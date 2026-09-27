// One-off (idempotent): LISHO modular switches as GROUPED products with
// per-variant pricing (B2). Products are grouped by Finish + Series; the
// customer selects the specification (variant), and the price updates to that
// variant's price.
//
//   • variant.size  = the spec label (e.g. "1M 10A 1 Way Switch (7000)")
//   • variant.price = selling price (the 20%-off price)
//   • variant.mrp   = cost price (original) — drives the strike-through
//   • variant.stock = 500
//
// The product's base `price` is the cheapest variant (used as the "from"
// price); product `mrp`/`discountPercent` are left at the cheapest variant's
// values for list cards. This script retires the old per-line MNK-SW-* rows
// (soft-delete + SKU rename) and rebuilds the grouped set.
//
// Run: APP_ENV=production DATABASE_URL=... tsx src/db/seed-lisho-switches.ts
import { eq, and, like } from 'drizzle-orm';
import { db, pool } from './index.js';
import { products } from './schema.js';

const SELLER_ID = '2f9968ee-4557-4cf3-ba7d-cc2a85a56a82'; // Manakamana Electricals
const SWITCHES_CAT_ID = 'af167631-c31a-4b24-bec8-bb32189b621d'; // Electrical & Lighting → Switches
const BRAND = 'LISHO';
const STOCK = 500;

interface Spec { spec: string; cost: number | null; selling: number | null; }
interface Group { finish: string; series: string; specs: Spec[]; }

