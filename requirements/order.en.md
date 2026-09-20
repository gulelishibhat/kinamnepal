# MK Electric Shop — Order Requirements

**Version:** 1.0  
**Language:** English (en)  
**Last Updated:** September 15, 2026

---

## 1. Overview

This document defines the complete requirements for the order lifecycle in MK Electric Shop — from the moment a customer adds a product to their cart through payment, fulfilment, and post-order communication. The order system is the commercial core of the platform and must be reliable, auditable, and user-friendly.

---

## 2. Order Lifecycle

```
[Browse Catalog]
      │
      ▼
[Add to Cart]
      │
      ▼
[Review Cart] ──► [Update Quantities / Remove Items]
      │
      ▼
[Checkout]
      │
  ┌───┴────────────────────┐
  │                        │
[Guest Checkout]    [Login / Register]
  │                        │
  └──────────┬─────────────┘
             │
             ▼
    [Enter Delivery Info]
             │
             ▼
    [Review Order Summary]
             │
             ▼
    [QR Code Payment Screen]
             │
      ┌──────┴──────┐
      │             │
  [Payment     [Payment
  Confirmed]   Pending /
      │         Failed]
      │             │
      ▼             ▼
[Order Placed]  [Retry / Cancel]
      │
      ▼
[Order Confirmation Email Sent]
      │
      ▼
[Admin Receives Real-Time Notification]
      │
      ▼
[Admin: Confirm → Dispatch → Deliver]
      │
      ▼
[Customer: Status Update Emails]
      │
      ▼
[Order Complete]
```

---

## 3. Customer Order Flow

### 3.1 Authentication at Checkout

Customers have two paths to place an order:

#### Registered Customer (Login)
- Customer logs in with email + password before or during checkout.
- Order is associated with their account.
- Delivery address can be pre-filled from saved addresses.
- Order history is accessible in the customer profile.

#### Guest Checkout
- Customer proceeds without creating an account.
- Required fields: full name, phone number, delivery address.
- An optional prompt to register after order placement is shown.
- Guest orders are stored server-side with a unique order token for tracking.
- Guest customers cannot view past orders without registering.

### 3.2 Delivery Information
- Required: Full name, phone number, delivery address (Street, City, District).
- Optional: Email address (for order confirmation email).
- Address validation: all required fields must be non-empty; phone must match a valid Nepali mobile format.
- Registered customers can select from saved addresses or add a new one.

### 3.3 Order Summary Review
- Before payment, the customer sees a final summary:
  - List of items (thumbnail, name, quantity, unit price, line total).
  - Subtotal (NPR).
  - Delivery information.
  - Total amount (NPR).
- "Edit Cart" link to return and modify the cart.
- "Confirm and Pay" CTA proceeds to the QR payment screen.

---

## 4. QR Code Payment

### 4.1 Payment Screen
- A dynamically generated QR code is displayed with:
  - The exact order total pre-filled (where the payment provider supports dynamic QR).
  - The store's bank account / payment wallet details as a fallback.
  - The unique order reference number for manual verification.
- A countdown timer (15 minutes) indicates how long the QR session remains valid.
- Instructions for payment are displayed in the customer's selected language (English / Nepali).

### 4.2 Supported Payment Methods (MVP)
- **Static QR code** linked to the owner's bank account (eSewa, Khalti, or direct bank QR).
- Customer scans with their mobile banking or wallet app and enters the exact amount.

### 4.3 Payment Confirmation
- Payment confirmation is **manual** in the MVP (admin marks payment as received) or via webhook if the payment provider supports it.
- Until payment is confirmed, order status is **Pending Payment**.
- Upon confirmation, order status transitions to **Confirmed**.
- If the QR session expires without payment, order status is set to **Payment Expired** and the customer is prompted to retry.

### 4.4 Payment Record
Each payment attempt is recorded with:
- `payment_id` (UUID)
- `order_id`
- `amount` (NPR)
- `payment_method` (QR / eSewa / Khalti)
- `status` (Pending / Confirmed / Failed / Expired)
- `transaction_reference` (provided by the customer or captured via webhook)
- `confirmed_at` timestamp
- `created_at` timestamp

---

## 5. Order Success Flow

### 5.1 Immediate Actions on Order Placement
1. Order record is written to the database with status `Pending Payment`.
2. Cart is cleared (server-side for logged-in users; localStorage cleared for guests).
3. Customer is redirected to the Order Success page.
4. Order confirmation email is sent to the customer (if email was provided).
5. Admin receives a real-time SSE notification of the new order.

