import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseInvoiceText } from "@/lib/invoice-parser";
import { extractTextFromPdf } from "@/lib/pdf-text-extractor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await requireUser();

  const formData = await request.formData();
  const file = formData.get("invoice") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No invoice file provided." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const text = isPdf ? extractTextFromPdf(buffer) : buffer.toString("utf8");
  const parsed = parseInvoiceText(text, file.name);

  return NextResponse.json({
    success: true,
    parsed,
    textLength: text.length,
    warning:
      parsed.items.length === 0
        ? "No line items could be extracted automatically. Please check whether the PDF is scanned/image-only or upload CSV/spreadsheet text."
        : null,
  });
}
