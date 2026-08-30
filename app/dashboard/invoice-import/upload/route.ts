import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient, storageBuckets, validateFileUpload } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("invoice") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No invoice file provided." }, { status: 400 });
  }

  try {
    validateFileUpload(file, ["application/pdf"], 10 * 1024 * 1024);

    const supabase = await createSupabaseAdminClient();
    const fileName = `${user.tenantId ?? "tenant"}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from(storageBuckets.invoices).upload(fileName, file, {
      upsert: false,
      contentType: file.type
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from(storageBuckets.invoices).getPublicUrl(fileName);

    const metadata = await prisma.document.create({
      data: {
        tenantId: user.tenantId ?? "",
        type: "INVOICE_PDF",
        name: file.name,
        url: data.publicUrl,
        mimeType: file.type,
        sizeBytes: file.size
      }
    });

    return NextResponse.json({ success: true, documentId: metadata.id, url: data.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
