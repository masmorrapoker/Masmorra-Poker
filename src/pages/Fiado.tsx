import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, HandCoins, MessageCircle, Search, Undo2, X } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { fiadoService, type FiadoEntry } from '../services/fiadoService';
import { hasPaymentFeatures, SETTLEMENT_METHODS, type SettlementMethod } from '../lib/paymentMethods';
import type { FiadoBalance } from '../types';
import { formatMoney, formatDateTime, formatPhone } from '../utils';
import { toast } from '../components/Toast';
import { useSubmitLock } from '../hooks/useSubmitLock';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Fiado() {
  const { clubId, clubName } = useClub();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [balances, setBalances] = useState<FiadoBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSettled, setShowSettled] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statement, setStatement] = useState<FiadoEntry[]>([]);
  const [paying, setPaying] = useState<FiadoBalance | null>(null);
  const [undoing, setUndoing] = useState<FiadoEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setBalances(await fiadoService.getBalances(clubId));
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar o fiado.');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    hasPaymentFeatures().then(ok => {
      setEnabled(ok);
      if (ok) load(); else setLoading(false);
    });
  }, [load]);

  async function toggle(playerId: string) {
    if (expanded === playerId) {
      setExpanded(null);
      return;
    }
    setExpanded(playerId);
    setStatement([]);
    if (clubId) {
      try {
        setStatement(await fiadoService.getStatement(clubId, playerId));
      } catch (e) {
        console.error(e);
      }
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return balances
      .filter(b => showSettled || b.saldo > 0.005)
      .filter(b => !q || b.name.toLowerCase().includes(q));
  }, [balances, search, showSettled]);

  const totalOpen = balances.filter(b => b.saldo > 0).reduce((s, b) => s + b.saldo, 0);
  const debtors = balances.filter(b => b.saldo > 0.005).length;

  async function undoPayment() {
    if (!clubId || !undoing) return;
    setBusy(true);
    try {
      await fiadoService.removePayment(clubId, undoing.id);
      toast.success('Pagamento desfeito.');
      setUndoing(null);
      await load();
      if (expanded) setStatement(await fiadoService.getStatement(clubId, expanded));
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível desfazer o pagamento.');
    } finally {
      setBusy(false);
    }
  }

  function chargeLink(b: FiadoBalance) {
    const phone = formatPhone(b.phone);
    if (!phone) return null;
    const text = `Olá, ${b.name.split(' ')[0]}! Passando para lembrar que seu saldo em aberto${clubName ? ` no ${clubName}` : ''} é de ${formatMoney(b.saldo)}. Qualquer dúvida, é só chamar.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  if (enabled === false) {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto mobile-view-padding text-left">
        <h1 className="mb-2">Fiado</h1>
        <div className="glass-panel p-6">
          <p className="text-white font-bold mb-2">O controle de fiado ainda não foi ativado.</p>
          <p className="text-sm text-muted mb-0">
            Ele depende de uma atualização do banco de dados (acerto na saída). Depois de aplicada, quem sair
            perdendo e ficar devendo aparece aqui com o saldo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto mobile-view-padding text-left">
      <div className="mb-6">
        <h1 className="mb-1">Fiado</h1>
        <p className="text-muted text-sm mb-0">Quem está devendo ao clube, quanto e desde quando.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass-panel p-4">
          <dt className="text-xs text-muted">Total em aberto</dt>
          <dd className="text-xl font-black text-warning">{formatMoney(totalOpen)}</dd>
        </div>
        <div className="glass-panel p-4">
          <dt className="text-xs text-muted">Jogadores devendo</dt>
          <dd className="text-xl font-black text-white">{debtors}</dd>
        </div>
      </dl>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden="true" />
          <input
            type="search"
            className="input pl-10"
            placeholder="Buscar jogador"
            aria-label="Buscar jogador"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input type="checkbox" checked={showSettled} onChange={e => setShowSettled(e.target.checked)} style={{ width: 18, height: 18 }} />
          Mostrar quitados
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><div className="spinner" role="status" aria-label="Carregando" /></div>
      ) : visible.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <HandCoins className="mx-auto text-muted mb-3" size={32} aria-hidden="true" />
          <p className="text-white font-bold mb-1">{balances.length === 0 ? 'Nenhum fiado registrado.' : 'Ninguém devendo.'}</p>
          <p className="text-sm text-muted mb-0">
            Quando um jogador sair perdendo e não pagar na hora, escolha <strong className="text-white">Fica devendo</strong> no
            acerto do cash-out. O valor aparece aqui até ser pago.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(b => {
            const isOpen = expanded === b.player_id;
            const link = b.saldo > 0 ? chargeLink(b) : null;
            return (
              <li key={b.player_id} className="glass-panel p-0 overflow-hidden">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggle(b.player_id)}
                    className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
                    style={{ background: 'transparent', border: 'none', padding: 0 }}
                  >
                    {isOpen ? <ChevronDown size={18} className="text-muted flex-shrink-0" /> : <ChevronRight size={18} className="text-muted flex-shrink-0" />}
                    <span className="min-w-0">
                      <span className="text-white font-bold block truncate">{b.name}</span>
                      <span className="text-xs text-muted block">
                        {b.ultima_movimentacao ? `Última movimentação ${formatDateTime(b.ultima_movimentacao)}` : ''}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-2 justify-between md:justify-end">
                    <span className={`text-lg font-black ${b.saldo > 0.005 ? 'text-warning' : 'text-success'}`}>
                      {b.saldo > 0.005 ? formatMoney(b.saldo) : 'Quitado'}
                    </span>
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" aria-label={`Cobrar ${b.name} pelo WhatsApp`}>
                        <MessageCircle size={16} /> Cobrar
                      </a>
                    )}
                    {b.saldo > 0.005 && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setPaying(b)}>
                        <HandCoins size={16} /> Registrar pagamento
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-glass-border p-4">
                    <p className="text-xs text-muted mb-3">
                      Ficou devendo {formatMoney(b.devido)} · Pago {formatMoney(b.pago)} ·{' '}
                      <Link to={`/player/${b.player_id}`} className="text-primary">ver perfil</Link>
                    </p>
                    {statement.length === 0 ? (
                      <p className="text-sm text-muted mb-0">Carregando extrato...</p>
                    ) : (
                      <ul className="space-y-2">
                        {statement.map(e => (
                          <li key={`${e.kind}-${e.id}`} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="text-white block truncate">{e.label}</span>
                              <span className="text-xs text-muted">{formatDateTime(e.created_at)}</span>
                            </span>
                            <span className="flex items-center gap-2 flex-shrink-0">
                              <span className={`font-bold ${e.kind === 'fiado' ? 'text-warning' : 'text-success'}`}>
                                {e.kind === 'fiado' ? '+' : '−'}{formatMoney(e.amount)}
                              </span>
                              {e.removable && (
                                <button
                                  type="button"
                                  onClick={() => setUndoing(e)}
                                  aria-label="Desfazer pagamento"
                                  className="w-9 h-9 rounded-lg text-muted hover:text-danger flex items-center justify-center cursor-pointer"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
                                >
                                  <Undo2 size={15} />
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {paying && clubId && (
        <PaymentDialog
          balance={paying}
          clubId={clubId}
          onClose={() => setPaying(null)}
          onDone={async () => {
            setPaying(null);
            await load();
            if (expanded === paying.player_id) setStatement(await fiadoService.getStatement(clubId, paying.player_id));
          }}
        />
      )}

      <ConfirmDialog
        open={undoing !== null}
        danger
        busy={busy}
        title="Desfazer pagamento?"
        message={undoing ? <>O pagamento de <strong className="text-white">{formatMoney(undoing.amount)}</strong> será apagado e o valor volta para o saldo devedor.</> : ''}
        confirmLabel="Desfazer pagamento"
        onConfirm={undoPayment}
        onCancel={() => setUndoing(null)}
      />
    </div>
  );
}

function PaymentDialog({ balance, clubId, onClose, onDone }: {
  balance: FiadoBalance;
  clubId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(balance.saldo.toFixed(2));
  const [method, setMethod] = useState<SettlementMethod>('pix');
  const [note, setNote] = useState('');
  const lock = useSubmitLock();
  const value = parseFloat(amount.replace(',', '.'));
  const valid = !isNaN(value) && value > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await lock.run(async () => {
      try {
        await fiadoService.registerPayment(clubId, { player_id: balance.player_id, amount: value, method, note });
        toast.success(`Pagamento de ${formatMoney(value)} registrado para ${balance.name}.`);
        onDone();
      } catch (err) {
        console.error(err);
        toast.error('Não foi possível registrar o pagamento.');
      }
    });
  }

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="pay-title" onClick={onClose}>
      <form className="modal-content mobile-bottom-sheet max-w-md" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className="flex justify-between items-center mb-4">
          <h2 id="pay-title" className="text-lg font-bold text-white mb-0">Pagamento de {balance.name}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 rounded-full flex items-center justify-center text-muted" style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}>
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted mb-4">Saldo em aberto: <strong className="text-warning">{formatMoney(balance.saldo)}</strong></p>

        <div className="input-group mb-4">
          <label htmlFor="pay-amount" className="text-xs font-bold text-muted block mb-2">Valor pago (R$)</label>
          <input id="pay-amount" type="number" inputMode="decimal" step="0.01" min="0.01" className="input text-xl font-bold text-center" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </div>

        <fieldset className="mb-4">
          <legend className="text-xs font-bold text-muted block mb-2">Forma de pagamento</legend>
          <div className="grid grid-cols-3 gap-2">
            {SETTLEMENT_METHODS.filter(m => m.value !== 'abatido_cashout').map(m => (
              <button
                key={m.value}
                type="button"
                aria-pressed={method === m.value}
                onClick={() => setMethod(m.value)}
                className={`py-3 rounded-xl text-xs font-bold border cursor-pointer ${
                  method === m.value ? 'bg-primary bg-opacity-20 border-primary text-white' : 'bg-white bg-opacity-5 border-glass-border text-muted'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="input-group mb-6">
          <label htmlFor="pay-note" className="text-xs font-bold text-muted block mb-2">Observação (opcional)</label>
          <input id="pay-note" type="text" className="input" placeholder="Ex.: pagou metade, resto semana que vem" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <button type="submit" className="btn btn-primary w-full py-3.5 font-bold" disabled={!valid || lock.busy}>
            {lock.busy ? 'Salvando...' : 'Registrar pagamento'}
          </button>
          <button type="button" className="btn btn-outline w-full py-3.5" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
