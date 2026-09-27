// Idempotent, self-healing seed for the category tree.
//
// Rules (per latest product decisions):
//   • There are 15 canonical TOP-LEVEL categories. "Mobile Phones" is MERGED
//     into "Electronics" (Electronics is the single tech category), so Mobile
//     Phones is NOT top-level — its phone types live under Electronics.
//   • Every top-level category gets 8–10 sample subcategories + an "Others".
//   • The script fully rebuilds the subcategory layer each run: it deletes all
//     existing subcategories (rows with a parent) and any stray duplicate
//     top-level rows, then recreates a clean tree. Top-level rows are matched
//     by their known IDs so real categories (and their ad references) survive.
//
// Run: APP_ENV=production DATABASE_URL=... tsx src/db/seed-subcategories.ts
import { eq, isNotNull, inArray } from 'drizzle-orm';
import { db, pool } from './index.js';
import { categories, products } from './schema.js';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Canonical top-level categories, matched by their real IDs in the live DB.
// Mobile Phones is intentionally absent here — it is folded into Electronics.
const TOP_LEVEL: Record<string, string> = {
  'Electronics': '28227cff-e6a5-432b-b329-c261ee0adc7d',
  'Electrical & Lighting': 'ae8ea185-77d6-49d2-81b4-27804b59c8eb',
  'Automobiles': '59c978d3-3d01-443d-8b00-de1e19a43385',
  'Real Estate': 'dd31fd70-4c52-4a05-89c8-3650805932ce',
  'Computers & Accessories': '2a46fa26-1849-4e7d-888e-d5ae00d2c61b',
  'Business & Industrial': '469b6ad6-b8af-4cb3-aa11-895d5e543809',
  'Home & Furniture': '87908854-2b1a-476d-a402-886a3c5f74de',
  'Bikes & Scooters': 'aeec08ba-bef4-4c80-b89f-024e8a67fb21',
  'Pets': '1bea1844-381f-41e6-8fe8-3cffcfd2e2b5',
  'Jobs': '18b185e8-8bf5-49c5-8a94-4c2527d50bcc',
  'Home Appliances': 'd565ea4e-2bce-493d-89c4-577e05fe7e8b',
  'Fashion & Beauty': '13d105f2-435c-43f0-96d0-8b66839760ff',
  'Books, Sports & Hobbies': '4679a613-3e66-4ef2-bb32-46a36fa5a2a2',
  'Services': '9214b41d-2744-48e2-9874-2077f50be084',
  'Others': '045b59e6-7c2f-44c1-8321-07dd53716405',
};

const CANONICAL_IDS = Object.values(TOP_LEVEL);

// The Mobile Phones top-level id — merged into Electronics as a subcategory.
const MOBILE_PHONES_ID = '36d145e2-20f8-4fcf-8263-f59c59fc90ac';

// Subcategories per top-level (8–10 each). "Others" is appended automatically.
// Electronics absorbs mobile-phone types since Mobile Phones is merged in.
const SUBCATEGORIES: Record<string, string[]> = {
  'Electronics': ['Mobile Phones', 'Tablets', 'Televisions', 'Cameras', 'Audio & Headphones', 'Smart Watches', 'Gaming Consoles', 'Drones', 'Chargers & Cables', 'Power Banks'],
  'Electrical & Lighting': ['Switches', 'Bulbs', 'Wires', 'Fancy Lights', 'Fan & Motor', 'MCB', 'Power Cable', 'Sockets & Plugs', 'Inverters & Batteries'],
  'Automobiles': ['Cars', 'Trucks & Vans', 'Spare Parts', 'Tyres & Wheels', 'Car Accessories', 'Car Audio', 'Oils & Fluids', 'Number Plates'],
  'Real Estate': ['Land', 'House for Sale', 'Apartments', 'Room for Rent', 'Commercial Space', 'Office Space', 'Shops for Rent', 'Guest House'],
  'Computers & Accessories': ['Laptops', 'Desktops', 'Monitors', 'Keyboards & Mice', 'Printers', 'Storage & Drives', 'Networking', 'Computer Parts', 'Software'],
  'Business & Industrial': ['Machinery', 'Office Equipment', 'Raw Materials', 'Tools', 'Restaurant Equipment', 'Packaging', 'Safety Equipment', 'Generators'],
  'Home & Furniture': ['Sofa & Chairs', 'Beds & Mattresses', 'Tables', 'Kitchenware', 'Home Decor', 'Curtains', 'Wardrobes', 'Lighting Fixtures'],
  'Bikes & Scooters': ['Motorcycles', 'Scooters', 'Electric Bikes', 'Bike Spare Parts', 'Helmets', 'Riding Gear', 'Bike Accessories', 'Bike Tyres'],
  'Pets': ['Dogs', 'Cats', 'Birds', 'Fish & Aquarium', 'Pet Food', 'Pet Accessories', 'Pet Cages', 'Grooming'],
  'Jobs': ['Full Time', 'Part Time', 'Internship', 'Remote', 'Freelance', 'Contract', 'Walk-in', 'Government'],
  'Home Appliances': ['Refrigerators', 'Washing Machines', 'Air Conditioners', 'Microwave Ovens', 'Water Heaters', 'Fans & Coolers', 'Vacuum Cleaners', 'Kitchen Appliances'],
  'Fashion & Beauty': ['Men Clothing', 'Women Clothing', 'Shoes', 'Watches', 'Bags', 'Jewellery', 'Cosmetics', 'Perfumes', 'Sunglasses'],
  'Books, Sports & Hobbies': ['Books', 'Sports Equipment', 'Musical Instruments', 'Bicycles', 'Board Games', 'Fitness Gear', 'Camping & Hiking', 'Collectibles'],
  'Services': ['Repair & Maintenance', 'Tuition & Classes', 'Event Services', 'Cleaning', 'Transport', 'Beauty & Spa', 'Legal & Financial', 'Photography'],
  'Others': [],
};

