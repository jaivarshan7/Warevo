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
| 1 | **Login Page** | `docs/screenshots/login.png` | **Captured** | Live capture via Vite SPA at `http://localhost:3000/login`. Dark theme, Warevo branding, email/password and Google OAuth entry points. Zero user records exposed. |
| 2 | **Main Dashboard** | `docs/screenshots/dashboard.png` | *Pending Demo Seed* | Metric cards (Pending Orders, Dispatched, Stock Value, Low Stock Alerts), Quick actions, Order activity feed. Requires synthetic tenant session. |
| 3 | **Inventory Management** | `docs/screenshots/inventory.png` | *Pending Demo Seed* | Inventory table with SKU, category, stock level badges, location bins, reorder thresholds, and search filters. |
| 4 | **Product Details** | `docs/screenshots/product-details.png` | *Pending Demo Seed* | Product specification modal/drawer, stock level breakdown across locations, and stock adjustment history. |
| 5 | **Order Management** | `docs/screenshots/order-management.png` | *Pending Demo Seed* | Order list with lifecycle status badges (`ISSUED`, `PROCESSING`, `DISPATCHED`, `DELIVERED`, `CANCELLED`), client tags, and date filters. |
| 6 | **Order Detail & Lifecycle** | `docs/screenshots/order-details.png` | *Pending Demo Seed* | Complete order timeline, line items, order comments feed, dispatch metadata, and linked invoice status. |
| 7 | **Client Delivery Verification** | `docs/screenshots/order-verification.png` | *Pending Demo Seed* | Client receiving checklist, discrepancy item flags, condition verification, receiver comments, and photo attachment slot. |
| 8 | **Invoice Management** | `docs/screenshots/invoices.png` | *Pending Demo Seed* | Invoices overview showing status (`DRAFT`, `FINAL`, `PAID`, `OVERDUE`), invoice number sequence (`INV-2026-XXXXXX`), and payment status badges. |
| 9 | **Invoice Details** | `docs/screenshots/invoice-details.png` | *Pending Demo Seed* | Printable invoice view with line items, tax breakdown, client billing details, and payment recording modal. |
| 10 | **Payment Proof Workflow** | `docs/screenshots/payment-proofs.png` | *Pending Demo Seed* | Secure payment modal with transaction reference, payment method selector, and synthetic document upload trigger. |
| 11 | **Employee Management** | `docs/screenshots/employee-management.png` | *Pending Demo Seed* | Warehouse staff and client employee role management table (`MD`, `GENERAL_MANAGER`, `MANAGER`, `RECEIVER`, `ACCOUNTANT`). |
| 12 | **Client Company Management** | `docs/screenshots/client-management.png` | *Pending Demo Seed* | Client directory, corporate group affiliations, credit settings, contact personnel, and assigned warehouse linkages. |
| 13 | **Notification Center** | `docs/screenshots/notifications.png` | *Pending Demo Seed* | Notification list showing order dispatch alerts, verification approvals, payment receipts, and read/unread toggles. |
| 14 | **Platform Admin Overview** | `docs/screenshots/admin-dashboard.png` | *Pending Demo Seed* | Cross-tenant metrics, tenant directory, warehouse provisioning, and global system health indicators. |

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
