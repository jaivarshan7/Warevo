import { Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClientLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Smartphone className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Client OTP login</h1>
            <p className="text-sm text-slate-500">Clients can only sign in after a warehouse creates their account.</p>
          </div>
        </div>
        <input className="mb-3 h-11 w-full rounded border border-border px-3" placeholder="Registered mobile number" />
        <Button className="w-full justify-center">Send OTP</Button>
        <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
          If this mobile number is not registered with this warehouse, the backend must reject OTP creation and show the contact-your-warehouse message.
        </p>
      </Card>
    </main>
  );
}
