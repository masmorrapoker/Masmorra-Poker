/**
 * Gera o SQL do clube de demonstração ("Seu Clube de Poker"), com dados 100% fictícios.
 *
 *   node scripts/demo/gerar-clube-demo.mjs [--hoje=AAAA-MM-DD]
 *
 * Saída em supabase/demo/:
 *   clube_demonstracao_aplicar.sql    grava os dados (o dono roda no SQL Editor)
 *   clube_demonstracao_simulacao.sql  mesmo conteúdo, termina com raise exception (nada é gravado)
 *   clube_demonstracao_remover.sql    apaga tudo o que é do clube demo (para refazer do zero)
 *
 * Os fechamentos de caixa usam as funções do próprio sistema (summarizeNight, expectedCash),
 * carregadas pelo Vite, para o "esperado" bater com o que a tela do caixa recalcula.
 * O gerador é determinístico: a mesma data gera o mesmo SQL.
 */
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(ROOT, 'supabase/demo');

const DEMO_CLUB_ID = '7262a52c-c249-4ada-9359-cf6ae33aa1e7';
const DEMO_CLUB_NAME = 'Seu Clube de Poker';

// ───────────────────────── utilitários ─────────────────────────

const arg = process.argv.find(a => a.startsWith('--hoje='));
const hojeBRT = arg
  ? arg.slice(7)
  : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// PRNG determinístico (mulberry32)
let seed = 0x5eed1234;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = p => rnd() < p;
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const weighted = (items, w) => {
  const total = items.reduce((s, it) => s + w(it), 0);
  let r = rnd() * total;
  for (const it of items) { r -= w(it); if (r <= 0) return it; }
  return items[items.length - 1];
};
const uuid = () => {
  const h = Array.from({ length: 32 }, () => Math.floor(rnd() * 16).toString(16));
  h[12] = '4'; h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
};
const round5 = v => Math.round(v / 5) * 5;

/** Data local (Brasília, -03:00) + minutos desde a meia-noite (pode passar de 24h) → ISO UTC. */
const at = (day, minutes) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0) + minutes * 60000).toISOString();
};
const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
};
const weekday = day => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 dom … 6 sáb

const q = v => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

// ───────────────────────── elenco fictício ─────────────────────────

const NOMES = [
  'Rafael Moreira', 'Diego Lacerda', 'Thiago Bastos', 'Lucas Ferraz', 'Bruno Teixeira', 'Felipe Dantas',
  'Caio Rezende', 'Igor Pacheco', 'Murilo Siqueira', 'André Coutinho', 'Gustavo Brandão', 'Rodrigo Vilela',
  'Marcelo Furtado', 'Eduardo Paiva', 'Leandro Sampaio', 'Vinícius Aragão', 'Henrique Lobo', 'Fábio Quintela',
  'Renato Valente', 'Matheus Godinho', 'Gabriel Antunes', 'Daniel Prado', 'Alexandre Bittencourt', 'Ricardo Falcão',
  'Sérgio Moura', 'Juliano Peixoto', 'Otávio Barreto', 'Leonardo Cunha', 'César Albuquerque', 'Fernanda Lins',
  'Patrícia Rocha', 'Camila Duarte', 'Juliana Toledo', 'Marcos Rangel', 'Pedro Lustosa', 'Samuel Viana'
];

const PRODUTOS = [
  { id: 'p1', name: 'Cerveja', category: 'Bebidas', price: 8, active: true },
  { id: 'p2', name: 'Long neck', category: 'Bebidas', price: 12, active: true },
  { id: 'p3', name: 'Refrigerante', category: 'Bebidas', price: 6, active: true },
  { id: 'p4', name: 'Água', category: 'Bebidas', price: 4, active: true },
  { id: 'p5', name: 'Energético', category: 'Bebidas', price: 12, active: true },
  { id: 'p6', name: 'Porção de fritas', category: 'Comida', price: 30, active: true },
  { id: 'p7', name: 'Hambúrguer', category: 'Comida', price: 28, active: true }
];
const PESO_PRODUTO = { Cerveja: 10, 'Long neck': 4, Refrigerante: 4, Água: 3, Energético: 3, 'Porção de fritas': 1.5, Hambúrguer: 1.5 };

