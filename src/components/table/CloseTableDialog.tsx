import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PlayerSummary } from '../../types';
import type { TableTotals } from '../../lib/tableMath';
import { formatMoney } from '../../utils';

interface CloseTableDialogProps {
  tableName: string;
  summaries: PlayerSummary[];
  totals: TableTotals;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Conferência antes de encerrar: mostra quem ainda não fez cash-out e o
 * resultado que vai ficar registrado. Encerrar com jogador sem cash-out exige
 * confirmação explícita, porque depois a mesa não aceita mais lançamentos.
 */
export default function CloseTableDialog({ tableName, summaries, totals, busy, onConfirm, onCancel }: CloseTableDialogProps) {
  const pending = summaries.filter(s => !s.hasCashOut);
  const [ack, setAck] = useState(false);
  const blocked = pending.length > 0 && !ack;

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="close-table-title" onClick={() => !busy && onCancel()}>
      <div className="modal-content mobile-bottom-sheet max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" />
        <h2 id="close-table-title" className="text-lg font-bold text-white mb-1">Encerrar {tableName}?</h2>
        <p className="text-xs text-muted mb-4">Depois de encerrada, a mesa não aceita novos jogadores nem lançamentos.</p>

        {pending.length > 0 ? (
          <div className="p-3 rounded-xl border border-warning border-opacity-25 bg-warning bg-opacity-10 mb-4 text-left">
            <p className="text-xs font-bold text-warning flex items-center gap-2 mb-2">
              <AlertTriangle size={16} />
              {pending.length === 1 ? '1 jogador ainda não fez cash-out' : `${pending.length} jogadores ainda não fizeram cash-out`}
            </p>
            <ul className="text-xs text-white space-y-1 mb-3">
              {pending.map(s => (
                <li key={s.player.id} className="flex justify-between gap-3">
                  <span className="truncate">{s.player.name}</span>
                  <span className="text-muted flex-shrink-0">buy-in {formatMoney(s.buyIn)}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 text-xs text-warning cursor-pointer">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span>Encerrar mesmo assim. O rake vai considerar que esses jogadores saíram sem fichas.</span>
            </label>
          </div>
        ) : (
          <p className="p-3 rounded-xl border border-success border-opacity-25 bg-success bg-opacity-10 mb-4 text-xs text-success flex items-center gap-2">
            <CheckCircle2 size={16} /> Todos os jogadores já fizeram cash-out.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-2 mb-6 text-left">
          <div className="p-3 rounded-xl bg-black bg-opacity-25 border border-glass-border">
            <dt className="text-[11px] text-muted">Buy-ins</dt>
            <dd className="text-sm font-bold text-white">{formatMoney(totals.buyIn)}</dd>
          </div>
          <div className="p-3 rounded-xl bg-black bg-opacity-25 border border-glass-border">
            <dt className="text-[11px] text-muted">Cash-outs</dt>
            <dd className="text-sm font-bold text-white">{formatMoney(totals.cashOut)}</dd>
          </div>
          <div className="p-3 rounded-xl bg-black bg-opacity-25 border border-glass-border">
            <dt className="text-[11px] text-muted">Rake da mesa</dt>
            <dd className={`text-sm font-bold ${totals.rake >= 0 ? 'text-primary' : 'text-danger'}`}>{formatMoney(totals.rake)}</dd>
          </div>
          <div className="p-3 rounded-xl bg-black bg-opacity-25 border border-glass-border">
            <dt className="text-[11px] text-muted">Consumo</dt>
            <dd className="text-sm font-bold text-white">{formatMoney(totals.consumo)}</dd>
          </div>
        </dl>

        <div className="flex flex-col md:flex-row gap-3">
          <button type="button" className="btn btn-danger w-full py-3.5 font-bold" onClick={onConfirm} disabled={blocked || busy}>
            {busy ? 'Encerrando...' : 'Encerrar mesa'}
          </button>
          <button type="button" className="btn btn-outline w-full py-3.5" onClick={onCancel} disabled={busy}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
