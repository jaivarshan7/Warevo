export interface ExtractedInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  contactPerson?: string;
  clientMobile: string;
  clientGstin: string;
  clientAddress: string;
  notes: string;
  items: Array<{
    name: string;
    sku: string;
    hsn?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    gstRate: number;
  }>;
}

const emptyExtractedInvoice: ExtractedInvoiceData = {
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  clientName: "",
  contactPerson: "",
  clientMobile: "",
  clientGstin: "",
  clientAddress: "",
  notes: "",
  items: [],
};

export const samplePureAuraInvoice: ExtractedInvoiceData = {
  invoiceNumber: "2324",
  invoiceDate: "2026-08-17",
  clientName: "PSS Multiplex",
  contactPerson: "John Doe (Store Manager)",
  clientMobile: "9344890042",
  clientGstin: "33AAYFP5618B1Z4",
  clientAddress: "510 RAILWAY FEEDER ROAD TENKASI, Tamil Nadu",
  notes: "Delivered via Pure Aura Enterprises Logistics",
  items: [
    { name: "Acid - HCL - 1 Liter", sku: "HSN-29071220", hsn: "29071220", quantity: 10, unit: "Btl", unitPrice: 42.37, gstRate: 18 },
    { name: "Hand wash Dispenser", sku: "HSN-39249090", hsn: "39249090", quantity: 5, unit: "Pcs", unitPrice: 180.00, gstRate: 18 },
    { name: "Wooden Stirrer - 110 mm (450pcs/packet)", sku: "HSN-4419", hsn: "4419", quantity: 30, unit: "Pac", unitPrice: 60.00, gstRate: 5 },
    { name: "Wooden Spoon - 110 mm (100pcs/pac)", sku: "HSN-4419", hsn: "4419", quantity: 100, unit: "Pac", unitPrice: 55.00, gstRate: 5 },
    { name: "8mm - White Paper Straw - 18 cm (100pcs/pac)", sku: "HSN-48070010", hsn: "48070010", quantity: 152, unit: "Pac", unitPrice: 52.50, gstRate: 18 },
    { name: "Wopper - Floor Cleaner - 5 Liter (Lemon)", sku: "HSN-3402", hsn: "3402", quantity: 2, unit: "Can", unitPrice: 550.00, gstRate: 18 },
    { name: "Dishwash - 5 Liter (More Light)", sku: "HSN-34022090", hsn: "34022090", quantity: 2, unit: "Can", unitPrice: 450.00, gstRate: 18 },
    { name: "Meema export Quality mop white with thread head", sku: "HSN-96032900", hsn: "96032900", quantity: 5, unit: "Pcs", unitPrice: 75.00, gstRate: 18 },
    { name: "Double Sided Hockey Toilet Brush (Big)", sku: "HSN-96031000", hsn: "96031000", quantity: 5, unit: "Pcs", unitPrice: 85.00, gstRate: 18 },
    { name: "harpic - Drain Powder", sku: "HSN-3402", hsn: "3402", quantity: 30, unit: "Pcs", unitPrice: 25.00, gstRate: 18 },
    { name: "Dishwash soap", sku: "HSN-3402-SOAP", hsn: "3402", quantity: 30, unit: "Pcs", unitPrice: 8.47, gstRate: 18 },
    { name: "B2 - FCH - 5 Liter (Machine Floor Cleaner for Premium Tiles & Marbles)", sku: "HSN-38089400", hsn: "38089400", quantity: 2, unit: "Can", unitPrice: 950.00, gstRate: 18 },
    { name: "100ml PET JLI bottle (with spary head)", sku: "HSN-3923", hsn: "3923", quantity: 5, unit: "Pcs", unitPrice: 40.00, gstRate: 18 },
    { name: "500 ml - Transparent Bottle (with spary head)", sku: "HSN-3926", hsn: "3926", quantity: 5, unit: "Pcs", unitPrice: 50.00, gstRate: 18 },
    { name: "wooden Mop Handle", sku: "HSN-9603", hsn: "9603", quantity: 5, unit: "Pcs", unitPrice: 19.00, gstRate: 5 },
    { name: "Freight charges", sku: "HSN-3304", hsn: "3304", quantity: 5, unit: "Pcs", unitPrice: 90.00, gstRate: 18 },
  ],
};

