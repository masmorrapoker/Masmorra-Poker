import { describe, expect, it } from 'vitest';
import type { DebtSettlement, Player, Table, Transaction } from '../types';
import { expectedCash, nightOf, nightRange, shiftNight, summarizeNight, type NightTournamentMovement } from './nightMath';

// Dados fictícios. Nenhum nome ou valor de jogador real.

describe('nightOf: a noite vai das 08h às 08h (horário de Brasília)', () => {
  it('madrugada conta para a noite anterior', () => {
    expect(nightOf('2026-10-23T20:00:00-03:00')).toBe('2026-10-23');
    expect(nightOf('2026-10-23T23:59:00-03:00')).toBe('2026-10-23');
    expect(nightOf('2026-10-24T00:59:00-03:00')).toBe('2026-10-23');
    expect(nightOf('2026-10-24T07:59:59-03:00')).toBe('2026-10-23');
  });

  it('a partir das 08h começa a noite do dia', () => {
    expect(nightOf('2026-10-24T08:00:00-03:00')).toBe('2026-10-24');
    expect(nightOf('2026-10-24T14:00:00-03:00')).toBe('2026-10-24');
  });

  it('funciona com horário em UTC (como vem do banco) e com Date', () => {
    // 10:30 UTC = 07:30 em Brasília → ainda é a noite anterior
    expect(nightOf('2026-10-24T10:30:00Z')).toBe('2026-10-23');
    expect(nightOf(new Date('2026-10-24T11:00:00Z'))).toBe('2026-10-24');
  });

  it('virada de mês e de ano', () => {
    expect(nightOf('2026-11-01T03:00:00-03:00')).toBe('2026-10-31');
    expect(nightOf('2027-01-01T05:00:00-03:00')).toBe('2026-12-31');
  });
});

