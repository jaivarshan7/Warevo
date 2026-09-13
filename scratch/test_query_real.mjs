import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rglumbheyypdanfpmuef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const REAL_ROLES = [
  "WAREHOUSE_STAFF",
  "ACCOUNTS_TEAM",
  "ACCOUNTANT",
  "WAREHOUSE_MODERATOR",
];

async function main() {
  const tenantId = "7398ea38-92ce-4a6f-96ac-135c051c36ac";
  const { data: filtered, error: errFiltered } = await supabase
    .from("User")
    .select("*, tenant:Tenant(*)")
    .eq("tenantId", tenantId)
    .in("role", REAL_ROLES)
    .order("createdAt", { ascending: false });

  if (errFiltered) console.error("Error filtered query:", errFiltered);
  console.log(`Filtered result count for ${tenantId}:`, filtered?.length);
  console.table(filtered?.map(u => ({ id: u.id, name: u.name, role: u.role, tenantId: u.tenantId })));
}

main().catch(console.error);