async function run() {
  console.log('Rebuilding category tree…');

  // 0) Safety: reassign any product currently pointing at a subcategory back
  //    to that subcategory's parent top-level, so deleting subs won't violate
  //    the products.category_id foreign key.
  const subRows = await db.query.categories.findMany({ where: isNotNull(categories.parentId) });
  for (const sub of subRows) {
    if (!sub.parentId) continue;
    const moved = await db.update(products).set({ categoryId: sub.parentId, updatedAt: new Date() })
      .where(eq(products.categoryId, sub.id)).returning({ id: products.id });
    if (moved.length) console.log(`  ~ Reassigned ${moved.length} product(s) from "${sub.nameEn}" to its parent`);
  }

  // 1) Delete ALL existing subcategories (any row that has a parent).
  //    This clears cruft from prior runs so we can rebuild deterministically.
  const delSubs = await db.delete(categories).where(isNotNull(categories.parentId)).returning({ id: categories.id });
  console.log(`  - Deleted ${delSubs.length} existing subcategories`);

  // 2) Delete stray top-level rows that are NOT canonical and NOT Mobile
  //    Phones (duplicate "Bikes & Scooters", promoted "Others", etc.).
  const keepTopIds = [...CANONICAL_IDS, MOBILE_PHONES_ID];
  const allTop = await db.query.categories.findMany();
  const strays = allTop.filter((c) => c.parentId === null && !keepTopIds.includes(c.id));
  if (strays.length) {
    await db.delete(categories).where(inArray(categories.id, strays.map((s) => s.id)));
    console.log(`  - Deleted ${strays.length} stray top-level rows: ${strays.map((s) => `${s.nameEn}(${s.slug})`).join(', ')}`);
  }

  // 3) Merge Mobile Phones INTO Electronics: delete the standalone Mobile
  //    Phones top-level (a "Mobile Phones" subcategory is created below).
  const mobile = await db.query.categories.findFirst({ where: eq(categories.id, MOBILE_PHONES_ID) });
  if (mobile) {
    const movedM = await db.update(products).set({ categoryId: TOP_LEVEL['Electronics']!, updatedAt: new Date() })
      .where(eq(products.categoryId, MOBILE_PHONES_ID)).returning({ id: products.id });
    if (movedM.length) console.log(`  ~ Reassigned ${movedM.length} product(s) from Mobile Phones to Electronics`);
    await db.delete(categories).where(eq(categories.id, MOBILE_PHONES_ID));
    console.log('  ~ Merged Mobile Phones into Electronics (removed standalone top-level)');
  }

  // 4) Recreate a clean subcategory layer under each canonical top-level.
  for (const [parentName, subs] of Object.entries(SUBCATEGORIES)) {
    const parentId = TOP_LEVEL[parentName]!;
    const parent = await db.query.categories.findFirst({ where: eq(categories.id, parentId) });
    if (!parent) { console.log(`  ! Top-level "${parentName}" (${parentId}) not found — skipping`); continue; }

    let order = 0;
    const names = [...subs, 'Others'];
    for (const name of names) {
      order += 1;
      const slug = `${slugify(parentName)}-${slugify(name)}`.slice(0, 100);
      await db.insert(categories).values({ nameEn: name, nameNe: name, slug, parentId, sortOrder: order });
      console.log(`  + ${parentName} → ${name}`);
    }
  }

  console.log('Done.');
}

run()
  .then(() => pool.end())
  .catch((e) => { console.error('Seed failed:', e); pool.end(); process.exit(1); });
