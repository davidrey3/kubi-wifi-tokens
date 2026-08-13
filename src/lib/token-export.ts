export type TokenExportMode = 'tokens' | 'cards' | 'both';

export type CardTokenBox = { x: number; y: number; width: number; height: number };
export const DEFAULT_CARD_TOKEN_BOX: CardTokenBox = { x: 0.56, y: 0.43, width: 0.38, height: 0.34 };

export type ExportableToken = {
  code: string;
  duration_days: number;
  assigned_at: string;
  expires_at: string;
};

type ExportOptions = {
  mode: TokenExportMode;
  baseName: string;
  cardTemplateUrl?: string;
  cardTokenBox?: CardTokenBox;
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

  if (options.mode === 'tokens' || options.mode === 'both') {
    const csv = createCsv(tokens);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${options.baseName}.csv`);
  }

  if (options.mode === 'tokens') return;
  if (!options.cardTemplateUrl) throw new Error('Debes subir un diseño de tarjeta antes de crear el PDF');

  const [{ jsPDF }, templateResponse] = await Promise.all([
    import('jspdf'),
    fetch(options.cardTemplateUrl),
  ]);
  if (!templateResponse.ok) throw new Error('No se pudo cargar el diseño de tarjeta');
  const cardTemplateDataUrl = await blobToDataUrl(await templateResponse.blob());

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const cardWidth = 85.6;
  const cardHeight = 54;
  const horizontalGap = 5;
  const verticalGap = 3;
  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const gridWidth = cardWidth * 2 + horizontalGap;
  const gridHeight = cardHeight * 4 + verticalGap * 3;
  const tokenBox = options.cardTokenBox ?? DEFAULT_CARD_TOKEN_BOX;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const itemOnPage = index % 8;
    if (index > 0 && itemOnPage === 0) pdf.addPage();
    const column = itemOnPage % 2;
    const row = Math.floor(itemOnPage / 2);
    const cardX = (pageWidth - gridWidth) / 2 + column * (cardWidth + horizontalGap);
    const cardY = (pageHeight - gridHeight) / 2 + row * (cardHeight + verticalGap);

    pdf.addImage(cardTemplateDataUrl, 'PNG', cardX, cardY, cardWidth, cardHeight, 'card-template', 'FAST');

    // The uploaded artwork reserves this right-side area for the access token.
    pdf.setFont('courier', 'bold');
    const baseFontSize = 16 * Math.min(tokenBox.height / DEFAULT_CARD_TOKEN_BOX.height, tokenBox.width / DEFAULT_CARD_TOKEN_BOX.width);
    pdf.setFontSize((token.code.length > 18 ? 0.7 : token.code.length > 14 ? 0.82 : 1) * baseFontSize);
    pdf.setTextColor(86, 20, 32);
    pdf.text(token.code, cardX + cardWidth * (tokenBox.x + tokenBox.width / 2), cardY + cardHeight * (tokenBox.y + tokenBox.height * 0.58), {
      align: 'center',
      maxWidth: cardWidth * tokenBox.width * 0.92,
    });

    // Small external crop marks make the eight cards easy to trim.
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

    options.onProgress?.(index + 1, tokens.length);
  }

  downloadBlob(pdf.output('blob'), `${options.baseName}-tarjetas.pdf`);
}
