import { describe, expect, it } from 'vitest';
import type { DebtSettlement, Player, Transaction } from '../types';
import { computeTableTotals, describeAcerto, formatDuration, mergeByPlayer, summarizePlayers } from './tableMath';

// Dados fictícios. Nenhum nome ou valor de jogador real.

const player = (id: string, name: string, player_id: string | null = `cad-${id}`): Player => ({
  id, table_id: 'mesa-1', player_id, name, created_at: '2026-10-23T23:00:00.000Z'
});

let seq = 0;
const tx = (player_id: string, type: Transaction['type'], amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: extra.id ?? `tx-${++seq}`,
  table_id: 'mesa-1',
  player_id,
  type,
  amount,
  created_at: extra.created_at ?? `2026-10-24T0${seq % 10}:00:00.000Z`,
  ...extra
});

const settlement = (amount: number, transaction_id: string | null): Pick<DebtSettlement, 'amount' | 'transaction_id'> => ({ amount, transaction_id });

describe('summarizePlayers: acerto na saída', () => {
  it('quem perdeu paga a diferença; o que não pagou fica no fiado', () => {
    const p = player('p1', 'Rafael');
    const [s] = summarizePlayers([p], [
      tx('p1', 'buy_in', 100),
      tx('p1', 'buy_in', 200),
      tx('p1', 'consumo', 20),
      tx('p1', 'cash_out', 100, { payment_method: 'pix', fiado_amount: 50 })
    ]);
    // saldo = cash-out − buy-in − consumo = 100 − 300 − 20
    expect(s.balance).toBe(-220);
    expect(s.hasCashOut).toBe(true);
    expect(s.acerto).toEqual({ method: 'pix', paidIn: 170, paidOut: 0, fiado: 50, abatido: 0 });
  });

  it('quem ganhou recebe já descontado o buy-in, e pode abater fiado antigo', () => {
    const p = player('p2', 'Diego');
    const out = tx('p2', 'cash_out', 500, { id: 'co-diego', payment_method: 'dinheiro' });
    const [s] = summarizePlayers(
      [p],
      [tx('p2', 'buy_in', 200), out],
      [settlement(80, 'co-diego'), settlement(999, 'outro-cashout'), settlement(10, null)]
    );
    expect(s.balance).toBe(300);
    // só o abatimento ligado ao cash-out deste jogador conta
    expect(s.acerto).toEqual({ method: 'dinheiro', paidIn: 0, paidOut: 220, fiado: 0, abatido: 80 });
  });

  it('quem ainda está jogando não tem acerto', () => {
    const [s] = summarizePlayers([player('p3', 'Thiago')], [tx('p3', 'buy_in', 300), tx('p3', 'consumo', 12)]);
    expect(s.hasCashOut).toBe(false);
    expect(s.acerto).toBeUndefined();
    expect(s.balance).toBe(-312);
  });

  it('usa a forma de pagamento do último cash-out que tem forma', () => {
    const [s] = summarizePlayers([player('p4', 'Lucas')], [
      tx('p4', 'buy_in', 100),
      tx('p4', 'cash_out', 20, { payment_method: 'dinheiro', created_at: '2026-10-24T02:00:00.000Z' }),
      tx('p4', 'cash_out', 10, { payment_method: 'pix', created_at: '2026-10-24T03:00:00.000Z' }),
      tx('p4', 'cash_out', 0, { payment_method: null, created_at: '2026-10-24T04:00:00.000Z' })
    ]);
    expect(s.acerto?.method).toBe('pix');
    expect(s.acerto?.paidIn).toBe(70);
  });

  it('perdeu e ficou devendo tudo: nada pago na hora', () => {
    const [s] = summarizePlayers([player('p5', 'Bruno')], [
      tx('p5', 'buy_in', 200),
      tx('p5', 'cash_out', 0, { payment_method: 'fiado', fiado_amount: 200 })
    ]);
    expect(s.acerto).toMatchObject({ paidIn: 0, fiado: 200 });
  });

  it('soma valores que chegam como texto do banco (numeric)', () => {
    const [s] = summarizePlayers([player('p6', 'Felipe')], [
      tx('p6', 'buy_in', '150' as unknown as number),
      tx('p6', 'cash_out', '200' as unknown as number, { payment_method: 'pix' })
    ]);
    expect(s.balance).toBe(50);
  });
});

