export type TokenExportMode = 'tokens' | 'qr' | 'both';

export type ExportableToken = {
  code: string;
  duration_days: number;
  assigned_at: string;
  expires_at: string;
};

type ExportOptions = {
  mode: TokenExportMode;
  includePdf: boolean;
  baseName: string;
  cardTemplateUrl?: string;
  onProgress?: (completed: number, total: number) => void;
};

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

function createCsv(tokens: ExportableToken[]): string {
  const rows = [
    ['Token', 'Duración (días)', 'Generado', 'Expira'],
    ...tokens.map((token) => [token.code, token.duration_days, token.assigned_at, token.expires_at]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(token: string): string {
  return token.replace(/[\\/:*?"<>|]/g, '_');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportGeneratedTokens(tokens: ExportableToken[], options: ExportOptions) {
  if (tokens.length === 0) return;

  const csv = createCsv(tokens);
  if (options.mode === 'tokens') {
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${options.baseName}.csv`);
    return;
  }

  const [{ default: QRCode }, { default: JSZip }] = await Promise.all([import('qrcode'), import('jszip')]);
  const zip = new JSZip();
  const qrFolder = zip.folder('qr-codes');
  if (!qrFolder) throw new Error('No se pudo crear la carpeta de códigos QR');

  if (options.mode === 'both') zip.file(`${options.baseName}.csv`, csv);

  let pdf: InstanceType<(typeof import('jspdf'))['jsPDF']> | null = null;
  let cardTemplateDataUrl: string | null = null;
  if (options.includePdf) {
    const { jsPDF } = await import('jspdf');
    pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: options.cardTemplateUrl ? 'letter' : 'a4',
    });
    if (options.cardTemplateUrl) {
      const response = await fetch(options.cardTemplateUrl);
      if (!response.ok) throw new Error('No se pudo cargar el diseño de tarjeta');
      cardTemplateDataUrl = await blobToDataUrl(await response.blob());
    }
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    // The QR payload is exactly the raw token—no URL, label, or metadata.
    const dataUrl = await QRCode.toDataURL(token.code, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    qrFolder.file(`${safeFilename(token.code)}.png`, dataUrl.split(',')[1], { base64: true });

    if (pdf) {
      if (cardTemplateDataUrl) {
        const itemOnPage = index % 8;
        if (index > 0 && itemOnPage === 0) pdf.addPage();
        const column = itemOnPage % 2;
        const row = Math.floor(itemOnPage / 2);
        const cardWidth = 85.6;
        const cardHeight = 54;
        const horizontalGap = 5;
        const verticalGap = 3;
        const pageWidth = 215.9;
        const pageHeight = 279.4;
        const gridWidth = cardWidth * 2 + horizontalGap;
        const gridHeight = cardHeight * 4 + verticalGap * 3;
        const cardX = (pageWidth - gridWidth) / 2 + column * (cardWidth + horizontalGap);
        const cardY = (pageHeight - gridHeight) / 2 + row * (cardHeight + verticalGap);

        pdf.addImage(cardTemplateDataUrl, 'PNG', cardX, cardY, cardWidth, cardHeight, 'card-template', 'FAST');
        pdf.addImage(dataUrl, 'PNG', cardX + 56.1, cardY + 21.4, 16.1, 16.1);
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(token.code.length > 18 ? 7.5 : token.code.length > 14 ? 8.5 : 10);
        pdf.setTextColor(66, 12, 24);
        pdf.text(token.code, cardX + 64.2, cardY + 44.6, { align: 'center', maxWidth: 34 });

        // Small external crop marks preserve the artwork while making the cards easy to trim.
        pdf.setDrawColor(110);
        pdf.setLineWidth(0.12);
        const mark = 2;
        const offset = 0.7;
        for (const [x, y, xDirection, yDirection] of [
          [cardX, cardY, -1, -1],
          [cardX + cardWidth, cardY, 1, -1],
          [cardX, cardY + cardHeight, -1, 1],
          [cardX + cardWidth, cardY + cardHeight, 1, 1],
        ] as const) {
          pdf.line(x + xDirection * offset, y, x + xDirection * (offset + mark), y);
          pdf.line(x, y + yDirection * offset, x, y + yDirection * (offset + mark));
        }
        pdf.setTextColor(0);
      } else {
        const itemOnPage = index % 12;
        if (index > 0 && itemOnPage === 0) pdf.addPage();
        const column = itemOnPage % 3;
        const row = Math.floor(itemOnPage / 3);
        const cellX = 8 + column * 66;
        const cellY = 10 + row * 72;
        pdf.setDrawColor(220);
        pdf.roundedRect(cellX, cellY, 62, 66, 2, 2);
        pdf.addImage(dataUrl, 'PNG', cellX + 10, cellY + 4, 42, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(token.code, cellX + 31, cellY + 53, { align: 'center', maxWidth: 56 });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100);
        pdf.text(`${token.duration_days} ${token.duration_days === 1 ? 'día' : 'días'}`, cellX + 31, cellY + 59, {
          align: 'center',
        });
        pdf.setTextColor(0);
      }
    }

    options.onProgress?.(index + 1, tokens.length);
  }

  if (pdf) zip.file(`${options.baseName}-imprimible.pdf`, pdf.output('arraybuffer'));

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(zipBlob, `${options.baseName}.zip`);
}
