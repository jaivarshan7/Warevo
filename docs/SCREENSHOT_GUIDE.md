# Warevo — Application Screenshot & Visual Assets Guide

This guide details the screenshot capture methodology, asset inventory, sanitization rules, and visual documentation standards for **Warevo — Multi-Tenant Warehouse Management System (WMS)**.

---

## 1. Executive Summary & Client Privacy Policy

Warevo is a production system used by active commercial warehouse operations and corporate clients. As such, **public software developer documentation must never expose real client data, customer records, phone numbers, employee names, financial amounts, or actual delivery/payment proofs**.

### Core Rules for Screenshot Publication
1. **Never Capture Production Data**: Screenshots must strictly be captured from local development or an isolated staging sandbox with synthetic seed data.
2. **Permanent Redaction vs. Reversible Blur**: If any incidental identifiers appear, use permanent opaque pixel masking (solid block overlay), never Gaussian blur or CSS filter tricks which can be reversed.
3. **Synthetic Demonstration Data**: All customer names, order IDs, product names, SKUs, and monetary values in published screenshots must be demonstrative (e.g., *Apex Warehousing*, *Titan Tools*, *Acme Industrial*, *SKU-SAMPLE-001*).
4. **No Real Payment Proofs**: Never capture or distribute actual bank transaction slips, NEFT receipts, cheques, or physical delivery signatures. Use mock invoices and synthetic verification receipts.
5. **No Credentials or Secrets**: Redact session tokens, user emails in header profiles, API endpoints, or database pooler URLs.

---

## 2. Screenshot Inventory & Capture Status

| # | Screen / Feature | Target File | Status | Verification & Sanitization Notes |
|---|------------------|-------------|:------:|-----------------------------------|
| 1 | **Login Page** | `docs/screenshots/login.png` | **Captured** | Live capture via Vite SPA at `http://localhost:3000/login`. Dark theme, Warevo branding, email/password and Google OAuth entry points. |
| 2 | **Main Dashboard** | `docs/screenshots/dashboard.png` | **Captured** | Real-time operations overview with order metrics, gross volume, and active client counts. |
| 3 | **Order Management** | `docs/screenshots/order-management.png` | **Captured** | Controlled lifecycle status badges (`DISPATCHED`), client tags, and verification state indicators. |
| 4 | **Order Detail & Timeline** | `docs/screenshots/order-details.png` | **Captured** | Order line items, GST rate calculations, payment status, and chronological audit history timeline. |
| 5 | **Invoices & Accounting** | `docs/screenshots/invoices.png` | **Captured** | Invoicing overview with gross billing, outstanding balances, and payment statuses (`FINAL`, `PAYMENT PENDING`). |
| 6 | **Platform Admin Console** | `docs/screenshots/admin-dashboard.png` | **Captured** | Multi-tenant system console with system warehouses, organizations, and RBAC management. |
| 7 | **Inventory Management** | `docs/screenshots/inventory.png` | **Captured** | Warehouse inventory view with stock levels and movement audit logs. |
| 8 | **Live Delivery Tracker** | `docs/screenshots/order-verification.png` | **Captured** | Real-time dispatch monitor and warehouse verification override interface. |
| 9 | **Employee Management** | `docs/screenshots/employee-management.png` | **Captured** | Tenant staff and employee role administration portal. |
| 10 | **Client Management** | `docs/screenshots/client-management.png` | **Captured** | Client company directory and contact records. |
| 11 | **Notification Center** | `docs/screenshots/notifications.png` | **Captured** | Notification inbox with transactional dispatch and receiving alerts. |

---

## 3. Step-by-Step Procedure to Capture Remaining Screens

When preparing screenshots for release, follow this standardized recipe:

### Step 1: Start Clean Local Sandbox
1. Launch the local dev server:
   ```bash
   npm run dev
   ```
2. Verify it is running on `http://localhost:3000` (or `http://localhost:5173`).

### Step 2: Ensure Synthetic Test Data
1. Check that the current tenant is a demo tenant (e.g., `Tenant: "Demo Warehouse"` or `Tenant: "Apex Logistics"`).
2. Use synthetic names:
   - Client: `Acme Retailers Ltd.`
   - Products: `Industrial Valve 2-inch`, `High-Tensile Steel Bolts M8`
   - Quantities: `100`, `250`
   - Currency: Demonstrative currency values
3. Confirm that no personal phone numbers (e.g., `+91 98...`) or actual client email addresses appear on the table rows.

### Step 3: Capture Window Dimensions
- Viewport size: **1920 × 1080** or **1536 × 864** (16:9 standard desktop).
- Browser: Chrome / Edge with zoom set to **100%**.
- Color scheme: Dark mode (matches Warevo default theme `slate-950`).
- Ensure no personal bookmarks bar or browser extension badges are visible.

### Step 4: Verification and File Storage
Save all captured screens into `docs/screenshots/` using lowercase kebab-case naming:
```
docs/screenshots/login.png
docs/screenshots/dashboard.png
docs/screenshots/inventory.png
docs/screenshots/product-details.png
docs/screenshots/order-management.png
docs/screenshots/order-details.png
docs/screenshots/order-verification.png
docs/screenshots/invoices.png
docs/screenshots/invoice-details.png
docs/screenshots/payment-proofs.png
docs/screenshots/employee-management.png
docs/screenshots/client-management.png
docs/screenshots/notifications.png
docs/screenshots/admin-dashboard.png
```

---

## 4. Manual Redaction Checklist

Before committing any newly captured image to Git:

- [ ] **No Client Names**: Real commercial trade names replaced with generic entities.
- [ ] **No Phone Numbers**: No real customer or driver mobile numbers visible.
- [ ] **No Personal Emails**: Only `@example.com` or `@warevo.online` dummy emails visible.
- [ ] **No Bank Details**: Bank account numbers, IFSC/SWIFT codes, or UPI IDs redacted.
- [ ] **No Real Signatures**: Hand-written signatures or delivery stamps blanked out.
- [ ] **No Cloud Tokens**: Browser address bar query params, JWT tokens, and Supabase project IDs cropped or masked.
- [ ] **No Broken Layouts**: UI elements rendered cleanly without debug flags or test banners.
