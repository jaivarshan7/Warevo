-- Phase 6: Notification Settings
-- Creates NotificationSettings table for tenant-level notification preferences

-- Create NotificationSettings table
CREATE TABLE IF NOT EXISTS "NotificationSettings" (
  "id" TEXT PRIMARY KEY DEFAULT concat('ns_', substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "eventConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on NotificationSettings
ALTER TABLE "NotificationSettings" ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "Allow tenant to read their notification settings" ON "NotificationSettings";
DROP POLICY IF EXISTS "Allow tenant to update their notification settings" ON "NotificationSettings";

-- Policy: Users can read their tenant's notification settings
CREATE POLICY "Allow tenant to read their notification settings"
  ON "NotificationSettings" FOR SELECT
  TO authenticated
  USING (
    "tenantId" = auth.jwt()->>'tenantId'
  );

-- Policy: Users can update their tenant's notification settings
-- Only WAREHOUSE_OWNER and PLATFORM_ADMIN should be able to modify
CREATE POLICY "Allow tenant to update their notification settings"
  ON "NotificationSettings" FOR UPDATE
  TO authenticated
  USING (
    "tenantId" = auth.jwt()->>'tenantId'
  )
  WITH CHECK (
    "tenantId" = auth.jwt()->>'tenantId'
  );

-- Index for faster lookups by tenant
CREATE INDEX IF NOT EXISTS "idx_notification_settings_tenant" ON "NotificationSettings"("tenantId");

-- Function to automatically create notification settings for new tenants
CREATE OR REPLACE FUNCTION create_notification_settings_for_new_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_event_config JSONB;
BEGIN
  -- Default notification settings for a new tenant
  default_event_config := jsonb_build_object(
    'NEW_ORDER', jsonb_build_object('inApp', true, 'clientEmail', true),
    'ORDER_ISSUED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'PROCESSING_STARTED', jsonb_build_object('inApp', true, 'clientEmail', false),
    'READY_FOR_DISPATCH', jsonb_build_object('inApp', true, 'clientEmail', true),
    'ORDER_DISPATCHED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'CLIENT_RECEIVED_ORDER', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_STARTED_VERIFICATION', jsonb_build_object('inApp', true, 'clientEmail', false),
    'CLIENT_COMPLETED_VERIFICATION', jsonb_build_object('inApp', true, 'clientEmail', true),
    'CLIENT_REJECTED_ORDER', jsonb_build_object('inApp', true, 'clientEmail', true),
    'DAMAGE_REPORTED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'MISSING_ITEMS_REPORTED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'VERIFICATION_COMPLETED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'INVOICE_GENERATED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'INVOICE_SENT', jsonb_build_object('inApp', true, 'clientEmail', true),
    'PAYMENT_RECEIVED', jsonb_build_object('inApp', true, 'clientEmail', true),
    'PAYMENT_OVERDUE', jsonb_build_object('inApp', true, 'clientEmail', true),
    'ORDER_COMPLETED', jsonb_build_object('inApp', true, 'clientEmail', true)
  );

  INSERT INTO "NotificationSettings" ("tenantId", "enabled", "eventConfig")
  VALUES (NEW."id", true, default_event_config);

  RETURN NEW;
END;
$$;

-- Trigger to create notification settings when a new tenant is created
DROP TRIGGER IF EXISTS "create_notification_settings_on_tenant_create" ON "Tenant";
CREATE TRIGGER "create_notification_settings_on_tenant_create"
  AFTER INSERT ON "Tenant"
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_settings_for_new_tenant();
