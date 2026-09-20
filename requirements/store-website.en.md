# MK Electric Shop — Store Website Requirements

**Version:** 1.0  
**Language:** English (en)  
**Last Updated:** September 15, 2026

---

## 1. Vision

MK Electric Shop is a modern, full-stack e-commerce platform purpose-built for a large-scale retail store specialising in **electrical goods for homes**. The platform provides a seamless, fast, and intuitive shopping experience for customers while giving the store owner and administrators powerful, real-time tools to manage inventory, orders, and customer relationships.

### 1.1 Core Value Proposition

| Value | Description |
|---|---|
| **Live Inventory** | Product listings are driven directly from the database, ensuring customers always see accurate stock levels and current pricing. |
| **Scalable Architecture** | The system is designed from day one to scale horizontally, supporting growth from a single store to a multi-branch or multi-vendor operation. |
| **Intuitive Admin Tools** | A clean, grid-based dashboard gives administrators full visibility and control without technical knowledge. |
| **Mobile-First UI** | All customer-facing interfaces are optimised for smartphones, the primary device of the target market. |
| **Multi-Language** | English and Nepali language support out of the box via `i18n`, removing friction for local customers. |
| **QR-Based Payments** | Frictionless checkout via QR code linked directly to the owner's bank account, removing the need for complex payment gateway setup in the MVP. |

### 1.2 Target Market

- Homeowners and contractors in Nepal purchasing electrical goods (wiring, switches, panels, lighting, cables, appliances, accessories).
- Walk-in and online customers of a large-format electrical retail store.
- Bulk buyers and contractors who need browsable inventory with pricing and specifications.

---

## 2. Service Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │  Customer Interface   │    │      Admin Interface          │  │
│  │  (Mobile + Desktop)  │    │  (Desktop-primary Dashboard) │  │
│  └──────────┬───────────┘    └──────────────┬───────────────┘  │
└─────────────┼────────────────────────────────┼──────────────────┘
              │  HTTPS / REST API + SSE         │
┌─────────────▼────────────────────────────────▼──────────────────┐
│                        SERVER SYSTEM                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐   │
│  │  Auth    │ │ Products │ │  Orders  │ │  Notifications  │   │
│  │ Service  │ │ Service  │ │ Service  │ │    Service      │   │
│  └──────────┘ └──────────┘ └──────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
              │                             │
