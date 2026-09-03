import { inflateSync } from "node:zlib";

type PdfObject = {
  id: number;
  body: string;
};

type CMap = Map<string, string>;

function getPdfObjects(pdf: string) {
  return Array.from(pdf.matchAll(/(?:^|\r?\n)(\d+)\s+0\s+obj\r?\n([\s\S]*?)\r?\nendobj/g), (match) => ({
    id: Number.parseInt(match[1], 10),
    body: match[2],
  }));
}

function getStreamBody(body: string) {
  const streamStart = body.indexOf("stream");
  const streamEnd = body.lastIndexOf("endstream");
  if (streamStart < 0 || streamEnd < 0 || streamEnd <= streamStart) return null;

  let raw = body.slice(streamStart + "stream".length, streamEnd);
  raw = raw.replace(/^\r?\n/, "").replace(/\r?\n$/, "");

  let buffer = Buffer.from(raw, "latin1");
  if (/\/FlateDecode\b/.test(body)) {
    try {
      buffer = inflateSync(buffer);
    } catch {
      return null;
    }
  }

  return buffer.toString("latin1");
}

function decodeUnicodeHex(hex: string) {
  const bytes = hex.replace(/\s+/g, "");
  const chars: string[] = [];

  for (let index = 0; index + 3 < bytes.length; index += 4) {
    chars.push(String.fromCharCode(Number.parseInt(bytes.slice(index, index + 4), 16)));
  }

  return chars.join("");
}

function parseCMap(cmapText: string) {
  const map: CMap = new Map();

  for (const section of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const row of section[1].matchAll(/<([\da-fA-F]+)>\s+<([\da-fA-F]+)>/g)) {
      map.set(row[1].toUpperCase(), decodeUnicodeHex(row[2]));
    }
  }

  for (const section of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const row of section[1].matchAll(/<([\da-fA-F]+)>\s+<([\da-fA-F]+)>\s+<([\da-fA-F]+)>/g)) {
      const start = Number.parseInt(row[1], 16);
      const end = Number.parseInt(row[2], 16);
      const unicodeStart = Number.parseInt(row[3], 16);

      for (let code = start; code <= end; code += 1) {
        const source = code.toString(16).toUpperCase().padStart(row[1].length, "0");
        map.set(source, String.fromCharCode(unicodeStart + code - start));
      }
    }
  }

  return map;
}

function buildFontMaps(objects: PdfObject[]) {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const fontMaps = new Map<string, CMap>();

  for (const object of objects) {
    if (!/\/Type\s*\/Font\b/.test(object.body)) continue;

    const unicodeRef = object.body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/)?.[1];
    if (!unicodeRef) continue;

    const cmapStream = getStreamBody(byId.get(Number.parseInt(unicodeRef, 10))?.body ?? "");
    if (!cmapStream) continue;

    const resourceNames = Array.from(
      objects
        .map((candidate) => candidate.body.match(new RegExp(`/([A-Za-z][A-Za-z0-9]*)\\s+${object.id}\\s+0\\s+R`, "g")) ?? [])
        .flat(),
      (match) => match.match(/\/([A-Za-z][A-Za-z0-9]*)/)?.[1]
    ).filter((name): name is string => !!name);

    for (const resourceName of resourceNames) {
      fontMaps.set(resourceName, parseCMap(cmapStream));
    }
  }

  return fontMaps;
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
      const map: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        "(": "(",
        ")": ")",
        "\\": "\\",
      };
      return map[escaped] ?? escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function decodeHexGlyphs(hex: string, cmap?: CMap) {
  const cleanHex = hex.replace(/\s+/g, "").toUpperCase();
  if (!cmap) return Buffer.from(cleanHex, "hex").toString("latin1");

  const pieces: string[] = [];
  for (let index = 0; index < cleanHex.length; index += 2) {
    const code = cleanHex.slice(index, index + 2);
    pieces.push(cmap.get(code) ?? "");
  }

  return pieces.join("");
}

function appendText(lines: string[], value: string) {
  if (!value) return;
  if (lines.length === 0) lines.push("");
  lines[lines.length - 1] += value;
}

function startNewLine(lines: string[]) {
  if (lines.length === 0 || lines[lines.length - 1].trim()) {
    lines.push("");
  }
}

function extractMappedText(stream: string, fontMaps: Map<string, CMap>) {
  const lines: string[] = [];
  let currentFont = "";

  const operatorPattern =
    /\/([A-Za-z][A-Za-z0-9]*)\s+[-.\d]+\s+Tf|(?:[-.\d]+\s+){5}[-.\d]+\s+Tm|([-.\d]+)\s+([-.\d]+)\s+Td|<([\da-fA-F\s]+)>\s*Tj|\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;

  for (const match of stream.matchAll(operatorPattern)) {
    if (match[1]) {
      currentFont = match[1];
      continue;
    }

    if (match[0].endsWith("Tm")) {
      startNewLine(lines);
      continue;
    }

    if (match[2] && Math.abs(Number.parseFloat(match[3])) > 1) {
      startNewLine(lines);
      continue;
    }

    if (match[4]) {
      appendText(lines, decodeHexGlyphs(match[4], fontMaps.get(currentFont)));
      continue;
    }

    if (match[5]) {
      appendText(lines, decodePdfLiteral(match[5]));
    }
  }

  return lines;
}

export function extractTextFromPdf(buffer: Buffer) {
  const pdf = buffer.toString("latin1");
  const objects = getPdfObjects(pdf);
  const fontMaps = buildFontMaps(objects);
  const lines: string[] = [];

  for (const object of objects) {
    const stream = getStreamBody(object.body);
    if (!stream || !stream.includes("Tj")) continue;
    lines.push(...extractMappedText(stream, fontMaps));
  }

  return lines
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
