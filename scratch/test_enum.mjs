import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rglumbheyypdanfpmuef.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbHVtYmhleXlwZGFuZnBtdWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxNzQsImV4cCI6MjEwMzE0MjE3NH0.8cTQrLjtp2RjF86VWUSbCaS0cvC6b-yVYP9YsbL3q5Q";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase.rpc("get_role_enum_values");
  console.log("get_role_enum_values:", data, error);
}

main().catch(console.error);