// Grouped: finish + series → list of spec variants.
const GROUPS: Group[] = [
  {
    finish: 'Classic White', series: 'SLiMZ', specs: [
      { spec: '1M Bell Push Switch (7402)', cost: 482, selling: 385.6 },
      { spec: 'Bell Push Switch 10A 2 Way (7402)', cost: 730, selling: 584 },
      { spec: '20A 1 Way Switch (7407)', cost: 594, selling: 475.2 },
      { spec: '20A 1 Way Switch with Indicator (7408)', cost: 666, selling: 532.8 },
      { spec: '2M 32A D.P. Switch with Indicator (7410)', cost: 1100, selling: 880 },
    ],
  },
  {
    finish: 'Classic White', series: 'S7', specs: [
      { spec: '1M 10A 1 Way Switch (7000)', cost: 164, selling: 131.2 },
      { spec: '1M Bell Push Switch (7002)', cost: 427, selling: 341.6 },
      { spec: '2M Bell Push Switch (7004)', cost: 624, selling: 499.2 },
      { spec: '1M 20A 1 Way Switch (7007)', cost: 396, selling: 316.8 },
      { spec: '1M 20A 1 Way Switch with Indicator (7008)', cost: 498, selling: 398.4 },
      { spec: '1M 20A 2 Way Switch (7009)', cost: 590, selling: 472 },
      { spec: '2M 32A D.P Switch with Indicator (7010)', cost: 1040, selling: 832 },
    ],
  },
  {
    finish: 'Classic White', series: 'Zen', specs: [
      { spec: '1M 10A 1 Way Switch (9000)', cost: 178, selling: 142.4 },
      { spec: '1M 10A 1 Way Switch (9001)', cost: 450, selling: 360 },
      { spec: '1M Bell Push Switch (9002)', cost: 442, selling: 353.6 },
      { spec: '1M Bell Push Switch with Indicator (9003)', cost: 501, selling: 400.8 },
      { spec: '1M 10A 2 Way Switch (9006)', cost: 411, selling: 328.8 },
      { spec: '1M 20A 1 Way Switch (9007)', cost: 520, selling: 416 },
      { spec: '1M 20A 1 Way Switch with Indicator (9008)', cost: 632, selling: 505.6 },
      { spec: '1M 20A 2 Way Switch (9009)', cost: 632, selling: 505.6 },
      { spec: '2M 32A D.P. Switch with Indicator (9010)', cost: 1090, selling: 872 },
    ],
  },
  {
    finish: 'Classic White', series: 'Socket', specs: [
      { spec: '1M 6A 2 Pin Socket with Shutter (7012)', cost: 347, selling: 277.6 },
      { spec: '2M 16A 2In1 Socket with Safety (7015/7048)', cost: 726, selling: 580.8 },
      { spec: '2M 6A Mobile Charger Socket (7014)', cost: 480, selling: 384 },
      { spec: '2M 13A World Pin Socket (7013)', cost: 703, selling: 562.4 },
    ],
  },
  {
    finish: 'Classic White', series: 'Dimmer & Regulator', specs: [
      { spec: '1M Dimmer 300W (7017)', cost: 971, selling: 776.8 },
      { spec: '2M Dimmer 300W (7018)', cost: 1506, selling: 1204.8 },
      { spec: '2M Premium Dimmer with Chrome (7038)', cost: 1506, selling: 1204.8 },
      { spec: '2M 5/8 Step Regulator with Chrome Border (7418)', cost: 1506, selling: 1204.8 },
      { spec: '1M Dimmer with Chrome Border (7417)', cost: 971, selling: 776.8 },
      { spec: '2M Dimmer with Chrome Border (7418)', cost: 1450, selling: 1160 },
    ],
  },
  {
    finish: 'Classic White', series: 'Accessories', specs: [
      { spec: '1M Red Indicator with LED (7021)', cost: 357, selling: 285.6 },
      { spec: '1M TV Antenna Socket Coaxial (7023)', cost: 427, selling: 341.6 },
      { spec: '1M USB Charger Socket A+C Type 20W', cost: 3221, selling: 2576.8 },
      { spec: '1M Blank Plate (7025)', cost: 99, selling: 79.2 },
      { spec: '2M Buzzer (7026)', cost: 1189, selling: 951.2 },
      { spec: '1M 2 Line Jack RJ-11 with Shutter', cost: 451, selling: 360.8 },
      { spec: 'EPD Socket Outlet RJ-45 Cat-6 with Shutter', cost: null, selling: null },
    ],
  },
  {
    finish: 'Graphite Grey / Matt Black', series: 'SLiMZ', specs: [
      { spec: '1M 10A 1 Way Switch (7400)', cost: 264, selling: 211.2 },
      { spec: '1M Bell Push Switch (7402)', cost: 532, selling: 425.6 },
      { spec: '2M Bell Push Switch (7404)', cost: 840, selling: 672 },
      { spec: '1M 10A 2 Way Switch (7407)', cost: 493, selling: 394.4 },
      { spec: '1M 20A 1 Way Switch (7407b)', cost: 665, selling: 532 },
      { spec: '1M 20A 1 Way Switch with Indicator (7408)', cost: 745, selling: 596 },
      { spec: '2M 32A D.P. Switch with Indicator (7410)', cost: 1300, selling: 1040 },
    ],
  },
  {
    finish: 'Graphite Grey / Matt Black', series: 'S7', specs: [
      { spec: '1M 10A 1 Way Switch (7000)', cost: 196, selling: 156.8 },
      { spec: '1M Bell Push Switch (7002)', cost: 470, selling: 376 },
      { spec: '2M Bell Push Switch (7404)', cost: 744, selling: 595.2 },
      { spec: '1M 10A 2 Way Switch (7006)', cost: 436, selling: 348.8 },
      { spec: '1M 20A 1 Way Switch (7007)', cost: 551, selling: 440.8 },
      { spec: '1M 20A 1 Way Switch (7008)', cost: 659, selling: 527.2 },
      { spec: '1M 20A 2 Way Switch (7009)', cost: 659, selling: 527.2 },
      { spec: '2M 32A D.P. Switch with Indicator (7010)', cost: 1150, selling: 920 },
    ],
  },
  {
    finish: 'Graphite Grey / Matt Black', series: 'Zen', specs: [
      { spec: '1M 10A 1 Way Switch (9000)', cost: 210, selling: 168 },
      { spec: '1M 10A 1 Way Switch with Indicator (9001)', cost: 490, selling: 392 },
      { spec: '1M Bell Push Switch (9002)', cost: 485, selling: 388 },
      { spec: '1M Bell Push Switch with Indicator (9003)', cost: 550, selling: 440 },
      { spec: '1M 10A 2 Way Switch (9006)', cost: 451, selling: 360.8 },
      { spec: '1M 20A 1 Way Switch (9007)', cost: 595, selling: 476 },
      { spec: '1M 20A 1 Way Switch with Indicator (9008)', cost: 701, selling: 560.8 },
      { spec: '1M 20A 2 Way Switch (9009)', cost: 701, selling: 560.8 },
      { spec: '2M 32A D.P. Switch with Indicator (9010)', cost: 1215, selling: 972 },
    ],
  },
  {
    finish: 'Graphite Grey / Matt Black', series: 'Socket', specs: [
      { spec: '1M 6A 2 Pin Socket with Shutter (7012)', cost: 396, selling: 316.8 },
      { spec: '2M 16A 2In1 Socket with Safety (7015/7048)', cost: 800, selling: 640 },
      { spec: '2M 6A Mobile Charger Socket (7014)', cost: 535, selling: 428 },
      { spec: '2M 13A World Pin Socket (7013)', cost: 773, selling: 618.4 },
    ],
  },
  {
    finish: 'Graphite Grey / Matt Black', series: 'Dimmer', specs: [
      { spec: '1M Dimmer 300W (7017)', cost: 1040, selling: 832 },
      { spec: '2M Dimmer 300W (7018)', cost: 1705, selling: 1364 },
      { spec: '2M Premium Dimmer with Chrome (7038)', cost: null, selling: null },
    ],
  },
];

