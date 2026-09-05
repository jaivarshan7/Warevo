import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function testRpc() {
  // Test 1: Trying to generate FINAL invoice for an unverified order (ORD-2026-000002 has verificationStatus PENDING)
  const { data: res1, error: err1 } = await supabase.rpc("rpc_generate_invoice", {
    p_order_id: "cmtn8tx6u0027eh4kt6puafab",
    p_is_final: true,
    p_user_id: "test-user",
    p_user_role: "WAREHOUSE_OWNER"
  });

  console.log("Test 1 (Blocked final invoice):", res1, "Expected Error:", err1?.message);
}

testRpc();
