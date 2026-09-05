import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
  const { data: orders, error: oErr } = await supabase
    .from("Order")
    .select("id, orderNumber, status, verificationStatus, totalAmount")
    .limit(3);

  console.log("Orders retrieved:", orders);
  if (oErr) console.error("Order error:", oErr);
}

test();
