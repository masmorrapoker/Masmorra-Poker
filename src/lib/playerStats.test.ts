import { describe, expect, it } from 'vitest';
import type { GlobalPlayer, Player, Table, Transaction } from '../types';
import { aggregatePlayers, buildSessions, inPeriod, periodLabel, sessionMinutes, shiftPeriod, type Session } from './playerStats';

// Dados fictícios. Nenhum nome ou valor de jogador real.

const table = (id: string, created_at: string): Table => ({ id, name: id, status: 'closed', created_at, closed_at: null });
const tp = (id: string, table_id: string, name: string, player_id: string | null, created_at = '2026-10-23T23:00:00Z'): Player =>
  ({ id, table_id, player_id, name, created_at });
const tx = (player_id: string, type: Transaction['type'], amount: number, created_at = '2026-10-24T02:00:00Z', extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `${player_id}-${type}-${amount}-${created_at}`, table_id: 'x', player_id, type, amount, created_at, ...extra });

describe('sessionMinutes', () => {
  const base = { finished: true, enteredAt: '2026-10-23T23:00:00Z', leftAt: '2026-10-24T00:30:00Z' } as Session;

  it('conta os minutos entre entrar e sair', () => {
    expect(sessionMinutes(base)).toBe(90);
  });

  it('não sabe quando ainda está jogando ou faltam horários', () => {
    expect(sessionMinutes({ ...base, finished: false })).toBeNull();
    expect(sessionMinutes({ ...base, enteredAt: null })).toBeNull();
    expect(sessionMinutes({ ...base, leftAt: '2026-10-23T22:00:00Z' })).toBeNull();
  });

  it('limita a 16 horas (mesa esquecida aberta)', () => {
    expect(sessionMinutes({ ...base, leftAt: '2026-10-25T23:00:00Z' })).toBe(16 * 60);
  });
});

describe('buildSessions', () => {
  const tables = [table('m1', '2026-10-23T23:00:00Z'), table('m2', '2026-10-24T22:00:00Z')];
  const globals: GlobalPlayer[] = [{ id: 'cad-raf', name: 'Rafael Novo Nome', created_at: '2026-01-01T00:00:00Z' }];

  it('soma linhas repetidas do mesmo jogador na mesma mesa e usa o nome do cadastro', () => {
    const sessions = buildSessions(
      tables,
      [tp('a1', 'm1', 'Rafael', 'cad-raf', '2026-10-23T23:10:00Z'), tp('a2', 'm1', 'Rafael', 'cad-raf', '2026-10-23T23:40:00Z')],
      [
        tx('a1', 'buy_in', 100), tx('a1', 'cash_out', 50, '2026-10-24T01:00:00Z', { fiado_amount: 20 }),
        tx('a2', 'buy_in', 200), tx('a2', 'consumo', 15), tx('a2', 'cash_out', 400, '2026-10-24T03:00:00Z')
      ],
      globals
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      key: 'cad-raf', name: 'Rafael Novo Nome', night: '2026-10-23',
      buyIn: 300, cashOut: 450, consumo: 15, result: 135, fiado: 20, finished: true,
      enteredAt: '2026-10-23T23:10:00Z', leftAt: '2026-10-24T03:00:00Z', rowIds: ['a1', 'a2']
    });
  });

  it('se uma das linhas ainda está jogando, a sessão não está finalizada', () => {
    const [s] = buildSessions(
      tables,
      [tp('b1', 'm1', 'Diego', 'cad-die'), tp('b2', 'm1', 'Diego', 'cad-die')],
      [tx('b1', 'buy_in', 100), tx('b1', 'cash_out', 0), tx('b2', 'buy_in', 100)]
    );
    expect(s.finished).toBe(false);
  });

  it('jogador só adicionado, sem lançamento, não conta; mesa desconhecida é ignorada', () => {
    const sessions = buildSessions(tables, [tp('c1', 'm1', 'Vazio', 'cad-v'), tp('c2', 'nao-existe', 'Outro', 'cad-o')], [tx('c2', 'buy_in', 50)]);
    expect(sessions).toEqual([]);
  });

  it('registros antigos sem cadastro são agrupados pelo nome', () => {
    const [s] = buildSessions(tables, [tp('d1', 'm2', '  Murilo ', null)], [tx('d1', 'buy_in', 80)]);
    expect(s.key).toBe('nome:murilo');
    expect(s.playerId).toBeNull();
    expect(s.night).toBe('2026-10-24');
  });
});

describe('aggregatePlayers', () => {
  const session = (over: Partial<Session>): Session => ({
    key: 'k', playerId: 'k', name: 'Lucas', table: table('m', '2026-10-23T23:00:00Z'), night: '2026-10-23',
    buyIn: 100, cashOut: 0, consumo: 0, result: 0, finished: true, fiado: 0, enteredAt: null, leftAt: null, ...over
  });

  it('resultado por noite (somando mesas da mesma noite); sessão em andamento não entra no resultado', () => {
    const [st] = aggregatePlayers([
      session({ night: '2026-10-23', result: 200 }),
      session({ night: '2026-10-23', result: -50 }),
      session({ night: '2026-10-30', result: -100 }),
      session({ night: '2026-11-06', result: 999, finished: false })
    ]);
    expect(st).toMatchObject({
      nights: 3, sessions: 4, buyIn: 400, result: 50,
      winRate: 0.5, bestNight: 150, worstNight: -100, lastNight: '2026-11-06'
    });
  });

  it('sem nenhuma sessão finalizada, a taxa de vitória fica vazia', () => {
    const [st] = aggregatePlayers([session({ finished: false })]);
    expect(st.winRate).toBeNull();
    expect(st.bestNight).toBe(0);
  });
});

describe('períodos do ranking', () => {
  it('filtra por mês, ano ou tudo', () => {
    expect(inPeriod('2026-10-23', { kind: 'month', value: '2026-10' })).toBe(true);
    expect(inPeriod('2026-11-01', { kind: 'month', value: '2026-10' })).toBe(false);
    expect(inPeriod('2026-10-23', { kind: 'year', value: '2026' })).toBe(true);
    expect(inPeriod('2025-10-23', { kind: 'all' })).toBe(true);
  });

  it('anda mês a mês atravessando o ano', () => {
    expect(shiftPeriod({ kind: 'month', value: '2026-12' }, 1)).toEqual({ kind: 'month', value: '2027-01' });
    expect(shiftPeriod({ kind: 'month', value: '2026-01' }, -1)).toEqual({ kind: 'month', value: '2025-12' });
    expect(shiftPeriod({ kind: 'year', value: '2026' }, -1)).toEqual({ kind: 'year', value: '2025' });
    expect(shiftPeriod({ kind: 'all' }, 1)).toEqual({ kind: 'all' });
  });

  it('nome do período em português', () => {
    expect(periodLabel({ kind: 'month', value: '2026-10' })).toBe('Outubro de 2026');
    expect(periodLabel({ kind: 'year', value: '2026' })).toBe('2026');
    expect(periodLabel({ kind: 'all' })).toBe('Desde o início');
  });
});
