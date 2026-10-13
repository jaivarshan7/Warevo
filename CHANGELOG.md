# Changelog — Warevo

All notable changes to the **Warevo — Multi-Tenant Warehouse Management System (WMS)** are documented here based on verified Git commit history and versioned database migrations.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]
### Planned Improvements
- Automated SMS webhook verification for carrier tracking updates.
- Real-time barcode and QR scanning support for bin-level inventory picking.
- Multi-currency ledger support for international client billing.

---

## [2026-10-01] — Tenant Management & Email Metric Hardening
### Added
- **Tenant Management Enhancements** (`Commit: 97c75a1`): Added configurable tenant profile fields (billing contact, tax ID, warehouse capacity) and direct update capabilities within the Platform Admin console.
- **Secure Email Sent Count RPC** (`Commit: b206940`, `Migration: 20261020_000000_get_email_sent_count_rpc.sql`):
  - Created atomic database function `rpc_get_email_sent_count(UUID)` to return aggregate sent email volume without client-side row exfiltration.
  - Enforced tenant boundaries: Platform Admins can query globally or by tenant; warehouse users are restricted to their authenticated tenant; client roles are denied.
- **Inventory Search Enhancements** (`Commit: b206940`): Expanded search filters across product name, SKU, category, and bin locations with debounce handling.
- **Delivery Verification Overrides & TIMESTAMPTZ Normalization** (`Commit: b4ff0f6`, `Migration: 20261019_000000_delivery_verification_override_and_timestamps.sql`):
  - Converted timestamp columns to `TIMESTAMPTZ` (UTC) across `OrderStatusHistory`, `VerificationResponse`, `DeliveryVerification`, `AuditLog`, and `Order`.
  - Added `source` and `verifiedByRole` audit fields to `VerificationResponse` and `DeliveryVerification`.
  - Upgraded `rpc_submit_verification` with warehouse administrative override support.
  - Implemented `rpc_add_delivery_evidence` to append delivery photos and signatures without overwriting previous evidence.

### Validated
- Unit tests added and verified in `__tests__/inventory_search_and_email_count.test.ts` (20 tests passed).
- Build compilation verified cleanly with `vite build`.

---

## [2026-09-29] — Order Lifecycle Management & Verification Storage
### Added
- **Order Lifecycle & Comments** (`Commit: fd43e36`, `Migration: 20261018_000000_order_lifecycle_verification_evidence.sql`):
  - Introduced `OrderComment` table with RLS policies allowing shared operational communication between warehouse personnel and client managers.
  - Implemented `rpc_add_order_comment` and `rpc_update_order_comment`.
  - Created `rpc_update_order_before_dispatched` and `rpc_delete_order_before_dispatched` to guarantee order item immutability post-dispatch.
  - Implemented `rpc_update_receiver_notes` allowing goods receivers to annotate checklists prior to final submission.
  - Configured private Supabase Storage bucket `delivery-evidence` with row-level storage access controls.
- **Clean Staging Baseline** (`Commit: b10ae62`): Established clean baseline for continuous deployment and staging schema validation.

---

## [2026-09-26] — Production Bootstrap Tooling & Email Workflow
### Added
- **Production Schema Bootstrap Tooling** (`Commit: c3ada3d`):
  - Created `scripts/export-production-schema.ts` to automate data-free, clean schema extraction from staging.
  - Documented complete zero-data bootstrap procedures in `docs/PRODUCTION_SCHEMA_BOOTSTRAP.md`.
- **Client Role Validation** (`Commit: 2d927df`): Comprehensive validation of client role dashboards, route permissions, and workflow guards.
- **Authentication Redirect & Email Normalization** (`Commit: 92bde3e`):
  - Added post-login destination redirect preserving originally requested routes (`location.state.from`).
  - Standardized email template formatting, company branding, and order dispatch notification payloads.
  - Added tests in `__tests__/new_order_email_recipient_and_template.test.ts`.
- **Inventory Timestamps & Dispatch Signals** (`Commit: 9156716`): Fixed timezone handling on inventory updates and resolved race conditions in dispatch email notifications.

---

## [2026-09-25] — Payment Gating & Notification Preferences
### Added
- **Gated Payment Authorization** (`Commit: 8093606`):
  - Enforced business invariant: Final invoices and payments cannot be processed until delivery verification status is `VERIFIED`.
  - Created test reset script `scripts/reset-wms-test-data.ts`.
- **Notification & Email Preferences** (`Commit: 014f4d3`):
  - Implemented granular user notification preferences (`NotificationSettings` table).
  - Added automated test suite `__tests__/notification_and_email.test.ts`.
- **Staging QA Sign-off** (`Commit: 6475b6c`): Finalized staging authentication tests and end-to-end order flow sign-off.

---

## [2026-09-24] — Granular RBAC & Role Definitions
### Added
- **Granular Client Employee Roles** (`Commit: 979d9e6`, `Commit: 61e808b`):
  - Added `ClientEmployeeRole` mappings (`MD`, `GENERAL_MANAGER`, `MANAGER`, `RECEIVER`, `ACCOUNTANT`).
  - Seeded default permission sets in `RoleDefinition` and `RolePermission`.
  - Added test suites `__tests__/employee_roles.test.ts` and `__tests__/client_management_roles.test.ts`.
- **Admin Management & Group Scope RPCs** (`Commit: f258a65`):
  - Implemented group-level access functions allowing corporate parent accounts to view child subsidiary warehouses.
- **Invoice Number Sequencing** (`Commit: 1a73b02`):
  - Enhanced invoice sequence generator using `WarehouseSetting` configuration with transactional incrementing (`nextInvoiceNumber`).
