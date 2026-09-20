/**
 * Marketplace seed — HamroBazaar-style multi-vendor catalog.
 *  - Creates 3 sellers
 *  - Adds broad categories (Electronics, Mobiles, Automobiles, Real Estate, etc.)
 *  - Assigns any existing (electric) products across the 3 sellers
 *  - Adds broad sample listings with conditions, distributed across the sellers
 *  - Backfills order_items.sellerId from the product's seller
 *
 * Run: APP_ENV=production pnpm --filter @mkelectric/api exec tsx src/db/seed-marketplace.ts
 * Idempotent: skips sellers/categories/products that already exist (by email/slug/sku).
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { eq, isNull, sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '../../../..');
const appEnv = process.env['APP_ENV'] ?? 'local';
config({ path: resolve(rootDir, `.env.${appEnv}`) });
config({ path: resolve(rootDir, '.env') });

const { Pool } = pg;
const dbUrl = process.env['DATABASE_URL'] ?? '';
const isRemote = !/@(localhost|127\.0\.0\.1)/.test(dbUrl);

function img(label: string): string {
  return `https://placehold.co/600x600/e11d48/ffffff/png?text=${encodeURIComponent(label)}`;
}

type Condition = 'brand_new' | 'like_new' | 'used';
type Unit = 'piece' | 'meter' | 'pack' | 'set' | 'roll' | 'box';

// ── 3 sellers ──
const SELLERS = [
  {
    email: 'gadgetworld@example.com',
    password: 'Seller@12345',
    shopName: 'Gadget World',
    shopDescription: 'Phones, laptops and electronics. Member since 2015.',
    ownerName: 'Bishal Nepali',
    phone: '9801111111',
    addressCity: 'Kathmandu',
    addressDistrict: 'Kathmandu',
  },
  {
    email: 'autotraders@example.com',
    password: 'Seller@12345',
    shopName: 'Aurora Auto Traders',
    shopDescription: 'Quality used and new vehicles across Nepal.',
    ownerName: 'Sanjog Rimal',
    phone: '9802222222',
    addressCity: 'Lalitpur',
    addressDistrict: 'Lalitpur',
  },
  {
    email: 'homestore@example.com',
    password: 'Seller@12345',
    shopName: 'Home & Living Store',
    shopDescription: 'Furniture, appliances, real estate and more.',
    ownerName: 'Roshani Bajracharya',
    phone: '9803333333',
    addressCity: 'Bhaktapur',
    addressDistrict: 'Bhaktapur',
  },
];

// ── Broad HamroBazaar-style categories (with electrical kept prominent) ──
const CATEGORIES = [
  { nameEn: 'Electronics, TVs & More', nameNe: 'इलेक्ट्रोनिक्स, टिभी र थप', slug: 'electronics', sortOrder: 1 },
  { nameEn: 'Electrical & Lighting', nameNe: 'विद्युतीय र लाइटिङ', slug: 'electrical-lighting', sortOrder: 2 },
  { nameEn: 'Mobile Phones & Accessories', nameNe: 'मोबाइल फोन र सामान', slug: 'mobile-phones', sortOrder: 3 },
  { nameEn: 'Computers & Accessories', nameNe: 'कम्प्युटर र सामान', slug: 'computers', sortOrder: 4 },
  { nameEn: 'Automobiles', nameNe: 'सवारी साधन', slug: 'automobiles', sortOrder: 5 },
  { nameEn: 'Bikes & Scooters', nameNe: 'बाइक र स्कुटर', slug: 'bikes-scooters', sortOrder: 6 },
  { nameEn: 'Real Estate', nameNe: 'घरजग्गा', slug: 'real-estate', sortOrder: 7 },
  { nameEn: 'Home & Furniture', nameNe: 'घर र फर्निचर', slug: 'home-furniture', sortOrder: 8 },
  { nameEn: 'Home Appliances', nameNe: 'घरायसी उपकरण', slug: 'home-appliances', sortOrder: 9 },
  { nameEn: 'Business & Industrial', nameNe: 'व्यापार र औद्योगिक', slug: 'business-industrial', sortOrder: 10 },
  { nameEn: 'Fashion & Beauty', nameNe: 'फेसन र सौन्दर्य', slug: 'fashion-beauty', sortOrder: 11 },
  { nameEn: 'Pets & Animals', nameNe: 'पाल्तु जनावर', slug: 'pets', sortOrder: 12 },
  { nameEn: 'Books, Sports & Hobbies', nameNe: 'किताब, खेलकुद र रुचि', slug: 'books-sports-hobbies', sortOrder: 13 },
  { nameEn: 'Jobs', nameNe: 'रोजगारी', slug: 'jobs', sortOrder: 14 },
  { nameEn: 'Services', nameNe: 'सेवाहरू', slug: 'services', sortOrder: 15 },
  { nameEn: 'Others', nameNe: 'अन्य', slug: 'others', sortOrder: 16 },
];

// SKU prefixes of the original electric products → reclassify into Electrical & Lighting.
const ELECTRICAL_SKU_PREFIXES = ['WIRE-', 'CABLE-', 'SW-', 'SOCK-', 'LED-', 'PANEL-', 'DB-', 'MCB-', 'COND-', 'TOOL-'];

interface Listing {
  categorySlug: string;
  sellerIndex: number; // 0..2
  nameEn: string;
  descriptionEn: string;
  brand: string;
  sku: string;
  price: string;
  unit: Unit;
  stockQuantity: number;
  condition: Condition;
}

const LISTINGS: Listing[] = [
  // Gadget World (0) — mobiles + electronics
  { categorySlug: 'mobile-phones', sellerIndex: 0, nameEn: 'iPhone 15 Plus 256GB', descriptionEn: 'Excellent condition, 88% battery health, single hand used.', brand: 'Apple', sku: 'MOB-IP15P-256', price: '80000', unit: 'piece', stockQuantity: 3, condition: 'used' },
  { categorySlug: 'mobile-phones', sellerIndex: 0, nameEn: 'Samsung Galaxy S26 Ultra 256GB', descriptionEn: '100% original sealed pack, brand new, 1-year warranty.', brand: 'Samsung', sku: 'MOB-S26U-256', price: '152999', unit: 'piece', stockQuantity: 5, condition: 'brand_new' },
  { categorySlug: 'electronics', sellerIndex: 0, nameEn: 'MacBook Pro 14” M5 16GB 1TB (2025)', descriptionEn: 'Brand new, sealed. Latest M5 chip.', brand: 'Apple', sku: 'ELE-MBP14-M5', price: '335000', unit: 'piece', stockQuantity: 2, condition: 'brand_new' },
  { categorySlug: 'electronics', sellerIndex: 0, nameEn: 'Sony PlayStation 5 Slim Disc 1TB', descriptionEn: 'PS5 Slim Disc edition, brand new.', brand: 'Sony', sku: 'ELE-PS5-1TB', price: '135000', unit: 'piece', stockQuantity: 4, condition: 'brand_new' },
  { categorySlug: 'electronics', sellerIndex: 0, nameEn: 'i3 4th Gen Desktop Computer Set', descriptionEn: 'Complete desktop set, brand new, 1 year warranty.', brand: 'Assembled', sku: 'ELE-I3-DESK', price: '16500', unit: 'set', stockQuantity: 8, condition: 'brand_new' },

  // Aurora Auto Traders (1) — automobiles
  { categorySlug: 'automobiles', sellerIndex: 1, nameEn: 'Kia Sonet HTE 2022 First Hand', descriptionEn: 'First hand, like new condition, all tax paid.', brand: 'Kia', sku: 'AUTO-SONET-22', price: '3250000', unit: 'piece', stockQuantity: 1, condition: 'like_new' },
  { categorySlug: 'automobiles', sellerIndex: 1, nameEn: 'Hyundai Santro Sportz 2019', descriptionEn: 'Single hand, excellent condition.', brand: 'Hyundai', sku: 'AUTO-SANTRO-19', price: '2150000', unit: 'piece', stockQuantity: 1, condition: 'like_new' },
  { categorySlug: 'automobiles', sellerIndex: 1, nameEn: 'BYD Sealion 7 2025 EV', descriptionEn: 'Brand new electric SUV on sale.', brand: 'BYD', sku: 'AUTO-BYD-S7', price: '8000000', unit: 'piece', stockQuantity: 1, condition: 'brand_new' },
  { categorySlug: 'automobiles', sellerIndex: 1, nameEn: 'Suzuki Alto 800 2016', descriptionEn: 'With full insurance, well maintained.', brand: 'Suzuki', sku: 'AUTO-ALTO-16', price: '1250000', unit: 'piece', stockQuantity: 1, condition: 'used' },

  // Home & Living Store (2) — real estate, furniture, appliances, pets
  { categorySlug: 'real-estate', sellerIndex: 2, nameEn: 'Land for sale at Buddhanilkantha', descriptionEn: 'Prime location, road access, clean title.', brand: '—', sku: 'RE-LAND-BUDHA', price: '2400000', unit: 'piece', stockQuantity: 1, condition: 'brand_new' },
  { categorySlug: 'real-estate', sellerIndex: 2, nameEn: 'Flat on Rent — Kathmandu', descriptionEn: '2BHK flat, ground floor, water + parking.', brand: '—', sku: 'RE-FLAT-KTM', price: '12000', unit: 'piece', stockQuantity: 1, condition: 'brand_new' },
  { categorySlug: 'home-furniture', sellerIndex: 2, nameEn: 'Godrej 8kg Fully Automatic Washing Machine', descriptionEn: 'Brand new, energy efficient.', brand: 'Godrej', sku: 'HF-WASH-8KG', price: '29990', unit: 'piece', stockQuantity: 6, condition: 'brand_new' },
  { categorySlug: 'home-furniture', sellerIndex: 2, nameEn: 'Modular Kitchen Furniture Set', descriptionEn: 'Custom modular kitchen, design + install.', brand: 'Suhana', sku: 'HF-KITCHEN', price: '85000', unit: 'set', stockQuantity: 3, condition: 'brand_new' },
  { categorySlug: 'pets', sellerIndex: 2, nameEn: 'Labrador Female Puppies', descriptionEn: 'Healthy vaccinated puppies on sale.', brand: '—', sku: 'PET-LAB-PUP', price: '7500', unit: 'piece', stockQuantity: 4, condition: 'brand_new' },
];

async function main() {
  const pool = new Pool({ connectionString: dbUrl, ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}) });
  const db = drizzle(pool, { schema });

  // 1) Sellers
  const sellerIds: string[] = [];
  for (const s of SELLERS) {
    const existing = await db.query.sellers.findFirst({ where: eq(schema.sellers.email, s.email) });
    if (existing) {
      sellerIds.push(existing.id);
      console.log(`ℹ️  Seller exists: ${s.shopName}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(s.password, 12);
    const [row] = await db.insert(schema.sellers).values({
      email: s.email, passwordHash, shopName: s.shopName, shopDescription: s.shopDescription,
      ownerName: s.ownerName, phone: s.phone, addressCity: s.addressCity, addressDistrict: s.addressDistrict,
    }).returning();
    sellerIds.push(row!.id);
    console.log(`✅ Seller created: ${s.shopName} (${s.email})`);
  }

  // 2) Categories (broad set)
  const catBySlug = new Map<string, string>();
  for (const c of CATEGORIES) {
    const existing = await db.query.categories.findFirst({ where: eq(schema.categories.slug, c.slug) });
    if (existing) { catBySlug.set(c.slug, existing.id); continue; }
    const [row] = await db.insert(schema.categories).values(c).returning();
    catBySlug.set(c.slug, row!.id);
    console.log(`✅ Category: ${c.nameEn}`);
  }

  // 3) Assign any existing seller-less products across the 3 sellers (round-robin)
  const orphanProducts = await db.select({ id: schema.products.id }).from(schema.products).where(isNull(schema.products.sellerId));
  let i = 0;
  for (const p of orphanProducts) {
    const sid = sellerIds[i % sellerIds.length]!;
    await db.update(schema.products).set({ sellerId: sid }).where(eq(schema.products.id, p.id));
    i++;
  }
  if (orphanProducts.length) console.log(`✅ Assigned ${orphanProducts.length} existing product(s) to sellers`);

  // 3b) Reclassify original electric products into "Electrical & Lighting"
  const electricalCatId = catBySlug.get('electrical-lighting');
  if (electricalCatId) {
    const likeClauses = ELECTRICAL_SKU_PREFIXES.map((p) => sql`${schema.products.sku} LIKE ${p + '%'}`);
    const orClause = sql.join(likeClauses, sql` OR `);
    const res = await db
      .update(schema.products)
      .set({ categoryId: electricalCatId, condition: 'brand_new' })
      .where(sql`(${orClause})`);
    console.log(`✅ Reclassified electric products into Electrical & Lighting (${res.rowCount ?? 0} rows)`);
  }

  // 4) Broad listings
  let created = 0;
  for (const l of LISTINGS) {
    const exists = await db.query.products.findFirst({ where: eq(schema.products.sku, l.sku) });
    if (exists) continue;
    const categoryId = catBySlug.get(l.categorySlug);
    if (!categoryId) { console.log(`⚠️  missing category ${l.categorySlug}`); continue; }
    const [product] = await db.insert(schema.products).values({
      nameEn: l.nameEn, nameNe: l.nameEn, // NE reuse for sample data
      descriptionEn: l.descriptionEn, descriptionNe: l.descriptionEn,
      categoryId, sellerId: sellerIds[l.sellerIndex]!,
      brand: l.brand, sku: l.sku, price: l.price, unit: l.unit,
      stockQuantity: l.stockQuantity, condition: l.condition, status: 'active', specifications: [],
    }).returning();
    if (product) {
      await db.insert(schema.productImages).values({ productId: product.id, url: img(l.nameEn.split(' ')[0] ?? 'Item'), sortOrder: 0 });
      created++;
    }
  }
  console.log(`✅ Created ${created} broad listing(s)`);

  // 5) Backfill order_items.sellerId from the product's current seller
  const backfill = await db.execute(sql`
    UPDATE order_items oi
    SET seller_id = p.seller_id
    FROM products p
    WHERE oi.product_id = p.id AND oi.seller_id IS NULL AND p.seller_id IS NOT NULL
  `);
  console.log(`✅ Backfilled order_items.seller_id (${backfill.rowCount ?? 0} rows)`);

  console.log('\nMarketplace seed complete.');
  await pool.end();
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
