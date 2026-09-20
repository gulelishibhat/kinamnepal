/**
 * Sample product seed — loads realistic electric goods into the catalog so the
 * storefront has browsable items and you can place a test order.
 *
 * Run: APP_ENV=production pnpm --filter @mkelectric/api exec tsx src/db/seed-products.ts
 * (or locally with APP_ENV=local). Idempotent: skips products whose SKU exists.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
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

// A neutral placeholder image (works without S3). Swap for real uploads later.
function img(label: string): string {
  return `https://placehold.co/600x600/1d4ed8/ffffff/png?text=${encodeURIComponent(label)}`;
}

interface SampleProduct {
  categorySlug: string;
  nameEn: string;
  nameNe: string;
  descriptionEn: string;
  descriptionNe: string;
  brand: string;
  sku: string;
  price: string;
  unit: 'piece' | 'meter' | 'pack' | 'set' | 'roll' | 'box';
  stockQuantity: number;
  specifications: { key: string; value: string }[];
}

const PRODUCTS: SampleProduct[] = [
  {
    categorySlug: 'wiring-cables',
    nameEn: 'PVC Copper Wire 2.5mm² (90m Roll)',
    nameNe: 'PVC तामाको तार २.५mm² (९० मिटर रोल)',
    descriptionEn: 'Single-core FR PVC insulated copper wire, ideal for house wiring and power circuits.',
    descriptionNe: 'घर वायरिङ र पावर सर्किटका लागि उपयुक्त एकल-कोर FR PVC इन्सुलेटेड तामाको तार।',
    brand: 'CG',
    sku: 'WIRE-CU-25-90',
    price: '4200.00',
    unit: 'roll',
    stockQuantity: 40,
    specifications: [
      { key: 'Conductor', value: 'Copper' },
      { key: 'Cross-section', value: '2.5 mm²' },
      { key: 'Length', value: '90 m' },
      { key: 'Voltage', value: '1100 V' },
      { key: 'Insulation', value: 'FR PVC' },
    ],
  },
  {
    categorySlug: 'wiring-cables',
    nameEn: 'Flexible Cable 3-Core 1.5mm² (per meter)',
    nameNe: 'फ्लेक्सिबल केबल ३-कोर १.५mm² (प्रति मिटर)',
    descriptionEn: 'Multi-strand flexible 3-core cable for appliances and extension use.',
    descriptionNe: 'उपकरण र एक्सटेन्सनका लागि बहु-स्ट्र्यान्ड फ्लेक्सिबल ३-कोर केबल।',
    brand: 'Finolex',
    sku: 'CABLE-3C-15',
    price: '95.00',
    unit: 'meter',
    stockQuantity: 500,
    specifications: [
      { key: 'Cores', value: '3' },
      { key: 'Cross-section', value: '1.5 mm²' },
      { key: 'Conductor', value: 'Copper (flexible)' },
    ],
  },
  {
    categorySlug: 'switches-sockets',
    nameEn: 'Modular 1-Gang 1-Way Switch',
    nameNe: 'मोड्युलर १-ग्याङ १-वे स्विच',
    descriptionEn: '16A modular switch with smooth operation and durable finish.',
    descriptionNe: 'सहज सञ्चालन र टिकाउ फिनिस भएको १६A मोड्युलर स्विच।',
    brand: 'Legrand',
    sku: 'SW-1G-1W',
    price: '185.00',
    unit: 'piece',
    stockQuantity: 300,
    specifications: [
      { key: 'Rating', value: '16 A' },
      { key: 'Type', value: '1 Gang / 1 Way' },
      { key: 'Module', value: '1M' },
    ],
  },
  {
    categorySlug: 'switches-sockets',
    nameEn: '3-Pin Socket 16A with Shutter',
    nameNe: '३-पिन सकेट १६A सटर सहित',
    descriptionEn: 'Universal 3-pin socket with child-safety shutter, 16A rated.',
    descriptionNe: 'बाल-सुरक्षा सटर सहितको युनिभर्सल ३-पिन सकेट, १६A रेटेड।',
    brand: 'Havells',
    sku: 'SOCK-3P-16',
    price: '260.00',
    unit: 'piece',
    stockQuantity: 220,
    specifications: [
      { key: 'Rating', value: '16 A' },
      { key: 'Pins', value: '3' },
      { key: 'Safety', value: 'Shutter protected' },
    ],
  },
  {
    categorySlug: 'lighting',
    nameEn: 'LED Bulb 9W B22 Cool Daylight',
    nameNe: 'LED बल्ब ९W B22 कूल डेलाइट',
    descriptionEn: 'Energy-efficient 9W LED bulb, 6500K cool daylight, B22 base.',
    descriptionNe: 'ऊर्जा-कुशल ९W LED बल्ब, ६५००K कूल डेलाइट, B22 बेस।',
    brand: 'Philips',
    sku: 'LED-9W-B22',
    price: '210.00',
    unit: 'piece',
    stockQuantity: 400,
    specifications: [
      { key: 'Power', value: '9 W' },
      { key: 'Base', value: 'B22' },
      { key: 'Colour Temp', value: '6500K' },
      { key: 'Lumens', value: '900 lm' },
    ],
  },
  {
    categorySlug: 'lighting',
    nameEn: 'LED Panel Light 18W Square',
    nameNe: 'LED प्यानल लाइट १८W स्क्वायर',
    descriptionEn: 'Recessed 18W square LED ceiling panel for homes and offices.',
    descriptionNe: 'घर र कार्यालयका लागि रिसेस्ड १८W स्क्वायर LED सिलिङ प्यानल।',
    brand: 'Wipro',
    sku: 'PANEL-18W-SQ',
    price: '640.00',
    unit: 'piece',
    stockQuantity: 120,
    specifications: [
      { key: 'Power', value: '18 W' },
      { key: 'Shape', value: 'Square' },
      { key: 'Mounting', value: 'Recessed' },
    ],
  },
  {
    categorySlug: 'distribution-boards',
    nameEn: '8-Way SPN Distribution Board',
    nameNe: '८-वे SPN वितरण बोर्ड',
    descriptionEn: 'Single-phase 8-way DB with metal enclosure and DIN rail.',
    descriptionNe: 'मेटल एनक्लोजर र DIN रेल सहितको एकल-फेज ८-वे DB।',
    brand: 'Schneider',
    sku: 'DB-8W-SPN',
    price: '1850.00',
    unit: 'piece',
    stockQuantity: 60,
    specifications: [
      { key: 'Ways', value: '8' },
      { key: 'Phase', value: 'Single (SPN)' },
      { key: 'Enclosure', value: 'Metal' },
    ],
  },
  {
    categorySlug: 'distribution-boards',
    nameEn: 'MCB 32A Single Pole C-Curve',
    nameNe: 'MCB ३२A सिंगल पोल C-कर्भ',
    descriptionEn: '32A single-pole miniature circuit breaker, C-curve, 6kA.',
    descriptionNe: '३२A सिंगल-पोल मिनिएचर सर्किट ब्रेकर, C-कर्भ, ६kA।',
    brand: 'Schneider',
    sku: 'MCB-32A-SP',
    price: '420.00',
    unit: 'piece',
    stockQuantity: 180,
    specifications: [
      { key: 'Current', value: '32 A' },
      { key: 'Poles', value: '1 (SP)' },
      { key: 'Curve', value: 'C' },
      { key: 'Breaking Capacity', value: '6 kA' },
    ],
  },
  {
    categorySlug: 'conduits-fittings',
    nameEn: 'PVC Conduit Pipe 20mm (per meter)',
    nameNe: 'PVC कन्ड्युट पाइप २०mm (प्रति मिटर)',
    descriptionEn: 'Rigid PVC conduit pipe 20mm for concealed wiring.',
    descriptionNe: 'कन्सिल्ड वायरिङका लागि रिजिड PVC कन्ड्युट पाइप २०mm।',
    brand: 'Precision',
    sku: 'COND-PVC-20',
    price: '55.00',
    unit: 'meter',
    stockQuantity: 800,
    specifications: [
      { key: 'Diameter', value: '20 mm' },
      { key: 'Material', value: 'Rigid PVC' },
      { key: 'Use', value: 'Concealed wiring' },
    ],
  },
  {
    categorySlug: 'tools-accessories',
    nameEn: 'Insulated Screwdriver Set (6pc)',
    nameNe: 'इन्सुलेटेड स्क्रुड्राइभर सेट (६ वटा)',
    descriptionEn: '1000V insulated screwdriver set for electrical work, 6 pieces.',
    descriptionNe: 'विद्युतीय कामका लागि १०००V इन्सुलेटेड स्क्रुड्राइभर सेट, ६ वटा।',
    brand: 'Stanley',
    sku: 'TOOL-SD-6PC',
    price: '1250.00',
    unit: 'set',
    stockQuantity: 45,
    specifications: [
      { key: 'Pieces', value: '6' },
      { key: 'Insulation', value: '1000 V' },
      { key: 'Includes', value: 'Flat + Phillips' },
    ],
  },
  {
    categorySlug: 'tools-accessories',
    nameEn: 'Digital Multimeter',
    nameNe: 'डिजिटल मल्टिमिटर',
    descriptionEn: 'Auto-ranging digital multimeter for voltage, current and resistance.',
    descriptionNe: 'भोल्टेज, करेन्ट र रेजिस्ट्यान्सका लागि अटो-रेन्जिङ डिजिटल मल्टिमिटर।',
    brand: 'Fluke',
    sku: 'TOOL-DMM-01',
    price: '3400.00',
    unit: 'piece',
    stockQuantity: 25,
    specifications: [
      { key: 'Type', value: 'Auto-ranging' },
      { key: 'Measures', value: 'V / A / Ω' },
      { key: 'Display', value: 'Digital LCD' },
    ],
  },
];

async function seedProducts() {
  const pool = new Pool({
    connectionString: dbUrl,
    ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const db = drizzle(pool, { schema });

  // Map category slug -> id
  const cats = await db.query.categories.findMany();
  const bySlug = new Map(cats.map((c) => [c.slug, c.id]));

  let created = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const categoryId = bySlug.get(p.categorySlug);
    if (!categoryId) {
      console.log(`⚠️  Category not found for slug "${p.categorySlug}", skipping ${p.sku}`);
      continue;
    }

    const exists = await db.query.products.findFirst({
      where: (row, { eq }) => eq(row.sku, p.sku),
    });
    if (exists) {
      skipped++;
      continue;
    }

    const [product] = await db
      .insert(schema.products)
      .values({
        nameEn: p.nameEn,
        nameNe: p.nameNe,
        descriptionEn: p.descriptionEn,
        descriptionNe: p.descriptionNe,
        categoryId,
        brand: p.brand,
        sku: p.sku,
        price: p.price,
        unit: p.unit,
        stockQuantity: p.stockQuantity,
        specifications: p.specifications,
        status: 'active',
      })
      .returning();

    if (product) {
      await db.insert(schema.productImages).values({
        productId: product.id,
        url: img(p.brand),
        sortOrder: 0,
      });
      created++;
      console.log(`✅ ${p.sku} — ${p.nameEn}`);
    }
  }

  console.log(`\nProducts seed complete. Created: ${created}, Skipped (existing): ${skipped}`);
  await pool.end();
}

seedProducts().catch((err) => {
  console.error('Product seed failed:', err);
  process.exit(1);
});
