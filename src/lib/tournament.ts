/**
 * Torneios: estrutura (configurável por torneio), cálculos e relógio.
 * Usado pelo painel do organizador e pela TV, para os dois mostrarem o mesmo.
 */

export interface EntryOption {
  id: string;
  label: string;
  /** quanto o jogador paga */
  price: number;
  /** quanto vai para o prêmio (o resto é taxa da casa) */
  toPrize: number;
  chips: number;
}

export interface Bonus {
  id: string;
  label: string;
  chips: number;
}

export interface ExtraPrize {
  id: string;
  label: string;
  amount: number;
}

export type LevelItem =
  | { kind: 'level'; sb: number; bb: number; ante: number; minutes: number }
  | { kind: 'break'; minutes: number; label: string; addon: boolean };

export interface PayoutRule {
  /** vale até este número de inscritos (null = acima de todos) */
  upTo: number | null;
  percents: number[];
}

export interface TournamentConfig {
  buyin: EntryOption;
  rebuys: EntryOption[];
  addons: EntryOption[];
  /** rebuy liberado até o fim deste nível (null = sem limite) */
  rebuyUntilLevel: number | null;
  bonuses: Bonus[];
  extras: ExtraPrize[];
  levels: LevelItem[];
  /** prêmio garantido (0 = sem garantido) */
  gtd: number;
  payouts: PayoutRule[];
  /** arredondamento dos prêmios */
  roundTo: number;
  /** recado livre que aparece na TV (ex.: "Churrasco às 12h") */
  notice?: string;
}

export interface TournamentRow {
  id: string;
  club_id: string;
  name: string;
  status: 'agendado' | 'em_andamento' | 'encerrado';
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  config: TournamentConfig;
  clock_level: number;
  clock_running: boolean;
  clock_ends_at: string | null;
  clock_remaining: number | null;
  tv_token: string;
  created_at: string;
}

export interface EntryRow {
  id: string;
  tournament_id: string;
  player_id: string;
  name: string;
  created_at: string;
  eliminated_at: string | null;
  position: number | null;
}

export type MovementKind = 'buyin' | 'rebuy' | 'addon' | 'bonus' | 'premio' | 'extra';

export interface MovementRow {
  id: string;
  tournament_id?: string;
  entry_id: string;
  kind: MovementKind;
  label: string | null;
  amount: number;
  to_prize: number;
  chips: number;
  payment_method?: string | null;
  created_at: string;
}

// ---------- estrutura padrão ----------

const uid = () => Math.random().toString(36).slice(2, 9);

/** Blinds com big blind ante a partir do 3º nível. */
const BLINDS: [number, number][] = [
  [100, 100], [100, 200], [200, 300], [200, 400], [300, 600], [400, 800], [500, 1000], [600, 1200],
  [800, 1600], [1000, 2000], [1500, 3000], [2000, 4000], [2500, 5000], [3000, 6000], [4000, 8000],
  [5000, 10000], [6000, 12000], [8000, 16000], [10000, 20000], [15000, 30000], [20000, 40000],
  [25000, 50000], [30000, 60000], [40000, 80000], [50000, 100000], [60000, 120000], [80000, 160000], [100000, 200000]
];

export interface StructurePreset {
  id: string;
  label: string;
  hint: string;
  minutesBefore: number;
  minutesAfter: number;
  breakAfter: number;
  breakMinutes: number;
}

export const STRUCTURE_PRESETS: StructurePreset[] = [
  { id: 'regular', label: 'Regular', hint: 'Níveis de 20 min; intervalo com add-on depois do 8º', minutesBefore: 20, minutesAfter: 20, breakAfter: 8, breakMinutes: 15 },
  { id: 'deep', label: 'Lento (25/15)', hint: '25 min até o intervalo do add-on, 15 min depois', minutesBefore: 25, minutesAfter: 15, breakAfter: 8, breakMinutes: 15 },
  { id: 'turbo', label: 'Turbo', hint: 'Níveis de 12 min; intervalo depois do 6º', minutesBefore: 12, minutesAfter: 12, breakAfter: 6, breakMinutes: 10 }
];

