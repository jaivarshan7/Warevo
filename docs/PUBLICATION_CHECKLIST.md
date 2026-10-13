# Warevo — Public Release & Repository Publication Checklist

This checklist must be reviewed and signed off before making the **Warevo** repository public or publishing visual assets.

---

## 1. Secrets & Sensitive File Sanitization

- [ ] **No `.env` files tracked**: Verify via `git status` and `git ls-files | grep .env` that only `.env.example` is committed.
- [ ] **No Service Role Keys**: Confirm `SUPABASE_SERVICE_ROLE_KEY` does not appear in client-facing code or markdown files.
- [ ] **No Database Passwords**: Verify database connection URLs in documentation use dummy credentials (`user:password@localhost:5432`).
- [ ] **Git History Audit**: Ensure past commits have not accidentally staged production certificates or private keys.
- [ ] **No Local SQL Dumps**: Confirm backup SQL files (`remote_schema.sql`, `supabase_backup.sql`, `backup_old_staging_schema.sql`) are ignored or excluded before publication.

---

## 2. Client Confidentiality & Real Business Records

- [ ] **No Real Customer Names**: Commercial entities, client brands, and vendor partnerships must not be named in documentation or test fixtures.
- [ ] **No Real Phone Numbers or Emails**: All sample contact details must use RFC 2606 domain names (`@example.com`, `@example.test`, `@warevo.online`).
- [ ] **No Live Financial Amounts**: Invoices, bank account details, transaction reference numbers, and GST/Tax numbers must be demonstrative.
- [ ] **No Actual Payment Proofs**: Ensure no real payment slip images, signed delivery receipts, or bank slips exist in `docs/screenshots/` or documentation folders.
- [ ] **Sanitized Screenshots Only**: Review all images in `docs/screenshots/` against [`docs/SCREENSHOT_GUIDE.md`](file:///d:/Dev/warehouse_management/docs/SCREENSHOT_GUIDE.md).

---

## 3. Licensing & Commercial Authorization

- [ ] **Client Approval**: Confirm with the commissioning client that the codebase architecture and developer documentation may be published in a portfolio.
- [ ] **Open Source License Confirmation**: Do **NOT** attach an open-source license (such as MIT, Apache 2.0, or GPL) unless explicit client permission is granted in writing.
- [ ] **Proprietary Notice**: If proprietary, maintain a clear copyright statement: `Copyright (c) 2026. All rights reserved.`

---

## 4. Documentation & Verification Quality

- [ ] **Consistent Branding**: Application is referenced consistently as **Warevo** or **Warevo — Multi-Tenant Warehouse Management System**.
- [ ] **Valid Relative Links**: All Markdown links between README and `docs/` resolve correctly.
- [ ] **Real Screenshot Validation**: Verified that every image linked in Markdown exists on disk and is not a 404.
- [ ] **Test Verification**: Verified `npm test` passes completely (13 suites, 224 unit tests).
- [ ] **Build Verification**: Verified `npm run build` completes with 0 errors.
