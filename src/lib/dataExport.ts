export interface DataExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T, index: number) => string | number | null | undefined);
  width?: number;
}

export interface DataExportOptions<T> {
  title: string;
  subtitle?: string;
  filename: string;
  sheetName?: string;
  columns: DataExportColumn<T>[];
  rows: T[];
  summary?: Array<[string, string | number]>;
}

function getCellValue<T>(row: T, column: DataExportColumn<T>, index: number) {
  const value = typeof column.accessor === 'function'
    ? column.accessor(row, index)
    : row[column.accessor];
  return value ?? '-';
}

function safeFilename(filename: string, extension: string) {
  const clean = filename.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return clean.toLowerCase().endsWith(`.${extension}`) ? clean : `${clean}.${extension}`;
}

export async function exportToXlsx<T>(options: DataExportOptions<T>) {
  const XLSX = await import('xlsx');
  const wsData: (string | number)[][] = [];

  wsData.push([options.title]);
  if (options.subtitle) wsData.push(['Periode/Filter', options.subtitle]);
  if (options.summary?.length) {
    options.summary.forEach(([label, value]) => wsData.push([label, value]));
  }
  wsData.push([]);
  wsData.push(options.columns.map((column) => column.header));

  options.rows.forEach((row, index) => {
    wsData.push(options.columns.map((column) => String(getCellValue(row, column, index))));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  worksheet['!cols'] = options.columns.map((column) => ({ wch: column.width || 18 }));
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, options.columns.length - 1) } }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Data');
  XLSX.writeFile(workbook, safeFilename(options.filename, 'xlsx'));
}

export async function exportToPdf<T>(options: DataExportOptions<T>) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SMPIT Digital Islamic Boarding School', centerX, 15, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Jln. Bintang Mujur, Pangkajene Kepulauan, Sulawesi Selatan', centerX, 21, { align: 'center' });
  doc.text('Website: digiss.co.id | Email: digissemail@gmail.com', centerX, 26, { align: 'center' });
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(14, 30, pageWidth - 14, 30);
  doc.setLineWidth(0.25);
  doc.line(14, 31, pageWidth - 14, 31);

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title.toUpperCase(), centerX, 39, { align: 'center' });

  let infoY = 48;
  if (options.subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Filter', 14, infoY);
    doc.text(':', 42, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(options.subtitle, 46, infoY);
    infoY += 6;
  }

  options.summary?.forEach(([label, value]) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 14, infoY);
    doc.text(':', 42, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), 46, infoY);
    infoY += 6;
  });

  autoTable(doc, {
    startY: infoY + 4,
    head: [options.columns.map((column) => column.header)],
    body: options.rows.map((row, index) => options.columns.map((column) => String(getCellValue(row, column, index)))),
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Halaman ${page} dari ${pageCount}`, pageWidth - 14, 202, { align: 'right' });
  }

  doc.save(safeFilename(options.filename, 'pdf'));
}
