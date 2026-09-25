# Phase 9: Notification & Email Workflow Audit Report
**Warehouse Management System (Warevo — Multi-Tenant WMS)**  
**Audit Date:** 2026-09-25  

---

## 1. Executive Summary

This audit evaluates the notification and transactional email architecture across the Warevo WMS repository. The existing infrastructure provides:
1. An in-app `Notification` table protected by strict PostgreSQL Row Level Security (RLS) and restrictive policies blocking direct mutations.
2. A deployed, hardened Supabase Edge Function (`supabase/functions/send-email/index.ts`) integrating with Resend.
3. An `EmailLog` table capturing delivery states (`PENDING`, `SENT`, `SKIPPED`, `FAILED`) with unique `idempotencyKey` constraints preventing duplicate email dispatch.
4. Tenant isolation and active-user verification preventing cross-tenant leakage and emailing inactive users.
5. Notification preferences defaulted strictly to **OFF** (`clientEmail: false`) for all 17 event types.

The purpose of this audit is to identify which of the 17 defined notification event types are actively emitted by production WMS workflows, which have working in-app and email triggers, which recipient resolution rules apply, and what gaps exist before wiring the remaining production workflows.

---

## 2. Notification Events Audit Table

| # | Event Type | Existing Trigger | In-App | Recipient Logic | Email Trigger | Email Template | Preference (Default) | Production Status |
|---|------------|------------------|--------|-----------------|---------------|----------------|----------------------|-------------------|
| 1 | `NEW_ORDER` | `rpc_create_order_with_invoice` (Order Creation) | **YES** | Active `ClientEmployee.userId` from `p_selected_contact_ids` | Available via `sendNotificationEmail`, requires automated call in `createOrderAtomic` | Generic HTML template in Edge Function; needs rich order template | `clientEmail: false` (OFF) | **ACTIVE IN-APP / WIRED FOR EMAIL** |
| 2 | `ORDER_ISSUED` | `rpc_transition_order(..., 'ISSUED')` | NO | Client users with roles `RECEIVER`, `STORE`, `MANAGER` | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 3 | `PROCESSING_STARTED` | `rpc_transition_order(..., 'PROCESSING')` | NO | Client receiver / manager | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 4 | `READY_FOR_DISPATCH` | `rpc_transition_order(..., 'READY_FOR_DISPATCH')` | NO | Dispatch team / Client receiver | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 5 | `ORDER_DISPATCHED` | `rpc_transition_order(..., 'DISPATCHED')` | NO | Active Client Employees (`RECEIVER`, `STORE`, `MANAGER`) for client company | Available via `sendNotificationEmail`; trigger to be connected in `transitionOrderStatus` | Needs dedicated dispatch template with order & tracking data | `clientEmail: false` (OFF) | **CORE WORKFLOW EXISTS — TO BE CONNECTED** |
| 6 | `CLIENT_RECEIVED_ORDER` | Retired transition (`DISPATCHED -> RECEIVED` is disallowed) | NO | N/A | None | None | `clientEmail: false` (OFF) | **RETIRED / NOT CURRENTLY TRIGGERED** |
| 7 | `CLIENT_STARTED_VERIFICATION` | No distinct start action in UI/RPC | NO | Warehouse staff | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 8 | `CLIENT_COMPLETED_VERIFICATION` | `rpc_submit_verification` (Delivery Verification) | **YES** | In-app broadcast to tenant warehouse operations staff (`userId = NULL`) | Available via `sendNotificationEmail`; trigger to be connected in `submitDeliveryVerification` | Needs dedicated verification result template | `clientEmail: false` (OFF) | **ACTIVE IN-APP / WIRED FOR EMAIL** |
| 9 | `CLIENT_REJECTED_ORDER` | Subsumed in `rpc_submit_verification` (emits `CLIENT_COMPLETED_VERIFICATION` with status `REJECTED`) | NO | Warehouse operations staff | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED (SUBSUMED)** |
| 10 | `DAMAGE_REPORTED` | Recorded in `DeliveryVerificationItem.damagedQuantity`, no dedicated notification row | NO | Warehouse operations & client manager | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 11 | `MISSING_ITEMS_REPORTED` | Recorded in `DeliveryVerificationItem.missingQuantity`, no dedicated notification row | NO | Warehouse operations & client manager | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 12 | `VERIFICATION_COMPLETED` | `rpc_submit_store_verification` (Store Inventory Verification) | NO | Client account team & warehouse operations | None | Generic only | `clientEmail: false` (OFF) | **CORE WORKFLOW EXISTS — TO BE CONNECTED** |
| 13 | `INVOICE_GENERATED` | `rpc_create_order_with_invoice` (Atomic) or `rpc_generate_invoice` | NO (emits `NEW_ORDER` when created with order) | Active Client Employees (`ACCOUNT`, `MANAGER`, `GM`, `MD`) & Client Accountant | Available via `sendNotificationEmail`; trigger to be connected | Needs dedicated invoice billing template with amount & due date | `clientEmail: false` (OFF) | **CORE WORKFLOW EXISTS — TO BE CONNECTED** |
| 14 | `INVOICE_SENT` | No distinct send trigger in UI | NO | Client accounting contacts | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 15 | `PAYMENT_RECEIVED` | `rpc_record_payment_secure` (Payment Recording) | NO | Client accounts (`ACCOUNT`, `MANAGER`) & Warehouse finance staff (`ACCOUNTANT`, `ACCOUNTS_TEAM`) | Available via `sendNotificationEmail`; trigger to be connected in `recordInvoicePayment` | Needs dedicated payment receipt template | `clientEmail: false` (OFF) | **CORE WORKFLOW EXISTS — TO BE CONNECTED** |
| 16 | `PAYMENT_OVERDUE` | No automated cron or aging job currently active | NO | Client accounts team | None | Generic only | `clientEmail: false` (OFF) | **NOT CURRENTLY TRIGGERED** |
| 17 | `ORDER_COMPLETED` | `rpc_transition_order(..., 'COMPLETED')` | NO | Client manager / receiver | None | Generic only | `clientEmail: false` (OFF) | **CORE WORKFLOW EXISTS — TO BE CONNECTED** |

