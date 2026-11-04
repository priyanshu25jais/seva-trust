const fs = require("fs");
const path = require("path");

const fontDir = path.join(__dirname, "..", "server", "assets", "fonts");
const fontCandidates = [
  "NotoSansDevanagari-Regular.ttf",
  "NotoSansDevanagari.ttf",
  "NotoSansDevanagari-Regular.otf",
  "NotoSansDevanagari-VariableFont_wdth,wght.ttf",
];

function findFont() {
  for (const name of fontCandidates) {
    const fontPath = path.join(fontDir, name);
    if (fs.existsSync(fontPath)) {
      return fontPath;
    }
  }
  return null;
}

function loadPdfKit() {
  try {
    return require("pdfkit");
  } catch {
    return require(path.join(__dirname, "..", "server", "node_modules", "pdfkit"));
  }
}

const fontPath = findFont();
if (!fontPath) {
  console.error(
    [
      "Noto Sans Devanagari font file is missing.",
      "Download NotoSansDevanagari-Regular.ttf (Google Fonts / Noto) and put it here:",
      fontDir,
    ].join("\n")
  );
  process.exit(1);
}

const PDFDocument = loadPdfKit();
const outDir = path.join(__dirname, "out");
const outPath = path.join(outDir, "smoke.pdf");
fs.mkdirSync(outDir, { recursive: true });

const doc = new PDFDocument({ size: "A4", margin: 72 });
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);
doc.font(fontPath).fontSize(18).text("सेवा ट्रस्ट", { align: "left" });
doc.end();

stream.on("finish", () => {
  console.log(`Wrote Hindi smoke PDF: ${outPath}`);
});
stream.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
