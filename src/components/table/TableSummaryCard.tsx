import { FileText, Timer, XCircle } from 'lucide-react';
import type { Table } from '../../types';
import type { TableTotals } from '../../lib/tableMath';
import { formatDuration } from '../../lib/tableMath';
import { formatMoney } from '../../utils';

interface TableSummaryCardProps {
  table: Table;
  totals: TableTotals;
  paymentsEnabled: boolean;
  onClose: () => void;
  onReport: () => void;
}

export default function TableSummaryCard({ table, totals, paymentsEnabled, onClose, onReport }: TableSummaryCardProps) {
  const open = table.status === 'active';

  const stats: { label: string; value: string; tone: string; hint?: string }[] = [
    { label: 'Jogando', value: String(totals.activeCount), tone: 'text-white' },
    { label: 'Saíram', value: String(totals.closedCount), tone: 'text-muted' },
    { label: 'Buy-ins', value: formatMoney(totals.buyIn), tone: 'text-warning' },
    { label: 'Consumo', value: formatMoney(totals.consumo), tone: 'text-danger' },
    {
      label: open ? 'Na mesa (parcial)' : 'Rake final',
      value: formatMoney(totals.rake),
      tone: totals.rake >= 0 ? 'text-primary' : 'text-danger',
      hint: open ? 'Mesa aberta: inclui fichas ainda em jogo. O rake final aparece quando todos fizerem cash-out.' : undefined
    }
  ];
  if (paymentsEnabled && totals.fiado > 0) {
    stats.push({ label: 'Fiado na mesa', value: formatMoney(totals.fiado), tone: 'text-warning' });
  }

  return (
    <section className="glass-panel mb-6 p-5 border border-glass-border" aria-labelledby="table-title">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="text-left min-w-0">
          <h1 id="table-title" className="text-2xl md:text-3xl font-black text-white mb-2 truncate">{table.name}</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`badge ${open ? 'badge-active' : 'badge-closed'} flex items-center gap-1.5`}>
              <span className={`w-2 h-2 rounded-full ${open ? 'bg-success' : 'bg-muted'}`} aria-hidden="true" />
              {open ? 'Aberta' : 'Encerrada'}
            </span>
            <span className="bg-black bg-opacity-35 px-2.5 py-1 rounded-lg text-muted font-semibold flex items-center gap-1.5">
              <Timer size={12} aria-hidden="true" /> {formatDuration(table)}
            </span>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button type="button" className="btn btn-outline flex-1 md:flex-initial" onClick={onReport}>
            <FileText size={18} /> Relatório
          </button>
          {open && (
            <button type="button" className="btn btn-danger flex-1 md:flex-initial" onClick={onClose}>
              <XCircle size={18} /> Encerrar mesa
            </button>
          )}
        </div>
      </div>

      <dl className={`grid grid-cols-2 sm:grid-cols-3 ${stats.length > 5 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3 text-left`}>
        {stats.map(s => (
          <div key={s.label} className="p-3 bg-black bg-opacity-20 rounded-xl border border-glass-border" title={s.hint}>
            <dt className="text-[11px] text-muted font-semibold">{s.label}</dt>
            <dd className={`text-sm font-extrabold ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
