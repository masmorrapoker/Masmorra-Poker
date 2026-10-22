import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Plus } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { tournamentService } from '../services/tournamentService';
import { defaultConfig, newId, normalizeConfig, type TournamentRow } from '../lib/tournament';
import { friendlyError } from '../services/teamService';
import { toast } from '../components/Toast';
import { useSubmitLock } from '../hooks/useSubmitLock';
import { formatMoney } from '../utils';

const STATUS: Record<TournamentRow['status'], { label: string; cls: string }> = {
  agendado: { label: 'Agendado', cls: 'badge-closed' },
  em_andamento: { label: 'Em andamento', cls: 'badge-active' },
  encerrado: { label: 'Encerrado', cls: 'badge-closed' }
};

function nextSunday1400() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(14, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Tournaments() {
  const { clubId } = useClub();
  const navigate = useNavigate();
  const [list, setList] = useState<TournamentRow[] | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [when, setWhen] = useState(nextSunday1400());
  const [copyFrom, setCopyFrom] = useState<string>('');
  const lock = useSubmitLock();

  useEffect(() => {
    if (!clubId) return;
    tournamentService.list(clubId).then(l => {
      setList(l);
      if (l && l.length) setCopyFrom(l[0].id);
    });
  }, [clubId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) return;
    await lock.run(async () => {
      try {
        const base = list?.find(t => t.id === copyFrom);
        const config = base ? normalizeConfig(JSON.parse(JSON.stringify(base.config))) : defaultConfig();
        // ids novos para as opções copiadas
        config.rebuys = config.rebuys.map(o => ({ ...o, id: newId() }));
        config.addons = config.addons.map(o => ({ ...o, id: newId() }));
        config.bonuses = config.bonuses.map(o => ({ ...o, id: newId() }));
        config.extras = config.extras.map(o => ({ ...o, id: newId() }));
        const t = await tournamentService.create(clubId, name, when ? new Date(when).toISOString() : null, config);
        navigate(`/torneios/${t.id}?aba=estrutura`);
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível criar o torneio.'));
      }
    });
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto mobile-view-padding text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="mb-1">Torneios</h1>
          <p className="text-muted text-sm mb-0">Estrutura do seu jeito, relógio na TV e premiação calculada.</p>
        </div>
        {list !== null && (
          <button type="button" className="btn btn-primary" onClick={() => { setName(''); setCreating(true); }}>
            <Plus size={16} /> Novo torneio
          </button>
        )}
      </div>

      {list === undefined ? (
        <div className="flex justify-center p-10"><div className="spinner" role="status" aria-label="Carregando" /></div>
      ) : list === null ? (
        <div className="glass-panel p-6 text-sm text-muted">Os torneios ainda não foram ativados no banco de dados.</div>
      ) : list.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <Crown className="mx-auto text-muted mb-3" size={32} aria-hidden="true" />
          <p className="text-white font-bold mb-1">Nenhum torneio ainda.</p>
          <p className="text-sm text-muted mb-4">Crie o primeiro: a estrutura fica salva e o próximo torneio já começa igual.</p>
          <button type="button" className="btn btn-primary mx-auto" onClick={() => setCreating(true)}>
            <Plus size={16} /> Criar torneio
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map(t => {
            const st = STATUS[t.status];
            return (
              <li key={t.id}>
                <Link to={`/torneios/${t.id}`} className="glass-panel p-4 flex items-center justify-between gap-3 no-underline hover:border-primary border border-glass-border">
                  <span className="min-w-0">
                    <span className="text-base font-bold text-white block truncate">{t.name}</span>
                    <span className="text-xs text-muted block">
                      {t.scheduled_at
                        ? new Date(t.scheduled_at).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Sem data'}
                      {' · '}buy-in {formatMoney(t.config.buyin.price).replace(',00', '')}
                      {t.config.gtd > 0 && ` · ${formatMoney(t.config.gtd).replace(',00', '')} garantidos`}
                    </span>
                  </span>
                  <span className={`badge ${st.cls} flex-shrink-0`}>{st.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="novo-torneio" onClick={() => setCreating(false)}>
          <form className="modal-content mobile-bottom-sheet max-w-md text-left" onClick={e => e.stopPropagation()} onSubmit={create}>
            <h2 id="novo-torneio" className="text-lg font-bold text-white mb-4">Novo torneio</h2>
            <label className="block mb-3">
              <span className="text-xs text-muted font-bold block mb-1">Nome</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Torneio de domingo 8K GTD" required autoFocus />
            </label>
            <label className="block mb-3">
              <span className="text-xs text-muted font-bold block mb-1">Data e hora</span>
              <input className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={{ colorScheme: 'dark' }} />
            </label>
            <label className="block mb-5">
              <span className="text-xs text-muted font-bold block mb-1">Estrutura</span>
              <select className="input" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
                <option value="">Estrutura padrão (90+30, rebuy simples/duplo, add-on)</option>
                {(list || []).map(t => <option key={t.id} value={t.id}>Copiar de: {t.name}</option>)}
              </select>
            </label>
            <div className="flex flex-col md:flex-row gap-2">
              <button type="submit" className="btn btn-primary flex-1" disabled={!name.trim() || lock.busy}>
                {lock.busy ? 'Criando...' : 'Criar e ajustar estrutura'}
              </button>
              <button type="button" className="btn btn-outline flex-1" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
