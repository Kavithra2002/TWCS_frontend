import type { jsPDF } from 'jspdf';

export interface ReportPdfStat {
  label: string;
  value: string;
}

export interface ReportPdfCompanionChart {
  title: string;
  element: HTMLElement;
}

export interface ReportPdfOptions {
  title: string;
  subtitle: string;
  meta: string[];
  stats: ReportPdfStat[];
  chartElement: HTMLElement | null;
  /** Extra charts printed below the main chart at half size (2-column grid). */
  companionCharts?: ReportPdfCompanionChart[];
  tableTitle: string;
  tableHead: string[];
  tableBody: string[][];
  filename: string;
}

/** Client-side PDF: cover meta, optional chart snapshot, summary stats, data table. */
export async function exportReportPdf(opts: ReportPdfOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('html2canvas'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text(opts.title, margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(opts.subtitle, margin, y);
  y += 6;

  doc.setFontSize(9);
  for (const line of opts.meta) {
    doc.text(line, margin, y);
    y += 4.5;
  }
  y += 3;

  if (opts.stats.length) {
    const colW = (pageW - margin * 2) / Math.min(opts.stats.length, 5);
    opts.stats.forEach((stat, i) => {
      const x = margin + (i % 5) * colW;
      const row = Math.floor(i / 5);
      const sy = y + row * 12;
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(stat.label.toUpperCase(), x, sy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text(stat.value, x, sy + 5);
      doc.setFont('helvetica', 'normal');
    });
    y += Math.ceil(opts.stats.length / 5) * 12 + 4;
  }

  let mainChartH = 0;

  if (opts.chartElement) {
    const canvas = await html2canvas(opts.chartElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    const img = canvas.toDataURL('image/png');
    const maxW = pageW - margin * 2;
    const maxH = pageH - y - 28;
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.addImage(img, 'PNG', margin, y, w, h);
    mainChartH = h;
    y += h + 6;
  }

  const companions = opts.companionCharts?.filter((c) => c.element) ?? [];
  if (companions.length) {
    const gap = 4;
    const colW = (pageW - margin * 2 - gap) / 2;
    // Half the main chart height; fall back if main chart was missing
    const cellH = mainChartH > 0 ? mainChartH / 2 : 42;
    const titleH = 5;

    for (let i = 0; i < companions.length; i++) {
      const col = i % 2;
      if (col === 0) {
        const rowH = titleH + cellH + 4;
        if (y + rowH > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      }

      const x = margin + col * (colW + gap);
      const chart = companions[i];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39);
      doc.text(chart.title, x, y + 3);

      const canvas = await html2canvas(chart.element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const img = canvas.toDataURL('image/png');
      const ratio = Math.min(colW / canvas.width, cellH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      doc.addImage(img, 'PNG', x, y + titleH, w, h);

      if (col === 1 || i === companions.length - 1) {
        y += titleH + cellH + 4;
      }
    }
    y += 2;
  }

  if (y > pageH - 40) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(opts.tableTitle, margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [opts.tableHead],
    body: opts.tableBody,
    styles: { fontSize: 7.5, cellPadding: 1.6, textColor: [31, 41, 55] },
    headStyles: { fillColor: [46, 152, 98], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      footer(doc, doc.getNumberOfPages(), pageW, pageH);
    },
  });

  doc.save(opts.filename);
}

function footer(doc: jsPDF, page: number, pageW: number, pageH: number) {
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('TWCS · Tea Withering Control System', 14, pageH - 6);
  doc.text(`Page ${page}`, pageW - 14, pageH - 6, { align: 'right' });
}
