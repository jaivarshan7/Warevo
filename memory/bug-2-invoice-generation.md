---
name: bug-2-invoice-generation
description: Fix silent invoice creation failure in createOrder
metadata:
  type: project
---

## Bug 2: Invoice Not Automatically Generated After Order Creation

### Root Cause
The `createOrder()` function in `src/lib/services.ts` called `createInvoiceForOrder()` but had no error handling. If invoice creation failed, the error would either:
1. Propagate and potentially break order creation flow
2. Be silently caught somewhere, leaving the order without an invoice

### Fix Applied
**File:** `src/lib/services.ts` lines 260-266

Added try/catch around invoice creation with proper error logging and user-friendly error message:

```typescript
// Before:
await createInvoiceForOrder(orderId, payload.tenantId, payload.clientId, taxTotal);

return order;

// After:
try {
  await createInvoiceForOrder(orderId, payload.tenantId, payload.clientId, taxTotal);
} catch (err) {
  console.error(
    `Invoice creation failed for order ${orderId}:`,
    err
  );
  // Re-throw as a user-friendly error rather than silently ignoring
  throw new Error(
    `Order created successfully, but invoice generation failed. Order ID: ${orderId}. Please contact support if this issue persists.`
  );
}

return order;
```

### Invoice Creation Flow
The `createInvoiceForOrder()` function (line 266-349):
1. Checks if invoice already exists for the order (duplicate prevention ✓)
2. Gets tenant settings for invoice prefix
3. Generates invoice number using `generateNextInvoiceNumber()`
4. Retrieves order data for totals calculation
5. Inserts Invoice record with tenantId, orderId, clientId
6. Inserts InvoiceItem records from OrderItems
7. Uses order's tenantId, clientId, and orderId for proper linking

### Important Notes
- Duplicate prevention is preserved: the function checks for existing invoices before creating
- Errors are now logged to console and surfaced to the user rather than silently ignored
- The invoice is created with: `tenantId = order.tenantId`, `clientId = order.clientId`, `orderId = order.id`
- Invoice number follows the `INV-2026-XXXXXX` format with tenant prefix support

### Verification
- Build passes: `npm run build` ✓
- All tests pass: `npm test` ✓ (20/20 tests pass)