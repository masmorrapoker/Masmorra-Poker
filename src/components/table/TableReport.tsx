import { Copy, Download, Printer, X } from 'lucide-react';
import type { PlayerSummary, Table, Transaction, Player } from '../../types';
import type { TableTotals } from '../../lib/tableMath';
import { describeAcerto, formatDuration, mergeByPlayer } from '../../lib/tableMath';
import { paymentLabel } from '../../lib/paymentMethods';
import { downloadCSV, slug } from '../../lib/csv';
import { formatMoney, formatDateTime } from '../../utils';
import { toast } from '../Toast';

interface TableReportProps {
  clubName: string | null;
  table: Table;
  summaries: PlayerSummary[];
  totals: TableTotals;
  transactions: Transaction[];
  players: Player[];
  onClose: () => void;
}

const signed = (v: number) => `${v > 0 ? '+' : ''}${formatMoney(v)}`;

/** Mesas antigas não têm acerto registrado; só mostra quando há informação. */
const hasAcertoInfo = (list: PlayerSummary[]) =>
  list.some(s => s.acerto && (s.acerto.method || s.acerto.fiado > 0 || s.acerto.abatido > 0));

/** Texto do relatório para colar no WhatsApp (negrito com *asteriscos*). */
export function buildReportText(clubName: string | null, table: Table, summaries: PlayerSummary[], totals: TableTotals): string {
  const ranking = mergeByPlayer(summaries).sort((a, b) => b.balance - a.balance);
  const showAcerto = hasAcertoInfo(ranking);
  const lines = [
    `*${table.name}*${clubName ? ` · ${clubName}` : ''}`,
    `${formatDateTime(table.created_at)} · duração ${formatDuration(table)}`,
    table.status === 'active' ? '_Mesa ainda aberta: valores parciais_' : '',
    '',
    '*Resultado por jogador*',
    ...ranking.map(s => {
      const extra = !s.hasCashOut ? ' (sem cash-out)' : showAcerto ? ` · ${describeAcerto(s)}` : '';
      return `${s.player.name}: ${signed(s.balance)}${extra}`;
    }),
    '',
    `Buy-ins: ${formatMoney(totals.buyIn)}`,
    `Cash-outs: ${formatMoney(totals.cashOut)}`,
    `Consumo: ${formatMoney(totals.consumo)}`,
    `*Rake: ${formatMoney(totals.rake)}*`,
    `*Receita do clube: ${formatMoney(totals.revenue)}*`
  ];
  if (showAcerto) {
    lines.push('', '*Acertos*');
    totals.byMethod.forEach(m => {
      const parts = [
        m.entradas > 0 ? `recebido ${formatMoney(m.entradas)}` : '',
        m.saidas > 0 ? `pago ${formatMoney(m.saidas)}` : ''
      ].filter(Boolean);
      lines.push(`${m.label}: ${parts.join(' · ')}`);
    });
    if (totals.fiado > 0) lines.push(`Ficou no fiado: ${formatMoney(totals.fiado)}`);
    if (totals.abatido > 0) lines.push(`Fiado abatido: ${formatMoney(totals.abatido)}`);
  }
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();
}

/**
 * Relatório da mesa: resultado por jogador, totais e formas de pagamento.
 * Pode ser copiado para o WhatsApp, impresso/salvo em PDF ou baixado em planilha.
 */
