-- ============================================================================
-- Migration: Add PAYMENT_PENDING to PaymentStatus
-- Purpose: Support the post-store-verification payment workflow.
-- Existing applied migrations are not modified.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'PaymentStatus'
          AND e.enumlabel = 'PAYMENT_PENDING'
    ) THEN
        ALTER TYPE public."PaymentStatus"
        ADD VALUE 'PAYMENT_PENDING' AFTER 'UNPAID';
    END IF;
END
$$;
