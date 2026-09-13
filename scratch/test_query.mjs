import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rglumbheyypdanfpmuef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ALLOWED_EMPLOYEE_ROLES = [
  "WAREHOUSE_STAFF",
  "PRODUCT_RECEIVER",
  "ACCOUNTS_TEAM",
  "ACCOUNTANT",
  "WAREHOUSE_MODERATOR",
];

async function main() {
  console.log("--- 1. Fetching all users from User table ---");
  const { data: allUsers, error: errAll } = await supabase
    .from("User")
    .select("id, name, role, tenantId");
  if (errAll) console.error("Error fetching all users:", errAll);
  console.log("Total users found:", allUsers?.length);
  console.table(allUsers);

  // Find tenant IDs
  const tenantIds = [...new Set(allUsers?.map(u => u.tenantId).filter(Boolean))];
  console.log("Tenant IDs found:", tenantIds);

  for (const tenantId of tenantIds) {
    console.log(`\n--- 2. Testing fetchEmployees query for tenant: ${tenantId} ---`);
    const { data: filtered, error: errFiltered } = await supabase
      .from("User")
      .select("*, tenant:Tenant(*)")
      .eq("tenantId", tenantId)
      .in("role", ALLOWED_EMPLOYEE_ROLES)
      .order("createdAt", { ascending: false });

    if (errFiltered) console.error("Error filtered query:", errFiltered);
    console.log(`Filtered result count for ${tenantId}:`, filtered?.length);
    console.table(filtered?.map(u => ({ id: u.id, name: u.name, role: u.role, tenantId: u.tenantId })));
  }
}

main().catch(console.error);
