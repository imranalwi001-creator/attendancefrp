import type jsPDFType from "jspdf";

function safeFilename(name: string, ext: string) {
  const clean = String(name || "dokumen")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .trim();
  return clean.toLowerCase().endsWith(`.${ext}`) ? clean : `${clean}.${ext}`;
}

function header(doc: jsPDFType, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setTextColor(0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ruangblajar.com", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text("The Integrated Learning Ecosystem", 14, 19);

  doc.setDrawColor(14, 165, 139); // teal-ish
  doc.setLineWidth(0.8);
  doc.line(14, 23, pageWidth - 14, 23);

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, pageWidth - 14, 16, { align: "right" });

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(subtitle, pageWidth - 14, 20, { align: "right" });
  }
}

function footer(doc: jsPDFType) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Halaman ${page} dari ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: "right" });
  }
}

export async function exportPerangkatAtpPdf(args: {
  filename: string;
  title: string;
  subtitle?: string;
  meta?: Array<[string, string]>;
  rows: Array<{
    pertemuan: number;
    materi_pokok: string;
    tujuan_pembelajaran: string;
    aktivitas_inti: string[];
    asesmen: string[];
  }>;
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF("portrait", "mm", "a4");
  header(doc, args.title, args.subtitle);

  let y = 30;
  if (args.meta?.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70);
    for (const [k, v] of args.meta) {
      doc.text(String(k), 14, y);
      doc.text(":", 48, y);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(String(v || "-"), 52, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(70);
      y += 5;
    }
    y += 2;
  }

  autoTable(doc, {
    startY: y,
    head: [["#", "Materi Pokok", "Tujuan Pembelajaran", "Aktivitas Inti", "Asesmen"]],
    body: args.rows.map((r) => [
      String(r.pertemuan),
      r.materi_pokok || "-",
      r.tujuan_pembelajaran || "-",
      (r.aktivitas_inti || []).join("\n") || "-",
      (r.asesmen || []).join("\n") || "-",
    ]),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [14, 165, 139], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 45 },
      2: { cellWidth: 50 },
      3: { cellWidth: 40 },
      4: { cellWidth: 40 },
    },
  });

  footer(doc);
  doc.save(safeFilename(args.filename, "pdf"));
}

export async function exportPerangkatModulAjarPdf(args: {
  filename: string;
  title: string;
  subtitle?: string;
  meta?: Array<[string, string]>;
  sections: Array<{ title: string; content_md: string }>;
}) {
  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
  const doc = new jsPDF("portrait", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  header(doc, args.title, args.subtitle);
  let y = 30;

  if (args.meta?.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70);
    for (const [k, v] of args.meta) {
      doc.text(String(k), 14, y);
      doc.text(":", 48, y);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(String(v || "-"), 52, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(70);
      y += 5;
    }
    y += 2;
  }

  doc.setTextColor(0);
  for (const sec of args.sections) {
    const title = String(sec.title || "").trim() || "Bagian";
    const content = String(sec.content_md || "").trim();

    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(content || "-", pageWidth - 28);
    for (const ln of lines) {
      if (y > 285) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(ln), 14, y);
      y += 4;
    }
    y += 2;
  }

  footer(doc);
  doc.save(safeFilename(args.filename, "pdf"));
}

export async function exportPerangkatAtpXlsx(args: {
  filename: string;
  sheetName?: string;
  title: string;
  meta?: Array<[string, string]>;
  rows: Array<{
    pertemuan: number;
    materi_pokok: string;
    tujuan_pembelajaran: string;
    aktivitas_inti: string[];
    asesmen: string[];
  }>;
}) {
  const XLSX = await import("xlsx");
  const wsData: (string | number)[][] = [];

  wsData.push([args.title]);
  (args.meta || []).forEach(([k, v]) => wsData.push([k, v]));
  wsData.push([]);
  wsData.push(["Pertemuan", "Materi Pokok", "Tujuan Pembelajaran", "Aktivitas Inti", "Asesmen"]);

  args.rows.forEach((r) => {
    wsData.push([
      r.pertemuan,
      r.materi_pokok || "-",
      r.tujuan_pembelajaran || "-",
      (r.aktivitas_inti || []).join("\n") || "-",
      (r.asesmen || []).join("\n") || "-",
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  worksheet["!cols"] = [{ wch: 10 }, { wch: 32 }, { wch: 38 }, { wch: 30 }, { wch: 26 }];
  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, args.sheetName || "ATP");
  XLSX.writeFile(workbook, safeFilename(args.filename, "xlsx"));
}

