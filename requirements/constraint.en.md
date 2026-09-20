# MK Electric Shop — System Constraints

**Version:** 1.0  
**Language:** English (en)  
**Last Updated:** September 15, 2026

---

## 1. Overview

This document defines the technical and business constraints that govern the MK Electric Shop platform. All development decisions must respect these boundaries to ensure a secure, compliant, and maintainable system.

---

## 2. Payment Processing Constraints

### 2.1 QR Code Payment
- Payment is processed exclusively via QR code linked to the owner's bank account (e.g., eSewa, Khalti, IME Pay, or direct bank QR).
- The system must not store card numbers, bank credentials, or raw payment tokens.
- QR codes must be dynamically generated per order with the exact amount pre-filled to prevent input errors.
- Each QR payment session must expire after **15 minutes** if not completed.
- Payment confirmation is manual or webhook-based; the order status must not be marked as paid until confirmation is received.

### 2.2 Transaction Records
- All payment attempts (successful, failed, pending) must be logged with timestamp, order ID, and amount.
- Refund and cancellation policies must be reflected in the data model but are handled offline in the MVP.
- No PCI-DSS scope is introduced since card data is never handled directly.

### 2.3 Future Payment Integrations
- The payment module must be designed with an adapter/strategy pattern to allow future addition of payment gateways (Stripe, PayPal, eSewa API, Khalti API) without restructuring core order logic.

---

## 3. Authentication Constraints

### 3.1 Session Management
- Authentication is **JWT (JSON Web Token) based**.
- Access tokens expire after **1 hour**; refresh tokens expire after **16 hours**.
- Auto-logout must be enforced on the client after 16 hours of inactivity or token expiry, whichever comes first.
- Tokens must be stored in **HttpOnly cookies** (not localStorage) to mitigate XSS attacks.

### 3.2 Password Security
- All passwords must be hashed using **bcrypt** with a minimum cost factor of **12**.
- Plain-text passwords must never be logged, stored, or transmitted.
- Minimum password policy: 8 characters, at least one uppercase letter, one number, and one special character.
- Password reset flows must use time-limited, single-use tokens (expires in 30 minutes).

### 3.3 User Roles
- The system supports two primary roles: **Customer** and **Admin**.
- Guests may browse and place orders without registering, but order history and profile are unavailable.
- Admin accounts must not be self-registerable; they are created by existing admins only.
- Role claims must be embedded in the JWT payload and validated server-side on every protected route.

### 3.4 Brute-Force Protection
- Login endpoints must implement rate limiting: maximum **5 failed attempts** per IP per 15 minutes before temporary lockout.
- CAPTCHA or challenge mechanism must be triggered after 3 consecutive failures.

---

## 4. File and Content Management Constraints

### 4.1 Image Uploads
- Product images must be uploaded in **JPEG, PNG, or WebP** format only.
- Maximum file size per image: **5 MB**.
- Images must be resized and optimized on the server side (max display width: 1200 px; thumbnail: 300 px).
- All uploaded files must be stored in a dedicated object storage bucket (e.g., AWS S3, MinIO) and never on the application server's local filesystem.

### 4.2 Content Integrity
- All uploaded content must be virus/malware scanned before being made publicly accessible.
- File names must be sanitized and stored with a UUID-based key to prevent path traversal attacks.
- Publicly accessible URLs must use signed/pre-signed URLs with a defined expiry or a CDN layer.

### 4.3 Inventory Content
- Each inventory item must have: name, description, category, price, stock count, at least one image, and dimensions/specifications.
- Rich-text descriptions are supported via a sanitized HTML or Markdown renderer; raw HTML input from users is disallowed.
- Content changes must be version-tracked in the admin audit log.

---

## 5. Notification Constraints

### 5.1 Channels
- MVP notification channels: **in-app notification** and **email**.
- Future channels (SMS, push notification) must be abstracted behind a notification service interface.

### 5.2 Real-Time Order Notifications (Admin)
- Admin dashboard uses **Server-Sent Events (SSE)** for real-time order updates.
- SSE connections must be authenticated using the admin JWT token.
- The server must handle SSE connection drops gracefully and allow clients to reconnect with `Last-Event-ID`.

