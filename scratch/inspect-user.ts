import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rglumbheyypdanfpmuef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: users } = await supabase
    .from("User")
    .select("*, tenant:Tenant(*), client:Client(*)");
  
  for (const u of users || []) {
    console.log("User:", u.name, "Role:", u.role);
    console.log("  tenantId:", u.tenantId);
    console.log("  tenant:", u.tenant);
    console.log("  client type:", typeof u.client, "isArray:", Array.isArray(u.client));
    console.log("  client:", u.client);
    console.log("  user?.client?.id:", u.client?.id);
    console.log("-----------------------------------------");
  }
}

main().catch(console.error);