### 5.2 Order Success Page
- Displays:
  - Order number (e.g., `MKE-2026-000123`).
  - Summary of items ordered.
  - Delivery details.
  - Payment status (Pending / Confirmed).
  - "Continue Shopping" and "View Order" (logged-in users only) CTAs.
- For guests: prompt to create an account to track the order.

### 5.3 Order Number Generation
- Format: `MKE-YYYY-NNNNNN` (e.g., `MKE-2026-000123`).
- Sequential and zero-padded to 6 digits within the year.
- Generated server-side at the moment of order creation; never on the client.
- Unique constraint enforced at the database level.

---

## 6. Cart Management

### 6.1 Cart Storage
| User Type | Cart Storage |
|---|---|
| Guest | `localStorage` (browser) |
| Registered (not logged in) | `localStorage` |
| Registered (logged in) | Server-side cart (synced to DB) |

- On login, guest cart items are merged with any existing server-side cart items.
- On logout, server cart is preserved; localStorage cart is cleared.

### 6.2 Cart Operations
- **Add to cart:** adds a product with a specified quantity. If the product already exists, quantity is incremented.
- **Update quantity:** quantity stepper with min = 1, max = available stock.
- **Remove item:** removes a single product from the cart.
- **Clear cart:** removes all items (triggered automatically on successful order placement).

### 6.3 Cart Validation
- On every cart operation and at checkout, stock availability is validated server-side.
- If a product becomes out of stock after being added to the cart, the customer is notified and the item is flagged in the cart view.
- Price is validated at checkout against the current database price; any price change since add-to-cart is surfaced to the customer before confirmation.

### 6.4 Cart UI
- Cart icon with item count badge visible in the header/navigation at all times.
- Cart drawer (slide-in panel on mobile) or dedicated Cart page.
- Each cart row shows: product thumbnail, name, unit price, quantity stepper, line total, remove (×) button.
- Order summary panel: subtotal, note about delivery fee (if applicable), total in NPR.
- "Proceed to Checkout" button is disabled if the cart is empty.

---

## 7. Order Data Management

### 7.1 Order Schema

```
orders
───────────────────────────────────────────────
order_id          UUID (PK)
order_number      VARCHAR (unique, e.g. MKE-2026-000123)
customer_id       UUID (FK → customers, nullable for guests)
guest_name        VARCHAR (for guest orders)
guest_phone       VARCHAR (for guest orders)
guest_email       VARCHAR (nullable)
delivery_address  JSONB
status            ENUM (Pending Payment, Confirmed, Dispatched, Delivered, Cancelled, Payment Expired)
subtotal          DECIMAL(12,2)
total             DECIMAL(12,2)
notes             TEXT (optional admin or customer notes)
placed_at         TIMESTAMP
updated_at        TIMESTAMP

order_items
───────────────────────────────────────────────
order_item_id     UUID (PK)
order_id          UUID (FK → orders)
product_id        UUID (FK → products)
product_name      VARCHAR (snapshot at time of order)
sku               VARCHAR (snapshot)
quantity          INT
unit_price        DECIMAL(12,2) (snapshot at time of order)
line_total        DECIMAL(12,2)

payments
───────────────────────────────────────────────
payment_id        UUID (PK)
order_id          UUID (FK → orders)
amount            DECIMAL(12,2)
payment_method    VARCHAR
status            ENUM (Pending, Confirmed, Failed, Expired)
transaction_ref   VARCHAR (nullable)
confirmed_at      TIMESTAMP (nullable)
created_at        TIMESTAMP

order_status_history
───────────────────────────────────────────────
history_id        UUID (PK)
order_id          UUID (FK → orders)
from_status       VARCHAR
to_status         VARCHAR
changed_by        UUID (FK → admins, nullable for system)
changed_at        TIMESTAMP
note              TEXT (nullable)
```

### 7.2 Order Status Transitions

| From | To | Triggered By |
|---|---|---|
| — | Pending Payment | System (order creation) |
| Pending Payment | Confirmed | Admin (payment verified) |
| Pending Payment | Payment Expired | System (QR timer expiry) |
| Pending Payment | Cancelled | Admin or Customer |
| Confirmed | Dispatched | Admin |
| Dispatched | Delivered | Admin |
| Confirmed / Dispatched | Cancelled | Admin |

- Status transitions are validated server-side; invalid transitions are rejected with a 422 response.
- Every transition is recorded in `order_status_history`.

---

## 8. Order Placement — Functional Requirements