---

## 3. Deep-Dive Findings by Event Category

### A. Order Lifecycle Events
1. **`NEW_ORDER`**:
   - **Business Action**: Creating an order with invoice in `createOrderAtomic` via `rpc_create_order_with_invoice`.
   - **In-App Creation**: PostgreSQL RPC iterates over `p_selected_contact_ids` and inserts a `Notification` for each active user.
   - **Current Email Status**: `sendNotificationEmail` helper was deployed, but was not automatically invoked after order creation succeeded.
   - **Action Needed**: Connect `sendNotificationEmail` in `createOrderAtomic` for each resolved contact whose tenant has `clientEmail: true` for `NEW_ORDER`.

2. **`ORDER_DISPATCHED`**:
   - **Business Action**: Warehouse staff advances order status from `READY_FOR_DISPATCH` to `DISPATCHED` via `rpc_transition_order`.
   - **Current Notification Status**: Currently no in-app notification is created during status transitions.
   - **Action Needed**: In `transitionOrderStatus`, when `nextStatus === 'DISPATCHED'`, resolve active client employees for that order (`RECEIVER`, `STORE`, `MANAGER`) and trigger in-app notification and email dispatch if preference is enabled.

3. **`ORDER_COMPLETED`**:
   - **Business Action**: Final order closure from `PAID` to `COMPLETED` via `rpc_transition_order`.
   - **Action Needed**: When `nextStatus === 'COMPLETED'`, notify active client manager/receiver.

### B. Delivery & Inventory Verification Events
1. **`CLIENT_COMPLETED_VERIFICATION`**:
   - **Business Action**: Receiver inspects delivery and submits verification checklist via `rpc_submit_verification`.
   - **In-App Creation**: PostgreSQL RPC inserts a broadcast notification (`userId = NULL`) for warehouse operations staff.
   - **Current Email Status**: Edge Function exists, but was not invoked on verification completion.
   - **Action Needed**: Wire `sendNotificationEmail` in `submitDeliveryVerification` resolving active warehouse staff/owner contacts.

2. **`VERIFICATION_COMPLETED`**:
   - **Business Action**: Store inventory verification submitted via `rpc_submit_store_verification`.
   - **Action Needed**: Wire client accounting and warehouse operations notification.

### C. Invoicing & Payment Events
1. **`INVOICE_GENERATED`**:
   - **Business Action**: Order invoice finalized or standalone invoice created.
   - **Action Needed**: Resolve client employees with `employeeRole IN ('ACCOUNT', 'MANAGER', 'GM', 'MD')` and notify them.

2. **`PAYMENT_RECEIVED`**:
   - **Business Action**: Payment logged via `rpc_record_payment_secure`.
   - **Action Needed**: In `recordInvoicePayment`, notify the client accounting contact and warehouse finance team.

---

## 4. Authoritative Recipient Resolution Rules

To adhere strictly to tenant and client boundaries:
1. **Never trust client-supplied emails**: All email recipients must be resolved server-side from authoritative `User` and `ClientEmployee` database records.
2. **Active Status Verification**: Users where `status != 'ACTIVE'` are strictly ignored and must never receive emails.
3. **Role-Based Targeting**:
   - **Order Dispatch & Delivery**: Target `ClientEmployee` with role in `['RECEIVER', 'STORE', 'MANAGER']`.
   - **Invoicing & Billing**: Target `ClientEmployee` with role in `['ACCOUNT', 'MANAGER', 'GM', 'MD']` and warehouse `ACCOUNTANT` / `ACCOUNTS_TEAM`.
   - **Payment Confirmation**: Target client payer contact and warehouse accounts team.
   - **Delivery Verification Submitted**: Target warehouse staff (`WAREHOUSE_OWNER`, `WAREHOUSE_MODERATOR`, `WAREHOUSE_STAFF`).
4. **Tenant Isolation**: Edge function strictly verifies that `recipientUser.tenantId === request.tenantId`. If cross-tenant mismatch is detected, dispatch is blocked immediately.

---

## 5. Security & Safety Invariants

- **Email Dispatch is a Non-Blocking Side Effect**: An email dispatch failure, network timeout, or Resend API error must **never** roll back or fail database transactions (order creation, status transition, payment recording, or verification).
- **Idempotency Guarantee**: Every dispatch computes a deterministic `idempotencyKey` (e.g., `notif_${notificationId}_${recipientEmail}` or `evt_${tenantId}_${eventType}_${orderId}_${recipientEmail}`). If already `SENT` in `EmailLog`, repeat attempts return duplicate success without re-calling Resend.
- **Default Preference OFF**: All 17 notification events default to `clientEmail: false`. Emails are only dispatched when a tenant administrator explicitly enables the event.