describe('shiftNight e nightRange', () => {
  it('anda dias para frente e para trás, atravessando meses', () => {
    expect(shiftNight('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftNight('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftNight('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('a noite vai das 08h de um dia às 08h do seguinte (11h UTC)', () => {
    expect(nightRange('2026-10-23')).toEqual({ from: '2026-10-23T11:00:00.000Z', to: '2026-10-24T11:00:00.000Z' });
  });
});

describe('summarizeNight: fechamento de caixa da noite', () => {
  const table = (id: string, status: Table['status']): Table => ({ id, name: id, status, created_at: '2026-10-23T23:00:00Z', closed_at: null });
  const player = (id: string, table_id: string, name: string): Player => ({ id, table_id, player_id: `cad-${id}`, name, created_at: '2026-10-23T23:00:00Z' });
  const tx = (id: string, table_id: string, player_id: string, type: Transaction['type'], amount: number, extra: Partial<Transaction> = {}): Transaction =>
    ({ id, table_id, player_id, type, amount, created_at: '2026-10-24T01:00:00Z', ...extra });
  const st = (amount: number, method: DebtSettlement['method'], extra: Partial<DebtSettlement> = {}): DebtSettlement =>
    ({ id: `st-${amount}-${method}`, club_id: 'clube', player_id: 'cad-x', amount, method, note: null, table_id: null, created_at: '2026-10-24T01:00:00Z', ...extra });
  const mv = (kind: NightTournamentMovement['kind'], amount: number, to_prize: number, payment_method: string | null, name = 'Ana', tournament_id = 't1'): NightTournamentMovement =>
    ({ tournament_id, kind, amount, to_prize, payment_method, name });

  const data = {
    tables: [table('m1', 'closed'), table('m2', 'active')],
    players: [player('p1', 'm1', 'Rafael'), player('p2', 'm1', 'Diego'), player('p3', 'm2', 'Thiago')],
    transactions: [
      // Rafael perdeu 220: pagou 170 no PIX e ficou devendo 50
      tx('t1', 'm1', 'p1', 'buy_in', 300), tx('t2', 'm1', 'p1', 'consumo', 20),
      tx('t3', 'm1', 'p1', 'cash_out', 100, { payment_method: 'pix', fiado_amount: 50 }),
      // Diego ganhou 300: abateu 80 de fiado antigo e recebeu 220 em dinheiro
      tx('t4', 'm1', 'p2', 'buy_in', 200), tx('t5', 'm1', 'p2', 'cash_out', 500, { payment_method: 'dinheiro' }),
      // Thiago ainda está jogando
      tx('t6', 'm2', 'p3', 'buy_in', 400)
    ],
    tableSettlements: [st(80, 'abatido_cashout', { table_id: 'm1', transaction_id: 't5' })],
    fiadoPayments: [st(50, 'dinheiro'), st(30, 'pix'), st(25, 'abatido_cashout')],
    tournamentMovements: [
      mv('buyin', 120, 90, 'dinheiro', 'Ana'),
      mv('rebuy', 90, 90, 'pix', 'Ana'),
      mv('buyin', 120, 90, 'fiado', 'Caio'),
      mv('premio', 400, 0, 'pix', 'Ana'),
      mv('extra', 50, 0, 'dinheiro', 'Caio')
    ]
  };
  const s = summarizeNight(data);

  it('soma as mesas e conta quem ainda joga', () => {
    expect(s.buyIn).toBe(900);
    expect(s.cashOut).toBe(600);
    expect(s.consumo).toBe(20);
    expect(s.rake).toBe(300);
    expect(s.openTables).toBe(1);
    expect(s.stillPlaying).toBe(1);
    expect(s.abatido).toBe(80);
  });

  it('separa o dinheiro por forma de pagamento (mesas, fiado recebido e torneio)', () => {
    expect(s.flows.dinheiro).toEqual({ recebido: 120, pago: 220 + 50, fiadoRecebido: 50 });
    expect(s.flows.pix).toEqual({ recebido: 170 + 90, pago: 400, fiadoRecebido: 30 });
    expect(s.flows.cartao).toEqual({ recebido: 0, pago: 0, fiadoRecebido: 0 });
    expect(s.semForma).toEqual({ recebido: 0, pago: 0 });
  });

  it('lista o fiado gerado na noite, inclusive inscrição de torneio, do maior para o menor', () => {
    expect(s.fiadoGerado).toEqual([{ name: 'Caio (torneio)', amount: 120 }, { name: 'Rafael', amount: 50 }]);
    expect(s.fiadoGeradoTotal).toBe(170);
  });

  it('torneio: taxa da casa, prêmio extra e o que a casa cobriu do garantido', () => {
    // arrecadado 330; vai para o prêmio 270; taxa 60
    // prêmio pago 400 > 270 → casa cobriu 130; prêmio extra 50 sai da casa
    expect(s.tournaments).toEqual({ count: 1, fee: 60, overlay: 180, collected: 330, prizes: 450 });
    // receita = rake + consumo + taxa − overlay
    expect(s.revenue).toBe(300 + 20 + 60 - 180);
  });

  it('dinheiro esperado na gaveta = abertura + recebido + fiado recebido − pago', () => {
    expect(expectedCash(s, 500)).toBe(500 + 120 + 50 - 270);
  });

  it('noite vazia não quebra', () => {
    const e = summarizeNight({ tables: [], players: [], transactions: [], tableSettlements: [], fiadoPayments: [] });
    expect(e.revenue).toBe(0);
    expect(e.tournaments.count).toBe(0);
    expect(expectedCash(e, 0)).toBe(0);
  });

  it('acerto sem forma de pagamento vai para "sem forma"', () => {
    const e = summarizeNight({
      tables: [table('m9', 'closed')],
      players: [player('z', 'm9', 'Igor')],
      transactions: [tx('z1', 'm9', 'z', 'buy_in', 100), tx('z2', 'm9', 'z', 'cash_out', 40, { payment_method: null })],
      tableSettlements: [],
      fiadoPayments: []
    });
    expect(e.semForma).toEqual({ recebido: 60, pago: 0 });
  });
});
