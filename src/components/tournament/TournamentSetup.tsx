import type React from 'react';
import { useState } from 'react';
import { Coffee, Plus, Trash2 } from 'lucide-react';
import {
  buildLevels,
  DEFAULT_PAYOUTS,
  fmtChips,
  newId,
  STRUCTURE_PRESETS,
  type Bonus,
  type EntryOption,
  type ExtraPrize,
  type LevelItem,
  type PayoutRule,
  type TournamentConfig
} from '../../lib/tournament';
import { formatMoney } from '../../utils';

/**
 * Editor da estrutura do torneio. Tudo é configurável por torneio;
 * o torneio novo copia a estrutura do anterior.
 */

interface Props {
  config: TournamentConfig;
  onChange: (c: TournamentConfig) => void;
  /** já começou: avisa que mudar blinds afeta o relógio */
  started: boolean;
}

const num = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

function NumberField({ label, value, onChange, prefix, width = 110 }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; width?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted font-bold block mb-1">{label}</span>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          className="input text-sm py-2"
          style={{ width, paddingLeft: prefix ? 32 : undefined }}
          value={Number.isFinite(value) ? value : 0}
          onChange={e => onChange(num(e.target.value))}
        />
      </div>
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel p-5 text-left">
      <h3 className="text-base font-bold text-white mb-1">{title}</h3>
      {hint && <p className="text-xs text-muted mb-4">{hint}</p>}
      {children}
    </section>
  );
}

