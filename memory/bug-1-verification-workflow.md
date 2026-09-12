---
name: bug-1-verification-workflow
description: Fix client verification status inconsistency between frontend and backend
metadata:
  type: project
---

## Bug 1: Client Cannot Verify Dispatched Order

### Root Cause
The frontend `OrderDetailPage.tsx` included `DISPATCHED` in the `canVerify` check, but the backend RPC `rpc_submit_verification` only allows verification when order status is `RECEIVED` or `VERIFICATION_PENDING`. This created a contradictory UI where "Submit Verification" appears but the backend rejects it with "This order is not ready for client verification. Current status: DISPATCHED".

### Fix Applied
**File:** `src/pages/operations/OrderDetailPage.tsx` line 138

Removed `DISPATCHED` from the `canVerify` status check:

```typescript
// Before:
const canVerify =
    ["RECEIVED", "VERIFICATION_PENDING", "DISPATCHED"].includes(order.status) &&
    (role === "CLIENT" || role === "PRODUCT_RECEIVER");

// After:
const canVerify =
    ["RECEIVED", "VERIFICATION_PENDING"].includes(order.status) &&
    (role === "CLIENT" || role === "PRODUCT_RECEIVER");
```

### Intended Workflow
The order status machine (defined in `src/lib/order-workflow.ts` and enforced by RPC `rpc_transition_order` and `rpc_submit_verification`) is:

```
PROCESSING → READY_FOR_DISPATCH → DISPATCHED → RECEIVED → VERIFICATION_PENDING → VERIFIED
```

Client delivery verification should only be available after the order status reaches `RECEIVED`, not `DISPATCHED`. The backend RPC enforces this at line 259-261:

```sql
IF v_order.status NOT IN ('RECEIVED', 'VERIFICATION_PENDING') THEN
    RAISE EXCEPTION 'This order (%) is not ready for client verification. Current status: %', ...
END IF;
```

### Verification
- Build passes: `npm run build` ✓
- All tests pass: `npm test` ✓ (20/20 tests pass)