export function buildLevels(p: StructurePreset): LevelItem[] {
  const out: LevelItem[] = [];
  BLINDS.forEach(([sb, bb], i) => {
    const n = i + 1;
    out.push({ kind: 'level', sb, bb, ante: n >= 3 ? bb : 0, minutes: n <= p.breakAfter ? p.minutesBefore : p.minutesAfter });
    if (n === p.breakAfter) out.push({ kind: 'break', minutes: p.breakMinutes, label: 'Intervalo', addon: true });
  });
  return out;
}

export const DEFAULT_PAYOUTS: PayoutRule[] = [
  { upTo: 8, percents: [70, 30] },
  { upTo: 15, percents: [50, 30, 20] },
  { upTo: 25, percents: [45, 27, 17, 11] },
  { upTo: 40, percents: [40, 25, 16, 11, 8] },
  { upTo: 60, percents: [37, 23, 15, 11, 8, 6] },
  { upTo: null, percents: [33, 21, 14, 10, 8, 6, 4.5, 3.5] }
];

export function defaultConfig(): TournamentConfig {
  return {
    buyin: { id: 'buyin', label: 'Buy-in', price: 120, toPrize: 90, chips: 15000 },
    rebuys: [
      { id: uid(), label: 'Rebuy simples', price: 90, toPrize: 90, chips: 15000 },
      { id: uid(), label: 'Rebuy duplo', price: 150, toPrize: 150, chips: 30000 }
    ],
    addons: [
      { id: uid(), label: 'Add-on simples', price: 100, toPrize: 100, chips: 50000 },
      { id: uid(), label: 'Add-on duplo', price: 200, toPrize: 200, chips: 120000 }
    ],
    rebuyUntilLevel: 8,
    bonuses: [
      { id: uid(), label: 'Pontualidade', chips: 5000 },
      { id: uid(), label: 'Confirmação', chips: 5000 }
    ],
    extras: [],
    levels: buildLevels(STRUCTURE_PRESETS[1]),
    gtd: 0,
    payouts: DEFAULT_PAYOUTS,
    roundTo: 5,
    notice: ''
  };
}

/** Garante que configs antigas ou incompletas tenham todos os campos. */
export function normalizeConfig(c: Partial<TournamentConfig> | null | undefined): TournamentConfig {
  const d = defaultConfig();
  return {
    ...d,
    ...(c ?? {}),
    buyin: { ...d.buyin, ...(c?.buyin ?? {}) },
    rebuys: c?.rebuys ?? d.rebuys,
    addons: c?.addons ?? d.addons,
    bonuses: c?.bonuses ?? d.bonuses,
    extras: c?.extras ?? [],
    levels: c?.levels?.length ? c.levels : d.levels,
    payouts: c?.payouts?.length ? c.payouts : DEFAULT_PAYOUTS,
    roundTo: c?.roundTo ?? 5
  };
}

/** Novo id para opções copiadas de outro torneio. */
export const newId = uid;

// ---------- números do torneio ----------

export interface TournamentStats {
  entries: number;
  alive: number;
  rebuys: number;
  addons: number;
  /** soma das partes que vão para o prêmio */
  pool: number;
  /** prêmio a distribuir: o maior entre o arrecadado e o garantido */
  prizePool: number;
  /** quanto a casa completa para cumprir o garantido */
  overlay: number;
  /** taxas da casa */
  houseFee: number;
  /** dinheiro recebido (buy-ins, rebuys, add-ons) */
  collected: number;
  totalChips: number;
  avgStack: number;
  paid: number;
}

export function computeStats(cfg: TournamentConfig, entries: Pick<EntryRow, 'eliminated_at'>[], movements: MovementRow[]): TournamentStats {
  const money = movements.filter(m => m.kind === 'buyin' || m.kind === 'rebuy' || m.kind === 'addon');
  const pool = money.reduce((s, m) => s + Number(m.to_prize), 0);
  const collected = money.reduce((s, m) => s + Number(m.amount), 0);
  const totalChips = movements
    .filter(m => m.kind !== 'premio' && m.kind !== 'extra')
    .reduce((s, m) => s + Number(m.chips), 0);
  const alive = entries.filter(e => !e.eliminated_at).length;
  const prizePool = Math.max(pool, cfg.gtd || 0);
  return {
    entries: entries.length,
    alive,
    rebuys: movements.filter(m => m.kind === 'rebuy').length,
    addons: movements.filter(m => m.kind === 'addon').length,
    pool,
    prizePool,
    overlay: Math.max(0, (cfg.gtd || 0) - pool),
    houseFee: collected - pool,
    collected,
    totalChips,
    avgStack: alive > 0 ? Math.round(totalChips / alive) : 0,
    paid: movements.filter(m => m.kind === 'premio' || m.kind === 'extra').reduce((s, m) => s + Number(m.amount), 0)
  };
}

