import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const adminSupabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const orderId = "ord_81f2dce7829d8354";
  const invoiceId = "inv_ad96c47ec61ca6fb";

  // Reset order to DISPATCHED awaiting delivery verification
  await adminSupabase
    .from("Order")
    .update({
      status: "DISPATCHED",
      verificationStatus: "PENDING",
      deliveryVerifiedAt: null,
      deliveryVerifiedById: null,
      storeVerifiedAt: null,
      storeVerifiedById: null,
    })
    .eq("id", orderId);

  // Reset invoice to UNPAID
  await adminSupabase
    .from("Invoice")
    .update({
      status: "FINAL",
      paymentStatus: "UNPAID",
    })
    .eq("id", invoiceId);

  // Delete payments on this invoice
  await adminSupabase.from("Payment").delete().eq("invoiceId", invoiceId);

  console.log("Order and invoice successfully reset to pristine DISPATCHED/UNPAID state!");
}

main().catch(console.error);