function slug(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function run() {
  console.log('Rebuilding LISHO switches as grouped products with priced variants…');

  // 1) Retire old per-line MNK-SW-* products (soft-delete + free SKU).
  const old = await db.query.products.findMany({
    where: and(eq(products.sellerId, SELLER_ID), like(products.sku, 'MNK-SW-%'), eq(products.isDeleted, false)),
    columns: { id: true, sku: true },
  });
  let n = 0;
  for (const o of old) {
    const retiredSku = `${o.sku.slice(0, 36)}-RET-${(++n).toString().padStart(3, '0')}`.slice(0, 50);
    await db.update(products)
      .set({ isDeleted: true, status: 'inactive', sku: retiredSku, updatedAt: new Date() })
      .where(eq(products.id, o.id));
  }
  console.log(`  - Retired ${old.length} old per-line switch products`);

  // 2) Create one grouped product per finish + series.
  let created = 0, updated = 0;
  for (const g of GROUPS) {
    const name = `LISHO ${g.finish} ${g.series} Modular Switch`.replace(/\s+/g, ' ').trim();
    const sku = `MNKG-SW-${slug(g.finish)}-${slug(g.series)}`.slice(0, 50);

    // Build priced variants; only include specs that have a selling price.
    const variants = g.specs
      .filter((s) => s.selling != null && s.selling > 0)
      .map((s) => ({
        size: s.spec,
        color: '',
        label: s.spec,
        stock: STOCK,
        price: s.selling as number,
        mrp: s.cost != null && s.cost > 0 ? s.cost : undefined,
      }));

    if (variants.length === 0) { console.log(`  ! ${name} — no priced specs, skipped`); continue; }

    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const cheapest = variants.reduce((min, v) => (v.price < min.price ? v : min), variants[0]!);

    const specs = [
      { key: 'Brand', value: 'LISHO' },
      { key: 'Finish', value: g.finish },
      { key: 'Series', value: g.series },
      { key: 'Type', value: 'Modular Switch' },
      { key: 'Options', value: `${variants.length} specifications` },
    ];
    const desc = `LISHO ${g.finish} ${g.series} modular switches. Select your specification below — each option is priced individually with 20% off. Genuine LISHO, 500 in stock per option.`;

    const existing = await db.query.products.findFirst({ where: eq(products.sku, sku) });
    if (existing) {
      await db.update(products).set({
        nameEn: name, nameNe: name, descriptionEn: desc, descriptionNe: desc,
        categoryId: SWITCHES_CAT_ID, sellerId: SELLER_ID, brand: BRAND,
        price: String(cheapest.price), mrp: cheapest.mrp != null ? String(cheapest.mrp) : null,
        discountPercent: cheapest.mrp != null ? Math.round(((cheapest.mrp - cheapest.price) / cheapest.mrp) * 100) : 0,
        unit: 'piece', stockQuantity: totalStock, specifications: specs, variants,
        status: 'active', isDeleted: false, updatedAt: new Date(),
      }).where(eq(products.id, existing.id));
      updated++;
      console.log(`  ~ Updated ${name} (${variants.length} specs)`);
      continue;
    }

    await db.insert(products).values({
      nameEn: name, nameNe: name, descriptionEn: desc, descriptionNe: desc,
      categoryId: SWITCHES_CAT_ID, sellerId: SELLER_ID, brand: BRAND, sku,
      price: String(cheapest.price), mrp: cheapest.mrp != null ? String(cheapest.mrp) : null,
      discountPercent: cheapest.mrp != null ? Math.round(((cheapest.mrp - cheapest.price) / cheapest.mrp) * 100) : 0,
      unit: 'piece', stockQuantity: totalStock, lowStockThreshold: 5,
      specifications: specs, variants, condition: 'brand_new', status: 'active',
    });
    created++;
    console.log(`  + ${name} (${variants.length} specs, from Rs.${cheapest.price})`);
  }

  console.log(`\nCreated: ${created}, Updated: ${updated}, Groups: ${GROUPS.length}`);
  console.log('Done.');
}

run().then(() => pool.end()).catch((e) => { console.error('Seed failed:', e); pool.end(); process.exit(1); });
