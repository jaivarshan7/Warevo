"use client";

import Link from "next/link";
import { CheckCircle2, FileText, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { money, statusTone } from "@/lib/utils";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  companyName: string;
  groupName: string | null;
  invoiceStatus: string;
  paymentStatus: string;
  total: number;
};

export function AccountingInvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("ALL");
  const [group, setGroup] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [invoiceStatus, setInvoiceStatus] = useState("ALL");

  const companies = Array.from(new Set(invoices.map((invoice) => invoice.companyName))).sort();
  const groups = Array.from(
    new Set(invoices.map((invoice) => invoice.groupName).filter((name): name is string => Boolean(name))),
  ).sort();
  const normalizedSearch = search.trim().toLowerCase();
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      !normalizedSearch ||
      [invoice.invoiceNumber, invoice.orderNumber, invoice.companyName, invoice.groupName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    return (
      matchesSearch &&
      (company === "ALL" || invoice.companyName === company) &&
      (group === "ALL" || invoice.groupName === group) &&
      (paymentStatus === "ALL" || invoice.paymentStatus === paymentStatus) &&
      (invoiceStatus === "ALL" || invoice.invoiceStatus === invoiceStatus)
    );
  });

  const hasFilters = Boolean(normalizedSearch) || [company, group, paymentStatus, invoiceStatus].some((value) => value !== "ALL");

  return (
    <Card className="overflow-hidden p-0 shadow-sm">
      <div className="border-b border-border bg-slate-50/70 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Commercial Invoices</h2>
            <p className="text-xs text-slate-500">Tax invoices with itemized CGST/SGST breakdown.</p>
          </div>
          <Badge tone="neutral">{filteredInvoices.length} of {invoices.length} invoices</Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Search invoices</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice, order, company"
              className="h-10 w-full rounded border border-border bg-white pl-9 pr-3 text-xs focus:border-primary focus:outline-none"
            />
          </label>
          <FilterSelect label="Company" value={company} onChange={setCompany} options={companies} />
          <FilterSelect label="Group" value={group} onChange={setGroup} options={groups} />
          <FilterSelect label="Payment" value={paymentStatus} onChange={setPaymentStatus} options={["PAID", "UNPAID", "PARTIALLY_PAID", "OVERDUE", "CANCELLED"]} />
          <FilterSelect label="Invoice status" value={invoiceStatus} onChange={setInvoiceStatus} options={["DRAFT", "FINAL", "SENT", "CANCELLED"]} />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCompany("ALL");
              setGroup("ALL");
              setPaymentStatus("ALL");
              setInvoiceStatus("ALL");
            }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-slate-300" />
          <p className="mt-3 font-medium text-slate-600">No matching invoices</p>
          <p className="text-sm text-slate-400">Try adjusting the search or filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">Invoice Number</th>
                <th className="px-6 py-3">Related Order</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Invoice Status</th>
                <th className="px-6 py-3">Payment Status</th>
                <th className="px-6 py-3 text-right">Invoice Total</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="transition hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-mono font-semibold">
                    <Link href={`/dashboard/invoices/${invoice.id}`} className="text-primary hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/orders/${invoice.orderId}`} className="font-mono text-xs font-medium text-slate-700 hover:underline">
                      {invoice.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    <div>{invoice.companyName}</div>
                    {invoice.groupName && <div className="text-xs font-normal text-slate-500">{invoice.groupName}</div>}
                  </td>
                  <td className="px-6 py-4"><Badge tone={statusTone(invoice.invoiceStatus)}>{invoice.invoiceStatus}</Badge></td>
                  <td className="px-6 py-4"><Badge tone={statusTone(invoice.paymentStatus)}>{invoice.paymentStatus}</Badge></td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{money(invoice.total)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/invoices/${invoice.id}`}>
                      <Button variant="secondary" className="ml-auto flex h-8 items-center gap-1.5 px-2.5 text-xs">
                        {invoice.paymentStatus === "PAID" ? <FileText className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {invoice.paymentStatus === "PAID" ? "View & Print" : "Check & Pay"}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label>
      <span className="sr-only">Filter by {label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded border border-border bg-white px-3 text-xs font-medium text-slate-700 focus:border-primary focus:outline-none">
        <option value="ALL">All {label.toLowerCase()}s</option>
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}
