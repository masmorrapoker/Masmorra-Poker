import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Copy, Printer, Undo2, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { authService } from '../services/authService';
import { cashService, type CashClosing } from '../services/cashService';
import {
  currentNight,
  expectedCash,
  formatNight,
  shiftNight,
  summarizeNight,
  type NightSummary
} from '../lib/nightMath';
import { formatMoney, formatDateTime } from '../utils';
import { toast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useSubmitLock } from '../hooks/useSubmitLock';

const money = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
};

function diffTone(diff: number) {
  if (Math.abs(diff) < 0.005) return { tone: 'text-success', label: 'Caixa bateu' };
  return diff < 0 ? { tone: 'text-danger', label: 'Faltou' } : { tone: 'text-warning', label: 'Sobrou' };
}

function buildText(clubName: string | null, night: string, s: NightSummary, c: CashClosing | null, opening: number, showFinance: boolean) {
  const d = s.flows.dinheiro;
  const expected = c ? c.expected_cash : expectedCash(s, opening);
  const lines = [
    `*Fechamento de caixa${clubName ? ` · ${clubName}` : ''}*`,
    formatNight(night),
    `Mesas: ${s.tables.map(t => t.table.name).join(', ') || 'nenhuma'}`,
    '',
    '*Dinheiro*',
    `Troco inicial: ${formatMoney(c ? c.opening_cash : opening)}`,
    `Recebido: ${formatMoney(d.recebido + d.fiadoRecebido)}`,
    `Pago: ${formatMoney(d.pago)}`,
    `Esperado na gaveta: ${formatMoney(expected)}`
  ];
  if (c) {
    const { label } = diffTone(c.difference);
    lines.push(`Contado: ${formatMoney(c.counted_cash)}`, `*${label}${Math.abs(c.difference) >= 0.005 ? `: ${formatMoney(Math.abs(c.difference))}` : ''}*`);
  }
  lines.push(
    '',
    `*PIX*: recebido ${formatMoney(s.flows.pix.recebido + s.flows.pix.fiadoRecebido)} · pago ${formatMoney(s.flows.pix.pago)}`,
    `*Cartão*: recebido ${formatMoney(s.flows.cartao.recebido + s.flows.cartao.fiadoRecebido)}`
  );
  if (s.fiadoGeradoTotal > 0) {
    lines.push('', `*Ficou no fiado: ${formatMoney(s.fiadoGeradoTotal)}*`, ...s.fiadoGerado.map(f => `${f.name}: ${formatMoney(f.amount)}`));
  }
  if (showFinance) lines.push('', `Rake: ${formatMoney(s.rake)}`, `Consumo: ${formatMoney(s.consumo)}`, `*Receita do clube: ${formatMoney(s.revenue)}*`);
  if (c?.note) lines.push('', `Obs.: ${c.note}`);
  return lines.join('\n');
}

