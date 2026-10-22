import { useMemo, useState } from 'react';
import {
  Award, ChevronLeft, ChevronRight, Copy, ExternalLink, Gift, Minus, Pause, Play, Plus, RotateCcw, Search, Skull, Trash2, UserPlus, X
} from 'lucide-react';
import {
  addonOpen,
  computeStats,
  fmtChips,
  fmtShortChips,
  fmtTime,
  payoutTable,
  rebuyOpen,
  type ClockState,
  type EntryOption,
  type EntryRow,
  type MovementRow,
  type TournamentRow
} from '../../lib/tournament';
import { SETTLE_OUT_METHODS, PAYMENT_METHODS, paymentLabel } from '../../lib/paymentMethods';
import type { GlobalPlayer, PaymentMethod } from '../../types';
import { formatMoney, isSamePlayer } from '../../utils';
import { tvLink } from '../../services/tournamentService';
import ConfirmDialog from '../ConfirmDialog';

export interface LiveActions {
  clock: (level: number, running: boolean, remaining: number) => Promise<void>;
  register: (player: { id?: string; name: string }, method: PaymentMethod, bonusIds: string[]) => Promise<void>;
  movement: (entry: EntryRow, kind: 'rebuy' | 'addon' | 'bonus' | 'premio' | 'extra', opt: { label: string; amount: number; to_prize: number; chips: number }, method: PaymentMethod | null) => Promise<void>;
  undoMovement: (m: MovementRow) => Promise<void>;
  eliminate: (entry: EntryRow, position: number | null) => Promise<void>;
  removeEntry: (entry: EntryRow) => Promise<void>;
  finish: (champion: EntryRow) => Promise<void>;
  reopen: () => Promise<void>;
}

interface Props {
  tournament: TournamentRow;
  entries: EntryRow[];
  movements: MovementRow[];
  globalPlayers: GlobalPlayer[];
  clock: ClockState;
  busy: boolean;
  canSeeFinance: boolean;
  actions: LiveActions;
}

const money = (v: number) => formatMoney(v).replace(',00', '');

