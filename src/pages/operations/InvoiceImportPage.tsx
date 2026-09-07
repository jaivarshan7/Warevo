import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, CheckCircle2, CheckSquare, FileSpreadsheet, FileText, Sparkles, Square, Trash2, Upload, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { createEnhancedOrder, createProductFromInvoice, fetchClients, fetchProducts } from "@/lib/services";
import { parseInvoiceText, samplePureAuraInvoice } from "@/lib/invoiceParser";
import { Client, Product } from "@/types";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type OrderItemDraft = { productId: string; quantity: number; unitPrice: number; taxRate: number; discount: number };
const inputClass = "w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500";

export const InvoiceImportPage: React.FC = () => {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [clientName, setClientName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [clientMobile, setClientMobile] = useState("");
  const [clientGstin, setClientGstin] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemDraft[]>([]);
  const [invoiceRawText, setInvoiceRawText] = useState("");
  const [notes, setNotes] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [distanceKm, setDistanceKm] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyParsedInvoice = async (text: string) => {
    setIsParsing(true);
    setError(null);
    try {
      const parsed = parseInvoiceText(text);
      setInvoiceNumber(parsed.invoiceNumber); setInvoiceDate(parsed.invoiceDate); setClientName(parsed.clientName);
      setContactPerson(parsed.contactPerson || ""); setClientMobile(parsed.clientMobile); setClientGstin(parsed.clientGstin); setClientAddress(parsed.clientAddress);
      setNotes(parsed.notes); setTransporterName(parsed.eWayBill?.transporterName || ""); setVehicleNumber(parsed.eWayBill?.vehicleNumber || ""); setDistanceKm(parsed.eWayBill?.distanceKm || 0);
      const matchedCompany = Array.from(new Set(clients.map((client) => client.companyName))).find((company) => company.toLowerCase().includes(parsed.clientName.toLowerCase()) || parsed.clientName.toLowerCase().includes(company.toLowerCase()));
      if (matchedCompany) { setSelectedCompanyName(matchedCompany); setSelectedContactIds(clients.filter((client) => client.companyName === matchedCompany).map((client) => client.id)); }
      const importedProducts: Product[] = [];
      const mappedItems: OrderItemDraft[] = [];
      for (const [index, item] of parsed.items.entries()) {
        const existingProduct = [...products, ...importedProducts].find((candidate) =>
          (item.sku && candidate.sku.toLowerCase() === item.sku.toLowerCase()) ||
          candidate.name.toLowerCase() === item.name.toLowerCase()
        );
        const product = existingProduct || await createProductFromInvoice({
          tenantId: tenant?.id || "",
          sku: `${item.sku || "IMPORTED"}-${index + 1}`,
          name: item.name,
          unit: item.unit,
          sellingPrice: item.unitPrice,
          gstRate: item.gstRate
        });
        importedProducts.push(product as Product);
        mappedItems.push({
          productId: product.id,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || Number(product.sellingPrice),
          taxRate: item.gstRate || Number(product.gstRate),
          discount: 0
        });
      }
      if (importedProducts.length) {
        setProducts((current) => [...current, ...importedProducts.filter((product) => !current.some((candidate) => candidate.id === product.id))]);
      }
      setOrderItems(mappedItems); setNotice(`${mappedItems.length} line items extracted from ${parsed.invoiceNumber || "the invoice"}.`);
    } catch (parseError: any) { setError(parseError?.message || "Invoice extraction failed."); } finally { setIsParsing(false); }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!tenant?.id) return;
      try {
        const [clientList, productList] = await Promise.all([fetchClients(tenant.id), fetchProducts(tenant.id)]);
        setClients(clientList); setProducts(productList as Product[]);
        const firstCompany = clientList[0]?.companyName || "";
        setSelectedCompanyName(firstCompany); setSelectedContactIds(clientList.filter((client) => client.companyName === firstCompany).map((client) => client.id));
        const firstProduct = productList[0] as Product | undefined;
        if (firstProduct) setOrderItems([{ productId: firstProduct.id, quantity: 1, unitPrice: Number(firstProduct.sellingPrice), taxRate: Number(firstProduct.gstRate), discount: 0 }]);
      } catch (loadError: any) { setError(loadError?.message || "Could not load clients and products."); } finally { setIsLoading(false); }
    };
    loadData();
  }, [tenant?.id]);

  const companyContacts = clients.filter((client) => client.companyName === selectedCompanyName);
  const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
  const taxTotal = orderItems.reduce((sum, item) => sum + ((item.quantity * item.unitPrice - item.discount) * item.taxRate) / 100, 0);
  const grandTotal = subtotal + taxTotal;
  const updateItem = (index: number, changes: Partial<OrderItemDraft>) => setOrderItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));

  const extractPdfText = async (file: File) => {
    const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    return pages.join("\n").trim();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setIsParsing(true); setError(null); setNotice(null);
    try {
      const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        ? await extractPdfText(file)
        : await file.text();
      if (!text) {
        throw new Error("This PDF has no selectable text. It may be a scanned image; upload a text-based PDF or paste the OCR text instead.");
      }
      setInvoiceRawText(text);
      await applyParsedInvoice(text);
    } catch (fileError: any) {
      setError(fileError?.message || "Could not read the invoice file.");
      setIsParsing(false);
    }
  };
  const loadSample = () => {
    const text = `INVOICE NUMBER: ${samplePureAuraInvoice.invoiceNumber}\nDATE: ${samplePureAuraInvoice.invoiceDate}\nCUSTOMER: ${samplePureAuraInvoice.clientName}\nCONTACT: ${samplePureAuraInvoice.contactPerson}\nGSTIN: ${samplePureAuraInvoice.clientGstin}\nDELIVERY ADDRESS: ${samplePureAuraInvoice.clientAddress}\n\n${samplePureAuraInvoice.items.map((item) => `${item.sku} | ${item.name} | Qty: ${item.quantity} | UnitPrice: ${item.unitPrice} | GST: ${item.gstRate}%`).join("\n")}`;
    setInvoiceRawText(text); void applyParsedInvoice(text);
  };
  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    const primaryClient = clients.find((client) => selectedContactIds.includes(client.id)) || companyContacts[0] || clients[0];
    if (!tenant?.id || !user?.id || !primaryClient) { setError("Select a registered client company before creating the order."); return; }
    if (!orderItems.length) { setError("Add at least one invoice line item."); return; }
    setIsSubmitting(true); setError(null);
    try {
      await createEnhancedOrder({ tenantId: tenant.id, clientId: primaryClient.id, selectedContactIds: selectedContactIds.length ? selectedContactIds : [primaryClient.id], createdById: user.id, status: "DISPATCHED", notes: `${invoiceNumber ? `Imported invoice ${invoiceNumber}. ` : ""}${notes}`, generateInvoice: true, eWayBill: transporterName || vehicleNumber ? { transporterName, vehicleNumber, distanceKm, transportMode: "ROAD" } : undefined, items: orderItems });
      navigate("/operations/orders", { state: { successMsg: `Order created successfully with ${orderItems.length} items.` } });
    } catch (submitError: any) { setError(submitError?.message || "Failed to create order."); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <LoadingSpinner message="Preparing invoice importer..." />;
  return (
    <form onSubmit={submitOrder} className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Link to="/operations/orders" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" aria-label="Back to orders"><ArrowLeft className="h-4 w-4" /></Link><div><p className="text-xs uppercase tracking-[0.18em] text-teal-400">Order intake</p><h1 className="text-2xl font-bold text-white">Import Invoice</h1><p className="text-sm text-slate-400">Extract, review, and issue a commercial order.</p></div></div><span className="rounded-md border border-teal-900/60 bg-teal-950/40 px-3 py-1.5 text-[11px] font-semibold text-teal-300">INVOICE TO ORDER</span></div>
      {error && <div className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200">{error}</div>}{notice && <div className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-xs text-emerald-300"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
      <Card className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3"><h2 className="flex items-center gap-2 text-sm font-bold text-white"><FileText className="h-4 w-4 text-teal-400" />Invoice source</h2><button type="button" onClick={loadSample} className="text-xs font-semibold text-amber-400 hover:text-amber-300">Load sample invoice</button></div><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"><label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-950/40 p-4 text-center hover:border-teal-500"><Upload className="mb-2 h-5 w-5 text-teal-400" /><span className="text-xs font-medium text-slate-300">Upload invoice, TXT, CSV, or OCR text</span><input type="file" accept=".txt,.csv,.json,.pdf" onChange={handleFileUpload} className="hidden" /></label><div className="space-y-2"><textarea value={invoiceRawText} onChange={(event) => setInvoiceRawText(event.target.value)} placeholder="Or paste invoice text here..." rows={4} className={`${inputClass} h-full min-h-28 font-mono`} /><Button type="button" variant="outline" size="sm" onClick={() => applyParsedInvoice(invoiceRawText)} isLoading={isParsing} disabled={!invoiceRawText.trim()}><Sparkles className="h-3.5 w-3.5" />Extract details</Button></div></div></Card>
      <Card className="space-y-4"><div className="flex items-center justify-between border-b border-slate-800 pb-3"><h2 className="flex items-center gap-2 text-sm font-bold text-white"><FileText className="h-4 w-4 text-teal-400" />Extracted customer & invoice details</h2><span className="rounded bg-emerald-950/60 px-2 py-1 text-[10px] font-semibold text-emerald-300">EDITABLE</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Invoice number", invoiceNumber, setInvoiceNumber], ["Invoice date", invoiceDate, setInvoiceDate], ["Client company", clientName, setClientName], ["Employee / contact", contactPerson, setContactPerson], ["Client contact phone", clientMobile, setClientMobile], ["Client GSTIN", clientGstin, setClientGstin]].map(([label, value, setter]) => <label key={label as string} className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label as string}</span><input value={value as string} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)} className={inputClass} /></label>)}<label className="space-y-1 sm:col-span-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Delivery destination address</span><input value={clientAddress} onChange={(event) => setClientAddress(event.target.value)} className={inputClass} /></label></div></Card>
      <Card className="space-y-4"><div className="border-b border-slate-800 pb-3"><h2 className="flex items-center gap-2 text-sm font-bold text-white"><Building2 className="h-4 w-4 text-teal-400" />Client company & notified contacts</h2><p className="mt-1 text-[11px] text-slate-400">Choose who receives the new order notification.</p></div><select value={selectedCompanyName} onChange={(event) => { setSelectedCompanyName(event.target.value); setSelectedContactIds(clients.filter((client) => client.companyName === event.target.value).map((client) => client.id)); }} className={inputClass}>{Array.from(new Set(clients.map((client) => client.companyName))).map((company) => <option key={company} value={company}>{company}</option>)}</select><div className="grid gap-2 sm:grid-cols-2">{companyContacts.map((contact) => { const checked = selectedContactIds.includes(contact.id); return <button type="button" key={contact.id} onClick={() => setSelectedContactIds((ids) => checked ? ids.filter((id) => id !== contact.id) : [...ids, contact.id])} className={`flex items-start gap-2 rounded-lg border p-3 text-left ${checked ? "border-teal-700 bg-teal-950/30" : "border-slate-800 bg-slate-950/30"}`}>{checked ? <CheckSquare className="h-4 w-4 text-teal-400" /> : <Square className="h-4 w-4 text-slate-600" />}<span><span className="block text-xs font-semibold text-white">{contact.contactPerson}</span><span className="block text-[10px] text-slate-400"><Users className="mr-1 inline h-3 w-3" />{contact.mobile}</span></span></button>; })}</div></Card>
      <Card className="space-y-4"><div className="flex items-center justify-between border-b border-slate-800 pb-3"><div><h2 className="flex items-center gap-2 text-sm font-bold text-white"><FileSpreadsheet className="h-4 w-4 text-teal-400" />Extracted products & stock line items ({orderItems.length})</h2><p className="text-[11px] text-slate-400">Review quantities, rates, and GST before issuing the order.</p></div><span className="text-xs font-bold text-white">Grand total: ₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div><div className="space-y-2">{orderItems.map((item, index) => { const product = products.find((candidate) => candidate.id === item.productId); const lineTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100) - item.discount; return <div key={`${item.productId}-${index}`} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3 sm:grid-cols-[minmax(0,2fr)_80px_110px_80px_120px_32px] sm:items-end"><label><span className="mb-1 block text-[10px] text-slate-500">Item name</span><select value={item.productId} onChange={(event) => { const next = products.find((candidate) => candidate.id === event.target.value); updateItem(index, { productId: event.target.value, unitPrice: next ? Number(next.sellingPrice) : item.unitPrice, taxRate: next ? Number(next.gstRate) : item.taxRate }); }} className={inputClass}>{products.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><label><span className="mb-1 block text-[10px] text-slate-500">Qty</span><input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 1 })} className={`${inputClass} text-right`} /></label><label><span className="mb-1 block text-[10px] text-slate-500">Price (₹)</span><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) || 0 })} className={`${inputClass} text-right`} /></label><label><span className="mb-1 block text-[10px] text-slate-500">GST %</span><input type="number" min="0" value={item.taxRate} onChange={(event) => updateItem(index, { taxRate: Number(event.target.value) || 0 })} className={`${inputClass} text-right`} /></label><div className="text-right"><span className="mb-1 block text-[10px] text-slate-500">Line total</span><strong className="block py-2 text-xs text-white">₹{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div><button type="button" onClick={() => setOrderItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-2 text-slate-500 hover:bg-rose-950/50 hover:text-rose-300" aria-label={`Remove ${product?.name || "item"}`}><Trash2 className="h-4 w-4" /></button></div>; })}</div><Button type="button" variant="outline" size="sm" onClick={() => { const product = products[0]; if (product) setOrderItems((items) => [...items, { productId: product.id, quantity: 1, unitPrice: Number(product.sellingPrice), taxRate: Number(product.gstRate), discount: 0 }]); }}>+ Add item</Button><div className="ml-auto max-w-xs space-y-1 border-t border-slate-800 pt-3 text-xs"><div className="flex justify-between text-slate-400"><span>Sub total</span><span>₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div><div className="flex justify-between text-slate-400"><span>CGST + SGST</span><span>₹{taxTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div><div className="flex justify-between pt-2 text-sm font-bold text-teal-300"><span>Invoice total</span><span>₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div></div></Card>
      <Card className="grid gap-3 sm:grid-cols-3"><label><span className="mb-1 block text-[10px] text-slate-400">Transporter</span><input value={transporterName} onChange={(event) => setTransporterName(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[10px] text-slate-400">Vehicle number</span><input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} className={`${inputClass} uppercase`} /></label><label><span className="mb-1 block text-[10px] text-slate-400">Distance (KM)</span><input type="number" min="0" value={distanceKm} onChange={(event) => setDistanceKm(Number(event.target.value) || 0)} className={inputClass} /></label><label className="sm:col-span-3"><span className="mb-1 block text-[10px] text-slate-400">Order notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className={inputClass} /></label></Card>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end"><Link to="/operations/orders"><Button type="button" variant="outline">Cancel</Button></Link><Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-500"><CheckCircle2 className="h-4 w-4" />Create order & generate invoice ({orderItems.length} items)</Button></div>
    </form>
  );
};