describe('describeAcerto', () => {
  const sum = (balance: number, acerto?: Parameters<typeof describeAcerto>[0]['acerto']) =>
    ({ player: player('x', 'X'), buyIn: 0, cashOut: 0, consumo: 0, balance, hasCashOut: !!acerto, acerto });

  it('descreve cada situação', () => {
    expect(describeAcerto(sum(-10))).toBe('Ainda jogando');
    expect(describeAcerto(sum(-220, { method: 'pix', paidIn: 170, paidOut: 0, fiado: 50, abatido: 0 })))
      .toBe('Pagou R$ 170,00 (PIX) · Ficou devendo R$ 50,00');
    expect(describeAcerto(sum(300, { method: 'dinheiro', paidIn: 0, paidOut: 220, fiado: 0, abatido: 80 })))
      .toBe('Recebeu R$ 220,00 (Dinheiro) · Abateu R$ 80,00 de fiado');
    expect(describeAcerto(sum(0, { method: null, paidIn: 0, paidOut: 0, fiado: 0, abatido: 0 }))).toBe('Saiu no zero');
  });
});

describe('computeTableTotals', () => {
  const players = [player('a', 'Ana'), player('b', 'Caio'), player('c', 'Igor')];
  const txs = [
    tx('a', 'buy_in', 300), tx('a', 'consumo', 20), tx('a', 'cash_out', 100, { payment_method: 'pix', fiado_amount: 50 }),
    tx('b', 'buy_in', 200), tx('b', 'cash_out', 500, { id: 'co-caio', payment_method: 'dinheiro' }),
    tx('c', 'buy_in', 400), tx('c', 'consumo', 30)
  ];
  const totals = computeTableTotals(summarizePlayers(players, txs, [settlement(80, 'co-caio')]));

  it('rake = buy-ins − cash-outs e receita = rake + consumo', () => {
    expect(totals.buyIn).toBe(900);
    expect(totals.cashOut).toBe(600);
    expect(totals.consumo).toBe(50);
    expect(totals.rake).toBe(300);
    expect(totals.revenue).toBe(350);
  });

  it('conta quem ainda joga e só fecha quando todos saíram', () => {
    expect(totals.activeCount).toBe(1);
    expect(totals.closedCount).toBe(2);
    expect(totals.allCashedOut).toBe(false);
    expect(computeTableTotals([]).allCashedOut).toBe(false);
  });

  it('separa os acertos por forma de pagamento e soma fiado e abatimentos', () => {
    expect(totals.byMethod).toEqual([
      { method: 'dinheiro', label: 'Dinheiro', entradas: 0, saidas: 220 },
      { method: 'pix', label: 'PIX', entradas: 170, saidas: 0 }
    ]);
    expect(totals.fiado).toBe(50);
    expect(totals.abatido).toBe(80);
  });
});

describe('formatDuration', () => {
  it('mostra horas e minutos; mesa aberta conta até agora', () => {
    expect(formatDuration({ created_at: '2026-10-23T23:00:00Z', closed_at: '2026-10-24T01:05:30Z' })).toBe('2h 5m');
    expect(formatDuration({ created_at: '2026-10-23T23:00:00Z', closed_at: null }, Date.parse('2026-10-23T23:42:00Z'))).toBe('42m');
    expect(formatDuration({ created_at: '2026-10-23T23:00:00Z', closed_at: '2026-10-23T22:00:00Z' })).toBe('0m');
  });
});

describe('mergeByPlayer', () => {
  it('junta linhas do mesmo cadastro, descarta linhas vazias e agrupa antigos pelo nome', () => {
    const rows = summarizePlayers(
      [player('r1', 'Rafael', 'cad-raf'), player('r2', 'Rafael', 'cad-raf'), player('v', 'Vazio'),
        player('o1', 'Murilo ', null), player('o2', 'murilo', null)],
      [
        tx('r1', 'buy_in', 100), tx('r1', 'cash_out', 50, { payment_method: 'pix' }),
        tx('r2', 'buy_in', 200), tx('r2', 'cash_out', 400, { payment_method: 'dinheiro' }),
        tx('o1', 'buy_in', 50), tx('o2', 'buy_in', 70)
      ]
    );
    const merged = mergeByPlayer(rows);
    expect(merged).toHaveLength(2);
    const raf = merged.find(m => m.player.player_id === 'cad-raf')!;
    expect(raf).toMatchObject({ buyIn: 300, cashOut: 450, balance: 150, hasCashOut: true });
    expect(raf.acerto).toEqual({ method: 'dinheiro', paidIn: 50, paidOut: 200, fiado: 0, abatido: 0 });
    const mur = merged.find(m => m.player.player_id === null)!;
    expect(mur).toMatchObject({ buyIn: 120, hasCashOut: false });
  });
});