export function payoutPercents(cfg: TournamentConfig, entries: number): number[] {
  const rules = [...cfg.payouts].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  const rule = rules.find(r => r.upTo === null || entries <= r.upTo) ?? rules[rules.length - 1];
  return rule?.percents ?? [100];
}

/** Valor de cada colocação, arredondado; a sobra do arredondamento vai para o campeão. */
export function payoutTable(cfg: TournamentConfig, prizePool: number, entries: number): number[] {
  const pcts = payoutPercents(cfg, entries).slice(0, Math.max(1, entries));
  const total = pcts.reduce((s, p) => s + p, 0) || 100;
  const step = cfg.roundTo > 0 ? cfg.roundTo : 1;
  const values = pcts.map(p => Math.floor((prizePool * (p / total)) / step) * step);
  const rest = prizePool - values.reduce((s, v) => s + v, 0);
  if (values.length) values[0] += rest;
  return values;
}

// ---------- relógio ----------

export interface ClockState {
  index: number;
  item: LevelItem | null;
  /** segundos que faltam no item atual */
  remaining: number;
  running: boolean;
  /** número do nível (1, 2, 3…), contando só níveis */
  levelNumber: number;
  /** próximo nível de blinds (pula intervalos) */
  nextLevel: Extract<LevelItem, { kind: 'level' }> | null;
  /** segundos até o próximo intervalo (null = não há) */
  untilBreak: number | null;
  finished: boolean;
}

export function levelNumberAt(levels: LevelItem[], index: number): number {
  let n = 0;
  for (let i = 0; i <= Math.min(index, levels.length - 1); i++) if (levels[i].kind === 'level') n++;
  return n;
}

export function deriveClock(
  levels: LevelItem[],
  t: Pick<TournamentRow, 'clock_level' | 'clock_running' | 'clock_ends_at' | 'clock_remaining'>,
  nowMs: number
): ClockState {
  if (!levels.length) {
    return { index: 0, item: null, remaining: 0, running: false, levelNumber: 0, nextLevel: null, untilBreak: null, finished: true };
  }
  let index = Math.min(t.clock_level, levels.length - 1);
  let remaining: number;
  let finished = false;
  if (t.clock_running && t.clock_ends_at) {
    let ends = new Date(t.clock_ends_at).getTime();
    while (nowMs >= ends && index < levels.length - 1) {
      index++;
      ends += levels[index].minutes * 60000;
    }
    remaining = Math.max(0, Math.ceil((ends - nowMs) / 1000));
    if (index === levels.length - 1 && remaining === 0) finished = true;
  } else {
    remaining = t.clock_remaining ?? levels[index].minutes * 60;
  }

  let nextLevel: ClockState['nextLevel'] = null;
  for (let i = index + 1; i < levels.length; i++) {
    const it = levels[i];
    if (it.kind === 'level') { nextLevel = it; break; }
  }

  let untilBreak: number | null = null;
  if (levels[index].kind !== 'break') {
    let acc = remaining;
    for (let i = index + 1; i < levels.length; i++) {
      if (levels[i].kind === 'break') { untilBreak = acc; break; }
      acc += levels[i].minutes * 60;
    }
  }

  return {
    index,
    item: levels[index],
    remaining,
    running: t.clock_running && !finished,
    levelNumber: levelNumberAt(levels, index),
    nextLevel,
    untilBreak,
    finished
  };
}

export function rebuyOpen(cfg: TournamentConfig, clock: ClockState): boolean {
  if (cfg.rebuyUntilLevel == null) return true;
  return clock.levelNumber <= cfg.rebuyUntilLevel;
}

export function addonOpen(clock: ClockState): boolean {
  return clock.item?.kind === 'break' && clock.item.addon;
}

// ---------- formatação ----------

export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export const fmtChips = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n));

/** 15000 → 15K; 1500 → 1.500; 120000 → 120K; 1500000 → 1,5M */
export const fmtShortChips = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K`;
  return fmtChips(n);
};

export const ordinal = (n: number) => `${n}º`;
