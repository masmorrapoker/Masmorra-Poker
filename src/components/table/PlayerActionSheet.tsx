import React, { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Coffee, Pencil, UserMinus, X, AlertTriangle } from 'lucide-react';
import type { PaymentMethod, PlayerSummary, TransactionType } from '../../types';
import { SETTLE_IN_METHODS, SETTLE_OUT_METHODS } from '../../lib/paymentMethods';
import { formatMoney } from '../../utils';
import { triggerHaptic } from '../../utils/haptic';

export interface ConsumoItem {
  name: string;
  price: number;
}

export interface NewTransaction {
  type: TransactionType;
  amount: number;
  description?: string;
  payment_method?: PaymentMethod | null;
  /** Cash-out: parte do acerto que ficou no fiado */
  fiado_amount?: number;
}

interface PlayerActionSheetProps {
  summary: PlayerSummary;
  initialPhone: string;
  consumoItems: ConsumoItem[];
  /** Acerto na saída e fiado disponíveis no banco (migrações aplicadas) */
  paymentsEnabled: boolean;
  /** Saldo de fiado em aberto do jogador (0 se nenhum) */
  fiadoBalance: number;
  /** Pode ser removido da mesa (sem lançamentos) */
  canRemove: boolean;
  submitting: boolean;
  onSubmit: (tx: NewTransaction, settleFiado?: number) => Promise<boolean>;
  onEditPlayer: (name: string, phone: string | null) => Promise<boolean>;
  onRemove: () => void;
  onClose: () => void;
}

type Mode = 'menu' | 'buy_in' | 'cash_out' | 'consumo' | 'edit';

const QUICK_VALUES = [50, 100, 200, 500, 1000];

