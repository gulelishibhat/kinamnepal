import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin', 'seller']);
export const productStatusEnum = pgEnum('product_status', ['active', 'inactive', 'out_of_stock']);
export const productUnitEnum = pgEnum('product_unit', ['piece', 'meter', 'pack', 'set', 'roll', 'box']);
export const productConditionEnum = pgEnum('product_condition', ['brand_new', 'like_new', 'used']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment',
  'confirmed',
  'dispatched',
  'delivered',
  'cancelled',
  'payment_expired',
]);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'confirmed', 'failed', 'expired']);
export const paymentMethodEnum = pgEnum('payment_method', ['qr', 'esewa', 'khalti', 'cash']);

// ─── Customers ────────────────────────────────────────────────────────────────
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    language: varchar('language', { length: 5 }).notNull().default('en'),
    emailVerified: boolean('email_verified').notNull().default(false),
    verificationToken: varchar('verification_token', { length: 128 }),
    verificationSentAt: timestamp('verification_sent_at'),
    resetToken: varchar('reset_token', { length: 128 }),
    resetTokenExpires: timestamp('reset_token_expires'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('customers_email_idx').on(t.email),
  }),
);

// ─── Admins ───────────────────────────────────────────────────────────────────
export const admins = pgTable(
  'admins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('admins_email_idx').on(t.email),
  }),
);

// ─── Sellers (marketplace vendors) ──────────────────────────────────────────────
export const sellers = pgTable(
  'sellers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // ── Login ──
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    // ── Public profile (shown on the storefront) ──
    shopName: varchar('shop_name', { length: 120 }).notNull(),
    shopDescription: text('shop_description'),
    // ── Private profile (never exposed publicly — only seller + admin) ──
    ownerName: varchar('owner_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    addressStreet: varchar('address_street', { length: 255 }),
    addressCity: varchar('address_city', { length: 100 }),
    addressDistrict: varchar('address_district', { length: 100 }),
    // ── Status ──
    emailVerified: boolean('email_verified').notNull().default(false),
    verificationToken: varchar('verification_token', { length: 128 }),
    verificationSentAt: timestamp('verification_sent_at'),
    resetToken: varchar('reset_token', { length: 128 }),
    resetTokenExpires: timestamp('reset_token_expires'),
    isApproved: boolean('is_approved').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('sellers_email_idx').on(t.email),
  }),
);

// ─── Refresh tokens ────────────────────────────────────────────────────────────
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: varchar('token', { length: 512 }).notNull(),
    userId: uuid('user_id').notNull(),
    userRole: userRoleEnum('user_role').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revoked: boolean('revoked').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('refresh_tokens_token_idx').on(t.token),
    userIdx: index('refresh_tokens_user_idx').on(t.userId),
  }),
);

// ─── Customer addresses ────────────────────────────────────────────────────────
export const customerAddresses = pgTable('customer_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 50 }),
  street: varchar('street', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  district: varchar('district', { length: 100 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  nameNe: varchar('name_ne', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  // Self-reference: null = top-level category, else the parent's id (subcategory).
  parentId: uuid('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameEn: varchar('name_en', { length: 255 }).notNull(),
    nameNe: varchar('name_ne', { length: 255 }).notNull(),
    descriptionEn: text('description_en').notNull(),
    descriptionNe: text('description_ne').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    // Owning seller. Nullable so pre-marketplace products can be backfilled.
    sellerId: uuid('seller_id').references(() => sellers.id),
    brand: varchar('brand', { length: 100 }).notNull(),
    sku: varchar('sku', { length: 50 }).notNull().unique(),
    // `price` is the actual selling price the customer pays. When a product is
    // discounted, `mrp` holds the original (pre-discount) price and
    // `discountPercent` the percentage off (0 = no discount).
    price: decimal('price', { precision: 12, scale: 2 }).notNull(),
    mrp: decimal('mrp', { precision: 12, scale: 2 }),
    discountPercent: integer('discount_percent').notNull().default(0),
    unit: productUnitEnum('unit').notNull().default('piece'),
    stockQuantity: integer('stock_quantity').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    specifications: jsonb('specifications').notNull().default([]),
    // Optional size/colour variants with per-combo stock (lightweight).
    variants: jsonb('variants').notNull().default([]),
    condition: productConditionEnum('condition').notNull().default('brand_new'),
    status: productStatusEnum('status').notNull().default('active'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index('products_category_idx').on(t.categoryId),
    statusIdx: index('products_status_idx').on(t.status),
    skuIdx: uniqueIndex('products_sku_idx').on(t.sku),
    sellerIdx: index('products_seller_idx').on(t.sellerId),
  }),
);

// ─── Product images ────────────────────────────────────────────────────────────
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 1024 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: varchar('order_number', { length: 30 }).notNull().unique(),
    customerId: uuid('customer_id').references(() => customers.id),
    guestName: varchar('guest_name', { length: 100 }),
    guestPhone: varchar('guest_phone', { length: 20 }),
    guestEmail: varchar('guest_email', { length: 255 }),
    deliveryAddress: jsonb('delivery_address').notNull(),
    status: orderStatusEnum('status').notNull().default('pending_payment'),
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
    total: decimal('total', { precision: 12, scale: 2 }).notNull(),
    notes: text('notes'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    placedAt: timestamp('placed_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index('orders_customer_idx').on(t.customerId),
    statusIdx: index('orders_status_idx').on(t.status),
    placedAtIdx: index('orders_placed_at_idx').on(t.placedAt),
    orderNumberIdx: uniqueIndex('orders_order_number_idx').on(t.orderNumber),
  }),
);

// ─── Order items ───────────────────────────────────────────────────────────────
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    // Owning seller of this line (snapshot at order time). Nullable for legacy rows.
    sellerId: uuid('seller_id').references(() => sellers.id),
    productNameEn: varchar('product_name_en', { length: 255 }).notNull(),
    productNameNe: varchar('product_name_ne', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 50 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),
    productImage: varchar('product_image', { length: 1024 }),
  },
  (t) => ({
    orderIdx: index('order_items_order_idx').on(t.orderId),
    sellerIdx: index('order_items_seller_idx').on(t.sellerId),
  }),
);

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('qr'),
    status: paymentStatusEnum('status').notNull().default('pending'),
    transactionRef: varchar('transaction_ref', { length: 255 }),
    qrExpiresAt: timestamp('qr_expires_at'),
    confirmedAt: timestamp('confirmed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('payments_order_idx').on(t.orderId),
  }),
);

// ─── Order status history ──────────────────────────────────────────────────────
export const orderStatusHistory = pgTable('order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 50 }),
  toStatus: varchar('to_status', { length: 50 }).notNull(),
  changedBy: uuid('changed_by'),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
  note: text('note'),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(customerAddresses),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  seller: one(sellers, { fields: [products.sellerId], references: [sellers.id] }),
  images: many(productImages),
  orderItems: many(orderItems),
}));

export const sellersRelations = relations(sellers, ({ many }) => ({
  products: many(products),
  orderItems: many(orderItems),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
  payment: one(payments, { fields: [orders.id], references: [payments.orderId] }),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  seller: one(sellers, { fields: [orderItems.sellerId], references: [sellers.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

// Reverse relations — Drizzle needs both sides declared for relational queries.
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, { fields: [customerAddresses.customerId], references: [customers.id] }),
}));
