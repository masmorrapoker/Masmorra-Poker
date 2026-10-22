import { defaultConfig, type MovementRow } from './tournament';
import type { TvPayload } from '../services/tournamentService';

/**
 * Torneio de demonstração para a página de vendas (/demo): roda inteiro no
 * aparelho, sem banco. O nível sobe em menos de um minuto e, a cada poucos
 * segundos, acontece um rebuy, add-on ou eliminação, com aviso e som.
 */

const NAMES = [
  'Bruno', 'Rafael', 'Thiago', 'Diego', 'Lucas', 'Gustavo', 'Marcelo', 'Felipe', 'André', 'Rodrigo',
  'Leandro', 'Fábio', 'Vinícius', 'Eduardo', 'Paulo', 'Henrique', 'Caio', 'Leonardo', 'Matheus', 'Daniel',
  'Ricardo', 'Alexandre', 'Gabriel', 'Renato', 'Fernando', 'Júlio', 'Sérgio', 'Igor', 'Murilo', 'Otávio',
  'Samuel', 'Vítor', 'Jonas', 'Arthur'
];

export function createDemo(): () => TvPayload {
  const cfg = defaultConfig();
  cfg.gtd = 5000;
  cfg.extras = [{ id: 'cl', label: 'Chip leader no intervalo', amount: 300 }];
  cfg.notice = 'Demonstração · os avisos e sons são simulados';

  const start = Date.now();
  const entries = NAMES.map((name, i) => ({
    id: `e${i}`,
    name,
    eliminated_at: i >= 24 ? new Date(start - (34 - i) * 60000).toISOString() : null,
    position: i >= 24 ? 34 - (i - 24) : null
  }));
  const movements: MovementRow[] = [
    ...entries.map((e, i) => ({
      id: `b${i}`, entry_id: e.id, kind: 'buyin' as const, label: 'Buy-in', amount: 120, to_prize: 90, chips: 15000,
      created_at: new Date(start - 3600000).toISOString()
    })),
    ...Array.from({ length: 14 }, (_, i) => ({
      id: `r${i}`, entry_id: `e${(i * 3) % 24}`, kind: 'rebuy' as const, label: 'Rebuy simples', amount: 90, to_prize: 90, chips: 15000,
      created_at: new Date(start - 1800000).toISOString()
    }))
  ];

  // Nível 6 terminando em 40 s: logo de cara a TV mostra a subida de blind.
  const clock = { clock_level: 5, clock_running: true, clock_ends_at: new Date(start + 40000).toISOString(), clock_remaining: null as number | null };
  let seq = 0;
  let lastEvent = start;

  const alive = () => entries.filter(e => !e.eliminated_at);

  function event(now: number) {
    if (now - lastEvent < 7000) return;
    lastEvent = now;
    seq++;
    const living = alive();
    const pick = living[Math.floor(Math.random() * living.length)];
    if (!pick) return;
    const roll = seq % 3;
    if (roll === 1 && living.length > 4) {
      pick.eliminated_at = new Date(now).toISOString();
      pick.position = living.length;
      return;
    }
    const isAddon = roll === 2;
    const opt = isAddon ? cfg.addons[seq % cfg.addons.length] : cfg.rebuys[seq % cfg.rebuys.length];
    movements.push({
      id: `d${seq}`,
      entry_id: pick.id,
      kind: isAddon ? 'addon' : 'rebuy',
      label: opt.label,
      amount: opt.price,
      to_prize: opt.toPrize,
      chips: opt.chips,
      created_at: new Date(now).toISOString()
    });
  }

  return () => {
    const now = Date.now();
    event(now);
    return {
      now: new Date(now).toISOString(),
      club: { name: 'Seu Clube de Poker', logo_url: null },
      tournament: {
        id: 'demo',
        name: 'Torneio de domingo · 5K garantidos',
        status: 'em_andamento',
        config: cfg,
        ...clock,
        started_at: new Date(start - 3600000).toISOString(),
        scheduled_at: null
      },
      entries: entries.map(e => ({ ...e })),
      movements: [...movements]
    };
  };
}