┌─────────────▼─────────────────────────────▼─────────────────────┐
│                        DATA STORE                                │
│  ┌───────────────────┐          ┌────────────────────────────┐  │
│  │  Orders Database  │          │  Inventory / Products DB   │  │
│  │  - Orders         │          │  - Products                │  │
│  │  - Order Items    │          │  - Categories              │  │
│  │  - Payments       │          │  - Stock Levels            │  │
│  │  - Customers      │          │  - Images / Media          │  │
│  └───────────────────┘          └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────┐
│        EXTERNAL SERVICES         │
│  - Object Storage (Images/CDN)   │
│  - Email Provider                │
│  - Bank QR Payment               │
└──────────────────────────────────┘
```

### 2.1 Customer Interface
- Product browsing with search, category menu, and filters.
- Product detail pages with images, specifications, pricing, and stock status.
- Shopping cart management.
- Checkout with QR code payment.
- Order tracking (for logged-in customers).
- Guest checkout support.
- Language switcher (English / Nepali).

### 2.2 Admin Interface
- Secure login with JWT authentication.
- Real-time order monitoring dashboard via Server-Sent Events (SSE).
- Inventory management (CRUD for products, categories, stock).
- Customer list with clickable profiles and order history.
- Order management with status updates.
- Sales analytics and reports (Advanced).

### 2.3 Server System
- RESTful API built on a Node.js (or equivalent) backend.
- JWT-based authentication middleware.
- SSE endpoint for real-time admin notifications.
- Input validation and sanitisation at all endpoints.
- Role-based access control (Customer, Admin).
- Background jobs for email notifications and report generation.

### 2.4 Data Store
- **Orders Database:** orders, order_items, payments, order_status_history.
- **Inventory Database:** products, categories, product_images, stock_movements.
- **User Database:** customers, admins, sessions, addresses.
- Relational database (PostgreSQL recommended) with appropriate indexing.
- Migrations managed via a version-controlled migration tool.

---

## 3. Inventory List

### 3.1 Data Model
Each product in the inventory exposes the following information:

| Field | Description |
|---|---|
| `product_id` | Unique identifier (UUID) |
| `name` | Product name (bilingual: en / ne) |
| `category` | Category (e.g., Wiring, Switches, Lighting) |
| `brand` | Manufacturer / brand name |
| `description` | Detailed description (bilingual) |
| `images` | Array of image URLs (min 1, max 10) |
| `price` | Current selling price (NPR) |
| `unit` | Unit of sale (piece, meter, pack) |
| `specifications` | Key-value pairs (size, voltage, wattage, etc.) |
| `stock_quantity` | Current available stock count |
| `sku` | Stock Keeping Unit code |
| `status` | Active / Inactive / Out of Stock |
| `created_at` | Creation timestamp |
| `updated_at` | Last modified timestamp |

### 3.2 Inventory Display
- Products are fetched from the database at runtime; no static product lists.
- Pagination: 24 products per page (configurable).
- Sort options: Price (asc/desc), Newest, Best Match.
- Real-time stock count displayed on product cards.
- Out-of-stock items are visually distinguished but still browsable.

---

## 4. Scalable Architecture

- **Stateless API servers** behind a load balancer to allow horizontal scaling.
- **Database connection pooling** to handle concurrent requests efficiently.
- **CDN** for all static assets and product images.
- **Caching layer** (Redis or equivalent) for frequently accessed catalog data.
- **Async job queue** for email sending, report generation, and bulk operations.
- **Container-ready** deployment (Docker / Docker Compose for local; Kubernetes or ECS for production scale).
- **Environment separation:** development, staging, production with isolated configs.

---

## 5. Customer-Facing UI Requirements

### 5.1 Mobile UI (Smartphone-First)
- Responsive design with breakpoints: mobile (< 768 px), tablet (768–1024 px), desktop (> 1024 px).
- Touch-friendly tap targets (minimum 44 × 44 px).
- Bottom navigation bar on mobile for: Home, Categories, Cart, Orders, Profile.
- Swipeable product image gallery on product detail pages.
- Sticky "Add to Cart" / "Buy Now" button on product pages.
- Fast initial load: target < 3 seconds on a 4G connection.

### 5.2 Product Menu and Search
- Top-level navigation: Categories, Search, Cart, Language toggle.
- Category menu renders dynamically from the database (no hard-coded categories).
- Search bar with debounced full-text search (fires after 300 ms of inactivity).
- Search results display product name, thumbnail, price, and stock status.
- Filter panel (collapsible on mobile): Category, Price Range, Brand, Availability.

### 5.3 Product Detail Page
- Full-size image carousel with thumbnail strip.
- Product name, SKU, brand, price (NPR), stock quantity ("X units remaining").
- Available sizes / variants (e.g., cable lengths, switch types) shown as selectable options.
- Specifications table (voltage, wattage, dimensions, certifications).
- Quantity selector with stock limit enforcement.
- "Add to Cart" and "Buy Now" CTAs.
- Breadcrumb navigation (Home > Category > Product Name).

### 5.4 Cart Management
- Persistent cart: stored in localStorage for guests, synced to server for logged-in users.
- Cart icon with item count badge in the header/navigation.
- Cart page shows: product thumbnail, name, unit price, quantity stepper, line total, remove button.
- Real-time stock validation on quantity changes.
- Order summary: subtotal, any applicable fees, total (NPR).
- "Proceed to Checkout" CTA.
- Empty cart state with a CTA to browse products.

### 5.5 Multi-Language Support (i18n)
- Supported locales: `en` (English), `ne` (Nepali — Devanagari script).
- Library: `react-i18next` (frontend), `i18next` (server-side if SSR).
- Language switcher visible in the header on all pages.
- All UI labels, error messages, notifications, and email templates must have both locale keys.
- Locale files stored at: `src/locales/en/translation.json` and `src/locales/ne/translation.json`.
- Language preference persisted in `localStorage` for guests and in user profile for registered customers.
- Product names and descriptions stored bilingually in the database; served based on active locale.

---

## 6. Admin Interface Requirements

### 6.1 Authentication and Session Management
- Admin login via email + password.
- JWT access token (1-hour expiry) + refresh token (16-hour expiry) stored in HttpOnly cookies.
- Auto-logout triggered after 16 hours; user is redirected to login with a session-expired message.
- Secure password storage using **bcrypt** (min cost factor 12).
- Failed login attempts are rate-limited (max 5 per 15 minutes per IP).

### 6.2 Dashboard Layout
- **Grid-based dashboard** with summary cards:
  - Today's orders (count + total revenue)
  - Pending orders
  - Low-stock alerts
  - New customers
- Recent orders list (last 20) with inline status indicators.
- Quick-access navigation: Orders, Inventory, Customers, Reports, Settings.

### 6.3 Real-Time Order Monitoring
- New orders appear on the dashboard in real time via **Server-Sent Events (SSE)**.
- Each incoming order triggers a visual notification (badge + toast) and an audio ping (optional, configurable).
- SSE connection status indicator in the admin header (connected / reconnecting).

### 6.4 Order Management
- Full order list with filters: status (Pending, Confirmed, Dispatched, Delivered, Cancelled), date range, customer name.
- **Stripe-style layout:** clickable list rows — each row expands or navigates to an order detail view.
- Order detail view shows:
  - Auto-generated **order number** (e.g., `MKE-2026-000123`)
  - Customer profile (name, phone, address, email) with a link to the full customer profile.
  - Ordered items (product name, SKU, quantity, unit price, line total).
  - Payment status and QR confirmation.
  - Order status history timeline.
  - Action buttons: Confirm, Dispatch, Mark Delivered, Cancel.
- Order deletion is supported with a confirmation prompt (soft delete / audit trail preserved).

### 6.5 Customer Management
- Customer list with columns: Name, Phone, Email, Total Orders, Last Order Date, Registration Date.
- Clickable rows open the customer profile with:
  - Contact information.
  - Full order history with links to each order.
  - Communication log (admin notes).

### 6.6 Inventory Management (Admin)
- Product list with inline stock count and status badge.
- Create / Edit / Archive products via a structured form.
- Bulk CSV import/export for inventory updates.
- Low-stock threshold setting per product; triggers a dashboard alert when breached.
- Image upload with drag-and-drop support (up to 10 images per product).
- Category management (create, rename, reorder, delete).

---

## 7. MVP Development Priority

### Phase 1 — Core MVP

| Priority | Feature |
|---|---|
| P0 | Product catalog with database-driven inventory |
| P0 | Customer browsing (mobile-first, responsive) |
| P0 | Shopping cart |
| P0 | Guest and registered customer checkout |
| P0 | QR code payment flow |
| P0 | Order placement and confirmation email |
| P0 | Admin login with JWT + bcrypt |
| P0 | Admin order dashboard (grid layout + SSE real-time) |
| P0 | Admin order management (list, detail, status update) |
| P1 | Multi-language support (English + Nepali via i18n) |
| P1 | Customer registration and login |
| P1 | Admin inventory CRUD |
| P1 | Customer order history |
| P1 | Low-stock alerts in admin dashboard |

### Phase 2 — Post-MVP Enhancements

| Priority | Feature |
|---|---|
| P2 | Advanced search and filtering |
| P2 | Admin customer management with profiles |
| P2 | Bulk CSV import/export for inventory |
| P2 | Sales analytics and reports |
| P2 | Email notification templates (bilingual) |
| P2 | Audit log for admin actions |

---

## 8. Advanced Features (Post-MVP)

### 8.1 Inventory Intelligence
- Auto-reorder suggestions based on sales velocity.
- Stock movement history per product.
- Supplier management module.

### 8.2 Analytics and Reporting
- Sales dashboard: revenue by day/week/month, top-selling products, category performance.
- Inventory reports: turnover rate, dead stock, low-stock trends.
- Customer insights: repeat purchase rate, average order value, geographic distribution.
- Exportable reports in CSV and PDF.

### 8.3 Notification System
- Push notification support for mobile (PWA or native app).
- SMS notifications for order status updates (via SMS gateway, e.g., Sparrow SMS for Nepal).
- In-app notification centre for customers.

### 8.4 Payment System Integration
- eSewa API integration.
- Khalti API integration.
- Dynamic QR generation via bank API.
- Automatic payment reconciliation.

---

## 9. Future Expansion

### 9.1 Mid-Term (6–18 Months)
- Progressive Web App (PWA) with offline browsing capability.
- Loyalty / reward points system.
- Product reviews and ratings.
- Promotional codes and discount engine.
- Multi-branch inventory management.

### 9.2 Long-Term (18+ Months)
- Native mobile applications (iOS and Android).
- Multi-vendor / marketplace mode.
- B2B portal for bulk buyers and contractors with quote requests.
- ERP integration (accounting, procurement).
- AI-powered product recommendations and demand forecasting.
- Delivery tracking integration with local courier services.

---

## 10. References

- [React i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
- [JWT Best Practices (RFC 8725)](https://www.rfc-editor.org/rfc/rfc8725)
- [bcrypt — Password Hashing](https://www.npmjs.com/package/bcrypt)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [WCAG 2.1 Accessibility Guidelines](https://www.w3.org/TR/WCAG21/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [eSewa Payment Gateway](https://developer.esewa.com.np/)
- [Khalti Payment Gateway](https://docs.khalti.com/)

---

*End of Store Website Requirements Document*