### 5.3 Customer Notifications
- Customers receive an **order confirmation email** upon successful order placement.
- Email notifications are sent when order status changes (e.g., Confirmed → Dispatched → Delivered).
- Email templates must support both **Nepali and English** languages based on customer preference.

### 5.4 Rate Limits
- Notification service must implement deduplication to prevent duplicate sends for the same event.
- Bulk notification jobs must be queued and rate-limited to avoid overwhelming the email provider.

---

## 6. Advanced Features Constraints

### 6.1 Search and Filtering
- Product search must support full-text search across name, category, and description fields.
- Filters must include: category, price range, stock availability, and brand.
- Search response time must not exceed **500 ms** at the 95th percentile under normal load.

### 6.2 Analytics and Reporting
- Sales reports and inventory reports are admin-only features.
- Reports must be generated asynchronously for large datasets and delivered via download link.
- Data retention for analytics: minimum **2 years** of transactional data.

### 6.3 Inventory Management
- Stock levels must be updated atomically to prevent overselling (optimistic or pessimistic locking).
- Low-stock threshold alerts must be configurable per product by the admin.
- Bulk import/export of inventory via CSV must be supported.

### 6.4 Multi-Language Support
- MVP must support **English (en)** and **Nepali (ne)** via the `i18n` library (e.g., `react-i18next` on the frontend, `i18next` on server-side rendering if applicable).
- All user-facing strings must be externalized into locale files; hard-coded UI strings are not permitted.
- Language preference must be persisted per user account and in localStorage for guests.
- Right-to-left (RTL) layout is not required for Nepali.

---

## 7. External Integration Constraints

### 7.1 Bank / Payment Gateway
- QR code generation must integrate with the bank or payment provider's API if dynamic QR is supported; otherwise, a static QR with amount entered by the customer is acceptable for MVP.
- Webhook endpoints for payment confirmation must be secured with HMAC signature verification.

### 7.2 Email Service Provider
- Transactional emails must be sent through a reliable ESP (e.g., AWS SES, SendGrid, Mailgun).
- The integration must support HTML templates and fallback plain-text versions.
- Bounce and complaint handling must be configured to maintain sender reputation.

### 7.3 CDN / Object Storage
- All static assets and product images must be served through a CDN.
- Cache-control headers must be configured appropriately (long TTL for versioned assets, short TTL for dynamic content).

### 7.4 Third-Party APIs
- All third-party API credentials must be stored in environment variables or a secrets manager; never in source code or version control.
- API clients must implement retry logic with exponential back-off and circuit-breaker patterns for resilience.
- Third-party service SLAs must be documented and monitored.

---

## 8. Performance and Scalability Constraints

- The system must handle a minimum of **500 concurrent users** in the MVP without degradation.
- Database queries must be optimized with appropriate indexing on foreign keys, search fields, and order status columns.
- API response times must be under **300 ms** for catalog browsing and under **500 ms** for order submission at the 95th percentile.
- The architecture must support horizontal scaling of the application tier behind a load balancer.

---

## 9. Security Constraints

- All communication must occur over **HTTPS/TLS 1.2+**; HTTP requests must be redirected to HTTPS.
- CORS policy must be explicitly configured to allow only trusted origins.
- SQL injection, XSS, and CSRF protections must be implemented at the framework and middleware level.
- Dependency vulnerabilities must be scanned in CI/CD using tools such as Dependabot or Snyk.
- Admin routes must be protected by both authentication and role-based authorization middleware.

---

## 10. Compliance and Legal Constraints

- The platform must comply with applicable data privacy regulations in Nepal.
- User data must not be sold or shared with third parties without explicit consent.
- Cookie consent banner must be displayed on first visit in compliance with data protection norms.
- Terms of Service and Privacy Policy documents must be linked from all major pages.

---

## 11. Development and Operational Constraints

- The codebase must be maintained in a version-controlled repository (Git).
- CI/CD pipelines must include linting, unit tests, and security scans before deployment.
- Environment configurations (development, staging, production) must be strictly separated.
- Database migrations must be versioned and reversible.
- All secrets must be rotated regularly and never committed to source control.

---

*End of Constraints Document*
