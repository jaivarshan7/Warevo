"use client";

import { Printer, Share2 } from "lucide-react";

export function InvoiceActions() {
  async function shareInvoice() {
    if (navigator.share) {
      await navigator.share({
        title: document.title,
        url: window.location.href,
      });
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={shareInvoice}
        className="hidden items-center gap-1.5 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 sm:inline-flex"
      >
        <Share2 className="h-3.5 w-3.5" />
        Share Link
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800"
      >
        <Printer className="h-3.5 w-3.5" />
        Print / Save PDF
      </button>
    </>
  );
}