export default function PlayerActionSheet({
  summary,
  initialPhone,
  consumoItems,
  paymentsEnabled,
  fiadoBalance,
  canRemove,
  submitting,
  onSubmit,
  onEditPlayer,
  onRemove,
  onClose
}: PlayerActionSheetProps) {
  const [mode, setMode] = useState<Mode>('menu');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [paidNow, setPaidNow] = useState('');
  const [settleFiado, setSettleFiado] = useState(false);
  const [name, setName] = useState(summary.player.name);
  const [phone, setPhone] = useState(initialPhone);

  useEffect(() => {
    setName(summary.player.name);
    setPhone(initialPhone);
  }, [summary.player.name, initialPhone]);

  const go = (next: Mode) => {
    triggerHaptic('light');
    setAmount('');
    setDescription('');
    setSettleFiado(false);
    setMethod('pix');
    setPaidNow('');
    setMode(next);
  };

  const quickAdd = (value: number) => {
    triggerHaptic('light');
    setAmount(prev => {
      const current = parseFloat(prev);
      return String((isNaN(current) || current <= 0 ? 0 : current) + value);
    });
  };

  const numeric = parseFloat(amount);
  const validAmount = !isNaN(numeric) && numeric >= 0 && !(mode === 'buy_in' && numeric === 0);

  // Acerto na saída: resultado = fichas − buy-in − consumo
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const result = validAmount ? round2(numeric - summary.buyIn - summary.consumo) : 0;
  const owes = Math.max(0, -result);
  const wins = Math.max(0, result);
  const outMethod: PaymentMethod = SETTLE_OUT_METHODS.some(m => m.value === method) ? method : 'pix';
  const paidParsed = parseFloat(paidNow);
  const paidIn = method === 'fiado' ? 0 : paidNow.trim() === '' || isNaN(paidParsed) ? owes : Math.min(owes, Math.max(0, paidParsed));
  const fiadoNovo = round2(owes - paidIn);
  const abatido = settleFiado ? Math.min(fiadoBalance, wins) : 0;
  const payout = round2(wins - abatido);

  async function submitMoney(e: React.FormEvent) {
    e.preventDefault();
    if (!validAmount || submitting || (mode !== 'buy_in' && mode !== 'cash_out')) return;
    if (mode === 'buy_in' || !paymentsEnabled) {
      await onSubmit({ type: mode, amount: numeric });
      return;
    }
    const payment_method = owes > 0 ? (paidIn > 0 ? method : null) : wins > 0 ? (payout > 0 ? outMethod : null) : null;
    await onSubmit(
      { type: 'cash_out', amount: numeric, payment_method, fiado_amount: fiadoNovo > 0 ? fiadoNovo : 0 },
      abatido > 0 ? abatido : undefined
    );
  }

  async function submitManualConsumo(e: React.FormEvent) {
    e.preventDefault();
    if (isNaN(numeric) || numeric < 0 || submitting) return;
    await onSubmit({ type: 'consumo', amount: numeric, description: description.trim() || 'Consumo avulso' });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await onEditPlayer(name.trim(), phone.trim() || null);
    if (ok) setMode('menu');
  }

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="player-sheet-title" onClick={onClose}>
      <div className="modal-content mobile-bottom-sheet max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" />

        <div className="flex justify-between items-center border-b border-glass-border pb-4 mb-4">
          <div className="text-left min-w-0">
            <span id="player-sheet-title" className="text-base font-black text-white block truncate">{summary.player.name}</span>
            <span className="text-xs text-muted">
              Buy-in {formatMoney(summary.buyIn)} · Consumo {formatMoney(summary.consumo)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-white flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
          >
            <X size={18} />
          </button>
        </div>

        {fiadoBalance > 0 && mode === 'menu' && (
          <div className="mb-4 p-3 rounded-xl border border-warning border-opacity-25 bg-warning bg-opacity-10 text-xs text-warning flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>Este jogador tem {formatMoney(fiadoBalance)} de fiado em aberto.</span>
          </div>
        )}

        {mode === 'menu' && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => go('buy_in')}
              className="w-full py-4 rounded-xl bg-warning bg-opacity-10 text-warning hover:bg-opacity-20 border border-warning border-opacity-25 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
            >
              <ArrowDownCircle size={18} /> Registrar buy-in
            </button>
            <button
              type="button"
              onClick={() => go('cash_out')}
              className="w-full py-4 rounded-xl bg-success bg-opacity-10 text-success hover:bg-opacity-20 border border-success border-opacity-25 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
            >
              <ArrowUpCircle size={18} /> Registrar cash-out
            </button>
            <button
              type="button"
              onClick={() => go('consumo')}
              className="w-full py-4 rounded-xl bg-danger bg-opacity-10 text-danger hover:bg-opacity-20 border border-danger border-opacity-25 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
            >
              <Coffee size={18} /> Registrar consumo
            </button>
            <button
              type="button"
              onClick={() => go('edit')}
              className="w-full py-4 rounded-xl bg-white bg-opacity-5 text-white hover:bg-opacity-10 border border-glass-border text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
            >
              <Pencil size={16} /> Editar jogador
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="w-full py-3 rounded-xl text-danger font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-danger border-opacity-25 active:scale-95 transition-transform"
                style={{ background: 'transparent' }}
              >
                <UserMinus size={14} /> Remover da mesa (adicionado por engano)
              </button>
            )}
          </div>
        )}

        {(mode === 'buy_in' || mode === 'cash_out') && (
          <form onSubmit={submitMoney}>
            <div className="input-group mb-4">
              <label htmlFor="tx-amount" className="text-xs text-muted font-bold text-left block mb-2">
                {mode === 'buy_in' ? 'Valor do buy-in (R$)' : 'Fichas na saída (R$)'}
              </label>
              <input
                id="tx-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="input text-2xl text-center font-bold py-3.5"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {QUICK_VALUES.map(v => (
                <button
                  key={v}
                  type="button"
                  className="btn btn-outline py-3.5 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                  onClick={() => quickAdd(v)}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                >
                  +{v}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-danger py-3.5 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                onClick={() => { triggerHaptic('medium'); setAmount(''); }}
              >
                Limpar
              </button>
            </div>

            {mode === 'cash_out' && paymentsEnabled && validAmount && amount.trim() !== '' && (
              <section aria-label="Acerto" className="mb-4 p-4 rounded-xl border border-glass-border text-left" style={{ background: 'rgba(15,23,42,0.5)' }}>
                <p className="text-[11px] text-muted mb-1">
                  Fichas {formatMoney(numeric)} − buy-in {formatMoney(summary.buyIn)}
                  {summary.consumo > 0 && <> − consumo {formatMoney(summary.consumo)}</>}
                </p>

                {owes > 0 && (
                  <>
                    <p className="text-base font-extrabold text-danger mb-3">Jogador paga {formatMoney(owes)}</p>
                    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Como o jogador pagou">
                      {[...SETTLE_IN_METHODS, { value: 'fiado' as PaymentMethod, label: 'Fica devendo' }].map(m => (
                        <button
                          key={m.value}
                          type="button"
                          aria-pressed={method === m.value}
                          onClick={() => { triggerHaptic('light'); setMethod(m.value); }}
                          className={`py-3 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                            method === m.value
                              ? m.value === 'fiado'
                                ? 'bg-warning bg-opacity-20 border-warning text-warning'
                                : 'bg-primary bg-opacity-20 border-primary text-white'
                              : 'bg-white bg-opacity-5 border-glass-border text-muted'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {method !== 'fiado' && (
                      <label className="block mt-3">
                        <span className="text-[11px] text-muted font-bold block mb-1">Quanto pagou agora (deixe vazio se pagou tudo)</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max={owes}
                          className="input text-sm py-2.5"
                          placeholder={String(owes)}
                          value={paidNow}
                          onChange={e => setPaidNow(e.target.value)}
                        />
                      </label>
                    )}
                    {fiadoNovo > 0 && (
                      <p className="text-xs text-warning font-bold mt-3 mb-0">
                        {formatMoney(fiadoNovo)} vai para o fiado do jogador.
                      </p>
                    )}
                  </>
                )}

                {wins > 0 && (
                  <>
                    <p className="text-base font-extrabold text-success mb-3">Clube paga {formatMoney(wins)}</p>
                    {fiadoBalance > 0 && (
                      <label className="mb-3 flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settleFiado}
                          onChange={e => setSettleFiado(e.target.checked)}
                          className="mt-0.5"
                          style={{ width: 18, height: 18 }}
                        />
                        <span className="text-xs text-warning">
                          Descontar o fiado em aberto ({formatMoney(fiadoBalance)})
                        </span>
                      </label>
                    )}
                    {payout > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Como o clube pagou">
                          {SETTLE_OUT_METHODS.map(m => (
                            <button
                              key={m.value}
                              type="button"
                              aria-pressed={outMethod === m.value}
                              onClick={() => { triggerHaptic('light'); setMethod(m.value); }}
                              className={`py-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                                outMethod === m.value
                                  ? 'bg-primary bg-opacity-20 border-primary text-white'
                                  : 'bg-white bg-opacity-5 border-glass-border text-muted'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        {abatido > 0 && (
                          <p className="text-xs text-white font-bold mt-3 mb-0">
                            Pagar ao jogador: {formatMoney(payout)} ({formatMoney(abatido)} abatidos do fiado)
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-white font-bold mb-0">
                        Todo o prêmio ({formatMoney(abatido)}) abate o fiado. Nada a pagar ao jogador.
                      </p>
                    )}
                  </>
                )}

                {owes === 0 && wins === 0 && (
                  <p className="text-sm font-bold text-white mb-0">Saiu no zero. Nada a acertar.</p>
                )}
              </section>
            )}

            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <button type="submit" className="btn btn-primary w-full py-4 text-sm font-bold" disabled={!validAmount || submitting}>
                {submitting ? 'Salvando...' : `Confirmar ${mode === 'buy_in' ? 'buy-in' : 'cash-out'}`}
              </button>
              <button type="button" className="btn btn-outline w-full py-4 text-sm font-semibold" onClick={() => go('menu')}>
                Voltar
              </button>
            </div>
          </form>
        )}

        {mode === 'consumo' && (
          <div className="space-y-6 text-left">
            <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
              {consumoItems.map((item, idx) => (
                <button
                  key={`${item.name}-${idx}`}
                  type="button"
                  disabled={submitting}
                  onClick={() => onSubmit({ type: 'consumo', amount: item.price, description: item.name })}
                  className="p-4 rounded-xl text-white border border-glass-border hover:border-success transition-all text-left flex flex-col gap-1 cursor-pointer active:scale-95"
                  style={{ background: 'rgba(15,23,42,0.5)' }}
                >
                  <span className="font-bold text-xs text-white">{item.name}</span>
                  <span className="text-xs text-success font-bold">{item.price === 0 ? 'Grátis' : formatMoney(item.price)}</span>
                </button>
              ))}
            </div>

            <form onSubmit={submitManualConsumo} className="border-t border-glass-border pt-4 flex flex-col gap-3">
              <p className="text-xs text-muted font-semibold mb-0">Produto avulso</p>
              <input
                type="text"
                className="input text-sm py-2.5 rounded-xl"
                placeholder="Nome do produto"
                aria-label="Nome do produto"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <div className="flex gap-3 items-end">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="input text-sm py-2.5 rounded-xl flex-1"
                  placeholder="Preço (R$)"
                  aria-label="Preço"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <button type="submit" className="btn btn-primary py-3 px-5" disabled={!amount || isNaN(numeric) || numeric < 0 || submitting}>
                  Lançar
                </button>
              </div>
            </form>

            <button type="button" className="btn btn-outline w-full py-3.5 text-xs font-bold" onClick={() => go('menu')}>
              Voltar
            </button>
          </div>
        )}

        {mode === 'edit' && (
          <form onSubmit={submitEdit}>
            <div className="input-group mb-4">
              <label htmlFor="edit-name" className="text-xs font-bold text-muted block mb-2 text-left">Nome do jogador</label>
              <input id="edit-name" type="text" className="input text-sm py-3 rounded-xl" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group mb-6">
              <label htmlFor="edit-phone" className="text-xs font-bold text-muted block mb-2 text-left">Telefone / WhatsApp</label>
              <input id="edit-phone" type="tel" className="input text-sm py-3 rounded-xl" placeholder="(51) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <button type="submit" className="btn btn-primary w-full py-4 text-xs font-bold" disabled={!name.trim() || submitting}>
                Salvar alterações
              </button>
              <button type="button" className="btn btn-outline w-full py-4 text-xs font-semibold" onClick={() => go('menu')}>
                Voltar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
