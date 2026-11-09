const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { env } = require("../config/env");
const { formatDateIst } = require("../utils/financialYear");
const { amountInWords } = require("../utils/amountInWords");

const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");
const INK = "#1b2b34";
const MUTED = "#5b6b73";
const ACCENT = "#0f5c54";

function findFont() {
  if (!fs.existsSync(FONT_DIR)) return null;
  const file = fs.readdirSync(FONT_DIR).find((f) => /^NotoSansDevanagari.*\.(ttf|otf)$/i.test(f));
  return file ? path.join(FONT_DIR, file) : null;
}

// Receipts are immutable, so a rendered PDF can be cached by receipt number.
const cache = new Map();
const CACHE_MAX = 200;

function rupees(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}.00`;
}

// The font ships one weight, so headings get a light outline to look bold.
function heading(doc, text, x, y, size, color, opts = {}) {
  doc.fontSize(size).fillColor(color).strokeColor(color).lineWidth(size * 0.025);
  doc.text(text, x, y, { fill: true, stroke: true, ...opts });
  doc.lineWidth(1);
}

/**
 * Render the 80G donation receipt and certificate from the receipt snapshot only.
 * Returns a Buffer. Includes the fields the brief requires: trust PAN, 80G
 * registration number, donor name, donor PAN and amount.
 */
function renderReceiptPdf(receipt) {
  const fontPath = findFont();
  if (!fontPath) {
    throw new Error(`Noto Sans Devanagari font not found in ${FONT_DIR}`);
  }
  const snap = receipt.snapshot;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 56,
      info: {
        Title: `Donation receipt ${receipt.receiptNo}`,
        Author: env.TRUST_NAME,
        CreationDate: snap.date,
      },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("noto", fontPath);
    doc.font("noto");
    const left = 56;
    const width = doc.page.width - left * 2;

    // Header
    doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);
    heading(doc, env.TRUST_NAME_HI, left, 44, 24, INK);
    doc.fontSize(11).fillColor(MUTED).text(`${env.TRUST_NAME} · Bhopal, Madhya Pradesh`, left, 78);
    doc.moveTo(left, 104).lineTo(left + width, 104).strokeColor("#d5dcdf").lineWidth(1).stroke();

    heading(doc, "दान रसीद एवं 80G प्रमाणपत्र", left, 120, 17, ACCENT);
    doc.fontSize(10).fillColor(MUTED).text("Donation receipt and 80G certificate", left, 144);

    // Receipt facts
    let y = 176;
    const rows = [
      ["रसीद संख्या / Receipt number", receipt.receiptNo],
      ["दिनांक / Date", formatDateIst(snap.date)],
      ["दानदाता / Received from", snap.donorName],
      ["दानदाता पैन / Donor PAN", snap.donorPan || "Not provided"],
      ["राशि / Amount", rupees(snap.amount)],
      ["शब्दों में / In words", amountInWords(snap.amount)],
      [
        "उद्देश्य / Towards",
        snap.campaignTitleHi && snap.campaignTitleHi !== snap.campaignTitle
          ? `${snap.campaignTitleHi} / ${snap.campaignTitle}`
          : snap.campaignTitle,
      ],
    ];
    const labelW = 190;
    const valueX = left + labelW + 10;
    const valueW = width - labelW - 10;
    for (const [label, value] of rows) {
      doc.fontSize(9.5).fillColor(MUTED);
      const labelH = doc.heightOfString(label, { width: labelW });
      doc.fontSize(12);
      const valueH = doc.heightOfString(String(value), { width: valueW });
      const rowH = Math.max(labelH, valueH);
      doc.fontSize(9.5).fillColor(MUTED).text(label, left, y, { width: labelW });
      doc.fontSize(12).fillColor(INK).text(String(value), valueX, y, { width: valueW });
      y += rowH + 12;
    }

    // Trust registration details
    y += 6;
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor("#d5dcdf").stroke();
    y += 14;
    heading(doc, "ट्रस्ट का पंजीकरण / Trust registration", left, y, 11, ACCENT);
    y += 24;
    const trustRows = [
      ["ट्रस्ट पैन / Trust PAN", env.TRUST_PAN],
      ["80G पंजीकरण संख्या / 80G registration number", env.TRUST_80G_NUMBER],
    ];
    for (const [label, value] of trustRows) {
      doc.fontSize(9.5).fillColor(MUTED).text(label, left, y, { width: labelW });
      doc.fontSize(12).fillColor(INK).text(value, valueX, y, { width: valueW });
      y += 26;
    }

    // Statement and illustrative notice
    y += 10;
    doc
      .fontSize(10)
      .fillColor(INK)
      .text(
        "यह रसीद स्वैच्छिक दान की प्राप्ति की पुष्टि करती है। धारा 80G के अंतर्गत कटौती ट्रस्ट के ऊपर दिए गए 80G पंजीकरण पर निर्भर करती है।",
        left,
        y,
        { width }
      );
    y = doc.y + 6;
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        "This receipt acknowledges a voluntary donation. Eligibility for a deduction under section 80G depends on the trust's 80G registration shown above.",
        left,
        y,
        { width }
      );

    doc
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        "Illustrative document for a demonstration. The trust name, PAN and 80G number are placeholders and this receipt is not valid for tax claims.",
        left,
        doc.page.height - 90,
        { width }
      );

    doc.end();
  });
}

async function getReceiptPdf(receipt) {
  const key = receipt.receiptNo;
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit); // refresh recency
    return hit;
  }
  const buffer = await renderReceiptPdf(receipt);
  cache.set(key, buffer);
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  return buffer;
}

function clearPdfCache() {
  cache.clear();
}

module.exports = { renderReceiptPdf, getReceiptPdf, clearPdfCache, findFont };
