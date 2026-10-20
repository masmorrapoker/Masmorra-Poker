import { useState } from 'react';
import { ChevronDown, ChevronRight, UserPlus } from 'lucide-react';
import type { PlayerSummary } from '../../types';
import { formatMoney } from '../../utils';
import { describeAcerto } from '../../lib/tableMath';

const signed = (v: number) => `${v > 0 ? '+' : ''}${formatMoney(v)}`;
const tone = (v: number) => (v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-muted');
const initials = (name: string) => name.trim().substring(0, 2).toUpperCase();

interface ActivePlayersProps {
  players: PlayerSummary[];
  open: boolean;
  fiadoByTablePlayer: Record<string, number>;
  onSelect: (summary: PlayerSummary) => void;
  onAdd: () => void;
}

export function ActivePlayers({ players, open, fiadoByTablePlayer, onSelect, onAdd }: ActivePlayersProps) {
  return (
    <section aria-labelledby="active-players-title">
      <div className="flex justify-between items-center mb-4 gap-4">
        <h2 id="active-players-title" className="text-base font-bold text-white mb-0">
          Jogando agora <span className="text-muted font-semibold">({players.length})</span>
        </h2>
        {open && (
          <button type="button" onClick={onAdd} className="btn btn-success btn-sm">
            <UserPlus size={16} /> Adicionar jogador
          </button>
        )}
      </div>

      {players.length === 0 ? (
        <div className="glass-panel text-center p-10">
          <p className="text-muted text-sm mb-4">{open ? 'Ninguém jogando nesta mesa.' : 'Todos os jogadores saíram.'}</p>
          {open && (
            <button type="button" className="btn btn-success mx-auto" onClick={onAdd}>
              <UserPlus size={16} /> Adicionar jogador
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map(s => (
            <li key={s.player.id}>
              <button
                type="button"
                disabled={!open}
                onClick={() => onSelect(s)}
                className="mobile-card w-full p-4 bg-card border border-glass-border hover:border-primary rounded-2xl flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-primary bg-opacity-10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0" aria-hidden="true">
                    {initials(s.player.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="font-bold text-base text-white block truncate">{s.player.name}</span>
                    <span className="text-xs text-muted block">
                      Buy-in {formatMoney(s.buyIn)}
                      {fiadoByTablePlayer[s.player.id] > 0 && <span className="text-warning"> · fiado {formatMoney(fiadoByTablePlayer[s.player.id])}</span>}
                    </span>
                  </span>
                </span>
                <span className="text-right flex-shrink-0">
                  <span className="text-[11px] text-muted block">Saldo parcial</span>
                  <span className={`text-base font-extrabold block ${tone(s.balance)}`}>{signed(s.balance)}</span>
                  {s.consumo > 0 && <span className="text-[11px] text-muted block">Consumo {formatMoney(s.consumo)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FinishedPlayers({ players, showAcerto = false }: { players: PlayerSummary[]; showAcerto?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (players.length === 0) return null;
  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 p-4 rounded-2xl border border-glass-border cursor-pointer text-left"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        {expanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
        <span className="text-sm font-bold text-white">Já saíram</span>
        <span className="text-sm text-muted">({players.length})</span>
      </button>

      {expanded && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {players.map(s => (
            <li key={s.player.id} className="p-4 border border-glass-border rounded-2xl flex items-center justify-between gap-3" style={{ background: 'rgba(15,23,42,0.3)' }}>
              <span className="min-w-0">
                <span className="font-bold text-sm text-white block truncate">{s.player.name}</span>
                <span className="text-xs text-muted block">Buy-in {formatMoney(s.buyIn)} · Cash-out {formatMoney(s.cashOut)}</span>
                {showAcerto && s.acerto && (s.acerto.method || s.acerto.fiado > 0 || s.acerto.abatido > 0) && (
                  <span className={`text-xs block ${s.acerto.fiado > 0 ? 'text-warning' : 'text-muted'}`}>{describeAcerto(s)}</span>
                )}
              </span>
              <span className={`text-sm font-bold flex-shrink-0 ${tone(s.balance)}`}>{signed(s.balance)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