function MethodChips({ value, onChange, methods }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; methods: { value: PaymentMethod; label: string }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }} role="group" aria-label="Forma de pagamento">
      {methods.map(m => (
        <button
          key={m.value}
          type="button"
          aria-pressed={value === m.value}
          onClick={() => onChange(m.value)}
          className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
            value === m.value
              ? m.value === 'fiado' ? 'bg-warning bg-opacity-20 border-warning text-warning' : 'bg-primary bg-opacity-20 border-primary text-white'
              : 'bg-white bg-opacity-5 border-glass-border text-muted'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function TournamentLive({ tournament, entries, movements, globalPlayers, clock, busy, canSeeFinance, actions }: Props) {
  const cfg = tournament.config;
  const stats = useMemo(() => computeStats(cfg, entries, movements), [cfg, entries, movements]);
  const payouts = useMemo(() => payoutTable(cfg, stats.prizePool, stats.entries), [cfg, stats]);
  const finished = tournament.status === 'encerrado';
  const alive = entries.filter(e => !e.eliminated_at);
  const out = entries.filter(e => e.eliminated_at).sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<EntryRow | null>(null);
  const [search, setSearch] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [paying, setPaying] = useState<{ entry: EntryRow; kind: 'premio' | 'extra'; label: string; amount: number } | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pix');

  const it = clock.item;
  const idx = clock.index;
  const levels = cfg.levels;
  const movesOf = (e: EntryRow) => movements.filter(m => m.entry_id === e.id);
  const count = (e: EntryRow, kind: string) => movesOf(e).filter(m => m.kind === kind).length;
  const champion = entries.find(e => e.position === 1);

  const filteredAlive = alive.filter(e => !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function copyTv() {
    try {
      await navigator.clipboard.writeText(tvLink(tournament.tv_token));
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      {/* Relógio */}
      <section className="glass-panel p-5" aria-label="Relógio">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs text-muted mb-1">
              {it?.kind === 'break' ? (it.label || 'Intervalo') + (it.addon ? ' · add-on liberado' : '') : `Nível ${clock.levelNumber}`}
              {!clock.running && !finished && ' · pausado'}
            </p>
            <p className="text-5xl font-black text-white mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(clock.remaining)}</p>
            {it?.kind === 'level' && (
              <p className="text-lg font-bold text-white mb-0">
                {fmtChips(it.sb)} / {fmtChips(it.bb)}{it.ante ? <span className="text-muted text-sm"> · ante {fmtChips(it.ante)}</span> : null}
              </p>
            )}
            {clock.nextLevel && <p className="text-xs text-muted mb-0 mt-1">Próximo: {fmtChips(clock.nextLevel.sb)} / {fmtChips(clock.nextLevel.bb)}</p>}
          </div>
          {!finished && (
            <div className="flex flex-col gap-2" style={{ minWidth: 260 }}>
              <button
                type="button"
                className={`btn ${clock.running ? 'btn-outline' : 'btn-primary'} w-full py-3`}
                disabled={busy}
                onClick={() => actions.clock(idx, !clock.running, clock.remaining)}
              >
                {clock.running ? <><Pause size={18} /> Pausar</> : <><Play size={18} /> {tournament.status === 'agendado' ? 'Iniciar torneio' : 'Continuar'}</>}
              </button>
              <div className="grid grid-cols-4 gap-2">
                <button type="button" className="btn btn-outline btn-sm" disabled={busy || idx === 0} onClick={() => actions.clock(idx - 1, clock.running, levels[idx - 1].minutes * 60)} aria-label="Nível anterior">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => actions.clock(idx, clock.running, Math.max(0, clock.remaining - 60))} aria-label="Menos 1 minuto">
                  <Minus size={14} />1
                </button>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => actions.clock(idx, clock.running, clock.remaining + 60)} aria-label="Mais 1 minuto">
                  <Plus size={14} />1
                </button>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy || idx >= levels.length - 1} onClick={() => actions.clock(idx + 1, clock.running, levels[idx + 1].minutes * 60)} aria-label="Próximo nível">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-2 mt-4 pt-4 border-t border-glass-border">
          <a className="btn btn-outline flex-1 no-underline" href={tvLink(tournament.tv_token)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Abrir relógio da TV
          </a>
          <button type="button" className="btn btn-outline flex-1" onClick={copyTv}>
            <Copy size={16} /> Copiar link da TV
          </button>
        </div>
      </section>

      {/* Números */}
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
        {[
          ['Jogadores', `${stats.alive} / ${stats.entries}`, 'text-white'],
          ['Rebuys · Add-ons', `${stats.rebuys} · ${stats.addons}`, 'text-white'],
          ['Prêmio', money(stats.prizePool), 'text-warning'],
          ['Média de fichas', fmtShortChips(stats.avgStack), 'text-white'],
          ...(canSeeFinance
            ? [
                ['Arrecadado', money(stats.collected), 'text-white'],
                ['Taxa da casa', money(stats.houseFee), 'text-success'],
                [stats.overlay > 0 ? 'Casa completa (garantido)' : 'Garantido', stats.overlay > 0 ? money(stats.overlay) : cfg.gtd ? 'Batido' : '—', stats.overlay > 0 ? 'text-danger' : 'text-white'],
                ['Prêmios pagos', money(stats.paid), 'text-white']
              ]
            : [])
        ].map(([label, value, tone]) => (
          <div key={label} className="p-3 rounded-xl bg-black bg-opacity-20 border border-glass-border">
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className={`text-base font-extrabold ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* Campeão / encerrar */}
      {!finished && alive.length === 1 && entries.length > 1 && (
        <section className="glass-panel p-5 border border-warning text-left">
          <p className="text-sm text-white mb-3">Só resta <strong>{alive[0].name}</strong>.</p>
          <button type="button" className="btn btn-primary w-full" onClick={() => setConfirmFinish(true)}>
            <Award size={16} /> Encerrar: {alive[0].name} é o campeão
          </button>
        </section>
      )}

      {/* Jogadores vivos */}
      <section aria-labelledby="vivos-title">
        <div className="flex justify-between items-center gap-3 mb-3">
          <h2 id="vivos-title" className="text-base font-bold text-white mb-0">No torneio <span className="text-muted">({alive.length})</span></h2>
          {!finished && (
            <button type="button" className="btn btn-success btn-sm" onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Inscrever
            </button>
          )}
        </div>
        {alive.length > 8 && (
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input className="input pl-10 text-sm" placeholder="Buscar jogador" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar jogador" />
          </div>
        )}
        {alive.length === 0 ? (
          <div className="glass-panel p-8 text-center text-sm text-muted">Ninguém inscrito ainda.</div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredAlive.map(e => {
              const r = count(e, 'rebuy');
              const a = count(e, 'addon');
              const fiado = movesOf(e).filter(m => m.payment_method === 'fiado').reduce((s, m) => s + m.amount, 0);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={finished}
                    onClick={() => setSelected(e)}
                    className="w-full p-3 rounded-xl border border-glass-border hover:border-primary flex items-center justify-between gap-3 text-left cursor-pointer"
                    style={{ background: 'rgba(15,23,42,0.45)' }}
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-bold text-white block truncate">{e.name}</span>
                      <span className="text-xs text-muted block">
                        {r > 0 ? `${r} rebuy${r > 1 ? 's' : ''}` : 'Sem rebuy'}{a > 0 ? ` · ${a} add-on${a > 1 ? 's' : ''}` : ''}
                        {fiado > 0 && <span className="text-warning"> · fiado {money(fiado)}</span>}
                      </span>
                    </span>
                    <span className="text-xs text-primary font-bold flex-shrink-0">Ações</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Premiação */}
      <section className="glass-panel p-5 text-left" aria-labelledby="premiacao-title">
        <h2 id="premiacao-title" className="text-base font-bold text-white mb-1">Premiação</h2>
        <p className="text-xs text-muted mb-3">
          {payouts.length} premiado{payouts.length === 1 ? '' : 's'} com {stats.entries} inscrito{stats.entries === 1 ? '' : 's'}.
          {stats.overlay > 0 && ` O garantido de ${money(cfg.gtd)} ainda não foi atingido.`}
        </p>
        <ul className="space-y-2">
          {payouts.map((v, i) => {
            const who = entries.find(e => e.position === i + 1);
            const paid = who ? movesOf(who).some(m => m.kind === 'premio') : false;
            return (
              <li key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-glass-border">
                <span className="min-w-0">
                  <span className="text-sm font-bold text-white">{i + 1}º</span>
                  <span className="text-sm text-muted"> · {who ? who.name : 'a definir'}</span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <strong className="text-warning text-sm">{money(v)}</strong>
                  {who && (paid
                    ? <span className="badge badge-active">Pago</span>
                    : <button type="button" className="btn btn-outline btn-sm" onClick={() => { setPayMethod('pix'); setPaying({ entry: who, kind: 'premio', label: `Prêmio ${i + 1}º lugar`, amount: v }); }}>Pagar</button>)}
                </span>
              </li>
            );
          })}
        </ul>
        {cfg.extras.length > 0 && (
          <>
            <h3 className="text-sm font-bold text-muted mt-4 mb-2">Prêmios extras</h3>
            <ul className="space-y-2">
              {cfg.extras.map(x => {
                const given = movements.find(m => m.kind === 'extra' && m.label === x.label);
                const to = given ? entries.find(e => e.id === given.entry_id) : null;
                return (
                  <li key={x.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-glass-border">
                    <span className="text-sm text-white min-w-0 truncate">{x.label}{to ? <span className="text-muted"> · {to.name}</span> : null}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <strong className="text-warning text-sm">{money(x.amount)}</strong>
                      {given ? <span className="badge badge-active">Pago</span> : (
                        <select
                          className="input text-xs py-1.5"
                          style={{ width: 150 }}
                          value=""
                          onChange={ev => {
                            const e = entries.find(y => y.id === ev.target.value);
                            if (e) { setPayMethod('pix'); setPaying({ entry: e, kind: 'extra', label: x.label, amount: x.amount }); }
                          }}
                          aria-label={`Quem ganhou ${x.label}`}
                        >
                          <option value="">Quem ganhou?</option>
                          {entries.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Eliminados */}
      {out.length > 0 && (
        <section aria-labelledby="fora-title">
          <h2 id="fora-title" className="text-base font-bold text-white mb-3">Colocações <span className="text-muted">({out.length})</span></h2>
          <ul className="space-y-1.5">
            {out.map(e => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-glass-border text-sm">
                <span className="min-w-0 truncate">
                  <strong className={e.position === 1 ? 'text-warning' : 'text-white'}>{e.position ? `${e.position}º` : '—'}</strong>
                  <span className="text-white"> {e.name}</span>
                </span>
                {!finished && (
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => actions.eliminate(e, null)} title="Voltar ao torneio">
                    <RotateCcw size={14} /> Voltar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {finished && (
        <section className="glass-panel p-5 text-left">
          <p className="text-sm text-white mb-3">
            Torneio encerrado{champion ? <> · campeão <strong className="text-warning">{champion.name}</strong></> : null}.
          </p>
          <button type="button" className="btn btn-outline btn-sm" onClick={actions.reopen} disabled={busy}>
            Reabrir torneio
          </button>
        </section>
      )}

      {/* Histórico */}
      {movements.length > 0 && (
        <details className="glass-panel p-5 text-left">
          <summary className="text-sm font-bold text-white cursor-pointer">Lançamentos ({movements.length})</summary>
          <ul className="mt-3 space-y-1.5">
            {[...movements].reverse().slice(0, 80).map(m => {
              const e = entries.find(x => x.id === m.entry_id);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 text-xs border-t border-glass-border pt-1.5">
                  <span className="min-w-0 truncate">
                    <span className="text-muted">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>{' '}
                    <strong className="text-white">{e?.name}</strong> · {m.label || m.kind}
                    {m.chips > 0 && <span className="text-muted"> · {fmtShortChips(m.chips)}</span>}
                    {m.amount > 0 && <span className={m.kind === 'premio' || m.kind === 'extra' ? 'text-danger' : 'text-success'}> · {money(m.amount)}</span>}
                    {m.payment_method && <span className="text-muted"> · {paymentLabel(m.payment_method)}</span>}
                  </span>
                  <button type="button" className="btn btn-outline btn-sm text-danger" onClick={() => actions.undoMovement(m)} disabled={busy} aria-label="Desfazer lançamento">
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {adding && (
        <RegisterSheet
          tournament={tournament}
          entries={entries}
          globalPlayers={globalPlayers}
          busy={busy}
          onClose={() => setAdding(false)}
          onConfirm={async (p, method, bonusIds) => {
            await actions.register(p, method, bonusIds);
          }}
        />
      )}

      {selected && (
        <EntrySheet
          tournament={tournament}
          entry={selected}
          movements={movesOf(selected)}
          clock={clock}
          alive={alive.length}
          busy={busy}
          onClose={() => setSelected(null)}
          actions={actions}
        />
      )}

      {paying && (
        <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="pagar-title" onClick={() => setPaying(null)}>
          <div className="modal-content mobile-bottom-sheet max-w-md text-left" onClick={e => e.stopPropagation()}>
            <h2 id="pagar-title" className="text-lg font-bold text-white mb-1">{paying.label}</h2>
            <p className="text-sm text-muted mb-4">{paying.entry.name} recebe <strong className="text-warning">{money(paying.amount)}</strong>.</p>
            <p className="text-xs text-muted font-bold mb-2">Como o clube pagou</p>
            <MethodChips value={payMethod} onChange={setPayMethod} methods={SETTLE_OUT_METHODS} />
            <div className="flex flex-col md:flex-row gap-2 mt-5">
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={async () => {
                  await actions.movement(paying.entry, paying.kind, { label: paying.label, amount: paying.amount, to_prize: 0, chips: 0 }, payMethod);
                  setPaying(null);
                }}
              >
                Confirmar pagamento
              </button>
              <button type="button" className="btn btn-outline flex-1" onClick={() => setPaying(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmFinish}
        title="Encerrar o torneio?"
        message={`${alive[0]?.name ?? ''} fica em 1º lugar e o relógio para. Os prêmios podem ser pagos depois.`}
        confirmLabel="Encerrar"
        busy={busy}
        onConfirm={async () => { await actions.finish(alive[0]); setConfirmFinish(false); }}
        onCancel={() => setConfirmFinish(false)}
      />
    </div>
  );
}

// ---------- inscrição ----------

function RegisterSheet({
  tournament, entries, globalPlayers, busy, onClose, onConfirm
}: {
  tournament: TournamentRow;
  entries: EntryRow[];
  globalPlayers: GlobalPlayer[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (p: { id?: string; name: string }, method: PaymentMethod, bonusIds: string[]) => Promise<void>;
}) {
  const cfg = tournament.config;
  const [term, setTerm] = useState('');
  const [chosen, setChosen] = useState<{ id?: string; name: string } | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('dinheiro');
  const [bonusIds, setBonusIds] = useState<string[]>([]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const q = norm(term);
  const inTournament = (gp: GlobalPlayer) => entries.some(e => isSamePlayer({ player_id: e.player_id, name: e.name } as never, gp));
  const available = globalPlayers.filter(gp => !inTournament(gp) && (!q || norm(gp.name).includes(q))).slice(0, 30);
  const exact = globalPlayers.some(gp => norm(gp.name) === q);

  const chips = cfg.buyin.chips + cfg.bonuses.filter(b => bonusIds.includes(b.id)).reduce((s, b) => s + b.chips, 0);

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="inscrever-title" onClick={onClose}>
      <div className="modal-content mobile-bottom-sheet max-w-lg text-left" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="inscrever-title" className="text-lg font-bold text-white mb-0">{chosen ? chosen.name : 'Inscrever jogador'}</h2>
          <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center text-muted border-0 cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {!chosen ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden="true" />
              <input className="input pl-10" placeholder="Buscar ou cadastrar" value={term} onChange={e => setTerm(e.target.value)} autoFocus aria-label="Buscar ou cadastrar" />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {q && !exact && (
                <button type="button" className="w-full p-3 rounded-xl border border-primary text-primary text-left text-sm font-bold cursor-pointer" style={{ background: 'rgba(59,130,246,0.08)' }} onClick={() => setChosen({ name: term.trim() })}>
                  <UserPlus size={16} className="inline mr-2" />Cadastrar "{term.trim()}"
                </button>
              )}
              {available.map(gp => (
                <button key={gp.id} type="button" className="w-full p-3 rounded-xl border border-glass-border text-white text-left text-sm font-bold cursor-pointer hover:border-primary" style={{ background: 'rgba(15,23,42,0.5)' }} onClick={() => setChosen({ id: gp.id, name: gp.name })}>
                  {gp.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-white mb-1">
              Buy-in <strong>{money(cfg.buyin.price)}</strong> · {fmtShortChips(chips)} fichas
            </p>
            <p className="text-xs text-muted mb-4">{money(cfg.buyin.toPrize)} para o prêmio · {money(cfg.buyin.price - cfg.buyin.toPrize)} de taxa</p>

            {cfg.bonuses.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-muted font-bold mb-2">Bônus de fichas</p>
                <div className="flex flex-wrap gap-2">
                  {cfg.bonuses.map(b => {
                    const on = bonusIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setBonusIds(ids => (on ? ids.filter(x => x !== b.id) : [...ids, b.id]))}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${on ? 'bg-success bg-opacity-20 border-success text-white' : 'bg-white bg-opacity-5 border-glass-border text-muted'}`}
                      >
                        <Gift size={13} className="inline mr-1" />{b.label} +{fmtShortChips(b.chips)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-muted font-bold mb-2">Como pagou</p>
            <MethodChips value={method} onChange={setMethod} methods={PAYMENT_METHODS} />

            <div className="flex flex-col md:flex-row gap-2 mt-5">
              <button type="button" className="btn btn-primary flex-1 py-3" disabled={busy} onClick={async () => { await onConfirm(chosen, method, bonusIds); onClose(); }}>
                {busy ? 'Inscrevendo...' : 'Confirmar inscrição'}
              </button>
              <button type="button" className="btn btn-outline flex-1 py-3" onClick={() => setChosen(null)}>Voltar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- ações do jogador ----------

function EntrySheet({
  tournament, entry, movements, clock, alive, busy, onClose, actions
}: {
  tournament: TournamentRow;
  entry: EntryRow;
  movements: MovementRow[];
  clock: ClockState;
  alive: number;
  busy: boolean;
  onClose: () => void;
  actions: LiveActions;
}) {
  const cfg = tournament.config;
  const [pending, setPending] = useState<{ kind: 'rebuy' | 'addon'; opt: EntryOption } | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('dinheiro');
  const [confirmOut, setConfirmOut] = useState(false);
  const givenBonus = new Set(movements.filter(m => m.kind === 'bonus').map(m => m.label));
  const hasMoney = movements.some(m => m.kind !== 'bonus');
  const rebuyLate = !rebuyOpen(cfg, clock);
  const addonEarly = !addonOpen(clock);

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="entry-title" onClick={onClose}>
      <div className="modal-content mobile-bottom-sheet max-w-lg text-left" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-glass-border pb-3 mb-4">
          <h2 id="entry-title" className="text-lg font-bold text-white mb-0 truncate">{entry.name}</h2>
          <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center text-muted border-0 cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {pending ? (
          <>
            <p className="text-sm text-white mb-1"><strong>{pending.opt.label}</strong> · {money(pending.opt.price)} · +{fmtShortChips(pending.opt.chips)} fichas</p>
            {pending.kind === 'rebuy' && rebuyLate && <p className="text-xs text-warning mb-2">O rebuy era até o nível {cfg.rebuyUntilLevel}. Confirme se o clube liberou.</p>}
            {pending.kind === 'addon' && addonEarly && <p className="text-xs text-warning mb-2">Fora do intervalo do add-on. Confirme se o clube liberou.</p>}
            <p className="text-xs text-muted font-bold mb-2 mt-3">Como pagou</p>
            <MethodChips value={method} onChange={setMethod} methods={PAYMENT_METHODS} />
            <div className="flex flex-col md:flex-row gap-2 mt-5">
              <button
                type="button"
                className="btn btn-primary flex-1 py-3"
                disabled={busy}
                onClick={async () => {
                  await actions.movement(entry, pending.kind, { label: pending.opt.label, amount: pending.opt.price, to_prize: pending.opt.toPrize, chips: pending.opt.chips }, method);
                  onClose();
                }}
              >
                Confirmar {pending.kind === 'rebuy' ? 'rebuy' : 'add-on'}
              </button>
              <button type="button" className="btn btn-outline flex-1 py-3" onClick={() => setPending(null)}>Voltar</button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {cfg.rebuys.length > 0 && (
              <div>
                <p className="text-xs text-muted font-bold mb-2">Rebuy{rebuyLate ? ' · encerrado' : ''}</p>
                <div className="grid grid-cols-2 gap-2">
                  {cfg.rebuys.map(o => (
                    <button key={o.id} type="button" className="p-3 rounded-xl border border-primary border-opacity-40 text-left cursor-pointer" style={{ background: 'rgba(59,130,246,0.08)' }} onClick={() => setPending({ kind: 'rebuy', opt: o })}>
                      <span className="text-sm font-bold text-white block">{o.label}</span>
                      <span className="text-xs text-muted">{money(o.price)} · {fmtShortChips(o.chips)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {cfg.addons.length > 0 && (
              <div>
                <p className="text-xs text-muted font-bold mb-2">Add-on{!addonEarly ? ' · liberado agora' : ''}</p>
                <div className="grid grid-cols-2 gap-2">
                  {cfg.addons.map(o => (
                    <button key={o.id} type="button" className="p-3 rounded-xl border border-warning border-opacity-40 text-left cursor-pointer" style={{ background: 'rgba(245,158,11,0.08)' }} onClick={() => setPending({ kind: 'addon', opt: o })}>
                      <span className="text-sm font-bold text-white block">{o.label}</span>
                      <span className="text-xs text-muted">{money(o.price)} · {fmtShortChips(o.chips)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {cfg.bonuses.some(b => !givenBonus.has(b.label)) && (
              <div>
                <p className="text-xs text-muted font-bold mb-2">Bônus de fichas</p>
                <div className="flex flex-wrap gap-2">
                  {cfg.bonuses.filter(b => !givenBonus.has(b.label)).map(b => (
                    <button key={b.id} type="button" className="btn btn-outline btn-sm" disabled={busy}
                      onClick={async () => { await actions.movement(entry, 'bonus', { label: b.label, amount: 0, to_prize: 0, chips: b.chips }, null); onClose(); }}>
                      <Gift size={14} /> {b.label} +{fmtShortChips(b.chips)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="button" className="btn btn-danger w-full py-3" onClick={() => setConfirmOut(true)} disabled={busy}>
              <Skull size={16} /> Eliminar ({alive}º lugar)
            </button>
            {!hasMoney && (
              <button type="button" className="btn btn-outline w-full py-2.5 text-danger" disabled={busy} onClick={async () => { await actions.removeEntry(entry); onClose(); }}>
                Remover inscrição (lançado por engano)
              </button>
            )}
          </div>
        )}

        <ConfirmDialog
          open={confirmOut}
          title={`Eliminar ${entry.name}?`}
          message={`Fica em ${alive}º lugar. A TV anuncia a eliminação.`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onConfirm={async () => { await actions.eliminate(entry, alive); setConfirmOut(false); onClose(); }}
          onCancel={() => setConfirmOut(false)}
        />
      </div>
    </div>
  );
}