const players = NOMES.map((name, i) => ({
  id: uuid(),
  name,
  // DDD 00 não existe: o botão de WhatsApp nunca abre conversa com alguém de verdade.
  phone: `(00) 90000-${String(1001 + i).slice(-4)}`,
  birth_date: `19${between(75, 99)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
  created_at: at('2026-09-01', between(0, 60 * 24 * 25)),
  freq: i < 10 ? 0.75 : i < 22 ? 0.42 : 0.18, // os primeiros são os "da casa"
  fiadoProne: [4, 7, 8, 13, 18, 25].includes(i)
}));
// dois aniversariantes nesta semana, para a tela de relacionamento
for (const [i, plus] of [[2, 2], [9, 5]]) {
  const d = addDays(hojeBRT, plus);
  players[i].birth_date = `19${between(80, 95)}-${d.slice(5)}`;
}

// ───────────────────────── carregar o cálculo do sistema ─────────────────────────

const vite = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const nightMath = await vite.ssrLoadModule('/src/lib/nightMath.ts');
const tour = await vite.ssrLoadModule('/src/lib/tournament.ts');

// ───────────────────────── simulação das noites ─────────────────────────

const rows = { tables: [], tablePlayers: [], txs: [], settlements: [], tournaments: [], entries: [], movements: [], closings: [] };
const saldo = new Map(players.map(p => [p.id, 0])); // fiado em aberto por jogador
const PRIMEIRA = addDays(hojeBRT, -54);
const nights = [];
for (let d = PRIMEIRA; d < hojeBRT; d = addDays(d, 1)) if ([2, 4, 6].includes(weekday(d))) nights.push(d);

const payMethod = p => (p.fiadoProne ? weighted(['pix', 'dinheiro', 'cartao'], m => ({ pix: 5, dinheiro: 4, cartao: 1 })[m]) : weighted(['pix', 'dinheiro', 'cartao'], m => ({ pix: 6, dinheiro: 3, cartao: 1 })[m]));

function choosePlayers(n, exclude) {
  const out = [];
  const pool = players.filter(p => !exclude.has(p.id));
  while (out.length < n && pool.length) {
    const p = weighted(pool, x => x.freq);
    out.push(p); pool.splice(pool.indexOf(p), 1); exclude.add(p.id);
  }
  return out;
}

function fiadoPayments(day) {
  const list = [];
  for (const p of players) {
    const s = saldo.get(p.id);
    if (s <= 0 || !chance(0.28)) continue;
    const amount = chance(0.6) ? s : round5(s / 2);
    if (amount <= 0) continue;
    saldo.set(p.id, s - amount);
    list.push({ id: uuid(), player_id: p.id, amount, method: chance(0.65) ? 'pix' : 'dinheiro', note: null, table_id: null, transaction_id: null, created_at: at(day, between(20 * 60 + 30, 22 * 60)) });
  }
  return list;
}

function cashTable(day, name, stake, open, chosen) {
  const table = { id: uuid(), name, status: 'closed', created_at: at(day, open), closed_at: null };
  const buyIn = stake === '1/2' ? 100 : 200;
  const tps = [], txs = [], sts = [];
  let lastOut = open;
  const plan = chosen.map(p => {
    const join = open + between(0, 95);
    const tp = { id: uuid(), table_id: table.id, player_id: p.id, name: p.name, created_at: at(day, join) };
    tps.push(tp);
    const leave = Math.max(join + 120, between(23 * 60 + 30, 28 * 60 + 40));
    const mine = [{ type: 'buy_in', amount: buyIn, min: join + 1, description: null }];
    const rebuys = weighted([0, 1, 2, 3], k => [4, 4, 2, 1][k]);
    for (let r = 0; r < rebuys; r++) mine.push({ type: 'buy_in', amount: chance(0.7) ? buyIn : buyIn / 2, min: between(join + 30, leave - 20), description: 'Rebuy' });
    const itens = weighted([0, 1, 2, 3, 4, 5], k => [2, 3, 4, 3, 2, 1][k]);
    for (let c = 0; c < itens; c++) {
      const prod = weighted(PRODUTOS, x => PESO_PRODUTO[x.name]);
      mine.push({ type: 'consumo', amount: prod.price, min: between(join + 10, leave - 5), description: prod.name });
    }
    return { p, tp, mine, leave };
  });
  // fichas finais: 5% de rake, alguns quebram
  const pot = plan.reduce((s, x) => s + x.mine.filter(m => m.type === 'buy_in').reduce((a, m) => a + m.amount, 0), 0);
  const available = round5(pot * 0.95);
  const weights = plan.map(() => (chance(0.3) ? 0 : 0.3 + rnd() ** 1.6 * 2.2));
  if (weights.every(w => w === 0)) weights[0] = 1;
  const wsum = weights.reduce((a, b) => a + b, 0);
  const stacks = weights.map(w => round5((available * w) / wsum));
  const diff = available - stacks.reduce((a, b) => a + b, 0);
  stacks[weights.indexOf(Math.max(...weights))] += diff;

  plan.forEach(({ p, tp, mine, leave }, i) => {
    mine.sort((a, b) => a.min - b.min);
    for (const m of mine) txs.push({ id: uuid(), table_id: table.id, player_id: tp.id, type: m.type, amount: m.amount, description: m.description, payment_method: null, fiado_amount: 0, created_at: at(day, m.min) });
    const bi = mine.filter(m => m.type === 'buy_in').reduce((a, m) => a + m.amount, 0);
    const cons = mine.filter(m => m.type === 'consumo').reduce((a, m) => a + m.amount, 0);
    const co = stacks[i];
    const balance = co - bi - cons;
    const out = { id: uuid(), table_id: table.id, player_id: tp.id, type: 'cash_out', amount: co, description: null, payment_method: null, fiado_amount: 0, created_at: at(day, leave) };
    if (balance < 0) {
      const owed = -balance;
      if (chance(p.fiadoProne ? 0.45 : 0.06)) {
        out.fiado_amount = chance(0.55) ? owed : round5(owed / 2);
        if (out.fiado_amount < owed) out.payment_method = payMethod(p);
        saldo.set(p.id, saldo.get(p.id) + out.fiado_amount);
      } else {
        out.payment_method = payMethod(p);
      }
    } else if (balance > 0) {
      out.payment_method = balance >= 400 || chance(0.6) ? 'pix' : 'dinheiro';
      const s = saldo.get(p.id);
      if (s > 0 && chance(0.65)) {
        const ab = Math.min(s, balance);
        saldo.set(p.id, s - ab);
        sts.push({ id: uuid(), player_id: p.id, amount: ab, method: 'abatido_cashout', note: 'Abatido no acerto', table_id: table.id, transaction_id: out.id, created_at: at(day, leave) });
      }
    }
    txs.push(out);
    lastOut = Math.max(lastOut, leave);
  });
  table.closed_at = at(day, lastOut + between(4, 15));
  return { table, tps, txs, sts };
}

function tournament(day, gtd, label) {
  const cfg = tour.defaultConfig();
  cfg.rebuys = cfg.rebuys.map((r, i) => ({ ...r, id: `rb${i + 1}` }));
  cfg.addons = cfg.addons.map((r, i) => ({ ...r, id: `ad${i + 1}` }));
  cfg.bonuses = cfg.bonuses.map((r, i) => ({ ...r, id: `bn${i + 1}` }));
  cfg.extras = [{ id: 'ex1', label: 'Chip leader no intervalo', amount: 300 }];
  cfg.gtd = gtd;
  const start = 16 * 60;
  const t = {
    id: uuid(), name: label, status: 'encerrado', scheduled_at: at(day, start), started_at: at(day, start + 5),
    finished_at: null, config: cfg, clock_level: 0, clock_running: false, clock_ends_at: null, clock_remaining: 0, created_at: at(addDays(day, -3), 14 * 60)
  };
  const n = between(16, 26);
  const chosen = choosePlayers(n, new Set());
  const ents = [], mvs = [];
  const breakAt = start + 8 * 25; // intervalo do add-on depois do 8º nível (25 min)
  const mv = (e, kind, opt, min, method) => mvs.push({ id: uuid(), tournament_id: t.id, entry_id: e.id, kind, label: opt?.label ?? null, amount: opt?.price ?? 0, to_prize: opt?.toPrize ?? 0, chips: opt?.chips ?? 0, payment_method: method, created_at: at(day, min), _player: e._p });
  for (const p of chosen) {
    const reg = start - 30 + between(0, 90);
    const e = { id: uuid(), tournament_id: t.id, player_id: p.id, name: p.name, created_at: at(day, reg), eliminated_at: null, position: null, _p: p };
    ents.push(e);
    const method = chance(p.fiadoProne ? 0.3 : 0.06) ? 'fiado' : payMethod(p);
    mv(e, 'buyin', cfg.buyin, reg, method);
    if (method === 'fiado') saldo.set(p.id, saldo.get(p.id) + cfg.buyin.price);
    if (reg <= start) mv(e, 'bonus', { label: 'Pontualidade', price: 0, toPrize: 0, chips: 5000 }, reg, null);
    if (chance(0.5)) mv(e, 'bonus', { label: 'Confirmação', price: 0, toPrize: 0, chips: 5000 }, reg, null);
    const rebuys = weighted([0, 1, 2], k => [5, 3, 1][k]);
    for (let r = 0; r < rebuys; r++) {
      const opt = chance(0.75) ? cfg.rebuys[0] : cfg.rebuys[1];
      const m2 = chance(p.fiadoProne ? 0.2 : 0.04) ? 'fiado' : payMethod(p);
      mv(e, 'rebuy', opt, between(start + 20, breakAt - 5), m2);
      if (m2 === 'fiado') saldo.set(p.id, saldo.get(p.id) + opt.price);
    }
  }
  // eliminações: alguns antes do intervalo, o resto depois
  const order = [...ents].sort(() => rnd() - 0.5);
  const earlyOut = Math.floor(n * 0.3);
  let minute = start + 60;
  order.slice(0, n - 1).forEach((e, i) => {
    if (i === earlyOut) {
      // intervalo: add-on de quem está vivo e o prêmio extra do chip leader
      for (const alive of order.slice(earlyOut)) {
        if (chance(0.75)) {
          const opt = chance(0.6) ? cfg.addons[0] : cfg.addons[1];
          const m3 = chance(alive._p.fiadoProne ? 0.2 : 0.04) ? 'fiado' : payMethod(alive._p);
          mv(alive, 'addon', opt, breakAt + between(1, 12), m3);
          if (m3 === 'fiado') saldo.set(alive._p.id, saldo.get(alive._p.id) + opt.price);
        }
      }
      mv(pick(order.slice(earlyOut)), 'extra', { label: 'Chip leader no intervalo', price: 300, toPrize: 0, chips: 0 }, breakAt + 14, 'pix');
      minute = breakAt + 20;
    }
    minute += between(6, i < earlyOut ? 18 : 14);
    e.eliminated_at = at(day, minute);
    e.position = n - i;
  });
  const champ = order[n - 1];
  champ.position = 1;
  const stats = tour.computeStats(cfg, ents, mvs);
  const prizes = tour.payoutTable(cfg, stats.prizePool, stats.entries);
  const end = minute + between(8, 20);
  prizes.forEach((v, i) => {
    const e = ents.find(x => x.position === i + 1);
    if (e && v > 0) mv(e, 'premio', { label: `${i + 1}º lugar`, price: v, toPrize: 0, chips: 0 }, end + i, v >= 400 || chance(0.6) ? 'pix' : 'dinheiro');
  });
  t.finished_at = at(day, end);
  t.clock_level = Math.min(cfg.levels.length - 1, Math.floor((end - start) / 22));
  return { t, ents, mvs };
}

const closingsLog = [];
for (const day of nights) {
  const dow = weekday(day);
  const nightTables = [], nightTps = [], nightTxs = [], nightSts = [];
  const pays = fiadoPayments(day);
  let tmv = [];

  if (dow === 6) {
    const gtd = pick([3000, 5000, 5000, 8000]);
    const { t, ents, mvs } = tournament(day, gtd, `Torneio de sábado · ${gtd / 1000}K garantidos`);
    rows.tournaments.push(t); rows.entries.push(...ents); rows.movements.push(...mvs);
    tmv = mvs;
  }
  const used = new Set();
  const tablesTonight = dow === 4 ? [['Mesa 1 · 2/4', '2/4'], ['Mesa 2 · 1/2', '1/2']] : [['Mesa 1 · 2/4', '2/4']];
  tablesTonight.forEach(([name, stake], k) => {
    const open = (dow === 6 ? 21 * 60 + 30 : 20 * 60) + k * 45 + between(0, 20);
    const { table, tps, txs, sts } = cashTable(day, name, stake, open, choosePlayers(between(6, 9), used));
    nightTables.push(table); nightTps.push(...tps); nightTxs.push(...txs); nightSts.push(...sts);
  });
  rows.tables.push(...nightTables); rows.tablePlayers.push(...nightTps); rows.txs.push(...nightTxs);
  rows.settlements.push(...nightSts, ...pays);

  // Fechamento: mesmo cálculo da tela do caixa
  const data = {
    tables: nightTables, players: nightTps, transactions: nightTxs, tableSettlements: nightSts, fiadoPayments: pays,
    tournamentMovements: tmv.map(m => ({ tournament_id: m.tournament_id, kind: m.kind, amount: m.amount, to_prize: m.to_prize, payment_method: m.payment_method, name: m._player.name }))
  };
  const summary = nightMath.summarizeNight(data);
  // Troco inicial de 300; se a noite pagou muito em dinheiro, a gaveta começou com mais.
  let opening = 300;
  let expected = nightMath.expectedCash(summary, opening);
  if (expected < 100) { opening += Math.ceil((100 - expected) / 100) * 100; expected = nightMath.expectedCash(summary, opening); }
  const falta = day === nights[nights.length - 4] ? 10 : 0;
  rows.closings.push({
    id: uuid(), night: day, opening_cash: opening, expected_cash: expected, counted_cash: Math.max(0, expected - falta),
    summary, note: falta ? 'Faltaram R$ 10 de troco; conferido com a equipe.' : null, closed_by_name: 'Ana', created_at: at(day, 29 * 60)
  });
  closingsLog.push(`${day} esperado ${expected}`);
}

// ───────────────────────── noite de hoje (para gravar ao vivo) ─────────────────────────
// Relativo ao now() do banco: a mesa já aberta e o torneio de hoje com inscritos.

const live = { table: { id: uuid(), name: 'Mesa 1 · 2/4' }, tps: [], txs: [], tour: null, ents: [], mvs: [] };
{
  const chosen = choosePlayers(6, new Set());
  chosen.forEach((p, i) => {
    const tp = { id: uuid(), player_id: p.id, name: p.name, ago: 95 - i * 9 };
    live.tps.push(tp);
    live.txs.push({ id: uuid(), player_id: tp.id, type: 'buy_in', amount: 200, description: null, ago: tp.ago - 1 });
    if (i % 2 === 0) live.txs.push({ id: uuid(), player_id: tp.id, type: 'buy_in', amount: 200, description: 'Rebuy', ago: tp.ago - 40 });
    if (i !== 3) live.txs.push({ id: uuid(), player_id: tp.id, type: 'consumo', amount: 8, description: 'Cerveja', ago: tp.ago - 25 });
  });
  const cfg = tour.defaultConfig();
  cfg.rebuys = cfg.rebuys.map((r, i) => ({ ...r, id: `rb${i + 1}` }));
  cfg.addons = cfg.addons.map((r, i) => ({ ...r, id: `ad${i + 1}` }));
  cfg.bonuses = cfg.bonuses.map((r, i) => ({ ...r, id: `bn${i + 1}` }));
  cfg.extras = [{ id: 'ex1', label: 'Chip leader no intervalo', amount: 300 }];
  cfg.gtd = 3000;
  cfg.notice = 'Jantar no intervalo';
  live.tour = { id: uuid(), name: 'Torneio de terça · 3K garantidos', config: cfg };
  for (const p of choosePlayers(14, new Set(live.tps.map(t => t.player_id)))) {
    const e = { id: uuid(), player_id: p.id, name: p.name, ago: between(5, 60) };
    live.ents.push(e);
    live.mvs.push({ id: uuid(), entry_id: e.id, kind: 'buyin', label: cfg.buyin.label, amount: cfg.buyin.price, to_prize: cfg.buyin.toPrize, chips: cfg.buyin.chips, payment_method: payMethod(p), ago: e.ago });
    if (chance(0.6)) live.mvs.push({ id: uuid(), entry_id: e.id, kind: 'bonus', label: 'Pontualidade', amount: 0, to_prize: 0, chips: 5000, payment_method: null, ago: e.ago });
  }
}

await vite.close();

// ───────────────────────── SQL ─────────────────────────

const ts = iso => `${q(iso)}::timestamptz`;
const ago = m => `now() - interval '${m} minutes'`;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const lines = [];
const L = s => lines.push(s);

L(`  -- Configuração do clube`);
L(`  update public.clubs set beer_price = 8, energy_price = 12, marketing_club_name = ${q(DEMO_CLUB_NAME)} where id = v_club;`);
L(`  update public.club_settings set custom_products = ${q(JSON.stringify(PRODUTOS))}::jsonb, default_buyin = 200, default_rebuy = 200,`);
L(`    business_days = array['terca','quinta','sabado'], opening_time = '20:00', closing_time = '05:00', marketing_club_name = ${q(DEMO_CLUB_NAME)}`);
L(`    where club_id = v_club;`);
L(``);
L(`  -- Jogadores (nomes inventados; telefones com DDD 00, que não existe)`);
for (const c of chunk(players, 50)) {
  L(`  insert into public.players (id, club_id, name, phone, birth_date, created_at) values`);
  L(c.map(p => `    (${q(p.id)}, v_club, ${q(p.name)}, ${q(p.phone)}, ${q(p.birth_date)}, ${ts(p.created_at)})`).join(',\n') + ';');
}

// Mesas: abre (status active), entra jogador, lança, fecha. Nessa ordem os gatilhos do banco aceitam.
const byTable = new Map(rows.tables.map(t => [t.id, { tps: [], txs: [], sts: [] }]));
rows.tablePlayers.forEach(tp => byTable.get(tp.table_id).tps.push(tp));
rows.txs.forEach(tx => byTable.get(tx.table_id).txs.push(tx));
rows.settlements.filter(s => s.table_id).forEach(s => byTable.get(s.table_id).sts.push(s));
const fiadoPays = rows.settlements.filter(s => !s.table_id);

L(``);
L(`  -- Mesas de cash (${rows.tables.length} mesas em ${nights.length} noites)`);
for (const t of rows.tables) {
  const g = byTable.get(t.id);
  L(`  insert into public.tables (id, club_id, name, status, created_at) values (${q(t.id)}, v_club, ${q(t.name)}, 'active', ${ts(t.created_at)});`);
  L(`  insert into public.table_players (id, club_id, table_id, player_id, name, created_at) values`);
  L(g.tps.map(tp => `    (${q(tp.id)}, v_club, ${q(t.id)}, ${q(tp.player_id)}, ${q(tp.name)}, ${ts(tp.created_at)})`).join(',\n') + ';');
  const pre = g.txs.filter(x => x.type !== 'cash_out');
  const outs = g.txs.filter(x => x.type === 'cash_out');
  const txv = x => `    (${q(x.id)}, v_club, ${q(t.id)}, ${q(x.player_id)}, ${q(x.type)}, ${x.amount}, ${q(x.description)}, ${q(x.payment_method)}, ${x.fiado_amount}, ${ts(x.created_at)})`;
  L(`  insert into public.transactions (id, club_id, table_id, player_id, type, amount, description, payment_method, fiado_amount, created_at) values`);
  L(pre.map(txv).join(',\n') + ';');
  L(`  insert into public.transactions (id, club_id, table_id, player_id, type, amount, description, payment_method, fiado_amount, created_at) values`);
  L(outs.map(txv).join(',\n') + ';');
  if (g.sts.length) {
    L(`  insert into public.debt_settlements (id, club_id, player_id, amount, method, note, table_id, transaction_id, created_at) values`);
    L(g.sts.map(s => `    (${q(s.id)}, v_club, ${q(s.player_id)}, ${s.amount}, ${q(s.method)}, ${q(s.note)}, ${q(s.table_id)}, ${q(s.transaction_id)}, ${ts(s.created_at)})`).join(',\n') + ';');
  }
  L(`  update public.tables set status = 'closed', closed_at = ${ts(t.closed_at)} where id = ${q(t.id)};`);
}

L(``);
L(`  -- Pagamentos de fiado (PIX/dinheiro) feitos em noites seguintes`);
for (const c of chunk(fiadoPays, 50)) {
  L(`  insert into public.debt_settlements (id, club_id, player_id, amount, method, note, table_id, transaction_id, created_at) values`);
  L(c.map(s => `    (${q(s.id)}, v_club, ${q(s.player_id)}, ${s.amount}, ${q(s.method)}, null, null, null, ${ts(s.created_at)})`).join(',\n') + ';');
}

L(``);
L(`  -- Torneios encerrados (${rows.tournaments.length})`);
for (const t of rows.tournaments) {
  L(`  insert into public.tournaments (id, club_id, name, status, scheduled_at, started_at, finished_at, config, clock_level, clock_running, clock_remaining, created_at) values`);
  L(`    (${q(t.id)}, v_club, ${q(t.name)}, 'encerrado', ${ts(t.scheduled_at)}, ${ts(t.started_at)}, ${ts(t.finished_at)}, ${q(JSON.stringify(t.config))}::jsonb, ${t.clock_level}, false, 0, ${ts(t.created_at)});`);
  const ents = rows.entries.filter(e => e.tournament_id === t.id);
  L(`  insert into public.tournament_entries (id, tournament_id, club_id, player_id, name, created_at, eliminated_at, position) values`);
  L(ents.map(e => `    (${q(e.id)}, ${q(t.id)}, v_club, ${q(e.player_id)}, ${q(e.name)}, ${ts(e.created_at)}, ${e.eliminated_at ? ts(e.eliminated_at) : 'null'}, ${e.position ?? 'null'})`).join(',\n') + ';');
  const mvs = rows.movements.filter(m => m.tournament_id === t.id);
  L(`  insert into public.tournament_movements (id, tournament_id, club_id, entry_id, kind, label, amount, to_prize, chips, payment_method, created_at) values`);
  L(mvs.map(m => `    (${q(m.id)}, ${q(t.id)}, v_club, ${q(m.entry_id)}, ${q(m.kind)}, ${q(m.label)}, ${m.amount}, ${m.to_prize}, ${m.chips}, ${q(m.payment_method)}, ${ts(m.created_at)})`).join(',\n') + ';');
}

L(``);
L(`  -- Fechamentos de caixa (esperado calculado pelo próprio sistema)`);
for (const c of chunk(rows.closings, 10)) {
  L(`  insert into public.cash_closings (id, club_id, night, opening_cash, expected_cash, counted_cash, summary, note, closed_by_name, created_at) values`);
  L(c.map(x => `    (${q(x.id)}, v_club, ${q(x.night)}, ${x.opening_cash}, ${x.expected_cash}, ${x.counted_cash}, ${q(JSON.stringify(x.summary))}::jsonb, ${q(x.note)}, ${q(x.closed_by_name)}, ${ts(x.created_at)})`).join(',\n') + ';');
}

L(``);
L(`  -- Noite de hoje, para gravar ao vivo: mesa aberta e torneio com inscritos`);
L(`  insert into public.tables (id, club_id, name, status, created_at) values (${q(live.table.id)}, v_club, ${q(live.table.name)}, 'active', ${ago(100)});`);
L(`  insert into public.table_players (id, club_id, table_id, player_id, name, created_at) values`);
L(live.tps.map(tp => `    (${q(tp.id)}, v_club, ${q(live.table.id)}, ${q(tp.player_id)}, ${q(tp.name)}, ${ago(tp.ago)})`).join(',\n') + ';');
L(`  insert into public.transactions (id, club_id, table_id, player_id, type, amount, description, created_at) values`);
L(live.txs.sort((a, b) => b.ago - a.ago).map(x => `    (${q(x.id)}, v_club, ${q(live.table.id)}, ${q(x.player_id)}, ${q(x.type)}, ${x.amount}, ${q(x.description)}, ${ago(x.ago)})`).join(',\n') + ';');
L(`  insert into public.tournaments (id, club_id, name, status, scheduled_at, config) values`);
L(`    (${q(live.tour.id)}, v_club, ${q(live.tour.name)}, 'agendado', ((now() at time zone 'America/Sao_Paulo')::date + time '20:30') at time zone 'America/Sao_Paulo', ${q(JSON.stringify(live.tour.config))}::jsonb);`);
L(`  insert into public.tournament_entries (id, tournament_id, club_id, player_id, name, created_at) values`);
L(live.ents.map(e => `    (${q(e.id)}, ${q(live.tour.id)}, v_club, ${q(e.player_id)}, ${q(e.name)}, ${ago(e.ago)})`).join(',\n') + ';');
L(`  insert into public.tournament_movements (id, tournament_id, club_id, entry_id, kind, label, amount, to_prize, chips, payment_method, created_at) values`);
L(live.mvs.map(m => `    (${q(m.id)}, ${q(live.tour.id)}, v_club, ${q(m.entry_id)}, ${q(m.kind)}, ${q(m.label)}, ${m.amount}, ${m.to_prize}, ${m.chips}, ${q(m.payment_method)}, ${ago(m.ago)})`).join(',\n') + ';');

L(``);
L(`  -- O histórico da mesa registra "jogador entrou" com a hora da gravação; usa a hora em que ele entrou`);
L(`  update public.table_events e set created_at = tp.created_at`);
L(`    from public.table_players tp`);
L(`    where e.club_id = v_club and e.event_type = 'jogador_entrou' and e.ref_id = tp.id;`);

const body = lines.join('\n');
const totals = {
  jogadores: players.length, noites: nights.length, mesas: rows.tables.length + 1, lancamentos: rows.txs.length + live.txs.length,
  torneios: rows.tournaments.length + 1, fechamentos: rows.closings.length,
  fiadoEmAberto: [...saldo.values()].filter(v => v > 0).length, fiadoTotal: [...saldo.values()].reduce((a, b) => a + Math.max(0, b), 0)
};

const guard = `  -- Proteção: só roda no clube de demonstração, e só se ele estiver vazio
  if not exists (select 1 from public.clubs where id = v_club and name = ${q(DEMO_CLUB_NAME)}) then
    raise exception 'Clube de demonstração não encontrado (id % / nome ${DEMO_CLUB_NAME}). Nada foi feito.', v_club;
  end if;
  if exists (select 1 from public.tables where club_id = v_club)
     or exists (select 1 from public.players where club_id = v_club)
     or exists (select 1 from public.tournaments where club_id = v_club) then
    raise exception 'O clube de demonstração já tem dados. Rode antes o clube_demonstracao_remover.sql. Nada foi feito.';
  end if;`;

const header = (titulo, extra) => `-- ${titulo}
-- Clube: ${DEMO_CLUB_NAME} (${DEMO_CLUB_ID}). Dados 100% fictícios.
-- Gerado por scripts/demo/gerar-clube-demo.mjs para o dia ${hojeBRT} (horário de Brasília).
-- Conteúdo: ${totals.jogadores} jogadores, ${totals.noites} noites (terça, quinta e sábado), ${totals.mesas} mesas,
--           ${totals.lancamentos} lançamentos, ${totals.torneios} torneios, ${totals.fechamentos} fechamentos de caixa,
--           ${totals.fiadoEmAberto} jogadores com fiado em aberto, e a noite de hoje pronta para gravar.
-- Não toca em nenhum outro clube: tudo usa v_club, e a proteção abaixo confere id e nome.
${extra}
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'clube_demonstracao_aplicar.sql'), `${header('APLICAR: preenche o clube de demonstração', '-- Rode depois da simulação dar certo.')}
do $$
declare
  v_club constant uuid := ${q(DEMO_CLUB_ID)};
begin
${guard}

${body}

  raise notice 'Clube de demonstração preenchido.';
end
$$;
`);

writeFileSync(resolve(OUT, 'clube_demonstracao_simulacao.sql'), `${header('SIMULAÇÃO: aplica, confere e desfaz (nada é gravado)', '-- O resultado esperado é um ERRO que começa com "SIMULACAO (nada foi gravado)" e traz as contagens.')}
do $$
declare
  v_club constant uuid := ${q(DEMO_CLUB_ID)};
  v_msg text;
  v_saldo numeric;
  v_ruins int;
begin
${guard}

${body}

  -- Conferências
  select count(*) into v_ruins from public.cash_closings where club_id = v_club and abs(difference) > 10;
  if v_ruins > 0 then raise exception 'Conferência falhou: fechamento com diferença inesperada.'; end if;
  select coalesce(sum(saldo), 0) into v_saldo from public.fiado_saldos where club_id = v_club and saldo > 0;
  if v_saldo <> ${totals.fiadoTotal} then raise exception 'Conferência falhou: fiado em aberto % (esperado ${totals.fiadoTotal}).', v_saldo; end if;
  if exists (select 1 from public.fiado_saldos where club_id = v_club and saldo < 0) then
    raise exception 'Conferência falhou: saldo de fiado negativo.';
  end if;
  if (select count(*) from public.tables where club_id = v_club and status = 'active') <> 1 then
    raise exception 'Conferência falhou: deveria haver só a mesa de hoje aberta.';
  end if;

  select format('jogadores %s | mesas %s | lançamentos %s | torneios %s | fechamentos %s | fiado em aberto R$ %s | eventos de mesa %s',
    (select count(*) from public.players where club_id = v_club),
    (select count(*) from public.tables where club_id = v_club),
    (select count(*) from public.transactions where club_id = v_club),
    (select count(*) from public.tournaments where club_id = v_club),
    (select count(*) from public.cash_closings where club_id = v_club),
    v_saldo,
    (select count(*) from public.table_events where club_id = v_club))
  into v_msg;
  raise exception 'SIMULACAO (nada foi gravado): tudo certo. %', v_msg;
end
$$;
`);

writeFileSync(resolve(OUT, 'clube_demonstracao_remover.sql'), `-- REMOVER (rollback): apaga todos os dados do clube de demonstração, para refazer do zero.
-- Clube: ${DEMO_CLUB_NAME} (${DEMO_CLUB_ID}). Mantém o clube, o login demo e a configuração.
-- Não toca em nenhum outro clube: tudo filtra por v_club, e a proteção confere id e nome.
-- Para refazer: rode este arquivo e depois o clube_demonstracao_aplicar.sql (gerado de novo para o dia).
do $$
declare
  v_club constant uuid := ${q(DEMO_CLUB_ID)};
begin
  if not exists (select 1 from public.clubs where id = v_club and name = ${q(DEMO_CLUB_NAME)}) then
    raise exception 'Clube de demonstração não encontrado. Nada foi feito.';
  end if;

  delete from public.debt_settlements where club_id = v_club;
  delete from public.cash_closings where club_id = v_club;
  delete from public.tournaments where club_id = v_club;   -- leva inscritos e movimentos (cascade)
  delete from public.tables where club_id = v_club;        -- leva jogadores da mesa, lançamentos e histórico (cascade)
  delete from public.players where club_id = v_club;
  delete from public.transactions_audit where club_id = v_club;  -- registros de "apagado" gerados pela própria limpeza
  delete from public.table_events where club_id = v_club;

  raise notice 'Dados do clube de demonstração removidos.';
end
$$;
`);

console.log(JSON.stringify(totals));
console.log(closingsLog.slice(-3).join('\n'));
