import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useClub } from '../contexts/ClubContext';
import { tournamentService } from '../services/tournamentService';
import { playerService } from '../services/playerService';
import { deriveClock, type EntryRow, type MovementRow, type TournamentConfig, type TournamentRow } from '../lib/tournament';
import type { GlobalPlayer, PaymentMethod } from '../types';
import { friendlyError } from '../services/teamService';
import { toast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import TournamentLive, { type LiveActions } from '../components/tournament/TournamentLive';
import TournamentSetup from '../components/tournament/TournamentSetup';

export default function Tournament() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clubId, canSeeFinance } = useClub();

  const [t, setT] = useState<TournamentRow | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  const [tab, setTab] = useState<'vivo' | 'estrutura'>(() =>
    new URLSearchParams(window.location.search).get('aba') === 'estrutura' ? 'estrutura' : 'vivo'
  );
  const [draft, setDraft] = useState<{ name: string; scheduled: string; config: TournamentConfig } | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      const [tt, e, m] = await Promise.all([
        tournamentService.get(clubId, id),
        tournamentService.entries(clubId, id),
        tournamentService.movements(clubId, id)
      ]);
      setT(tt);
      setEntries(e);
      setMovements(m);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar o torneio.');
    }
  }, [clubId, id]);

  useEffect(() => {
    if (!clubId) return;
    load();
    playerService.getPlayers(clubId).then(setPlayers).catch(() => setPlayers([]));
    tournamentService.serverNow().then(s => setOffset(s - Date.now()));
    const ch = supabase
      .channel(`torneio_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_entries', filter: `tournament_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_movements', filter: `tournament_id=eq.${id}` }, () => load())
      .subscribe();
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => { supabase.removeChannel(ch); window.clearInterval(tick); };
  }, [clubId, id, load]);

  useEffect(() => {
    if (t && !draft) {
      setDraft({
        name: t.name,
        scheduled: t.scheduled_at ? toLocalInput(t.scheduled_at) : '',
        config: t.config
      });
    }
  }, [t, draft]);

  const clock = useMemo(() => (t ? deriveClock(t.config.levels, t, now + offset) : null), [t, now, offset]);

  /** Executa uma ação com trava contra toque duplo e recarrega. */
  const run = useCallback(async (fn: () => Promise<void>, ok?: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível salvar. Verifique a conexão.'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [load]);

  if (!t || !clock || !draft || !clubId) {
    return <div className="flex justify-center p-20"><div className="spinner" role="status" aria-label="Carregando" /></div>;
  }

  const actions: LiveActions = {
    clock: (level, running, remaining) => run(async () => {
      const serverNow = await tournamentService.clock(t.id, level, running, remaining);
      setOffset(new Date(serverNow).getTime() - Date.now());
    }),
    register: (p, method, bonusIds) => run(async () => {
      let playerId = p.id;
      if (!playerId) {
        const created = await playerService.createPlayer(clubId, p.name);
        playerId = created.id;
        setPlayers(list => [...list, created]);
      }
      const entry = await tournamentService.addEntry(clubId, t.id, playerId, p.name.trim());
      const b = t.config.buyin;
      await tournamentService.addMovement(clubId, t.id, entry.id, { kind: 'buyin', label: b.label, amount: b.price, to_prize: b.toPrize, chips: b.chips, payment_method: method });
      for (const bonus of t.config.bonuses.filter(x => bonusIds.includes(x.id))) {
        await tournamentService.addMovement(clubId, t.id, entry.id, { kind: 'bonus', label: bonus.label, amount: 0, to_prize: 0, chips: bonus.chips, payment_method: null });
      }
    }, `${p.name.trim()} inscrito.`),
    movement: (entry, kind, opt, method) => run(
      () => tournamentService.addMovement(clubId, t.id, entry.id, { kind, ...opt, payment_method: method as PaymentMethod | null }),
      `${opt.label} · ${entry.name}`
    ),
    undoMovement: m => run(() => tournamentService.removeMovement(clubId, m.id), 'Lançamento desfeito.'),
    eliminate: (entry, position) => run(
      () => tournamentService.eliminate(clubId, entry.id, position),
      position ? `${entry.name} eliminado em ${position}º.` : `${entry.name} voltou ao torneio.`
    ),
    removeEntry: entry => run(() => tournamentService.removeEntry(clubId, entry.id), 'Inscrição removida.'),
    finish: champion => run(async () => {
      await tournamentService.setPosition(clubId, champion.id, 1);
      await tournamentService.clock(t.id, clock.index, false, clock.remaining);
      await tournamentService.update(clubId, t.id, { status: 'encerrado', finished_at: new Date().toISOString() });
    }, 'Torneio encerrado.'),
    reopen: () => run(async () => {
      const champ = entries.find(e => e.position === 1 && !e.eliminated_at);
      if (champ) await tournamentService.setPosition(clubId, champ.id, null);
      await tournamentService.update(clubId, t.id, { status: 'em_andamento', finished_at: null });
    }, 'Torneio reaberto.')
  };

  async function saveSetup() {
    if (!draft) return;
    await run(async () => {
      await tournamentService.update(clubId!, t!.id, {
        name: draft.name.trim() || t!.name,
        scheduled_at: draft.scheduled ? new Date(draft.scheduled).toISOString() : null,
        config: draft.config
      });
    }, 'Estrutura salva.');
  }

  const dirty = stable({ n: draft.name, s: draft.scheduled, c: draft.config }) !==
    stable({ n: t.name, s: t.scheduled_at ? toLocalInput(t.scheduled_at) : '', c: t.config });

  return (
    <div className="animate-fade-in max-w-5xl mx-auto mobile-view-padding text-left">
      <Link to="/torneios" className="text-xs text-muted font-bold inline-flex items-center gap-1.5 py-2 mb-2 no-underline">
        <ArrowLeft size={14} /> Torneios
      </Link>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="mb-1 truncate">{t.name}</h1>
          <p className="text-sm text-muted mb-0">
            {t.status === 'agendado' ? 'Agendado' : t.status === 'em_andamento' ? 'Em andamento' : 'Encerrado'}
            {t.scheduled_at && ` · ${new Date(t.scheduled_at).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border border-glass-border" role="tablist" style={{ background: 'rgba(15,23,42,0.5)' }}>
          {([['vivo', 'Ao vivo'], ['estrutura', 'Estrutura']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold border-0 cursor-pointer ${tab === k ? 'bg-primary text-white' : 'text-muted'}`}
              style={tab === k ? undefined : { background: 'transparent' }}
            >
              {label}{k === 'estrutura' && dirty ? ' •' : ''}
            </button>
          ))}
        </div>
      </div>

      {tab === 'vivo' ? (
        <TournamentLive
          tournament={t}
          entries={entries}
          movements={movements}
          globalPlayers={players}
          clock={clock}
          busy={busy}
          canSeeFinance={canSeeFinance}
          actions={actions}
        />
      ) : (
        <div className="space-y-4">
          <section className="glass-panel p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-muted font-bold block mb-1">Nome do torneio</span>
              <input className="input text-sm" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted font-bold block mb-1">Data e hora</span>
              <input className="input text-sm" type="datetime-local" value={draft.scheduled} onChange={e => setDraft({ ...draft, scheduled: e.target.value })} style={{ colorScheme: 'dark' }} />
            </label>
          </section>
          <TournamentSetup config={draft.config} onChange={config => setDraft({ ...draft, config })} started={t.status !== 'agendado'} />
          <div className="sticky bottom-20 md:bottom-4 z-10 flex flex-col md:flex-row gap-2">
            <button type="button" className="btn btn-primary flex-1 py-3" onClick={saveSetup} disabled={!dirty || busy}>
              <Save size={16} /> {dirty ? 'Salvar estrutura' : 'Estrutura salva'}
            </button>
            {t.status === 'agendado' && entries.length === 0 && (
              <button type="button" className="btn btn-outline text-danger py-3" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Apagar torneio
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar este torneio?"
        message="Ele ainda não tem inscritos. A estrutura será apagada."
        confirmLabel="Apagar"
        danger
        busy={busy}
        onConfirm={async () => {
          await run(() => tournamentService.remove(clubId, t.id));
          navigate('/torneios', { replace: true });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** JSON com chaves em ordem (o banco reordena as chaves do jsonb). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
