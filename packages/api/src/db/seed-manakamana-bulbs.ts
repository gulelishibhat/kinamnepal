// One-off (idempotent): rebuild Manakamana Electricals LED bulb inventory as
// GROUPED products — one product per brand+wattage — with selectable variants
// on two axes:
//   • size  = Holder / Base  (B22 or E27)
//   • color = Colour         (White [WH] or Warm White [WW])
// So a customer opens e.g. "LED Bulb himstar 3W" and picks Holder + Colour.
//
// Price is per-wattage (a single price per product, since the variant model has
// no per-variant price). We use the sheet's price for that wattage; where WH and
// WW differ slightly we take the lower (WH) price. Rows without any price become
// DRAFT products (price 0, status inactive) so the seller can edit them later.
// Stock = 1000 spread as 1000 per in-stock variant combo.
//
// This script DELETES all existing MNK-LED-* products first, then recreates the
// grouped set, so re-running always yields the same clean result.
//
// Run: APP_ENV=production DATABASE_URL=... tsx src/db/seed-manakamana-bulbs.ts
import { eq, and, like } from 'drizzle-orm';
import { db, pool } from './index.js';
import { products } from './schema.js';

const SELLER_ID = '2f9968ee-4557-4cf3-ba7d-cc2a85a56a82'; // Manakamana Electricals (ujjwal)
const BULBS_CAT_ID = '84307ed9-5e0e-4f07-9a1a-c283c8b90ac0'; // Electrical & Lighting → Bulbs
const STOCK_PER_VARIANT = 1000;

// Which base/colour combos exist + the price for a wattage. `price` null → draft.
interface Group {
  brand: string;
  wattLabel: string;     // e.g. "3W", "0.5W", "30W DURO"
  price: number | null;  // single product price (WH price when WH/WW differ)
  bases: string[];       // e.g. ['B22','E27']
  colours: string[];     // e.g. ['White','Warm White']
}

const WH = 'White';
const WW = 'Warm White';
const BOTH_COLOURS = [WH, WW];
const BOTH_BASES = ['B22', 'E27'];

const GROUPS: Group[] = [
  // ── himstar (priced) ──
  { brand: 'himstar', wattLabel: '0.5W', price: 63, bases: ['B22', 'E27'], colours: [WH] },
  { brand: 'himstar', wattLabel: '3W', price: 94.5, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '5W', price: 120.75, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '7W', price: 126, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '9W', price: 160.65, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '11W', price: 189, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '14W', price: 294, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '15W', price: 351.75, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '20W', price: 595.35, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '24W', price: 630, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '30W', price: 609, bases: ['E27'], colours: BOTH_COLOURS },
  // ── himstar (no price → draft) ──
  { brand: 'himstar', wattLabel: '26W', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '40W', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'himstar', wattLabel: '50W', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  // ── SURYA (no price → draft). NEO MAX D for ≤23W, DURO for ≥30W ──
  { brand: 'SURYA', wattLabel: '0.5W', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '5W NEO MAX D', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '7W NEO MAX D', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '10W NEO MAX D', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '12W NEO MAX D', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '15W NEO MAX D', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '18W NEO MAX D', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '23W NEO MAX D', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '30W DURO', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '40W DURO', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
  { brand: 'SURYA', wattLabel: '50W DURO', price: null, bases: BOTH_BASES, colours: BOTH_COLOURS },
];

function slug(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Extract the numeric wattage for the spec table (e.g. "30W DURO" → "30W").
function wattageOnly(label: string): string {
  const m = label.match(/(\d+(?:\.\d+)?)\s*W/i);
  return m ? `${m[1]}W` : label;
}

async function run() {
  console.log('Rebuilding Manakamana LED bulbs as grouped products with variants…');

  // 1) Retire all previous MNK-LED-* products for this seller. We SOFT-delete
  //    (isDeleted = true) rather than hard delete because an order_item may
  //    reference one (FK). We also rename their SKU (suffix -RETIRED-<n>) so the
  //    new grouped SKUs are free to reuse. Retired rows are hidden everywhere
  //    (all seller/storefront queries filter isDeleted = false).
  const old = await db.query.products.findMany({
    where: and(eq(products.sellerId, SELLER_ID), like(products.sku, 'MNK-LED-%'), eq(products.isDeleted, false)),
    columns: { id: true, sku: true },
  });
  let n = 0;
  for (const o of old) {
    // Keep within the 50-char SKU limit while guaranteeing uniqueness.
    const retiredSku = `${o.sku.slice(0, 36)}-RET-${(++n).toString().padStart(3, '0')}`.slice(0, 50);
    await db.update(products)
      .set({ isDeleted: true, status: 'inactive', sku: retiredSku, updatedAt: new Date() })
      .where(eq(products.id, o.id));
  }
  console.log(`  - Retired ${old.length} old individual bulb listings (soft-deleted, SKUs freed)`);

  // 2) Recreate one product per brand+wattage with Base × Colour variants.
  let active = 0;
  let draft = 0;
  for (const g of GROUPS) {
    const name = `LED Bulb ${g.brand} ${g.wattLabel}`.replace(/\s+/g, ' ').trim();
    const sku = `MNK-LED-${slug(g.brand)}-${slug(g.wattLabel)}`.slice(0, 50);

    // Build variants: every base × colour combo, each with its own stock.
    const variants = [];
    for (const base of g.bases) {
      for (const colour of g.colours) {
        variants.push({ size: base, color: colour, stock: STOCK_PER_VARIANT });
      }
    }
    const totalStock = variants.reduce((s, v) => s + v.stock, 0);

    const hasPrice = g.price != null && g.price > 0;
    const price = hasPrice ? String(g.price) : '0';
    const status: 'active' | 'inactive' = hasPrice ? 'active' : 'inactive';

    const specs = [
      { key: 'Wattage', value: wattageOnly(g.wattLabel) },
      { key: 'Holder / Base', value: g.bases.join(' or ') },
      { key: 'Colour', value: g.colours.map((c) => (c === WH ? 'White' : 'Warm White')).join(' or ') },
      { key: 'Type', value: 'LED Bulb' },
    ];
    const desc = `${name}. Energy-efficient LED bulb from ${g.brand}. Choose holder size (${g.bases.join('/')}) and colour (${g.colours.map((c) => (c === WH ? 'White' : 'Warm White')).join('/')}).`;

    await db.insert(products).values({
      nameEn: name,
      nameNe: name,
      descriptionEn: desc,
      descriptionNe: desc,
      categoryId: BULBS_CAT_ID,
      sellerId: SELLER_ID,
      brand: g.brand,
      sku,
      price,
      unit: 'piece',
      stockQuantity: totalStock,
      lowStockThreshold: 5,
      specifications: specs,
      variants,
      condition: 'brand_new',
      status,
    });

    if (hasPrice) { active++; console.log(`  + ${name}  Rs.${g.price}  variants=${variants.length}  [active]`); }
    else { draft++; console.log(`  + ${name}  (no price → draft)  variants=${variants.length}`); }
  }

  console.log(`\nActive products: ${active}`);
  console.log(`Draft products (no price — edit + activate later): ${draft}`);
  console.log(`Total grouped products: ${active + draft}`);
  console.log('Done.');
}

run().then(() => pool.end()).catch((e) => { console.error('Seed failed:', e); pool.end(); process.exit(1); });
