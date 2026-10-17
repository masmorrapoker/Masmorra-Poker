import { Trash2 } from 'lucide-react';
import type { TableEvent } from '../types';
import { formatMoney } from '../utils';

interface TableTimelineProps {
  events: TableEvent[];
  /** O lançamento deste evento ainda pode ser removido? */
  canDelete: (event: TableEvent) => boolean;
  onDelete: (event: TableEvent) => void;
}

const TYPE_LABEL: Record<string, string> = {
  buy_in: 'Buy-in',
  cash_out: 'Cash-out',
  consumo: 'Consumo'
};

function describe(ev: TableEvent): { title: string; detail?: string; tone: string; amountTone?: string; struck?: boolean } {
  const who = ev.player_name || 'Jogador';
  switch (ev.event_type) {
    case 'mesa_aberta':
      return { title: 'Mesa aberta', detail: ev.description || undefined, tone: 'primary' };
    case 'mesa_encerrada':
      return { title: 'Mesa encerrada', tone: 'muted' };
    case 'jogador_entrou':
      return { title: `${who} entrou na mesa`, tone: 'primary' };
    case 'jogador_removido':
      return { title: `${who} removido da mesa`, tone: 'muted' };
    case 'buy_in':
      return { title: who, detail: 'Buy-in', tone: 'warning', amountTone: 'text-warning' };
    case 'cash_out':
      return { title: who, detail: 'Cash-out', tone: 'success', amountTone: 'text-success' };
    case 'consumo':
      return { title: who, detail: ev.description || 'Consumo', tone: 'danger', amountTone: 'text-danger' };
    case 'lancamento_removido':
      return {
        title: `Lançamento removido · ${who}`,
        detail: TYPE_LABEL[ev.description || ''] || ev.description || undefined,
        tone: 'muted',
        amountTone: 'text-muted',
        struck: true
      };
    case 'lancamento_alterado':
      return { title: `Lançamento alterado · ${who}`, detail: ev.description || undefined, tone: 'muted', amountTone: 'text-muted' };
    default:
      return { title: ev.event_type, tone: 'muted' };
  }
}

const DOT: Record<string, string> = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  success: 'bg-success',
  danger: 'bg-danger',
  muted: 'bg-muted'
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Linha do tempo da mesa: tudo o que aconteceu, do mais recente ao mais antigo.
 */
export default function TableTimeline({ events, canDelete, onDelete }: TableTimelineProps) {
  if (events.length === 0) {
    return <p className="text-muted text-center py-6 text-xs font-semibold">Nenhum acontecimento registrado ainda.</p>;
  }

  return (
    <ol className="space-y-2 max-h-96 overflow-y-auto pr-1" aria-label="Histórico da mesa">
      {events.map(ev => {
        const d = describe(ev);
        const isMoney = ev.amount !== null && ev.amount !== undefined && ev.event_type !== 'lancamento_alterado';
        const signed = ev.event_type === 'cash_out' ? '+' : ev.event_type === 'lancamento_removido' ? '' : '-';
        return (
          <li
            key={ev.id}
            className={`p-3 rounded-xl border border-glass-border flex items-center justify-between gap-3 text-xs ${
              d.struck ? 'opacity-70' : 'bg-dark bg-opacity-40'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${DOT[d.tone]}`} aria-hidden="true" />
              <div className="min-w-0">
                <span className="font-bold text-white block truncate">{d.title}</span>
                <span className="text-[11px] text-muted block mt-0.5">
                  {d.detail ? `${d.detail} · ` : ''}{formatTime(ev.created_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isMoney && (
                <span
                  className={`font-black text-sm ${d.amountTone ?? 'text-white'}`}
                  style={d.struck ? { textDecoration: 'line-through' } : undefined}
                >
                  {signed}{formatMoney(Number(ev.amount))}
                </span>
              )}
              {canDelete(ev) && (
                <button
                  type="button"
                  onClick={() => onDelete(ev)}
                  aria-label={`Remover lançamento de ${ev.player_name ?? 'jogador'}`}
                  className="w-8 h-8 rounded-lg text-muted hover:text-danger flex items-center justify-center cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