### FR-ORD-01: Add to Cart
- The system shall allow any visitor (guest or logged-in) to add a product to their cart.
- The system shall validate that the requested quantity does not exceed available stock.
- If the product is already in the cart, the system shall increment the quantity rather than create a duplicate entry.

### FR-ORD-02: Cart Persistence
- The system shall persist guest cart data in `localStorage`.
- The system shall persist logged-in cart data server-side.
- The system shall merge guest cart with server cart on login.

### FR-ORD-03: Checkout Initiation
- The system shall require the customer to provide a name, phone number, and delivery address before proceeding to payment.
- The system shall allow both guest and registered customers to complete checkout.

### FR-ORD-04: QR Payment
- The system shall display a QR code with the total order amount and a 15-minute session timer.
- The system shall record the payment attempt with status `Pending`.
- The system shall update payment status to `Confirmed` upon admin verification or webhook confirmation.

### FR-ORD-05: Order Creation
- The system shall create an order record atomically, including all order items, upon checkout submission.
- The system shall generate a unique order number in the format `MKE-YYYY-NNNNNN`.
- The system shall reduce the reserved stock count when an order is placed.

### FR-ORD-06: Order Confirmation Communication
- The system shall send an order confirmation email (if customer email is available) within 60 seconds of order placement.
- The system shall push a real-time SSE notification to the admin dashboard upon new order creation.

### FR-ORD-07: Order Status Updates
- The system shall notify the customer via email when the order status changes to Dispatched and Delivered.
- The system shall display the current order status to logged-in customers on their order history page.

### FR-ORD-08: Order Cancellation
- The system shall allow admin to cancel orders in `Pending Payment` or `Confirmed` status.
- The system shall restore reserved stock when an order is cancelled.
- The system shall notify the customer via email upon cancellation.

### FR-ORD-09: Guest Order Tracking
- The system shall allow a guest to check their order status using the order number and phone number combination.

### FR-ORD-10: Order Deletion (Admin)
- Admin may soft-delete orders (mark as deleted; data is preserved in audit trail).
- Hard deletion is not permitted to maintain financial audit integrity.

---

## 9. Admin Order Features

### 9.1 Real-Time Order Monitoring
- The admin dashboard receives new order events via **Server-Sent Events (SSE)**.
- Each event carries: `order_id`, `order_number`, `customer_name`, `total`, `placed_at`, `status`.
- The dashboard order list auto-updates without a page refresh.
- Visual and optional audio alert on new order arrival.

### 9.2 Order List View
- Filterable columns: Order Number, Customer, Status, Date, Total.
- Status filter chips: All, Pending Payment, Confirmed, Dispatched, Delivered, Cancelled.
- Date range picker for filtering by order date.
- Pagination: 25 orders per page.
- Each row is clickable and navigates to the Order Detail view.

### 9.3 Order Detail View
- Displays all order information: order number, customer details, items, payment status, address, timestamps.
- Status update buttons visible based on allowed transitions.
- Order status history timeline (who changed status, when, and any notes).
- Link to customer profile (for registered customers).
- Print / download order slip (future enhancement).

### 9.4 Order Deletion
- Admin can soft-delete an order via a "Delete" action with a confirmation modal.
- Deleted orders are hidden from the default list but accessible via an "Archived" filter.
- Deletion is logged in the audit trail with admin ID and timestamp.

---

## 10. Multi-Language Support for Orders

- All order-facing UI strings (status labels, CTAs, error messages, email templates) must exist in both `en` and `ne` locale files.
- Order confirmation and status-change emails must be rendered in the customer's language preference.
- Product name snapshots in `order_items` are stored in both languages to ensure historical accuracy.

---

## 11. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Order creation response time | < 500 ms at P95 |
| Cart operation response time | < 200 ms at P95 |
| Payment QR generation time | < 1 second |
| Order confirmation email delivery | < 60 seconds after placement |
| SSE notification latency (admin) | < 2 seconds from order creation |
| Concurrent order throughput | Minimum 100 simultaneous checkouts |
| Data durability | Zero order record loss (ACID-compliant database writes) |

---

## 12. References

- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [eSewa Payment Gateway](https://developer.esewa.com.np/)
- [Khalti Payment Gateway](https://docs.khalti.com/)
- [React i18next](https://react.i18next.com/)
- [PostgreSQL ACID Compliance](https://www.postgresql.org/docs/current/transaction-iso.html)
- [JWT Authentication Best Practices](https://www.rfc-editor.org/rfc/rfc8725)

---

*End of Order Requirements Document*