export default function TableReport({ clubName, table, summaries, totals, transactions, players, onClose }: TableReportProps) {
  const ranking = mergeByPlayer(summaries).sort((a, b) => b.balance - a.balance);
  const showAcerto = hasAcertoInfo(ranking);

  async function copyText() {
    const text = buildReportText(clubName, table, summaries, totals);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Relatório copiado. É só colar no WhatsApp.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  }

  function exportCSV() {
    const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? '';
    const typeLabel = { buy_in: 'Buy-in', cash_out: 'Cash-out', consumo: 'Consumo' } as const;
    const rows = [...transactions]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(tx => [
        formatDateTime(tx.created_at),
        nameOf(tx.player_id),
        typeLabel[tx.type],
        Number(tx.amount),
        tx.type === 'consumo' ? '' : paymentLabel(tx.payment_method),
        tx.type === 'cash_out' ? Number(tx.fiado_amount ?? 0) : '',
        tx.description ?? ''
      ]);
    downloadCSV(
      `${slug(table.name)}-lancamentos`,
      ['Data/hora', 'Jogador', 'Tipo', 'Valor (R$)', 'Forma do acerto', 'Ficou no fiado (R$)', 'Descrição'],
      rows
    );
  }

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={onClose}>
      <div className="modal-content mobile-bottom-sheet max-w-2xl print-area" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="text-left min-w-0">
            <h2 id="report-title" className="text-lg font-bold text-white mb-1 truncate">Relatório · {table.name}</h2>
            <p className="text-xs text-muted mb-0">
              {clubName ? `${clubName} · ` : ''}{formatDateTime(table.created_at)} · {formatDuration(table)}
              {table.status === 'active' && <span className="text-warning"> · mesa aberta, valores parciais</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar relatório"
            className="no-print w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-white flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5 text-left">
          {[
            ['Buy-ins', formatMoney(totals.buyIn), 'text-white'],
            ['Cash-outs', formatMoney(totals.cashOut), 'text-white'],
            ['Rake', formatMoney(totals.rake), totals.rake >= 0 ? 'text-primary' : 'text-danger'],
            ['Receita (rake + consumo)', formatMoney(totals.revenue), 'text-success']
          ].map(([label, value, tone]) => (
            <div key={label} className="p-3 rounded-xl bg-black bg-opacity-25 border border-glass-border">
              <dt className="text-[11px] text-muted">{label}</dt>
              <dd className={`text-sm font-bold ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="overflow-x-auto mb-5">
          <table className="report-table w-full text-xs text-left">
            <caption className="text-xs text-muted text-left mb-2">Resultado por jogador ({ranking.length})</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-2 pr-2">Jogador</th>
                <th scope="col" className="py-2 px-2 text-right">Buy-in</th>
                <th scope="col" className="py-2 px-2 text-right">Cash-out</th>
                <th scope="col" className="py-2 px-2 text-right">Consumo</th>
                <th scope="col" className="py-2 pl-2 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(s => (
                <tr key={s.player.id} className="border-t border-glass-border">
                  <th scope="row" className="py-2 pr-2 font-bold text-white">
                    {s.player.name}
                    {!s.hasCashOut && <span className="block text-[10px] text-warning font-semibold">sem cash-out</span>}
                    {s.hasCashOut && showAcerto && (
                      <span className={`block text-[10px] font-semibold ${s.acerto && s.acerto.fiado > 0 ? 'text-warning' : 'text-muted'}`}>
                        {describeAcerto(s)}
                      </span>
                    )}
                  </th>
                  <td className="py-2 px-2 text-right text-white">{formatMoney(s.buyIn)}</td>
                  <td className="py-2 px-2 text-right text-white">{formatMoney(s.cashOut)}</td>
                  <td className="py-2 px-2 text-right text-white">{formatMoney(s.consumo)}</td>
                  <td className={`py-2 pl-2 text-right font-bold ${s.balance > 0 ? 'text-success' : s.balance < 0 ? 'text-danger' : 'text-muted'}`}>
                    {signed(s.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showAcerto && (
          <div className="mb-5 text-left">
            <p className="text-xs text-muted mb-2">Acertos na saída</p>
            <ul className="space-y-1">
              {totals.byMethod.map(m => (
                <li key={m.method} className="flex justify-between gap-3 text-xs border-t border-glass-border py-1.5">
                  <span className="font-bold text-white">{m.label}</span>
                  <span className="text-muted text-right">
                    {m.entradas > 0 && <>recebido <strong className="text-success">{formatMoney(m.entradas)}</strong></>}
                    {m.entradas > 0 && m.saidas > 0 && ' · '}
                    {m.saidas > 0 && <>pago <strong className="text-white">{formatMoney(m.saidas)}</strong></>}
                  </span>
                </li>
              ))}
              {totals.fiado > 0 && (
                <li className="flex justify-between gap-3 text-xs border-t border-glass-border py-1.5">
                  <span className="font-bold text-warning">Ficou no fiado</span>
                  <strong className="text-warning">{formatMoney(totals.fiado)}</strong>
                </li>
              )}
              {totals.abatido > 0 && (
                <li className="flex justify-between gap-3 text-xs border-t border-glass-border py-1.5">
                  <span className="font-bold text-white">Fiado antigo abatido</span>
                  <strong className="text-white">{formatMoney(totals.abatido)}</strong>
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-2">
          <button type="button" className="btn btn-primary w-full py-3 text-xs font-bold" onClick={copyText}>
            <Copy size={16} /> Copiar para WhatsApp
          </button>
          <button type="button" className="btn btn-outline w-full py-3 text-xs font-bold" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir ou salvar PDF
          </button>
          <button type="button" className="btn btn-outline w-full py-3 text-xs font-bold" onClick={exportCSV}>
            <Download size={16} /> Baixar planilha
          </button>
        </div>
      </div>
    </div>
  );
}
