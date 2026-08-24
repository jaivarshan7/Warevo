import { AlertTriangle, CheckCircle2, FileUp, ListChecks, ReceiptText, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusTone } from "@/lib/utils";

export default async function InvoiceImportPage() {
  const user = await requireUser(["PLATFORM_ADMIN", "WAREHOUSE_OWNER", "WAREHOUSE_MODERATOR", "ACCOUNTANT"]);
  const imports = await prisma.importedInvoice.findMany({
    where: user.role === "PLATFORM_ADMIN" ? {} : { tenantId: user.tenantId ?? "" },
    include: {
      client: true,
      originalDocument: true,
      uploadedBy: true,
      items: true,
      eWayBill: true,
      deliveryVerification: { include: { items: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoice Import & E-Way Bill</h1>
        <p className="text-sm text-slate-500">
          A separate workflow for external invoice PDFs, manual extraction review, e-way bill preparation, and item-level delivery verification.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <WorkflowStep icon={<FileUp />} title="Upload PDF" text="Store the original invoice securely." />
        <WorkflowStep icon={<ReceiptText />} title="Review Import" text="Edit extracted and missing fields." />
        <WorkflowStep icon={<CheckCircle2 />} title="Confirm Data" text="Only confirmed imports proceed." />
        <WorkflowStep icon={<Truck />} title="E-Way Bill" text="Prepare GST transport data." />
        <WorkflowStep icon={<ListChecks />} title="Delivery Verify" text="Client verifies every item." />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <h2 className="mb-4 font-semibold">Upload existing invoice</h2>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Warehouse</label>
            <select className="h-10 w-full rounded border border-border px-3 text-sm">
              <option>Current tenant warehouse</option>
            </select>
            <label className="block text-sm font-medium">Invoice PDF</label>
            <input className="w-full rounded border border-border p-2 text-sm" type="file" accept="application/pdf" />
            <Button className="w-full justify-center">
              <FileUp className="h-4 w-4" />
              Upload & Extract
            </Button>
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
              Upload actions should validate PDF type and size, scan where available, store in Supabase Storage, and create an `ImportedInvoice` in `UPLOADED`.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">Import review queue</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Import</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>E-Way Bill</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-3">
                      <div className="font-medium">{item.importNumber}</div>
                      <div className="text-xs text-slate-500">{item.originalDocument.name}</div>
                    </td>
                    <td>{item.client?.companyName ?? "Review required"}</td>
                    <td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                    <td>{item.items.length}</td>
                    <td><Badge tone={statusTone(item.eWayBill?.status ?? "DRAFT")}>{item.eWayBill?.status ?? "DRAFT"}</Badge></td>
                    <td><Badge tone={statusTone(item.deliveryVerification?.status ?? "PENDING")}>{item.deliveryVerification?.status ?? "PENDING"}</Badge></td>
                  </tr>
                ))}
                {imports.length === 0 ? (
                  <tr className="border-t border-border">
                    <td className="py-6 text-slate-500" colSpan={6}>No imported invoices yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-semibold">Extraction review</h2>
          <ReviewField label="Invoice number" value="Requires review when confidence is low" />
          <ReviewField label="Seller / buyer GSTIN" value="Missing fields block confirmation" />
          <ReviewField label="Items and HSN/SAC" value="Editable before confirm" />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">E-way bill readiness</h2>
          <ReviewField label="Document data" value="Invoice number, date, value" />
          <ReviewField label="GST and addresses" value="Supplier, recipient, dispatch, ship-to" />
          <ReviewField label="Transport" value="Mode, vehicle, transporter, distance" />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Delivery exceptions</h2>
          <div className="flex gap-3 rounded border border-border p-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-amber-600" />
            <p className="text-sm text-slate-600">
              Missing, damaged, partially received, or rejected items should create a resolution workflow instead of completing the order.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}

function WorkflowStep({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card className="p-4">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded bg-teal-50 text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{text}</div>
    </Card>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-sm text-slate-500">{value}</div>
    </div>
  );
}