function OptionRow({ opt, onChange, onRemove, fixedLabel }: { opt: EntryOption; onChange: (o: EntryOption) => void; onRemove?: () => void; fixedLabel?: boolean }) {
  const fee = Math.max(0, opt.price - opt.toPrize);
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-glass-border" style={{ background: 'rgba(15,23,42,0.4)' }}>
      {!fixedLabel && (
        <label className="block flex-1" style={{ minWidth: 140 }}>
          <span className="text-[11px] text-muted font-bold block mb-1">Nome</span>
          <input className="input text-sm py-2" value={opt.label} onChange={e => onChange({ ...opt, label: e.target.value })} />
        </label>
      )}
      <NumberField label="Valor" prefix="R$" value={opt.price} onChange={v => onChange({ ...opt, price: v, toPrize: Math.min(opt.toPrize, v) || v })} />
      <NumberField label="Vai para o prêmio" prefix="R$" value={opt.toPrize} onChange={v => onChange({ ...opt, toPrize: Math.min(v, opt.price) })} />
      <NumberField label="Fichas" value={opt.chips} onChange={v => onChange({ ...opt, chips: Math.round(v) })} width={120} />
      <span className="text-xs text-muted pb-2.5">Taxa da casa: <strong className="text-white">{formatMoney(fee)}</strong></span>
      {onRemove && (
        <button type="button" className="btn btn-outline btn-sm text-danger ml-auto" onClick={onRemove} aria-label={`Remover ${opt.label}`}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export default function TournamentSetup({ config, onChange, started }: Props) {
  const c = config;
  const set = (patch: Partial<TournamentConfig>) => onChange({ ...c, ...patch });
  const [presetId, setPresetId] = useState(STRUCTURE_PRESETS[1].id);

  const updateList = <T extends { id: string }>(key: 'rebuys' | 'addons' | 'bonuses' | 'extras', list: T[]) => set({ [key]: list } as Partial<TournamentConfig>);

  function setLevel(i: number, item: LevelItem) {
    const levels = [...c.levels];
    levels[i] = item;
    set({ levels });
  }

  let levelCounter = 0;

  return (
    <div className="space-y-4">
      <Section title="Buy-in" hint="Valor, quanto vai para o prêmio e quantas fichas. A diferença é a taxa da casa.">
        <OptionRow opt={c.buyin} fixedLabel onChange={o => set({ buyin: o })} />
      </Section>

      <Section title="Rebuys" hint="Crie quantas opções quiser (simples, duplo...).">
        <div className="space-y-2 mb-3">
          {c.rebuys.map((o, i) => (
            <OptionRow
              key={o.id}
              opt={o}
              onChange={n => updateList('rebuys', c.rebuys.map((x, j) => (j === i ? n : x)))}
              onRemove={() => updateList('rebuys', c.rebuys.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => updateList('rebuys', [...c.rebuys, { id: newId(), label: 'Rebuy', price: c.buyin.toPrize, toPrize: c.buyin.toPrize, chips: c.buyin.chips }])}>
            <Plus size={14} /> Opção de rebuy
          </button>
          <label className="block">
            <span className="text-[11px] text-muted font-bold block mb-1">Rebuy liberado até o nível</span>
            <input
              type="number"
              min="0"
              className="input text-sm py-2"
              style={{ width: 110 }}
              value={c.rebuyUntilLevel ?? ''}
              placeholder="Sem limite"
              onChange={e => set({ rebuyUntilLevel: e.target.value === '' ? null : Math.max(0, Math.round(num(e.target.value))) })}
            />
          </label>
        </div>
      </Section>

      <Section title="Add-ons" hint="Normalmente no intervalo. Marque nos blinds qual intervalo libera o add-on.">
        <div className="space-y-2 mb-3">
          {c.addons.map((o, i) => (
            <OptionRow
              key={o.id}
              opt={o}
              onChange={n => updateList('addons', c.addons.map((x, j) => (j === i ? n : x)))}
              onRemove={() => updateList('addons', c.addons.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => updateList('addons', [...c.addons, { id: newId(), label: 'Add-on', price: 100, toPrize: 100, chips: 50000 }])}>
          <Plus size={14} /> Opção de add-on
        </button>
      </Section>

      <Section title="Bônus em fichas" hint="Fichas extras sem custo: pontualidade, confirmação de presença, aniversariante...">
        <div className="space-y-2 mb-3">
          {c.bonuses.map((b, i) => (
            <div key={b.id} className="flex flex-wrap items-end gap-3">
              <label className="block flex-1" style={{ minWidth: 160 }}>
                <span className="text-[11px] text-muted font-bold block mb-1">Nome</span>
                <input className="input text-sm py-2" value={b.label} onChange={e => updateList<Bonus>('bonuses', c.bonuses.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              </label>
              <NumberField label="Fichas" value={b.chips} onChange={v => updateList<Bonus>('bonuses', c.bonuses.map((x, j) => (j === i ? { ...x, chips: Math.round(v) } : x)))} width={120} />
              <button type="button" className="btn btn-outline btn-sm text-danger" onClick={() => updateList('bonuses', c.bonuses.filter((_, j) => j !== i))} aria-label={`Remover ${b.label}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => updateList('bonuses', [...c.bonuses, { id: newId(), label: 'Bônus', chips: 5000 }])}>
          <Plus size={14} /> Bônus
        </button>
      </Section>

      <Section title="Prêmio" hint="Garantido: se o arrecadado não chegar, a casa completa. Prêmios extras ficam fora da premiação (ex.: chip leader no intervalo, sorteio).">
        <div className="flex flex-wrap gap-3 mb-4">
          <NumberField label="Garantido (0 = sem)" prefix="R$" value={c.gtd} onChange={v => set({ gtd: v })} width={150} />
          <NumberField label="Arredondar prêmios para" prefix="R$" value={c.roundTo} onChange={v => set({ roundTo: Math.max(1, Math.round(v)) })} width={120} />
        </div>
        <div className="space-y-2 mb-3">
          {c.extras.map((x, i) => (
            <div key={x.id} className="flex flex-wrap items-end gap-3">
              <label className="block flex-1" style={{ minWidth: 160 }}>
                <span className="text-[11px] text-muted font-bold block mb-1">Prêmio extra</span>
                <input className="input text-sm py-2" value={x.label} onChange={e => updateList<ExtraPrize>('extras', c.extras.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
              </label>
              <NumberField label="Valor" prefix="R$" value={x.amount} onChange={v => updateList<ExtraPrize>('extras', c.extras.map((y, j) => (j === i ? { ...y, amount: v } : y)))} />
              <button type="button" className="btn btn-outline btn-sm text-danger" onClick={() => updateList('extras', c.extras.filter((_, j) => j !== i))} aria-label={`Remover ${x.label}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => updateList('extras', [...c.extras, { id: newId(), label: 'Chip leader no intervalo', amount: 200 }])}>
          <Plus size={14} /> Prêmio extra
        </button>
      </Section>

      <Section title="Premiação" hint="Quantos recebem e a porcentagem de cada colocação, conforme o número de inscritos. Separe as porcentagens por vírgula.">
        <div className="space-y-2 mb-3">
          {c.payouts.map((r, i) => (
            <PayoutRow
              key={i}
              rule={r}
              onChange={n => set({ payouts: c.payouts.map((x, j) => (j === i ? n : x)) })}
              onRemove={c.payouts.length > 1 ? () => set({ payouts: c.payouts.filter((_, j) => j !== i) }) : undefined}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => set({ payouts: [...c.payouts, { upTo: null, percents: [50, 30, 20] }] })}>
            <Plus size={14} /> Faixa
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => set({ payouts: DEFAULT_PAYOUTS })}>Restaurar padrão</button>
        </div>
      </Section>

      <Section title="Blinds" hint={started ? 'O torneio já começou: mudanças valem a partir do nível atual.' : 'Escolha um modelo e ajuste nível a nível. Ante é big blind ante.'}>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <label className="block">
            <span className="text-[11px] text-muted font-bold block mb-1">Modelo</span>
            <select className="input text-sm py-2" value={presetId} onChange={e => setPresetId(e.target.value)} style={{ width: 'auto' }}>
              {STRUCTURE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label} · {p.hint}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => set({ levels: buildLevels(STRUCTURE_PRESETS.find(p => p.id === presetId)!) })}
          >
            Aplicar modelo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left" style={{ minWidth: 520 }}>
            <thead>
              <tr className="text-muted">
                <th className="py-2 pr-2">Nível</th>
                <th className="py-2 px-1">Small</th>
                <th className="py-2 px-1">Big</th>
                <th className="py-2 px-1">Ante</th>
                <th className="py-2 px-1">Minutos</th>
                <th className="py-2 pl-1" />
              </tr>
            </thead>
            <tbody>
              {c.levels.map((it, i) => {
                if (it.kind === 'level') levelCounter++;
                const remove = () => set({ levels: c.levels.filter((_, j) => j !== i) });
                const insertBreak = () => {
                  const levels = [...c.levels];
                  levels.splice(i + 1, 0, { kind: 'break', minutes: 10, label: 'Intervalo', addon: false });
                  set({ levels });
                };
                return it.kind === 'level' ? (
                  <tr key={i} className="border-t border-glass-border">
                    <td className="py-1.5 pr-2 font-bold text-white">{levelCounter}</td>
                    {(['sb', 'bb', 'ante', 'minutes'] as const).map(k => (
                      <td key={k} className="py-1.5 px-1">
                        <input
                          type="number"
                          min="0"
                          className="input text-xs py-1.5"
                          style={{ width: k === 'minutes' ? 64 : 92 }}
                          value={it[k]}
                          onChange={e => setLevel(i, { ...it, [k]: Math.max(0, Math.round(num(e.target.value))) })}
                          aria-label={`${k} do nível ${levelCounter}`}
                        />
                      </td>
                    ))}
                    <td className="py-1.5 pl-1 whitespace-nowrap">
                      <button type="button" className="btn btn-outline btn-sm" onClick={insertBreak} title="Intervalo depois deste nível" aria-label="Intervalo depois deste nível">
                        <Coffee size={13} />
                      </button>{' '}
                      <button type="button" className="btn btn-outline btn-sm text-danger" onClick={remove} aria-label="Remover nível">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className="border-t border-glass-border" style={{ background: 'rgba(245,158,11,0.06)' }}>
                    <td className="py-1.5 pr-2 font-bold text-warning">Pausa</td>
                    <td className="py-1.5 px-1" colSpan={2}>
                      <input className="input text-xs py-1.5" value={it.label} onChange={e => setLevel(i, { ...it, label: e.target.value })} aria-label="Nome do intervalo" />
                    </td>
                    <td className="py-1.5 px-1">
                      <label className="flex items-center gap-1.5 text-xs text-white whitespace-nowrap">
                        <input type="checkbox" checked={it.addon} onChange={e => setLevel(i, { ...it, addon: e.target.checked })} /> Add-on
                      </label>
                    </td>
                    <td className="py-1.5 px-1">
                      <input type="number" min="1" className="input text-xs py-1.5" style={{ width: 64 }} value={it.minutes} onChange={e => setLevel(i, { ...it, minutes: Math.max(1, Math.round(num(e.target.value))) })} aria-label="Minutos do intervalo" />
                    </td>
                    <td className="py-1.5 pl-1">
                      <button type="button" className="btn btn-outline btn-sm text-danger" onClick={remove} aria-label="Remover intervalo">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm mt-3"
          onClick={() => {
            const last = [...c.levels].reverse().find(x => x.kind === 'level') as Extract<LevelItem, { kind: 'level' }> | undefined;
            const bb = last ? last.bb * 2 : 200;
            set({ levels: [...c.levels, { kind: 'level', sb: bb / 2, bb, ante: bb, minutes: last?.minutes ?? 20 }] });
          }}
        >
          <Plus size={14} /> Nível
        </button>
        <p className="text-[11px] text-muted mt-3 mb-0">
          Fichas iniciais: {fmtChips(c.buyin.chips)}. Duração até o último nível: {Math.round(c.levels.reduce((s, x) => s + x.minutes, 0) / 60 * 10) / 10} h.
        </p>
      </Section>

      <Section title="Recado na TV" hint="Aparece embaixo do relógio. Ex.: “Churrasco às 12h para os confirmados”.">
        <input className="input text-sm" value={c.notice ?? ''} onChange={e => set({ notice: e.target.value })} maxLength={90} />
      </Section>
    </div>
  );
}

function PayoutRow({ rule, onChange, onRemove }: { rule: PayoutRule; onChange: (r: PayoutRule) => void; onRemove?: () => void }) {
  const [text, setText] = useState(rule.percents.join(', '));
  const sum = rule.percents.reduce((s, p) => s + p, 0);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="text-[11px] text-muted font-bold block mb-1">Até quantos inscritos</span>
        <input
          type="number"
          min="1"
          className="input text-sm py-2"
          style={{ width: 120 }}
          value={rule.upTo ?? ''}
          placeholder="Acima disso"
          onChange={e => onChange({ ...rule, upTo: e.target.value === '' ? null : Math.max(1, Math.round(num(e.target.value))) })}
        />
      </label>
      <label className="block flex-1" style={{ minWidth: 200 }}>
        <span className="text-[11px] text-muted font-bold block mb-1">
          Porcentagens ({rule.percents.length} premiados · soma {Math.round(sum * 10) / 10}%)
        </span>
        <input
          className={`input text-sm py-2 ${Math.abs(sum - 100) > 0.01 ? 'border-warning' : ''}`}
          value={text}
          onChange={e => {
            setText(e.target.value);
            const percents = e.target.value.split(/[;,\s]+/).map(num).filter(v => v > 0);
            if (percents.length) onChange({ ...rule, percents });
          }}
        />
      </label>
      {onRemove && (
        <button type="button" className="btn btn-outline btn-sm text-danger" onClick={onRemove} aria-label="Remover faixa">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
