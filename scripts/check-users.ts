import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rglumbheyypdanfpmuef.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q"
);

async function test() {
  const res = await supabase
    .from("User")
    .select("id, name, email, role")
    .order("role", { ascending: true });

  console.log("All users:");
  for (const u of res.data || []) {
    console.log(`  ${u.role} | ${u.name} | ${u.email || "NO EMAIL"}`);
  }
}

test();