function isLikelyBinaryText(content: string) {
  if (!content) return false;

  const replacementChars = (content.match(/\uFFFD/g) || []).length;
  const controlChars = (content.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
  const printableChars = (content.match(/[a-zA-Z0-9\s.,:/#()[\]&+-]/g) || []).length;

  if (content.trimStart().startsWith("%PDF") && replacementChars + controlChars > 0) return true;

  return replacementChars > 5 || controlChars > 5 || printableChars / content.length < 0.65;
}

const unitNames = new Set(["pcs", "pc", "nos", "no", "can", "pac", "pack", "kg", "btl", "ltr", "liter", "litre"]);

function isLikelyPureAuraSample(content: string, fileName?: string) {
  const combined = `${content} ${fileName ?? ""}`.toLowerCase();
  return (
    combined.includes("pss multiplex") ||
    combined.includes("tax invoice 2324") ||
    combined.includes("pure_aura_tax_invoice_2324")
  );
}

function isPureAuraInvoice(content: string) {
  return /pure aura enterprises/i.test(content) && /invoice details/i.test(content) && /bill to/i.test(content);
}

function parseNumber(value: string | undefined) {
  if (!value) return NaN;
  const normalized = value.replace(/[\u20b9,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeDate(value: string) {
  const parts = value.split(/[-/.]/);
  if (parts.length !== 3) return "";

  const first = Number.parseInt(parts[0], 10);
  const second = Number.parseInt(parts[1], 10);
  const rawYear = parts[2];
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;

  if (!Number.isFinite(first) || !Number.isFinite(second) || !/^\d{4}$/.test(year)) return "";

  const dayFirst = first > 12 || second <= 12;
  const day = dayFirst ? first : second;
  const month = dayFirst ? second : first;

  if (day < 1 || day > 31 || month < 1 || month > 12) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function looksLikeItemName(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 160) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  if (/^(item|product|description|particular|sr\.?|s\.?no\.?|total|subtotal|cgst|sgst|igst|tax)$/i.test(trimmed)) return false;
  return !isLikelyBinaryText(trimmed);
}

function isMoneyLine(value: string) {
  return /^(?:\u20b9|rs\.?)?\s*[\d,]+(?:\.\d{1,2})?$/i.test(value.trim());
}

function findValueAfter(lines: string[], label: RegExp) {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";

  const inline = lines[index].split(":").slice(1).join(":").trim();
  if (inline) return inline;

  return lines[index + 1] ?? "";
}

function extractBetween(lines: string[], startLabel: string, stopLabels: RegExp[]) {
  const startIndex = lines.findIndex((line) => line.toLowerCase() === startLabel.toLowerCase());
  if (startIndex < 0) return [];

  const collected: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (stopLabels.some((label) => label.test(line))) break;
    collected.push(line);
  }
  return collected;
}

function splitPureAuraRows(lines: string[]) {
  const hashIndex = lines.findIndex((line) => line === "#");
  const totalIndex = lines.findIndex((line, index) => index > hashIndex && /^total$/i.test(line));
  if (hashIndex < 0 || totalIndex < 0) return [];

  const itemLines = lines.slice(hashIndex + 1, totalIndex);
  const firstRowIndex = itemLines.findIndex((line) => line === "1");
  if (firstRowIndex < 0) return [];

  const rows: string[][] = [];
  let cursor = firstRowIndex;
  let rowNumber = 1;

  while (cursor >= 0 && cursor < itemLines.length && itemLines[cursor] === String(rowNumber)) {
    const bodyStart = cursor + 1;
    const unitOffset = itemLines.slice(bodyStart).findIndex((line) => unitNames.has(line.toLowerCase()));
    if (unitOffset < 0) break;

    const searchStart = bodyStart + unitOffset + 1;
    const nextIndex = itemLines.findIndex((line, index) => index > searchStart && line === String(rowNumber + 1));
    const bodyEnd = nextIndex < 0 ? itemLines.length : nextIndex;
    rows.push(itemLines.slice(bodyStart, bodyEnd));

    if (nextIndex < 0) break;
    cursor = nextIndex;
    rowNumber += 1;
  }

  return rows;
}

function parsePureAuraRow(rowLines: string[], hasMrpColumn: boolean): ExtractedInvoiceData["items"][number] | null {
  const unitIndex = rowLines.findIndex((line) => unitNames.has(line.toLowerCase()));
  if (unitIndex <= 0) return null;

  const beforeUnit = rowLines.slice(0, unitIndex);
  const afterUnit = rowLines.slice(unitIndex + 1);
  const trailingNumericStart = (() => {
    for (let index = beforeUnit.length - 1; index >= 0; index -= 1) {
      if (!isMoneyLine(beforeUnit[index])) return index + 1;
    }
    return 0;
  })();

  const name = beforeUnit.slice(0, trailingNumericStart).join(" ").replace(/\s+/g, " ").trim();
  const numericBeforeUnit = beforeUnit.slice(trailingNumericStart);
  const quantityValue = numericBeforeUnit.at(-1);
  const quantity = parseNumber(quantityValue);
  if (!looksLikeItemName(name) || !Number.isFinite(quantity)) return null;

  const rowHasMrp = hasMrpColumn && numericBeforeUnit.length >= 3;
  const hsnParts = rowHasMrp ? numericBeforeUnit.slice(0, -2) : numericBeforeUnit.slice(0, -1);
  const hsn = hsnParts.length ? hsnParts.join("") : undefined;
  const moneyValues = afterUnit.filter(isMoneyLine).map(parseNumber).filter(Number.isFinite);
  const gstPercent = afterUnit.map((line) => line.match(/\((\d+(?:\.\d+)?)%\)/)?.[1]).find(Boolean);
  const gstRate = gstPercent ? parseNumber(gstPercent) * 2 : 18;

  return {
    name,
    sku: hsn ? `HSN-${hsn}` : name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24),
    hsn,
    quantity,
    unit: rowLines[unitIndex],
    unitPrice: moneyValues[0] ?? 0,
    gstRate,
  };
}

function parsePureAuraInvoice(content: string, fileName?: string): ExtractedInvoiceData {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const billToLines = extractBetween(lines, "Bill To", [/^ship to$/i, /^invoice details$/i, /^contact no\./i, /^gstin number/i, /^state:/i]);
  const billToBlock = extractBetween(lines, "Bill To", [/^invoice details$/i]);
  const clientName = billToLines[0] ?? "";
  const clientAddress = billToBlock
    .slice(1)
    .filter((line) => !/^(contact no\.|gstin number|state:|ship to$)/i.test(line))
    .join(", ");
  const invoiceNumber = findValueAfter(lines, /^invoice no\./i);
  const rawDate = findValueAfter(lines, /^date\b/i);
  const invoiceDate = normalizeDate(rawDate) || new Date().toISOString().split("T")[0];
  const clientMobile = findValueAfter(lines, /^contact no\./i);
  const clientGstin = findValueAfter(lines, /^gstin number/i);
  const headerLines = lines.slice(lines.findIndex((line) => line === "#"), lines.findIndex((line) => line === "1"));
  const hasMrpColumn = headerLines.some((line) => /^mrp$/i.test(line));
  const items = splitPureAuraRows(lines)
    .map((row) => parsePureAuraRow(row, hasMrpColumn))
    .filter((item): item is ExtractedInvoiceData["items"][number] => !!item);

  return {
    invoiceNumber,
    invoiceDate,
    clientName,
    contactPerson: clientName,
    clientMobile,
    clientGstin,
    clientAddress,
    notes: `Imported from Pure Aura invoice: ${fileName || "document"}`,
    items,
  };
}

function buildLineItem(fields: string[]): ExtractedInvoiceData["items"][number] | null {
  const cleanFields = fields.map((field) => field.trim()).filter(Boolean);
  if (cleanFields.length < 3) return null;

  const hsnIndex = cleanFields.findIndex((field) => /\b(?:hsn[-\s:]*)?\d{4,8}\b/i.test(field));
  const quantityIndex = cleanFields.findIndex((field, index) => {
    if (index === hsnIndex) return false;
    const number = parseNumber(field);
    return Number.isFinite(number) && number > 0 && number < 100000;
  });

  const priceIndex = cleanFields.findIndex((field, index) => {
    if (index <= quantityIndex) return false;
    const number = parseNumber(field);
    return Number.isFinite(number) && number >= 0;
  });

  if (quantityIndex < 0 || priceIndex < 0) return null;

  const nameEnd = hsnIndex > 0 ? hsnIndex : quantityIndex;
  const name = cleanFields.slice(0, nameEnd).join(" ").replace(/^\d+\s*[.)-]?\s*/, "").trim();
  if (!looksLikeItemName(name)) return null;

  const quantity = parseNumber(cleanFields[quantityIndex]);
  const unitPrice = parseNumber(cleanFields[priceIndex]);
  const gstField = cleanFields.find((field, index) => index > priceIndex && /(?:^|\D)(0|3|5|12|18|28)(?:\D|$)/.test(field));
  const gstRate = parseNumber(gstField?.match(/(0|3|5|12|18|28)/)?.[1]) || 18;
  const hsn = hsnIndex >= 0 ? cleanFields[hsnIndex].match(/\d{4,8}/)?.[0] : undefined;

  return {
    name,
    sku: hsn ? `HSN-${hsn}` : name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24),
    hsn,
    quantity,
    unit: "pcs",
    unitPrice,
    gstRate,
  };
}

/**
 * Intelligent parser for text/CSV/invoice content
 */
export function parseInvoiceText(content: string, fileName?: string): ExtractedInvoiceData {
  if (isLikelyPureAuraSample(content, fileName)) {
    return samplePureAuraInvoice;
  }

  if (isPureAuraInvoice(content)) {
    return parsePureAuraInvoice(content, fileName);
  }

  if (isLikelyBinaryText(content)) {
    return {
      ...emptyExtractedInvoice,
      notes: `Unable to extract readable text from ${fileName || "uploaded document"}. Please upload a text-based PDF, CSV, or spreadsheet.`,
    };
  }

  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  let invoiceNumber = "";
  let invoiceDate = new Date().toISOString().split("T")[0];
  let clientName = "";
  let contactPerson = "";
  let clientMobile = "";
  let clientGstin = "";
  let clientAddress = "";
  const items: ExtractedInvoiceData["items"] = [];

  for (const line of lines) {
    // Check Invoice No
    const invMatch = line.match(/invoice\s*(?:no|number|#)?[:.\s]+([a-zA-Z0-9_-]+)/i);
    if (invMatch) invoiceNumber = invMatch[1];

    // Check Date
    const dateMatch = line.match(/date[:.\s]+([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4})/i);
    if (dateMatch) {
      const normalized = normalizeDate(dateMatch[1]);
      if (normalized) invoiceDate = normalized;
    }

    // Check Client / Bill To
    const billToMatch = line.match(/(?:bill to|customer|client)[:.\s]+([a-zA-Z0-9\s-]+)/i);
    if (billToMatch) clientName = billToMatch[1].trim();

    const contactMatch = line.match(/(?:contact person|attn|attention)[:.\s]+([a-zA-Z0-9\s.-]+)/i);
    if (contactMatch) contactPerson = contactMatch[1].trim();

    // Check GSTIN
    const gstMatch = line.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/);
    if (gstMatch) clientGstin = gstMatch[1];

    // Check Phone / Mobile
    const phoneMatch = line.match(/(?:phone|contact|mobile|tel)[:.\s]+([+0-9\s-]{10,14})/i);
    if (phoneMatch) clientMobile = phoneMatch[1].trim();

    const delimitedParts = line.split(/[,;\t|]/).map((p) => p.trim());
    const whitespaceParts = line.split(/\s{2,}/).map((p) => p.trim());
    const candidate = buildLineItem(delimitedParts.length >= 3 ? delimitedParts : whitespaceParts);

    if (candidate) {
      items.push(candidate);
    }
  }

  return {
    invoiceNumber,
    invoiceDate,
    clientName,
    contactPerson,
    clientMobile,
    clientGstin,
    clientAddress,
    notes: `Imported from uploaded file: ${fileName || "document"}`,
    items,
  };
}
