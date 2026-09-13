import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rglumbheyypdanfpmuef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase.rpc("rpc_update_employee", {
    p_actor_id: "ec754300-67ec-43fe-a6c5-34d978491fb6", // alex (WAREHOUSE_OWNER)
    p_actor_role: "WAREHOUSE_OWNER",
    p_target_id: "4fe06303-aeed-42bf-bbbb-0fda080079a5", // ravu (WAREHOUSE_STAFF)
    p_new_role: "ACCOUNTANT"
  });

  console.log("RPC result:", data);
  console.log("RPC error:", error);
}

main().catch(console.error);
