import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rglumbheyypdanfpmuef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: users, error: uErr } = await supabase
    .from("User")
    .select("id, name, email, role, tenantId, client:Client(*)");
  console.log("Users:", JSON.stringify(users, null, 2));

  const { data: clients, error: cErr } = await supabase
    .from("Client")
    .select("id, tenantId, userId, companyName, contactPerson");
  console.log("Clients:", JSON.stringify(clients, null, 2));

  const { data: orders, error: oErr } = await supabase
    .from("Order")
    .select("id, orderNumber, tenantId, clientId");
  console.log("Orders:", JSON.stringify(orders, null, 2));

  const { data: invoices, error: iErr } = await supabase
    .from("Invoice")
    .select("id, invoiceNumber, tenantId, clientId");
  console.log("Invoices:", JSON.stringify(invoices, null, 2));
}

main().catch(console.error);
