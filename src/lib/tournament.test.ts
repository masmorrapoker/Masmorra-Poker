import { describe, expect, it } from 'vitest';
import {
  addonOpen, buildLevels, computeStats, defaultConfig, deriveClock, fmtShortChips, fmtTime, normalizeConfig,
  payoutPercents, payoutTable, rebuyOpen, STRUCTURE_PRESETS, type LevelItem, type MovementRow, type TournamentConfig
} from './tournament';

// Dados fictícios. Nenhum nome ou valor de jogador real.

describe('estrutura de níveis', () => {
  it('preset Regular: 28 níveis, intervalo com add-on depois do 8º, ante a partir do 3º', () => {
    const levels = buildLevels(STRUCTURE_PRESETS[0]);
    expect(levels.filter(l => l.kind === 'level')).toHaveLength(28);
    expect(levels[8]).toEqual({ kind: 'break', minutes: 15, label: 'Intervalo', addon: true });
    expect(levels[1]).toMatchObject({ kind: 'level', sb: 100, bb: 200, ante: 0 });
    expect(levels[2]).toMatchObject({ kind: 'level', sb: 200, bb: 300, ante: 300 });
  });

  it('preset Lento: 25 min antes do intervalo e 15 min depois', () => {
    const levels = buildLevels(STRUCTURE_PRESETS[1]);
    expect(levels[7]).toMatchObject({ kind: 'level', minutes: 25 });
    expect(levels[9]).toMatchObject({ kind: 'level', minutes: 15 });
  });

  it('config antiga ou incompleta ganha os campos que faltam', () => {
    const c = normalizeConfig({ gtd: 3000, buyin: { price: 90 } } as Partial<TournamentConfig>);
    expect(c.gtd).toBe(3000);
    expect(c.buyin).toMatchObject({ price: 90, toPrize: 90, chips: 15000 });
    expect(c.levels.length).toBeGreaterThan(0);
    expect(c.extras).toEqual([]);
    expect(normalizeConfig(null).roundTo).toBe(5);
  });
});

describe('computeStats', () => {
  const mv = (kind: MovementRow['kind'], amount: number, to_prize: number, chips: number): MovementRow =>
    ({ id: `${kind}-${amount}-${chips}-${Math.random()}`, entry_id: 'e', kind, label: null, amount, to_prize, chips, created_at: '2026-10-24T00:00:00Z' });
  const entries = [{ eliminated_at: null }, { eliminated_at: null }, { eliminated_at: '2026-10-24T01:00:00Z' }];
  const movements = [
    mv('buyin', 120, 90, 15000), mv('buyin', 120, 90, 15000), mv('buyin', 120, 90, 15000),
    mv('rebuy', 90, 90, 15000), mv('addon', 100, 100, 50000), mv('bonus', 0, 0, 5000),
    mv('premio', 300, 0, 0)
  ];

  it('prêmio, taxa da casa, fichas e média por jogador vivo', () => {
    const s = computeStats({ ...defaultConfig(), gtd: 0 }, entries, movements);
    expect(s).toMatchObject({
      entries: 3, alive: 2, rebuys: 1, addons: 1,
      pool: 460, prizePool: 460, overlay: 0, collected: 550, houseFee: 90,
      totalChips: 115000, avgStack: 57500, paid: 300
    });
  });

  it('garantido maior que o arrecadado: a casa cobre a diferença', () => {
    const s = computeStats({ ...defaultConfig(), gtd: 1000 }, entries, movements);
    expect(s.prizePool).toBe(1000);
    expect(s.overlay).toBe(540);
  });

  it('todos eliminados: média zero, sem dividir por zero', () => {
    const s = computeStats(defaultConfig(), [{ eliminated_at: 'x' }], movements);
    expect(s.avgStack).toBe(0);
  });
});

describe('premiação', () => {
  const cfg = defaultConfig();

  it('escolhe a tabela pelo número de inscritos', () => {
    expect(payoutPercents(cfg, 8)).toEqual([70, 30]);
    expect(payoutPercents(cfg, 9)).toEqual([50, 30, 20]);
    expect(payoutPercents(cfg, 200)).toHaveLength(8);
  });

  it('arredonda cada prêmio e a sobra vai para o campeão', () => {
    expect(payoutTable(cfg, 1000, 10)).toEqual([500, 300, 200]);
    const t = payoutTable(cfg, 1003, 10);
    expect(t).toEqual([503, 300, 200]);
    expect(t.reduce((a, b) => a + b, 0)).toBe(1003);
  });

  it('nunca paga mais colocações do que inscritos', () => {
    expect(payoutTable(cfg, 500, 1)).toEqual([500]);
  });

  it('a soma dos prêmios é sempre o prêmio total', () => {
    for (const [pool, n] of [[2370, 23], [5000, 34], [12345, 70], [999, 12]]) {
      expect(payoutTable(cfg, pool, n).reduce((a, b) => a + b, 0)).toBe(pool);
    }
  });
});