export default function Caixa() {
  const { clubId, clubName, canSeeFinance } = useClub();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const night = params.get('noite') || currentNight();
  const isToday = night === currentNight();

  const [summary, setSummary] = useState<NightSummary | null>(null);
  const [closing, setClosing] = useState<CashClosing | null | undefined>(null);
  const [history, setHistory] = useState<CashClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitLock = useSubmitLock();

  const load = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const [data, c, h] = await Promise.all([
        cashService.getNightData(clubId, night),
        cashService.getClosing(clubId, night),
        cashService.listClosings(clubId)
      ]);
      setSummary(summarizeNight(data));
      setClosing(c);
      setHistory(h);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar a noite. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  }, [clubId, night]);

  useEffect(() => {
    setOpening('');
    setCounted('');
    setNote('');
    load();
  }, [load]);

  const goTo = (n: string) => setParams(n === currentNight() ? {} : { noite: n });

  const openingValue = money(opening) ?? 0;
  const countedValue = money(counted);
  const expected = summary ? expectedCash(summary, openingValue) : 0;
  const liveDiff = countedValue === null ? null : Math.round((countedValue - expected) * 100) / 100;
  const featureMissing = closing === undefined;
  const canUndo = closing ? Date.now() - new Date(closing.created_at).getTime() < 24 * 3600 * 1000 : false;
  const changedAfter = closing && summary ? Math.abs(expectedCash(summary, closing.opening_cash) - closing.expected_cash) >= 0.005 : false;

  async function closeCash(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId || !summary || countedValue === null || countedValue < 0) return;
    await submitLock.run(async () => {
      try {
        const profile = user ? await authService.getProfile(user.id) : null;
        await cashService.createClosing(clubId, {
          night,
          opening_cash: openingValue,
          expected_cash: expected,
          counted_cash: countedValue,
          summary,
          note: note.trim() || null,
          closed_by_name: profile?.full_name || user?.email || null
        });
        toast.success('Caixa fechado.');
        await load();
      } catch (err) {
        toast.error((err as Error).message || 'Não foi possível fechar o caixa.');
      }
    });
  }

  async function undoClosing() {
    if (!clubId || !closing) return;
    setBusy(true);
    try {
      await cashService.removeClosing(clubId, closing.id);
      toast.success('Fechamento desfeito. Você pode fechar de novo.');
      setConfirmUndo(false);
      setOpening(String(closing.opening_cash));
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível desfazer.');
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(buildText(clubName, night, summary, closing ?? null, openingValue, canSeeFinance));
      toast.success('Fechamento copiado. É só colar no WhatsApp.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  const s = summary;
  const d = s?.flows.dinheiro;
  const hasTables = (s?.tables.length ?? 0) > 0;
  const semForma = s ? s.semForma.recebido + s.semForma.pago : 0;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto mobile-view-padding text-left print-area">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="mb-1">Fechamento de caixa</h1>
          <p className="text-muted text-sm mb-0">Confira o dinheiro da noite e registre se bateu.</p>
        </div>
        <div className="flex items-center gap-2 no-print" role="group" aria-label="Escolher noite">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => goTo(shiftNight(night, -1))} aria-label="Noite anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-white text-center capitalize" style={{ minWidth: 190 }}>
            {isToday ? 'Hoje · ' : ''}{formatNight(night)}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => goTo(shiftNight(night, 1))}
            disabled={isToday}
            aria-label="Próxima noite"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading || !s || !d ? (
        <div className="flex justify-center p-10"><div className="spinner" role="status" aria-label="Carregando" /></div>
      ) : (
        <>
          {featureMissing && (
            <div className="glass-panel p-4 mb-4 text-sm text-warning flex gap-2">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <span>O registro de fechamento ainda não foi ativado no banco de dados. Os valores abaixo já podem ser conferidos.</span>
            </div>
          )}

          {!hasTables ? (
            <div className="glass-panel p-8 text-center mb-6">
              <Wallet className="mx-auto text-muted mb-3" size={32} aria-hidden="true" />
              <p className="text-white font-bold mb-1">Nenhuma mesa nesta noite.</p>
              <p className="text-sm text-muted mb-0">Use as setas para ver outra noite. Mesas abertas depois da meia-noite contam para a noite anterior.</p>
            </div>
          ) : (
            <>
              {(s.openTables > 0 || s.stillPlaying > 0 || semForma > 0) && (
                <div className="glass-panel p-4 mb-4 border border-warning border-opacity-25 text-sm text-warning space-y-1 no-print">
                  {s.stillPlaying > 0 && (
                    <p className="mb-0 flex gap-2"><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      {s.stillPlaying} jogador{s.stillPlaying > 1 ? 'es ainda não fizeram' : ' ainda não fez'} cash-out. Os valores ainda vão mudar.
                    </p>
                  )}
                  {s.openTables > 0 && s.stillPlaying === 0 && (
                    <p className="mb-0 flex gap-2"><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      {s.openTables} mesa{s.openTables > 1 ? 's' : ''} ainda aberta{s.openTables > 1 ? 's' : ''}.
                    </p>
                  )}
                  {semForma > 0 && (
                    <p className="mb-0 flex gap-2"><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      {formatMoney(semForma)} em acertos sem forma de pagamento informada (não entram no dinheiro esperado).
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
                {/* Dinheiro na gaveta */}
                <section className="glass-panel p-5 lg:col-span-3" aria-labelledby="gaveta-title">
                  <h2 id="gaveta-title" className="text-base font-bold text-white mb-4">Dinheiro na gaveta</h2>

                  <dl className="text-sm space-y-2 mb-4">
                    <div className="flex justify-between gap-3 items-center">
                      <dt className="text-muted">Troco inicial</dt>
                      <dd className="text-white font-bold">
                        {closing ? formatMoney(closing.opening_cash) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            className="input text-sm py-2 text-right"
                            style={{ width: 130 }}
                            placeholder="0,00"
                            aria-label="Troco inicial"
                            value={opening}
                            onChange={e => setOpening(e.target.value)}
                          />
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">+ Recebido dos jogadores</dt>
                      <dd className="text-success font-bold">{formatMoney(d.recebido)}</dd>
                    </div>
                    {d.fiadoRecebido > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">+ Fiado antigo recebido</dt>
                        <dd className="text-success font-bold">{formatMoney(d.fiadoRecebido)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">− Pago aos jogadores</dt>
                      <dd className="text-danger font-bold">{formatMoney(d.pago)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-glass-border pt-3">
                      <dt className="text-white font-bold">Deveria ter</dt>
                      <dd className="text-white text-lg font-black">{formatMoney(closing ? closing.expected_cash : expected)}</dd>
                    </div>
                  </dl>

                  {closing ? (
                    <div className="p-4 rounded-xl bg-black bg-opacity-25 border border-glass-border">
                      <div className="flex justify-between items-center gap-3 mb-1">
                        <span className="text-sm text-muted">Contado</span>
                        <span className="text-white font-bold">{formatMoney(closing.counted_cash)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className={`text-sm font-bold flex items-center gap-1.5 ${diffTone(closing.difference).tone}`}>
                          {Math.abs(closing.difference) < 0.005 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                          {diffTone(closing.difference).label}
                        </span>
                        {Math.abs(closing.difference) >= 0.005 && (
                          <span className={`text-lg font-black ${diffTone(closing.difference).tone}`}>{formatMoney(Math.abs(closing.difference))}</span>
                        )}
                      </div>
                      {closing.note && <p className="text-xs text-muted mt-3 mb-0">Obs.: {closing.note}</p>}
                      <p className="text-[11px] text-muted mt-3 mb-0">
                        Fechado{closing.closed_by_name ? ` por ${closing.closed_by_name}` : ''} em {formatDateTime(closing.created_at)}
                      </p>
                      {changedAfter && (
                        <p className="text-xs text-warning mt-2 mb-0">
                          Algum lançamento mudou depois do fechamento: hoje o esperado seria {formatMoney(expectedCash(s, closing.opening_cash))}.
                        </p>
                      )}
                    </div>
                  ) : (
                    !featureMissing && (
                      <form onSubmit={closeCash} className="space-y-3 no-print">
                        <label className="block">
                          <span className="text-xs text-muted font-bold block mb-1">Quanto você contou na gaveta</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            className="input text-xl text-center font-bold py-3"
                            placeholder="0,00"
                            value={counted}
                            onChange={e => setCounted(e.target.value)}
                            required
                          />
                        </label>
                        {liveDiff !== null && (
                          <p className={`text-sm font-bold mb-0 ${diffTone(liveDiff).tone}`}>
                            {diffTone(liveDiff).label}{Math.abs(liveDiff) >= 0.005 ? `: ${formatMoney(Math.abs(liveDiff))}` : ''}
                          </p>
                        )}
                        <input
                          type="text"
                          className="input text-sm py-2.5"
                          placeholder="Observação (opcional)"
                          aria-label="Observação"
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          maxLength={300}
                        />
                        <button type="submit" className="btn btn-primary w-full py-3.5 font-bold" disabled={countedValue === null || countedValue < 0 || submitLock.busy}>
                          {submitLock.busy ? 'Fechando...' : 'Fechar caixa'}
                        </button>
                      </form>
                    )
                  )}
                </section>

                {/* Outros meios e resultado */}
                <div className="lg:col-span-2 space-y-4">
                  <section className="glass-panel p-5" aria-labelledby="meios-title">
                    <h2 id="meios-title" className="text-base font-bold text-white mb-3">PIX e cartão</h2>
                    <dl className="text-sm space-y-2 mb-0">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">PIX recebido</dt>
                        <dd className="text-success font-bold">{formatMoney(s.flows.pix.recebido + s.flows.pix.fiadoRecebido)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">PIX pago</dt>
                        <dd className="text-danger font-bold">{formatMoney(s.flows.pix.pago)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Cartão recebido</dt>
                        <dd className="text-success font-bold">{formatMoney(s.flows.cartao.recebido + s.flows.cartao.fiadoRecebido)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="glass-panel p-5" aria-labelledby="fiado-title">
                    <h2 id="fiado-title" className="text-base font-bold text-white mb-3">Ficou no fiado</h2>
                    {s.fiadoGerado.length === 0 ? (
                      <p className="text-sm text-muted mb-0">Ninguém ficou devendo.</p>
                    ) : (
                      <>
                        <ul className="text-sm space-y-1.5 mb-3">
                          {s.fiadoGerado.map((f, i) => (
                            <li key={`${f.name}-${i}`} className="flex justify-between gap-3">
                              <span className="text-white truncate">{f.name}</span>
                              <span className="text-warning font-bold flex-shrink-0">{formatMoney(f.amount)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex justify-between gap-3 border-t border-glass-border pt-2 text-sm">
                          <span className="text-muted">Total</span>
                          <strong className="text-warning">{formatMoney(s.fiadoGeradoTotal)}</strong>
                        </div>
                      </>
                    )}
                    {s.abatido > 0 && (
                      <p className="text-xs text-muted mt-3 mb-0">{formatMoney(s.abatido)} de fiado antigo abatidos de prêmios.</p>
                    )}
                  </section>

                  {canSeeFinance && (
                  <section className="glass-panel p-5" aria-labelledby="resultado-title">
                    <h2 id="resultado-title" className="text-base font-bold text-white mb-3">Resultado do clube</h2>
                    <dl className="text-sm space-y-2 mb-0">
                      <div className="flex justify-between gap-3"><dt className="text-muted">Rake</dt><dd className="text-white font-bold">{formatMoney(s.rake)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">Consumo</dt><dd className="text-white font-bold">{formatMoney(s.consumo)}</dd></div>
                      <div className="flex justify-between gap-3 border-t border-glass-border pt-2"><dt className="text-white font-bold">Receita</dt><dd className="text-success font-black">{formatMoney(s.revenue)}</dd></div>
                    </dl>
                  </section>
                  )}
                </div>
              </div>

              <section className="mb-6" aria-labelledby="mesas-noite-title">
                <h2 id="mesas-noite-title" className="text-sm font-bold text-muted mb-2">Mesas desta noite</h2>
                <ul className="space-y-2">
                  {s.tables.map(t => (
                    <li key={t.table.id}>
                      <Link
                        to={`/table/${t.table.id}`}
                        className="flex justify-between items-center gap-3 p-3 rounded-xl border border-glass-border no-underline hover:border-primary"
                        style={{ background: 'rgba(15,23,42,0.4)' }}
                      >
                        <span className="min-w-0">
                          <span className="text-sm font-bold text-white block truncate">{t.table.name}</span>
                          <span className="text-xs text-muted">
                            {t.table.status === 'active' ? `Aberta · ${t.activeCount} jogando` : 'Encerrada'}
                          </span>
                        </span>
                        {canSeeFinance && <span className="text-sm font-bold text-success flex-shrink-0">{formatMoney(t.revenue)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="flex flex-col md:flex-row gap-2 mb-8 no-print">
                <button type="button" className="btn btn-outline flex-1" onClick={copyText}>
                  <Copy size={16} /> Copiar para WhatsApp
                </button>
                <button type="button" className="btn btn-outline flex-1" onClick={() => window.print()}>
                  <Printer size={16} /> Imprimir ou salvar PDF
                </button>
                {closing && canUndo && (
                  <button type="button" className="btn btn-outline flex-1 text-danger" onClick={() => setConfirmUndo(true)}>
                    <Undo2 size={16} /> Desfazer fechamento
                  </button>
                )}
              </div>
            </>
          )}

          {history.length > 0 && (
            <section className="no-print" aria-labelledby="historico-caixa-title">
              <h2 id="historico-caixa-title" className="text-sm font-bold text-muted mb-2">Fechamentos anteriores</h2>
              <div className="glass-panel p-0 overflow-x-auto">
                <table className="report-table w-full text-xs text-left">
                  <thead>
                    <tr className="text-muted">
                      <th scope="col" className="py-2.5 px-4">Noite</th>
                      <th scope="col" className="py-2.5 px-2 text-right">Esperado</th>
                      <th scope="col" className="py-2.5 px-2 text-right">Contado</th>
                      <th scope="col" className="py-2.5 px-4 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} className="border-t border-glass-border cursor-pointer hover:bg-white hover:bg-opacity-5" onClick={() => goTo(h.night)}>
                        <th scope="row" className="py-2.5 px-4 text-white font-bold">{formatNight(h.night, { weekday: false })}</th>
                        <td className="py-2.5 px-2 text-right text-white">{formatMoney(h.expected_cash)}</td>
                        <td className="py-2.5 px-2 text-right text-white">{formatMoney(h.counted_cash)}</td>
                        <td className={`py-2.5 px-4 text-right font-bold ${diffTone(h.difference).tone}`}>
                          {Math.abs(h.difference) < 0.005 ? 'Bateu' : `${h.difference < 0 ? '−' : '+'}${formatMoney(Math.abs(h.difference))}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmUndo}
        title="Desfazer fechamento?"
        message="O fechamento desta noite será apagado e você poderá fechar o caixa de novo."
        confirmLabel="Desfazer"
        danger
        busy={busy}
        onConfirm={undoClosing}
        onCancel={() => setConfirmUndo(false)}
      />
    </div>
  );
}
