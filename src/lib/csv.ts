/**
 * Exportação para planilha (CSV). Usa ponto e vírgula e BOM UTF-8 para abrir
 * direto no Excel em português com acentos e vírgula decimal corretos.
 */
type Cell = string | number | null | undefined;

const escapeCell = (value: Cell): string => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number'
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
    : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCSV(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map(row => row.map(escapeCell).join(';')).join('\r\n');
}

export function downloadCSV(filename: string, header: string[], rows: Cell[][]) {
  const blob = new Blob(['﻿' + toCSV(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome de arquivo seguro a partir de um texto livre (ex.: nome da mesa). */
export const slug = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mesa';