describe('deriveClock: relógio determinístico da TV', () => {
  const L = (sb: number, minutes = 20): LevelItem => ({ kind: 'level', sb, bb: sb * 2, ante: 0, minutes });
  const levels: LevelItem[] = [L(100), L(200), { kind: 'break', minutes: 15, label: 'Intervalo', addon: true }, L(300)];
  const now = Date.parse('2026-10-24T00:00:00Z');
  const at = (ms: number) => new Date(now + ms).toISOString();

  it('rodando: mostra o tempo que falta, o próximo nível e quanto falta para o intervalo', () => {
    const c = deriveClock(levels, { clock_level: 0, clock_running: true, clock_ends_at: at(5 * 60000), clock_remaining: null }, now);
    expect(c).toMatchObject({ index: 0, remaining: 300, running: true, levelNumber: 1, untilBreak: 300 + 1200, finished: false });
    expect(c.nextLevel).toMatchObject({ sb: 200 });
  });

  it('se o nível acabou enquanto ninguém olhava, avança sozinho', () => {
    const c = deriveClock(levels, { clock_level: 0, clock_running: true, clock_ends_at: at(-60000), clock_remaining: null }, now);
    expect(c.index).toBe(1);
    expect(c.remaining).toBe(19 * 60);
    expect(c.levelNumber).toBe(2);
  });

  it('chega no intervalo: add-on liberado, sem contagem para o próximo intervalo', () => {
    const c = deriveClock(levels, { clock_level: 1, clock_running: true, clock_ends_at: at(-60000), clock_remaining: null }, now);
    expect(c.item?.kind).toBe('break');
    expect(c.untilBreak).toBeNull();
    expect(c.levelNumber).toBe(2);
    expect(addonOpen(c)).toBe(true);
    expect(c.nextLevel).toMatchObject({ sb: 300 });
  });

  it('pausado: usa o tempo guardado, ou o nível inteiro se não houver', () => {
    expect(deriveClock(levels, { clock_level: 1, clock_running: false, clock_ends_at: null, clock_remaining: 437 }, now))
      .toMatchObject({ index: 1, remaining: 437, running: false });
    expect(deriveClock(levels, { clock_level: 3, clock_running: false, clock_ends_at: null, clock_remaining: null }, now).remaining).toBe(1200);
  });

  it('passou do último nível: relógio termina parado no zero', () => {
    const c = deriveClock(levels, { clock_level: 0, clock_running: true, clock_ends_at: at(-10 * 3600000), clock_remaining: null }, now);
    expect(c).toMatchObject({ index: 3, remaining: 0, finished: true, running: false, nextLevel: null });
  });

  it('nível salvo além da estrutura (estrutura encurtada) não quebra', () => {
    expect(deriveClock(levels, { clock_level: 99, clock_running: false, clock_ends_at: null, clock_remaining: null }, now).index).toBe(3);
    expect(deriveClock([], { clock_level: 0, clock_running: true, clock_ends_at: null, clock_remaining: null }, now).finished).toBe(true);
  });

  it('rebuy fecha depois do nível configurado', () => {
    const cfg = { ...defaultConfig(), rebuyUntilLevel: 2 };
    const nivel2 = deriveClock(levels, { clock_level: 1, clock_running: false, clock_ends_at: null, clock_remaining: null }, now);
    const nivel3 = deriveClock(levels, { clock_level: 3, clock_running: false, clock_ends_at: null, clock_remaining: null }, now);
    expect(rebuyOpen(cfg, nivel2)).toBe(true);
    expect(rebuyOpen(cfg, nivel3)).toBe(false);
    expect(rebuyOpen({ ...cfg, rebuyUntilLevel: null }, nivel3)).toBe(true);
    expect(addonOpen(nivel2)).toBe(false);
  });
});

describe('formatação', () => {
  it('tempo do relógio', () => {
    expect(fmtTime(0)).toBe('00:00');
    expect(fmtTime(65)).toBe('01:05');
    expect(fmtTime(3725)).toBe('1:02:05');
    expect(fmtTime(-5)).toBe('00:00');
  });

  it('fichas abreviadas', () => {
    expect(fmtShortChips(1500)).toBe('1.500');
    expect(fmtShortChips(15000)).toBe('15K');
    expect(fmtShortChips(12500)).toBe('12,5K');
    expect(fmtShortChips(120000)).toBe('120K');
    expect(fmtShortChips(1500000)).toBe('1,5M');
  });
});
