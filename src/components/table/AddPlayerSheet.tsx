import { useState } from 'react';
import { Search, UserCheck, UserPlus, X } from 'lucide-react';
import type { GlobalPlayer, Player } from '../../types';
import { isSamePlayer } from '../../utils';

interface AddPlayerSheetProps {
  globalPlayers: GlobalPlayer[];
  tablePlayers: Player[];
  busy: boolean;
  onAdd: (name: string, playerId?: string) => void;
  onClose: () => void;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export default function AddPlayerSheet({ globalPlayers, tablePlayers, busy, onAdd, onClose }: AddPlayerSheetProps) {
  const [term, setTerm] = useState('');
  const q = normalize(term);

  const available = globalPlayers
    .filter(gp => !tablePlayers.some(tp => isSamePlayer(tp, gp)))
    .filter(gp => !q || normalize(gp.name).includes(q));
  const alreadyAtTable = q ? globalPlayers.filter(gp => tablePlayers.some(tp => isSamePlayer(tp, gp)) && normalize(gp.name).includes(q)) : [];
  const exactExists = globalPlayers.some(gp => normalize(gp.name) === q);
  const canCreate = q.length > 0 && !exactExists;

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="add-player-title" onClick={onClose}>
      <div className="modal-content mobile-bottom-sheet max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" />
        <div className="flex justify-between items-center mb-4">
          <h2 id="add-player-title" className="text-lg font-bold text-white mb-0">Adicionar jogador</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-white"
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={20} aria-hidden="true" />
          <input
            type="search"
            className="input pl-10"
            placeholder="Buscar ou cadastrar jogador"
            aria-label="Buscar ou cadastrar jogador"
            value={term}
            onChange={e => setTerm(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (available.length === 1) onAdd(available[0].name, available[0].id);
                else if (canCreate) onAdd(term);
              }
            }}
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 mb-4 text-left">
          {canCreate && (
            <button
              type="button"
              className="w-full flex items-center gap-2 p-3 rounded-xl border border-primary text-primary text-left cursor-pointer"
              style={{ background: 'rgba(59,130,246,0.08)' }}
              onClick={() => onAdd(term)}
              disabled={busy}
            >
              <UserPlus size={18} />
              <span className="font-bold text-sm">Cadastrar e adicionar "{term.trim()}"</span>
            </button>
          )}

          {available.map(gp => (
            <button
              type="button"
              key={gp.id}
              className="w-full flex items-center justify-between p-3 rounded-xl text-white border border-glass-border text-left cursor-pointer hover:border-primary"
              onClick={() => onAdd(gp.name, gp.id)}
              disabled={busy}
              style={{ background: 'rgba(15,23,42,0.5)' }}
            >
              <span className="font-bold text-sm">{gp.name}</span>
              <UserCheck size={18} className="text-muted" />
            </button>
          ))}

          {alreadyAtTable.map(gp => (
            <p key={gp.id} className="text-xs text-muted px-3">{gp.name} já está nesta mesa.</p>
          ))}

          {available.length === 0 && !canCreate && alreadyAtTable.length === 0 && (
            <p className="text-center text-muted p-4 text-sm">
              {globalPlayers.length === 0 ? 'Digite o nome para cadastrar o primeiro jogador.' : 'Todos os jogadores cadastrados já estão na mesa.'}
            </p>
          )}
        </div>

        <button type="button" className="btn btn-outline w-full py-3" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
