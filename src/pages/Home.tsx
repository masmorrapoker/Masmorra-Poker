import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu, MessageCircle, Play, Volume2, X } from 'lucide-react';
import { FONT_CSS, buildSlides, renderAt, totalDuration, loadFonts, W as VW, H as VH } from '../lib/wrappedVideo';
import type { Retrospective } from '../lib/retrospective';
import { sounds, unlockAudio } from '../lib/tournamentSounds';

/**
 * Página de vendas. Identidade Masmorra: noite escura, luz azul do escudo,
 * o produto de verdade em cena (relógio da TV ao vivo, sons, retrospectiva).
 * Só mostra o que o sistema faz. Contato comercial pelo WhatsApp.
 */

const WHATSAPP = '5551998811587';
const wa = (text: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
const WA_DEFAULT = wa('Olá! Quero testar o Masmorra Manager no meu clube de poker.');
const PRICE = 99;
const TRIAL_DAYS = 14;
const DISPLAY_FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=Inter:wght@400;500;600;700&display=swap';

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useInView<T extends Element>(margin = '0px') {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => { setVisible(e.isIntersecting); if (e.isIntersecting) setSeen(true); }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return { ref, seen, visible };
}

/* ───────────────────────── Hero ───────────────────────── */

/** Ficha de poker em CSS (face com o escudo da Masmorra). */
function Chip({ color, size, style, stack = 1 }: { color: 'blue' | 'gold' | 'ice' | 'red'; size: number; style?: CSSProperties; stack?: number }) {
  return (
    <div className={`mm-chip-wrap`} style={style} aria-hidden="true">
      <div className={`mm-chip mm-chip-${color}`} style={{ '--s': `${size}px`, '--n': stack } as CSSProperties}>
        <img src="/logo.png?v=2" alt="" />
      </div>
    </div>
  );
}

/** Poeira iluminada pela luz da mesa. */
function Dust() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduceMotion()) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, on = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const ps = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, v: Math.random() * 0.00025 + 0.00006, a: Math.random() * Math.PI * 2 }));
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); } });
    io.observe(cv);
    function tick(t: number) {
      if (!on || !ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.y -= p.v * 16;
        p.x += Math.sin(t / 3000 + p.a) * 0.00012;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        // mais brilho no cone de luz (centro)
        const cone = Math.max(0, 1 - Math.abs(p.x - 0.5) * 2.4);
        const alpha = (0.12 + cone * 0.55) * (0.6 + 0.4 * Math.sin(t / 700 + p.a));
        ctx.beginPath();
        ctx.fillStyle = `rgba(170,200,255,${alpha.toFixed(3)})`;
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="mm-dust" aria-hidden="true" />;
}

/** A TV do clube com o relógio de verdade (/demo) rodando dentro. */
function HeroTV() {
  const screen = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const el = screen.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / 1600);
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit); };
  }, []);
  return (
    <a className={`mm-tv ${loaded ? 'is-on' : ''}`} href="/demo" target="_blank" rel="noreferrer" aria-label="Abrir o relógio de torneio em tela cheia">
      <div className="mm-tv-screen" ref={screen}>
        <iframe
          src="/demo?embed=1"
          title="Relógio de torneio ao vivo"
          tabIndex={-1}
          onLoad={() => window.setTimeout(() => setLoaded(true), 700)}
          style={{ transform: `scale(${scale})` }}
        />
        <div className="mm-tv-power" aria-hidden="true" />
        <div className="mm-tv-glare" aria-hidden="true" />
      </div>
      <span className="mm-tv-badge"><span className="mm-live" /> Ao vivo, simulação</span>
    </a>
  );
}

/* ───────────────────────── Celular ───────────────────────── */

function Phone({ children, time = '21:47', className = '' }: { children: ReactNode; time?: string; className?: string }) {
  return (
    <div className={`mm-phone ${className}`}>
      <div className="mm-phone-screen">
        <div className="mm-phone-status"><span>{time}</span><i className="mm-notch" /><span className="mm-sig"><b /><b /><b /><b /></span></div>
        {children}
      </div>
    </div>
  );
}

const Av = ({ n, c }: { n: string; c?: string }) => <span className="ap-av" style={c ? { background: c } : undefined}>{n[0]}</span>;

function ScreenMesa() {
  const rows: [string, string, string][] = [['Rafael', 'R$ 300', '#2b55d9'], ['Diego', 'R$ 200', '#7a4cd6'], ['Thiago', 'R$ 500', '#c2410c'], ['Lucas', 'R$ 200', '#0f8a6a'], ['Bruno', 'R$ 400', '#a8326e'], ['Felipe', 'R$ 300', '#4b5d8a']];
  return (
    <div className="ap">
      <div className="ap-head"><small>Seu Clube</small><b>Mesa 1 · Cash 2/4</b><span className="ap-pill ap-green">Aberta</span></div>
      <div className="ap-list">
        {rows.map(([n, v, c], i) => (
          <div className="ap-row" key={n} style={{ animationDelay: `${i * 90}ms` }}>
            <Av n={n} c={c} /><div><b>{n}</b><small>buy-in {i < 2 ? '20:0' + (i * 4 + 2) : '20:' + (10 + i * 7)}</small></div><em>{v}</em>
          </div>
        ))}
      </div>
      <div className="ap-foot"><div><small>Na mesa</small><b>R$ 1.900</b></div><span className="ap-btn">+ Lançar</span></div>
    </div>
  );
}

function ScreenLancar() {
  return (
    <div className="ap ap-dim">
      <div className="ap-head"><small>Seu Clube</small><b>Mesa 1 · Cash 2/4</b><span className="ap-pill ap-green">Aberta</span></div>
      <div className="ap-sheet">
        <i className="ap-grab" />
        <b className="ap-sheet-title">Lançar para Felipe</b>
        <div className="ap-seg"><span>Buy-in</span><span className="on">Rebuy</span><span>Consumo</span><span>Saída</span></div>
        <div className="ap-quick"><span>R$ 100</span><span className="on">R$ 200</span><span>R$ 300</span></div>
        <div className="ap-note">Acerta na saída. Nada para pagar agora.</div>
        <span className="ap-btn ap-btn-full">Lançar rebuy de R$ 200</span>
      </div>
      <div className="ap-toast">Rebuy de Felipe lançado às 22:14</div>
    </div>
  );
}

function ScreenTorneio() {
  return (
    <div className="ap">
      <div className="ap-head"><small>Torneio de quinta</small><b>3K garantidos</b><span className="ap-pill ap-blue">Nível 7</span></div>
      <div className="ap-clock"><span>14:32</span><small>500 / 1.000 · ante 1.000</small><i><b style={{ width: '58%' }} /></i></div>
      <div className="ap-stats"><div><b>18</b><small>de 27</small></div><div><b>R$ 3.240</b><small>prêmio</small></div><div><b>11</b><small>rebuys</small></div></div>
      <div className="ap-actions"><span>Rebuy</span><span>Add-on</span><span className="ap-danger">Eliminar</span></div>
      <div className="ap-feed">
        <div><b>Eliminado</b> Caio · 19º</div>
        <div><b>Add-on</b> Rafael · +50K</div>
        <div><b>Rebuy</b> Igor · +15K</div>
      </div>
    </div>
  );
}

function ScreenAcerto() {
  return (
    <div className="ap">
      <div className="ap-head"><small>Acerto de saída</small><b>Thiago</b><span className="ap-pill ap-blue">03:10</span></div>
      <div className="ap-card">
        <div className="ap-line"><span>Buy-ins e rebuys</span><b>R$ 500</b></div>
        <div className="ap-line"><span>Consumo do bar</span><b>R$ 46</b></div>
        <div className="ap-line"><span>Saiu com fichas</span><b>R$ 1.120</b></div>
        <div className="ap-line ap-total"><span>Resultado</span><b className="ap-pos">+ R$ 574</b></div>
      </div>
      <div className="ap-card ap-fiado"><div><b>Abater fiado antigo</b><small>Ele devia R$ 150</small></div><i className="ap-toggle on" /></div>
      <div className="ap-result"><small>O clube paga</small><b>R$ 424</b><span>no pix</span></div>
      <span className="ap-btn ap-btn-full">Confirmar acerto</span>
    </div>
  );
}

function ScreenCaixa() {
  return (
    <div className="ap">
      <div className="ap-head"><small>Fechamento da noite</small><b>Quinta, 23 de outubro</b><span className="ap-pill ap-green">Fechado</span></div>
      <div className="ap-bateu"><b>Bateu.</b><small>Esperado R$ 6.480 · contado R$ 6.480</small></div>
      <div className="ap-card">
        <div className="ap-line"><span>Dinheiro</span><b>R$ 2.100</b></div>
        <div className="ap-line"><span>Pix</span><b>R$ 3.980</b></div>
        <div className="ap-line"><span>Cartão</span><b>R$ 400</b></div>
        <div className="ap-line"><span>Ficou no fiado</span><b className="ap-warn">R$ 350</b></div>
      </div>
      <span className="ap-btn ap-btn-full ap-btn-ghost">Copiar relatório para o grupo</span>
    </div>
  );
}

const STORY = [
  { time: '20:00', title: 'Abre a mesa', text: 'Mesa aberta em dois toques. Cada buy-in entra na hora, com o nome de quem lançou.', screen: <ScreenMesa /> },
  { time: '22:14', title: 'Rebuy sem papelzinho', text: 'Rebuy, consumo do bar e troca de mesa vão para a conta do jogador. Ninguém paga na hora: tudo acerta na saída.', screen: <ScreenLancar /> },
  { time: '23:30', title: 'Torneio rodando junto', text: 'O organizador lança rebuy, add-on e eliminação pelo celular. A TV do clube mostra na hora, com som.', screen: <ScreenTorneio /> },
  { time: '03:10', title: 'Acerto na saída', text: 'O sistema mostra quanto o jogador paga ou recebe, já descontando buy-in e consumo. Se ele tem fiado, você abate ali mesmo.', screen: <ScreenAcerto /> },
  { time: '05:00', title: 'Caixa fechado', text: 'Esperado contra contado, separado por dinheiro, pix e cartão. Bateu, faltou ou sobrou, e quanto. Relatório pronto para o grupo.', screen: <ScreenCaixa /> }
];

function Story() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i)); });
    }, { rootMargin: '-48% 0px -48% 0px' });
    refs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="mm-story">
      <ol className="mm-steps">
        {STORY.map((s, i) => (
          <li key={s.time} data-i={i} ref={el => { refs.current[i] = el; }} className={i === active ? 'is-active' : ''}>
            <time>{s.time}</time>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <div className="mm-step-phone"><Phone time={s.time}>{s.screen}</Phone></div>
          </li>
        ))}
      </ol>
      <div className="mm-story-stage" aria-hidden="true">
        <div className="mm-story-sticky">
          <div className="mm-story-glow" />
          <Phone time={STORY[active].time}>
            {STORY.map((s, i) => <div key={s.time} className={`mm-screen ${i === active ? 'is-on' : ''}`}>{s.screen}</div>)}
          </Phone>
          <div className="mm-story-dots">{STORY.map((s, i) => <i key={s.time} className={i === active ? 'on' : ''} />)}</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Torneio: sons ───────────────────────── */

type Pad = { id: string; label: string; play: () => void; tag: string; name: string; detail: string; tone: string; ms: number };
const PADS: Pad[] = [
  { id: 'level', label: 'Subiu a blind', play: () => sounds.levelUp(), tag: 'Nível 8', name: '600 / 1.200', detail: 'ante 1.200', tone: 'level', ms: 2600 },
  { id: 'out', label: 'Eliminação', play: () => sounds.applause(), tag: 'Eliminado', name: 'Diego', detail: '14º lugar', tone: 'out', ms: 3200 },
  { id: 'rebuy', label: 'Rebuy', play: () => sounds.rebuy(), tag: 'Rebuy duplo', name: 'Rafael', detail: '+30K fichas', tone: 'rebuy', ms: 1400 },
  { id: 'addon', label: 'Add-on', play: () => sounds.addon(), tag: 'Add-on', name: 'Thiago', detail: '+120K fichas', tone: 'addon', ms: 1800 }
];

function SoundBoard() {
  const [cur, setCur] = useState<Pad | null>(null);
  const [n, setN] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  function hit(p: Pad) {
    unlockAudio();
    p.play();
    setCur(p);
    setN(x => x + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCur(null), p.ms + 1200);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="mm-board">
      <div className={`mm-board-screen ${cur ? `t-${cur.tone}` : ''}`}>
        {cur ? (
          <div key={n} className="mm-board-msg">
            <span className="mm-board-tag">{cur.tag}</span>
            <b>{cur.name}</b>
            <small>{cur.detail}</small>
          </div>
        ) : (
          <div className="mm-board-idle"><Volume2 size={22} /> Aperte um botão e escute o que toca na TV</div>
        )}
        <div className={`mm-eq ${cur ? 'is-on' : ''}`} aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 73) % 500}ms` }} />)}</div>
      </div>
      <div className="mm-pads">
        {PADS.map(p => (
          <button key={p.id} type="button" className={`mm-pad pad-${p.tone} ${cur?.id === p.id ? 'is-hit' : ''}`} onClick={() => hit(p)}>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Retrospectiva ───────────────────────── */

const RETRO: Retrospective = {
  month: '2026-09', monthName: 'setembro', nights: 18, players: 64, minutes: 21840,
  mostPresent: { name: 'Rafael', value: 18 },
  mostTime: { name: 'Thiago', value: 5240 },
  bestNight: { name: 'Diego', value: 2350, detail: '12 de setembro.' },
  topWinner: { name: 'Lucas', value: 4870 },
  longestTable: { name: 'Mesa 1', value: 760 },
  barKing: { name: 'Bruno', value: 42 },
  topProduct: { name: 'Cerveja', value: 310 },
  debuts: ['André', 'Caio', 'Igor', 'Murilo'],
  top5: [{ name: 'Lucas', value: 4870 }, { name: 'Diego', value: 3120 }, { name: 'Rafael', value: 2650 }, { name: 'Bruno', value: 1980 }, { name: 'Caio', value: 1240 }]
};

function RetroPhone() {
  const { ref, visible } = useInView<HTMLDivElement>('100px');
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let raf = 0, alive = true;
    const opts = { clubName: 'Seu Clube de Poker', logo: null, showMoney: true, disabled: [] as string[] };
    const slides = buildSlides(RETRO, opts);
    const total = totalDuration(slides);
    const start = performance.now();
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    loadFonts().then(() => {
      if (!alive) return;
      setReady(true);
      const still = reduceMotion();
      const draw = (t: number) => {
        if (!alive) return;
        ctx.setTransform(cv.width / VW, 0, 0, cv.height / VH, 0, 0);
        renderAt(ctx, slides, RETRO, opts, still ? 2400 : (t - start) % total);
        if (!still) raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [visible]);
  return (
    <div ref={ref} className="mm-retro-phone">
      <Phone time="09:00">
        <canvas ref={canvas} width={540} height={960} className={`mm-retro-canvas ${ready ? 'is-ready' : ''}`} aria-label="Exemplo da retrospectiva do mês em vídeo" />
      </Phone>
    </div>
  );
}

/* ───────────────────────── Painéis do dono ───────────────────────── */

function Spot({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`mm-spot ${className}`}
      onPointerMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────── Portão final ───────────────────────── */

function Gate() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduceMotion()) { el.style.setProperty('--p', '1'); return; }
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height * 0.35)));
        el.style.setProperty('--p', p.toFixed(3));
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return (
    <section className="mm-gate" ref={ref}>
      <div className="mm-gate-door" aria-hidden="true"><i /></div>
      <div className="mm-gate-copy">
        <h2>Abra as portas do seu clube.</h2>
        <p>{TRIAL_DAYS} dias grátis, sem cartão. A gente cria o seu clube e te ajuda a rodar a primeira noite.</p>
        <div className="mm-ctas mm-center">
          <a className="mm-btn mm-btn-primary" href={WA_DEFAULT} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Começar o teste grátis</a>
          <a className="mm-btn mm-btn-ghost" href="/demo" target="_blank" rel="noreferrer"><Play size={18} /> Ver o relógio em tela cheia</a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Página ───────────────────────── */

const TICKER: [string, string][] = [
  ['♠', 'Relógio na TV'], ['♥', 'Som de blind e palmas'], ['♦', 'Acerto na saída'], ['♣', 'Fiado com extrato'],
  ['♠', 'Fechamento de caixa'], ['♥', 'Ranking'], ['♦', 'Retrospectiva em vídeo'], ['♣', 'Equipe com permissões']
];

const FAQ = [
  { q: 'Precisa instalar alguma coisa?', a: 'Não. Funciona no navegador do celular, do computador e da TV. Cada pessoa da equipe entra com o próprio e-mail e senha.' },
  { q: 'Como coloco o relógio na TV do clube?', a: 'Cada torneio tem um link próprio para a TV, que abre sem login. Abra no navegador da smart TV, num notebook ligado à TV ou num TV box. O organizador comanda tudo pelo celular.' },
  { q: 'Funciona para cash game e torneio ao mesmo tempo?', a: 'Sim. Mesas de cash e torneios rodam juntos, e tudo cai no mesmo fechamento de caixa da noite.' },
  { q: 'Dá para personalizar o torneio do meu jeito?', a: 'Sim: valor e taxa do buy-in, quantos tipos de rebuy e add-on quiser, bônus de fichas, garantido, prêmios extras, premiação e cada nível de blind. O próximo torneio já começa com a estrutura do anterior.' },
  { q: 'Meu funcionário vai ver quanto o clube fatura?', a: 'Não, se você não quiser. O papel "caixa" opera mesas, fiado e caixa, mas não vê rake, receita nem relatórios de faturamento.' },
  { q: 'E se o jogador pagar depois?', a: 'No acerto de saída você marca "fica devendo" (ou quanto pagou agora) e o valor vai para o fiado do jogador, com extrato e botão de cobrança pelo WhatsApp.' },
  { q: 'Meus dados ficam seguros?', a: 'A conexão é criptografada e cada clube só enxerga os próprios dados, com regras aplicadas no banco. Lançamentos removidos ficam registrados no histórico.' },
  { q: 'Como funciona o teste grátis?', a: `Você chama no WhatsApp, a gente cria o seu clube e manda o link de acesso. São ${TRIAL_DAYS} dias para usar de verdade, sem cartão.` }
];

export default function Home() {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const hero = useRef<HTMLElement>(null);

  useEffect(() => {
    for (const href of [DISPLAY_FONTS, FONT_CSS]) {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        document.head.appendChild(l);
      }
    }
    const prev = document.body.style.background;
    document.body.style.background = '#04060c';
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { document.body.style.background = prev; window.removeEventListener('scroll', onScroll); };
  }, []);

  // Parallax leve do hero com o mouse
  useEffect(() => {
    const el = hero.current;
    if (!el || reduceMotion() || !window.matchMedia?.('(pointer: fine)').matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty('--my', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener('pointermove', move);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); };
  }, []);

  return (
    <div className="mm">
      <HomeStyle />

      <header className={`mm-nav ${scrolled || menu ? 'is-solid' : ''}`}>
        <a href="#topo" className="mm-brand">
          <img src="/logo.png?v=2" alt="" />
          <span>Masmorra Manager</span>
        </a>
        <nav className={`mm-links ${menu ? 'is-open' : ''}`} aria-label="Seções">
          <a href="#noite" onClick={() => setMenu(false)}>Como funciona</a>
          <a href="#torneios" onClick={() => setMenu(false)}>Torneios</a>
          <a href="#preco" onClick={() => setMenu(false)}>Preço</a>
          <a href="#duvidas" onClick={() => setMenu(false)}>Dúvidas</a>
          <Link to="/login" className="mm-login" onClick={() => setMenu(false)}>Entrar</Link>
        </nav>
        <a className="mm-btn mm-btn-primary mm-nav-cta" href={WA_DEFAULT} target="_blank" rel="noreferrer">Testar grátis</a>
        <button type="button" className="mm-burger" aria-label={menu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menu} onClick={() => setMenu(v => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <main id="topo">
        {/* HERO */}
        <section className="mm-hero" ref={hero}>
          <div className="mm-lamp" aria-hidden="true" />
          <Dust />
          <div className="mm-hero-copy">
            <span className="mm-pill"><img src="/logo.png?v=2" alt="" /> Nascido dentro do Masmorra Poker</span>
            <h1>Seu clube de poker, <span className="mm-h1-glow">blindado.</span></h1>
            <p className="mm-lead">
              Cash game, torneio com relógio na TV, fiado e fechamento de caixa num sistema só.
              Nada se perde no caderno, e a TV do clube vira atração da noite.
            </p>
            <div className="mm-ctas mm-center">
              <a className="mm-btn mm-btn-primary mm-btn-lg" href={WA_DEFAULT} target="_blank" rel="noreferrer"><MessageCircle size={19} /> Testar {TRIAL_DAYS} dias grátis</a>
              <a className="mm-btn mm-btn-ghost mm-btn-lg" href="/demo" target="_blank" rel="noreferrer"><Play size={18} /> Relógio em tela cheia</a>
            </div>
            <p className="mm-fine">Sem cartão e sem instalar nada.</p>
          </div>

          <div className="mm-stage">
            <div className="mm-crest" aria-hidden="true" />
            <Chip color="blue" size={92} stack={6} style={{ left: '-7%', top: '20%', '--d': 1.4, '--r': '-18deg', '--b': '0s' } as CSSProperties} />
            <Chip color="gold" size={70} stack={3} style={{ left: '-5%', bottom: '-7%', '--d': 2, '--r': '24deg', '--b': '-2s' } as CSSProperties} />
            <Chip color="ice" size={58} style={{ right: '-3%', top: '8%', '--d': 0.8, '--r': '40deg', '--b': '-4s' } as CSSProperties} />
            <Chip color="red" size={84} stack={4} style={{ right: '-6%', bottom: '-3%', '--d': 1.7, '--r': '-8deg', '--b': '-1s' } as CSSProperties} />
            <Chip color="blue" size={44} style={{ left: '20%', top: '-6%', '--d': 0.4, '--r': '60deg', '--b': '-3s', filter: 'blur(2px)', opacity: 0.6 } as CSSProperties} />
            <HeroTV />
            <div className="mm-floor" aria-hidden="true" />
          </div>
        </section>

        {/* LETREIRO */}
        <div className="mm-ticker" aria-label="Funções">
          <div className="mm-ticker-track">
            {[0, 1].map(k => (
              <div key={k} className="mm-ticker-row" aria-hidden={k === 1}>
                {TICKER.map(([suit, t], i) => (
                  <span key={i}><i className={suit === '♥' || suit === '♦' ? 'red' : ''}>{suit}</i>{t}</span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* A NOITE */}
        <section className="mm-section" id="noite">
          <div className="mm-head">
            <h2>Uma noite inteira, do primeiro buy‑in ao caixa fechado.</h2>
            <p>É assim que o clube roda com o Masmorra Manager. Tudo pelo celular de quem está no balcão.</p>
          </div>
          <Story />
        </section>

        {/* TORNEIOS */}
        <section className="mm-section mm-tour" id="torneios">
          <div className="mm-head">
            <h2>Torneio com cara de evento grande.</h2>
            <p>O relógio vai para a TV por um link. Cada subida de blind, rebuy e eliminação aparece na tela com som, e a sala inteira acompanha.</p>
          </div>
          <div className="mm-tour-grid">
            <div className="mm-poster">
              <div className="mm-poster-top"><img src="/logo.png?v=2" alt="" /><span>Seu Clube de Poker</span></div>
              <div className="mm-poster-gtd"><b>8K</b><span>garantidos</span></div>
              <dl>
                <div><dt>Buy-in</dt><dd>R$ 90 + 30 <em>15K</em></dd></div>
                <div><dt>Rebuy</dt><dd>R$ 90 <em>15K</em> · R$ 150 <em>30K</em></dd></div>
                <div><dt>Add-on</dt><dd>R$ 100 <em>50K</em> · R$ 200 <em>120K</em></dd></div>
                <div><dt>Bônus</dt><dd>Pontualidade e confirmação <em>5K</em></dd></div>
                <div><dt>Blinds</dt><dd>25 min, depois 15 min</dd></div>
                <div><dt>Extra</dt><dd>Chip leader no intervalo <em>R$ 500</em></dd></div>
              </dl>
              <p className="mm-poster-note">Monte do jeito do seu clube: quantas entradas, rebuys, add-ons e bônus quiser, garantido, premiação e cada nível de blind.</p>
            </div>
            <SoundBoard />
          </div>
        </section>

        {/* JOGADORES */}
        <section className="mm-section mm-retro">
          <div className="mm-retro-grid">
            <RetroPhone />
            <div className="mm-retro-copy">
              <h2>Todo mês, um vídeo que o grupo inteiro vai compartilhar.</h2>
              <p>Quem mais apareceu, quem passou mais tempo na mesa, a maior noite, as estreias e o top 5. O sistema monta o vídeo vertical com o nome do seu clube, pronto para o WhatsApp e o Instagram.</p>
              <ul className="mm-ticks">
                <li>Só celebra feitos. Ninguém aparece por ter perdido.</li>
                <li>Ranking por noite, mês ou ano.</li>
                <li>Ficha de cada jogador: presença, tempo de mesa, resultado e fiado.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* DONO */}
        <section className="mm-section">
          <div className="mm-head">
            <h2>O dono vê tudo. O caixa vê o que precisa.</h2>
            <p>Cada pessoa da equipe entra com o próprio login, e cada lançamento fica com nome, data e hora.</p>
          </div>
          <div className="mm-bento">
            <Spot className="b-caixa">
              <h3>Caixa da noite</h3>
              <p>Esperado contra contado, por forma de pagamento.</p>
              <div className="mm-bars">
                {[['Dinheiro', 34, 'R$ 2.100'], ['Pix', 62, 'R$ 3.980'], ['Cartão', 9, 'R$ 400']].map(([l, w, v]) => (
                  <div key={l as string}><span>{l}</span><i><b style={{ width: `${w}%` }} /></i><em>{v}</em></div>
                ))}
              </div>
              <div className="mm-verdict"><b>Bateu.</b><span>Diferença R$ 0</span></div>
            </Spot>
            <Spot className="b-fiado">
              <h3>Fiado</h3>
              <p>Quem deve, quanto e desde quando.</p>
              <div className="mm-fiado">
                <div><Av n="Igor" c="#4b5d8a" /><span>Igor</span><em>R$ 220</em></div>
                <div><Av n="Murilo" c="#0f8a6a" /><span>Murilo</span><em>R$ 130</em></div>
                <div><Av n="Caio" c="#7a4cd6" /><span>Caio</span><em className="paid">pagou</em></div>
              </div>
            </Spot>
            <Spot className="b-equipe">
              <h3>Equipe</h3>
              <p>Três papéis, cada um com o seu limite.</p>
              <div className="mm-roles"><span className="r-dono">Dono</span><span className="r-ger">Gerente</span><span className="r-cx">Caixa</span></div>
              <small className="mm-muted">O caixa não vê faturamento nem relatórios.</small>
            </Spot>
            <Spot className="b-hist">
              <h3>Histórico</h3>
              <p>Nada some sem deixar rastro.</p>
              <div className="mm-log">
                <div><time>22:14</time> Rebuy Felipe R$ 200 <small>por Ana</small></div>
                <div className="del"><time>22:31</time> Consumo Diego R$ 12 <small>apagado por Ana</small></div>
                <div><time>23:02</time> Buy-in Caio R$ 300 <small>por João</small></div>
              </div>
            </Spot>
            <Spot className="b-rank">
              <h3>Ranking</h3>
              <p>Quem está no topo do mês.</p>
              <div className="mm-rank">
                {[['Lucas', 100], ['Diego', 64], ['Rafael', 54], ['Bruno', 41]].map(([n, w], i) => (
                  <div key={n as string}><b>{i + 1}</b><span>{n}</span><i><em style={{ width: `${w}%` }} /></i></div>
                ))}
              </div>
            </Spot>
          </div>
        </section>

        {/* ORIGEM */}
        <section className="mm-origin">
          <img src="/logo.png?v=2" alt="" className="mm-origin-logo" />
          <div>
            <h2>Nasceu numa mesa de verdade.</h2>
            <p>
              O Masmorra Manager foi criado dentro do Masmorra Poker, no Rio Grande do Sul, para resolver o que o caderno e a planilha
              não resolviam: fiado esquecido, caixa que não fecha e torneio no cronômetro do celular. Cada função roda numa noite de
              clube antes de chegar ao seu.
            </p>
          </div>
        </section>

        {/* PREÇO */}
        <section className="mm-section" id="preco">
          <div className="mm-price">
            <div className="mm-price-in">
              <h2>Um plano. Tudo dentro.</h2>
              <div className="mm-price-value"><small>R$</small><b>{PRICE}</b><span>/mês</span></div>
              <p className="mm-muted">{TRIAL_DAYS} dias grátis para testar numa noite de verdade. Sem cartão.</p>
              <ul className="mm-ticks">
                <li>Mesas de cash, jogadores e lançamentos sem limite</li>
                <li>Torneios com relógio na TV e sons</li>
                <li>Acerto na saída, fiado e fechamento de caixa</li>
                <li>Ranking, ficha do jogador e retrospectiva em vídeo</li>
                <li>Equipe com papéis de dono, gerente e caixa</li>
                <li>Implantação e suporte pelo WhatsApp</li>
              </ul>
              <a className="mm-btn mm-btn-primary mm-btn-lg mm-btn-block" href={WA_DEFAULT} target="_blank" rel="noreferrer"><MessageCircle size={19} /> Quero testar grátis</a>
            </div>
          </div>
        </section>

        {/* DÚVIDAS */}
        <section className="mm-section mm-faq" id="duvidas">
          <div className="mm-faq-head">
            <h2>Dúvidas</h2>
            <p>Não achou a sua? <a href={WA_DEFAULT} target="_blank" rel="noreferrer">Pergunte no WhatsApp.</a></p>
          </div>
          <div className="mm-faq-list">
            {FAQ.map((f, i) => (
              <div key={f.q} className={`mm-faq-item ${open === i ? 'is-open' : ''}`}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span>{f.q}</span><ChevronDown size={20} />
                </button>
                <div className="mm-faq-a"><p>{f.a}</p></div>
              </div>
            ))}
          </div>
        </section>

        <Gate />
      </main>

      <footer className="mm-footer">
        <div className="mm-brand"><img src="/logo.png?v=2" alt="" /><span>Masmorra Manager</span></div>
        <nav>
          <Link to="/termos">Termos de uso</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/login">Entrar</Link>
        </nav>
      </footer>

      <a className="mm-wa" href={WA_DEFAULT} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp"><MessageCircle size={26} /></a>
    </div>
  );
}

function HomeStyle() {
  return <style>{CSS}</style>;
}

const CSS = `
.mm { --bg:#04060c; --stone:#0a0f1d; --stone2:#0e1528; --line:rgba(130,160,255,.13); --blue:#2563ff; --blue2:#6b97ff; --gold:#f3c04d;
  --ice:#eef2fb; --fog:#8e99b5; --red:#ff5d6c; --green:#3ddc97;
  --disp:'Archivo', 'Arial Narrow', system-ui, sans-serif; --text:Inter, system-ui, -apple-system, sans-serif;
  --mx:0; --my:0;
  background:var(--bg); color:var(--ice); font-family:var(--text); overflow-x:clip; min-height:100vh; }
.mm *, .mm *::before, .mm *::after { box-sizing:border-box; }
.mm h1, .mm h2, .mm h3, .mm p, .mm ul, .mm ol, .mm dl, .mm dd { margin:0; padding:0; }
.mm a { color:inherit; text-decoration:none; }
.mm :focus-visible { outline:2px solid var(--blue2); outline-offset:3px; border-radius:8px; }
.mm h2 { font-family:var(--disp); font-weight:800; font-stretch:118%; letter-spacing:-.025em; line-height:1.02; font-size:clamp(32px, 4.6vw, 60px); text-wrap:balance;
  background:linear-gradient(180deg, #fff 45%, #b4c3e8); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.mm h3 { background:none; -webkit-text-fill-color:currentColor; margin:0; }
.mm-muted { color:var(--fog); }

/* botões */
.mm-btn { display:inline-flex; align-items:center; justify-content:center; gap:10px; min-height:46px; padding:0 20px; border-radius:14px; font-weight:700; font-size:15px; transition:transform .2s, box-shadow .2s, background .2s; white-space:nowrap; }
.mm-btn-lg { min-height:56px; padding:0 26px; font-size:16px; border-radius:16px; }
.mm-btn-block { width:100%; }
.mm-btn-primary { background:linear-gradient(180deg, #3a76ff, #1f55f0); color:#fff; box-shadow:0 0 0 1px rgba(150,180,255,.35) inset, 0 14px 40px -8px rgba(37,99,255,.7); }
.mm-btn-primary:hover { transform:translateY(-2px); box-shadow:0 0 0 1px rgba(170,195,255,.5) inset, 0 20px 50px -8px rgba(37,99,255,.9); }
.mm-btn-ghost { background:rgba(255,255,255,.04); border:1px solid rgba(200,215,255,.18); color:var(--ice); backdrop-filter:blur(8px); }
.mm-btn-ghost:hover { background:rgba(255,255,255,.08); }
.mm-ctas { display:flex; flex-wrap:wrap; gap:12px; margin-top:32px; }
.mm-center { justify-content:center; }

/* nav */
.mm-nav { position:fixed; inset:0 0 auto 0; z-index:50; height:72px; display:flex; align-items:center; gap:24px; padding:0 max(20px, calc((100vw - 1200px)/2)); transition:background .3s, border-color .3s; border-bottom:1px solid transparent; }
.mm-nav.is-solid { background:rgba(5,8,16,.78); backdrop-filter:blur(16px) saturate(140%); border-color:var(--line); }
.mm-brand { display:flex; align-items:center; gap:10px; font-weight:800; font-size:17px; letter-spacing:-.01em; white-space:nowrap; }
.mm-brand img { width:34px; height:34px; object-fit:contain; filter:drop-shadow(0 0 12px rgba(37,99,255,.6)); }
.mm-links { display:flex; gap:28px; margin-left:auto; font-size:15px; color:#b6c0d8; }
.mm-links a:hover { color:#fff; }
.mm-login { color:#fff !important; font-weight:600; }
.mm-nav-cta { min-height:42px; }
.mm-burger { display:none; margin-left:auto; background:none; border:0; color:var(--ice); width:46px; height:46px; align-items:center; justify-content:center; cursor:pointer; }

/* hero */
.mm-hero { position:relative; padding:118px 20px 40px; text-align:center; isolation:isolate; }
.mm-lamp { position:absolute; inset:0; z-index:-2; pointer-events:none;
  background:
    radial-gradient(60% 50% at 50% 62%, rgba(37,99,255,.28), transparent 70%),
    conic-gradient(from 180deg at 50% -8%, transparent 0 158deg, rgba(120,160,255,.13) 172deg, rgba(150,185,255,.2) 180deg, rgba(120,160,255,.13) 188deg, transparent 202deg 360deg),
    radial-gradient(120% 70% at 50% 0%, #0b1430 0%, var(--bg) 60%); }
.mm-dust { position:absolute; inset:0; width:100%; height:100%; z-index:-1; pointer-events:none; }
.mm-hero-copy { max-width:900px; margin:0 auto; animation:mm-rise .9s cubic-bezier(.2,.8,.2,1) both; }
.mm-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 14px 6px 8px; border-radius:99px; border:1px solid rgba(110,150,255,.3); background:rgba(37,99,255,.1); color:#c5d4ff; font-size:14px; font-weight:600; }
.mm-pill img { width:22px; height:22px; }
.mm-hero h1 { margin-top:26px; font-family:var(--disp); font-weight:900; font-stretch:122%; letter-spacing:-.035em; line-height:.95; font-size:clamp(44px, 7.4vw, 96px); text-wrap:balance;
  background:linear-gradient(180deg, #fff 30%, #a9bbe6); -webkit-background-clip:text; background-clip:text; color:transparent; }
.mm-h1-glow { display:inline-block; background:linear-gradient(180deg, #9fbcff, #2f6bff 85%); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 0 28px rgba(37,99,255,.55)); }
.mm-lead { margin:24px auto 0 !important; max-width:620px; font-size:clamp(17px, 1.6vw, 20px); line-height:1.6; color:#c2cce2; }
.mm-fine { margin-top:14px !important; font-size:14px; color:var(--fog); }

.mm-stage { position:relative; width:min(1060px, 100%); margin:52px auto 0; perspective:1600px; }
.mm-crest { position:absolute; left:50%; top:-14%; width:min(760px, 90%); aspect-ratio:1; transform:translateX(-50%); z-index:-1; opacity:.07;
  background:url(/logo.png?v=2) center/contain no-repeat; filter:grayscale(1) brightness(3); mask:radial-gradient(closest-side, #000 40%, transparent); -webkit-mask:radial-gradient(closest-side, #000 40%, transparent); }
.mm-tv { position:relative; display:block; margin:0 auto; width:100%; padding:14px; border-radius:22px;
  background:linear-gradient(180deg, #1a2236, #090d18 60%); box-shadow:0 0 0 1px rgba(150,175,255,.14) inset, 0 50px 120px -30px rgba(0,0,0,.9), 0 0 0 1px #000;
  transform:rotateX(calc(4deg - var(--my) * 2.5deg)) rotateY(calc(var(--mx) * 3.5deg)); transform-style:preserve-3d; transition:transform .5s cubic-bezier(.2,.8,.2,1);
  animation:mm-tv-in 1.4s .25s cubic-bezier(.2,.8,.2,1) both; -webkit-box-reflect:below 18px linear-gradient(transparent 72%, rgba(255,255,255,.1)); }
.mm-tv::after { content:''; position:absolute; inset:-2px; border-radius:24px; z-index:-1; opacity:0; transition:opacity 1.6s; box-shadow:0 0 120px 20px rgba(37,99,255,.35), 0 0 40px rgba(37,99,255,.4); }
.mm-tv.is-on::after { opacity:1; }
.mm-tv-screen { position:relative; aspect-ratio:16/9; border-radius:10px; overflow:hidden; background:#000; }
.mm-tv-screen iframe { position:absolute; left:0; top:0; width:1600px; height:900px; border:0; transform-origin:0 0; pointer-events:none; }
.mm-tv-power { position:absolute; inset:0; background:#000; pointer-events:none; }
.mm-tv-power::before { content:''; position:absolute; left:0; right:0; top:50%; height:2px; margin-top:-1px; background:#dfe8ff; box-shadow:0 0 30px 6px rgba(150,190,255,.9); transform:scaleX(0); opacity:0; }
.mm-tv.is-on .mm-tv-power { animation:mm-power-bg 1s ease-out forwards; }
.mm-tv.is-on .mm-tv-power::before { animation:mm-power-line 1s ease-out forwards; }
.mm-tv-glare { position:absolute; inset:0; pointer-events:none; background:linear-gradient(115deg, rgba(255,255,255,.07) 0%, transparent 32%, transparent 70%, rgba(255,255,255,.03)); }
.mm-tv-badge { position:absolute; left:50%; bottom:-46px; transform:translateX(-50%); display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--fog); white-space:nowrap; }
.mm-live { width:8px; height:8px; border-radius:50%; background:#ff4b5c; box-shadow:0 0 0 0 rgba(255,75,92,.6); animation:mm-pulse 1.6s infinite; }
.mm-floor { position:absolute; left:-10%; right:-10%; bottom:-120px; height:200px; z-index:-1; background:radial-gradient(50% 40% at 50% 20%, rgba(37,99,255,.25), transparent 70%); filter:blur(10px); }

.mm-chip-wrap { position:absolute; z-index:2; pointer-events:none; transform:translate3d(calc(var(--mx) * var(--d) * 26px), calc(var(--my) * var(--d) * 18px), 0); transition:transform .6s cubic-bezier(.2,.8,.2,1); }
.mm-chip { --c:#2563ff; --e:#173fb8; width:var(--s); height:var(--s); border-radius:50%; position:relative; transform:rotateX(62deg) rotateZ(var(--r)); animation:mm-bob 6s ease-in-out infinite; animation-delay:var(--b);
  background:
    radial-gradient(circle, var(--c) 0 47%, rgba(255,255,255,.9) 47.5% 49.5%, var(--c) 50% 62%, transparent 62.5%),
    repeating-conic-gradient(from 8deg, #f4f6ff 0 14deg, var(--c) 14deg 45deg);
  box-shadow: inset 0 0 0 calc(var(--s) * .035) rgba(0,0,0,.2),
    0 3px 0 var(--e), 0 6px 0 #dfe4f3, 0 9px 0 var(--e), 0 12px 0 var(--c), 0 15px 0 var(--e),
    0 30px 40px rgba(0,0,0,.6); }
.mm-chip img { position:absolute; inset:28%; width:44%; height:44%; object-fit:contain; filter:brightness(0) invert(1); opacity:.9; }
.mm-chip-blue { --c:#2563ff; --e:#1438a8; }
.mm-chip-gold { --c:#e8b23a; --e:#9b6f12; }
.mm-chip-ice { --c:#dfe6f7; --e:#8b97b5; }
.mm-chip-ice img { filter:none; }
.mm-chip-red { --c:#e23b4e; --e:#8f1d2c; }

/* letreiro */
.mm-ticker { margin-top:110px; border-block:1px solid var(--line); background:linear-gradient(180deg, rgba(14,21,40,.7), rgba(4,6,12,.7)); overflow:hidden; padding:22px 0; }
.mm-ticker-track { display:flex; width:max-content; animation:mm-marquee 46s linear infinite; }
.mm-ticker-row { display:flex; }
.mm-ticker span { display:inline-flex; align-items:center; gap:22px; padding-right:44px; font-family:var(--disp); font-weight:800; font-stretch:120%; font-size:clamp(24px, 3.4vw, 44px); letter-spacing:-.02em; white-space:nowrap; color:transparent; -webkit-text-stroke:1px rgba(190,205,240,.55); }
.mm-ticker span:nth-child(odd) { color:#e6ecfa; -webkit-text-stroke:0; }
.mm-ticker i { font-style:normal; color:var(--blue2); -webkit-text-stroke:0; font-size:.8em; }
.mm-ticker i.red { color:var(--red); }

/* seções */
.mm-section { padding:120px 20px 0; max-width:1200px; margin:0 auto; scroll-margin-top:60px; }
.mm-head { max-width:760px; }
.mm-head p { margin-top:18px !important; font-size:18px; line-height:1.6; color:var(--fog); max-width:60ch; }

/* história da noite */
.mm-story { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:24px; }
.mm-steps { list-style:none; }
.mm-steps li { min-height:52vh; display:flex; flex-direction:column; justify-content:center; padding-left:28px; border-left:2px solid var(--line); transition:border-color .4s, opacity .4s; opacity:.35; }
.mm-steps li.is-active { opacity:1; border-color:var(--blue); }
.mm-steps time { font-family:var(--disp); font-stretch:110%; font-weight:800; font-size:20px; color:var(--blue2); font-variant-numeric:tabular-nums; }
.mm-steps h3 { margin-top:8px; font-family:var(--disp); font-weight:800; font-stretch:115%; letter-spacing:-.02em; font-size:clamp(28px, 3vw, 40px); line-height:1.05; }
.mm-steps p { margin-top:14px; font-size:18px; line-height:1.6; color:#b9c3da; max-width:44ch; }
.mm-step-phone { display:none; }
.mm-step-phone .ap { height:calc(100% - 34px); }
.mm-story-stage { position:relative; }
.mm-story-sticky { position:sticky; top:calc(50vh - 320px); height:640px; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.mm-story-glow { position:absolute; inset:10% 0; border-radius:50%; background:radial-gradient(closest-side, rgba(37,99,255,.32), transparent); filter:blur(30px); z-index:-1; }
.mm-story-dots { display:flex; gap:8px; margin-top:22px; }
.mm-story-dots i { width:8px; height:8px; border-radius:9px; background:rgba(150,170,220,.25); transition:all .3s; }
.mm-story-dots i.on { width:26px; background:var(--blue); }
.mm-screen { position:absolute; inset:34px 0 0; opacity:0; transform:translateY(14px) scale(.98); transition:opacity .45s, transform .45s; pointer-events:none; }
.mm-screen.is-on { opacity:1; transform:none; }

/* celular */
.mm-phone { width:292px; height:600px; border-radius:48px; padding:10px; background:linear-gradient(145deg, #2a3350, #0b0f1c 40%, #1b2236); box-shadow:0 0 0 1px rgba(160,180,255,.2) inset, 0 40px 90px -20px rgba(0,0,0,.9), 0 0 0 1px #000; flex:none; }
.mm-phone-screen { position:relative; height:100%; border-radius:39px; overflow:hidden; background:#070b16; }
.mm-phone-status { position:relative; z-index:3; height:34px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; font-size:12px; font-weight:700; color:#dfe6f7; }
.mm-notch { position:absolute; left:50%; top:8px; width:84px; height:22px; margin-left:-42px; border-radius:20px; background:#000; }
.mm-sig { display:flex; gap:2px; align-items:flex-end; }
.mm-sig b { width:3px; background:#dfe6f7; border-radius:1px; }
.mm-sig b:nth-child(1) { height:4px } .mm-sig b:nth-child(2) { height:6px } .mm-sig b:nth-child(3) { height:8px } .mm-sig b:nth-child(4) { height:10px }

/* telas do app (mock) */
.ap { position:relative; height:100%; padding:6px 14px 16px; display:flex; flex-direction:column; gap:10px; font-size:12px; color:#dfe6f7; text-align:left; }
.ap-head { display:grid; grid-template-columns:1fr auto; align-items:end; padding:4px 2px 6px; }
.ap-head small { grid-column:1; color:#7f8bab; font-size:11px; }
.ap-head b { grid-column:1; font-size:16px; letter-spacing:-.01em; }
.ap-pill { grid-column:2; grid-row:1 / span 2; padding:4px 9px; border-radius:99px; font-size:10.5px; font-weight:700; }
.ap-green { background:rgba(61,220,151,.14); color:#62e3aa; }
.ap-blue { background:rgba(37,99,255,.18); color:#9cb9ff; }
.ap-list { display:flex; flex-direction:column; gap:6px; }
.ap-row { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; padding:9px 10px; border-radius:12px; background:#0d1426; border:1px solid rgba(130,160,255,.08); }
.mm-screen.is-on .ap-row, .mm-step-phone .ap-row { animation:mm-row .5s both; }
.ap-row b { display:block; font-size:13px; }
.ap-row small { color:#7f8bab; font-size:10.5px; }
.ap-row em { font-style:normal; font-weight:700; font-variant-numeric:tabular-nums; }
.ap-av { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; font-weight:800; font-size:12px; background:#2b55d9; color:#fff; flex:none; }
.ap-foot { margin-top:auto; display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:14px; background:#0f1830; border:1px solid rgba(130,160,255,.12); }
.ap-foot small { display:block; color:#7f8bab; font-size:10.5px; }
.ap-foot b { font-size:17px; }
.ap-btn { display:inline-flex; align-items:center; justify-content:center; padding:9px 14px; border-radius:11px; background:#2563ff; color:#fff; font-weight:700; font-size:12.5px; box-shadow:0 8px 20px -6px rgba(37,99,255,.8); }
.ap-btn-full { width:100%; padding:12px; margin-top:auto; }
.ap-btn-ghost { background:#121b33; box-shadow:none; border:1px solid rgba(130,160,255,.2); }
.ap-dim > .ap-head { opacity:.35; }
.ap-sheet { position:absolute; left:0; right:0; bottom:0; padding:12px 16px 20px; border-radius:22px 22px 0 0; background:#0f1730; border-top:1px solid rgba(130,160,255,.2); display:flex; flex-direction:column; gap:12px; box-shadow:0 -30px 60px rgba(0,0,0,.6); }
.mm-screen.is-on .ap-sheet, .mm-step-phone .ap-sheet { animation:mm-sheet .55s cubic-bezier(.2,.8,.2,1) both; }
.ap-grab { width:38px; height:4px; border-radius:4px; background:rgba(200,210,240,.3); align-self:center; }
.ap-sheet-title { font-size:16px; }
.ap-seg { display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; padding:4px; border-radius:11px; background:#0a1022; }
.ap-seg span { text-align:center; padding:7px 0; border-radius:8px; color:#8a96b6; font-weight:600; font-size:11px; }
.ap-seg .on { background:#2563ff; color:#fff; }
.ap-quick { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; }
.ap-quick span { text-align:center; padding:12px 0; border-radius:11px; border:1px solid rgba(130,160,255,.18); font-weight:700; }
.ap-quick .on { border-color:#2563ff; background:rgba(37,99,255,.16); color:#bcd0ff; }
.ap-note { color:#8a96b6; font-size:11.5px; }
.ap-toast { position:absolute; left:14px; right:14px; top:44px; padding:10px 12px; border-radius:12px; background:rgba(61,220,151,.14); border:1px solid rgba(61,220,151,.35); color:#7deab8; font-weight:600; }
.mm-screen.is-on .ap-toast, .mm-step-phone .ap-toast { animation:mm-toast 3.2s 1s both; }
.ap-clock { padding:14px; border-radius:16px; background:radial-gradient(120% 120% at 50% 0%, #142454, #0b1226); border:1px solid rgba(130,160,255,.18); text-align:center; }
.ap-clock span { display:block; font-family:'Big Shoulders Display', var(--disp); font-weight:900; font-size:54px; line-height:1; color:#f3c04d; letter-spacing:.01em; }
.ap-clock small { color:#b6c3e6; }
.ap-clock i { display:block; height:4px; margin-top:10px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; }
.ap-clock i b { display:block; height:100%; background:#2563ff; }
.ap-stats { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; }
.ap-stats div { padding:9px 6px; border-radius:11px; background:#0d1426; text-align:center; }
.ap-stats b { display:block; font-size:14px; }
.ap-stats small { color:#7f8bab; font-size:10px; }
.ap-actions { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; }
.ap-actions span { text-align:center; padding:10px 0; border-radius:11px; background:#2563ff; color:#fff; font-weight:700; }
.ap-actions .ap-danger { background:rgba(255,93,108,.15); color:#ff8794; border:1px solid rgba(255,93,108,.35); }
.ap-feed { display:flex; flex-direction:column; gap:6px; }
.ap-feed div { padding:8px 10px; border-radius:10px; background:#0d1426; color:#b6c0d8; }
.ap-feed b { color:#fff; margin-right:4px; }
.ap-card { padding:10px 12px; border-radius:14px; background:#0d1426; border:1px solid rgba(130,160,255,.1); }
.ap-line { display:flex; justify-content:space-between; padding:6px 0; color:#aab5d0; }
.ap-line b { color:#fff; font-variant-numeric:tabular-nums; }
.ap-total { border-top:1px solid rgba(130,160,255,.12); margin-top:4px; padding-top:9px; }
.ap-pos { color:#62e3aa !important; }
.ap-warn { color:#f3c04d !important; }
.ap-fiado { display:flex; align-items:center; justify-content:space-between; }
.ap-fiado small { display:block; color:#7f8bab; }
.ap-toggle { width:38px; height:22px; border-radius:22px; background:#2563ff; position:relative; }
.ap-toggle::after { content:''; position:absolute; right:3px; top:3px; width:16px; height:16px; border-radius:50%; background:#fff; }
.ap-result { text-align:center; padding:12px; border-radius:16px; background:linear-gradient(180deg, rgba(61,220,151,.12), rgba(61,220,151,.03)); border:1px solid rgba(61,220,151,.25); }
.ap-result small, .ap-result span { color:#8fdcb9; }
.ap-result b { display:block; font-size:30px; letter-spacing:-.02em; color:#fff; }
.ap-bateu { text-align:center; padding:18px 10px; border-radius:16px; background:radial-gradient(100% 120% at 50% 0%, rgba(61,220,151,.2), rgba(61,220,151,.02)); border:1px solid rgba(61,220,151,.3); }
.ap-bateu b { display:block; font-family:var(--disp); font-weight:900; font-stretch:120%; font-size:40px; color:#7deab8; }
.ap-bateu small { color:#9fb0cf; }

/* torneio */
.mm-tour-grid { display:grid; grid-template-columns:1fr 1.1fr; gap:28px; margin-top:48px; align-items:stretch; }
.mm-poster { position:relative; padding:30px; border-radius:26px; overflow:hidden; border:1px solid rgba(243,192,77,.25);
  background:radial-gradient(90% 60% at 50% 0%, rgba(243,192,77,.16), transparent 70%), linear-gradient(180deg, #121a30, #070b16); }
.mm-poster::before { content:'♠'; position:absolute; right:-30px; top:-60px; font-size:260px; line-height:1; color:rgba(243,192,77,.06); }
.mm-poster-top { display:flex; align-items:center; gap:10px; color:#d9c38e; font-weight:700; }
.mm-poster-top img { width:28px; height:28px; }
.mm-poster-gtd { display:flex; align-items:baseline; gap:14px; margin:18px 0 22px; }
.mm-poster-gtd b { font-family:'Big Shoulders Display', var(--disp); font-weight:900; font-size:clamp(84px, 10vw, 130px); line-height:.85; color:var(--gold); text-shadow:0 0 40px rgba(243,192,77,.35); }
.mm-poster-gtd span { font-family:var(--disp); font-weight:800; font-stretch:120%; font-size:26px; color:#f5e3b5; }
.mm-poster dl { display:flex; flex-direction:column; }
.mm-poster dl div { display:grid; grid-template-columns:92px 1fr; gap:12px; padding:11px 0; border-top:1px solid rgba(243,192,77,.14); }
.mm-poster dt { color:#c7b07a; font-size:14px; font-weight:600; }
.mm-poster dd { font-size:15px; font-weight:600; }
.mm-poster em { font-style:normal; color:var(--gold); font-weight:800; margin-left:4px; }
.mm-poster-note { margin-top:18px !important; color:var(--fog); font-size:14.5px; line-height:1.55; }

.mm-board { display:flex; flex-direction:column; gap:14px; padding:18px; border-radius:26px; background:linear-gradient(180deg, #0f1730, #080c18); border:1px solid var(--line); }
.mm-board-screen { position:relative; flex:1; min-height:250px; border-radius:18px; overflow:hidden; display:grid; place-items:center; text-align:center; padding:24px;
  background:radial-gradient(80% 90% at 50% 10%, #13224a, #060a16); border:1px solid rgba(130,160,255,.15); transition:background .4s; }
.mm-board-screen.t-out { background:radial-gradient(80% 90% at 50% 10%, #4a1420, #0d0609); }
.mm-board-screen.t-rebuy, .mm-board-screen.t-addon { background:radial-gradient(80% 90% at 50% 10%, #1b3a8a, #060a16); }
.mm-board-screen.t-level { background:radial-gradient(80% 90% at 50% 10%, #4a3a10, #0a0805); }
.mm-board-idle { display:flex; align-items:center; gap:10px; color:var(--fog); font-size:16px; }
.mm-board-msg { animation:mm-pop .5s cubic-bezier(.2,1.4,.4,1) both; }
.mm-board-tag { display:inline-block; padding:5px 12px; border-radius:99px; background:rgba(255,255,255,.1); font-weight:700; font-size:14px; }
.mm-board-msg b { display:block; margin-top:10px; font-family:'Big Shoulders Display', var(--disp); font-weight:900; font-size:clamp(54px, 7vw, 86px); line-height:.95; }
.t-level .mm-board-msg b { color:var(--gold); }
.mm-board-msg small { display:block; margin-top:6px; color:#c9d3ea; font-size:17px; }
.mm-eq { position:absolute; left:0; right:0; bottom:0; height:46px; display:flex; align-items:flex-end; justify-content:center; gap:5px; padding:0 20px 10px; opacity:.25; transition:opacity .3s; }
.mm-eq.is-on { opacity:.9; }
.mm-eq i { width:6px; height:6px; border-radius:3px; background:var(--blue2); }
.mm-eq.is-on i { animation:mm-eq .5s ease-in-out infinite alternate; }
.mm-pads { display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; }
.mm-pad { position:relative; min-height:68px; border-radius:16px; border:1px solid rgba(150,175,255,.18); background:linear-gradient(180deg, #162142, #0d1428); color:#fff; font:700 16px var(--text); cursor:pointer;
  box-shadow:0 6px 0 #050913, 0 14px 30px -10px rgba(0,0,0,.8); transition:transform .08s, box-shadow .08s, border-color .2s; }
.mm-pad:hover { border-color:rgba(150,175,255,.4); }
.mm-pad:active, .mm-pad.is-hit { transform:translateY(4px); box-shadow:0 2px 0 #050913, 0 6px 16px -8px rgba(0,0,0,.8); }
.mm-pad.is-hit { border-color:var(--blue); }
.pad-out.is-hit { border-color:var(--red); }
.pad-level.is-hit { border-color:var(--gold); }

/* retrospectiva */
.mm-retro-grid { display:grid; grid-template-columns:auto 1fr; gap:72px; align-items:center; }
.mm-retro-phone { position:relative; display:flex; justify-content:center; }
.mm-retro-phone::before { content:''; position:absolute; inset:-10% -30%; background:radial-gradient(closest-side, rgba(217,174,69,.18), transparent); z-index:-1; }
.mm-retro-phone .mm-phone-status { position:absolute; left:0; right:0; }
.mm-retro-phone .mm-phone-screen { background:#07120e; }
.mm-retro-canvas { position:absolute; left:0; top:34px; width:100%; aspect-ratio:9/16; display:block; background:#07120e; opacity:0; transition:opacity .8s; }
.mm-retro-canvas.is-ready { opacity:1; }
.mm-retro-copy p { margin-top:18px !important; font-size:18px; line-height:1.6; color:var(--fog); max-width:52ch; }
.mm-ticks { list-style:none; margin-top:24px !important; display:flex; flex-direction:column; gap:12px; }
.mm-ticks li { position:relative; padding-left:30px; font-size:16px; line-height:1.5; color:#d5dcec; }
.mm-ticks li::before { content:''; position:absolute; left:0; top:4px; width:18px; height:18px; border-radius:6px; background:rgba(37,99,255,.18) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239cb9ff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center/12px no-repeat; }

/* painéis */
.mm-bento { display:grid; grid-template-columns:repeat(6, 1fr); gap:16px; margin-top:48px; }
.mm-spot { position:relative; padding:24px; border-radius:22px; background:linear-gradient(180deg, rgba(17,25,47,.9), rgba(8,12,24,.9)); border:1px solid var(--line); overflow:hidden; isolation:isolate; }
.mm-spot::before { content:''; position:absolute; inset:0; z-index:-1; opacity:0; transition:opacity .3s; background:radial-gradient(380px circle at var(--x, 50%) var(--y, 0%), rgba(37,99,255,.18), transparent 60%); }
.mm-spot::after { content:''; position:absolute; inset:0; border-radius:inherit; padding:1px; opacity:0; transition:opacity .3s; pointer-events:none;
  background:radial-gradient(260px circle at var(--x, 50%) var(--y, 0%), rgba(120,160,255,.7), transparent 60%);
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; }
.mm-spot:hover::before, .mm-spot:hover::after { opacity:1; }
.mm-spot h3 { font-family:var(--disp); font-weight:800; font-stretch:115%; font-size:24px; letter-spacing:-.015em; }
.mm-spot > p { margin-top:6px; color:var(--fog); font-size:15px; }
.b-caixa { grid-column:span 4; } .b-fiado { grid-column:span 2; } .b-equipe { grid-column:span 2; } .b-hist { grid-column:span 2; } .b-rank { grid-column:span 2; }
.mm-bars { margin-top:22px; display:flex; flex-direction:column; gap:12px; }
.mm-bars div { display:grid; grid-template-columns:80px 1fr 90px; align-items:center; gap:12px; font-size:14px; color:#b9c3da; }
.mm-bars i { height:10px; border-radius:10px; background:rgba(255,255,255,.06); overflow:hidden; }
.mm-bars b { display:block; height:100%; border-radius:10px; background:linear-gradient(90deg, #1f55f0, #6b97ff); }
.mm-bars em { font-style:normal; text-align:right; font-weight:700; color:#fff; font-variant-numeric:tabular-nums; }
.mm-verdict { display:flex; align-items:baseline; gap:14px; margin-top:20px; }
.mm-verdict b { font-family:var(--disp); font-weight:900; font-stretch:120%; font-size:44px; color:#7deab8; line-height:1; }
.mm-verdict span { color:var(--fog); }
.mm-fiado { margin-top:18px; display:flex; flex-direction:column; gap:8px; }
.mm-fiado div { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; background:rgba(255,255,255,.03); font-size:14px; }
.mm-fiado em { font-style:normal; font-weight:700; color:var(--gold); }
.mm-fiado em.paid { color:#62e3aa; }
.mm-roles { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0 14px; }
.mm-roles span { padding:8px 14px; border-radius:99px; font-weight:700; font-size:14px; border:1px solid; }
.r-dono { color:var(--gold); border-color:rgba(243,192,77,.4); background:rgba(243,192,77,.08); }
.r-ger { color:#9cb9ff; border-color:rgba(37,99,255,.45); background:rgba(37,99,255,.1); }
.r-cx { color:#c9d1e4; border-color:rgba(200,210,240,.25); }
.mm-spot small.mm-muted { font-size:13.5px; line-height:1.5; display:block; }
.mm-log { margin-top:18px; display:flex; flex-direction:column; gap:8px; font-size:13.5px; }
.mm-log div { padding:8px 10px; border-radius:10px; background:rgba(255,255,255,.03); color:#d5dcec; }
.mm-log time { color:var(--blue2); font-weight:700; margin-right:6px; font-variant-numeric:tabular-nums; }
.mm-log small { display:block; color:var(--fog); font-size:12px; margin-top:2px; }
.mm-log .del { color:#8d97b0; text-decoration:line-through; text-decoration-color:rgba(255,93,108,.7); }
.mm-log .del small { text-decoration:none; color:#ff8794; }
.mm-rank { margin-top:18px; display:flex; flex-direction:column; gap:9px; }
.mm-rank div { display:grid; grid-template-columns:18px 60px 1fr; align-items:center; gap:10px; font-size:14px; }
.mm-rank b { color:var(--gold); }
.mm-rank i { height:8px; border-radius:8px; background:rgba(255,255,255,.06); overflow:hidden; }
.mm-rank em { display:block; height:100%; background:linear-gradient(90deg, #9b6f12, #f3c04d); border-radius:8px; }

/* origem */
.mm-origin { max-width:1200px; margin:120px auto 0; padding:56px 20px; display:grid; grid-template-columns:auto 1fr; gap:48px; align-items:center; position:relative; }
.mm-origin::before { content:''; position:absolute; inset:0 20px; border-radius:32px; z-index:-1; border:1px solid var(--line);
  background: radial-gradient(60% 120% at 0% 50%, rgba(37,99,255,.22), transparent 60%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 46px),
    repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 92px), #070b16; }
.mm-origin-logo { width:clamp(110px, 16vw, 190px); margin-left:32px; filter:drop-shadow(0 0 40px rgba(37,99,255,.7)); }
.mm-origin p { margin-top:18px !important; font-size:18px; line-height:1.65; color:#c2cce2; max-width:62ch; padding-right:32px; }

/* preço */
.mm-price { position:relative; max-width:560px; margin:0 auto; padding:2px; border-radius:30px; overflow:hidden; isolation:isolate; }
.mm-price::before { content:''; position:absolute; inset:-60%; z-index:-1; background:conic-gradient(from 0deg, transparent 0 55%, #2563ff 70%, #9fbcff 76%, transparent 86%); animation:mm-spin 6s linear infinite; }
.mm-price-in { padding:40px 36px; border-radius:28px; background:linear-gradient(180deg, #0f1730, #070b16); text-align:left; }
.mm-price h2 { font-size:clamp(30px, 3.6vw, 42px); }
.mm-price-value { display:flex; align-items:baseline; gap:6px; margin-top:20px; }
.mm-price-value small { font-size:22px; font-weight:700; color:var(--fog); }
.mm-price-value b { font-family:var(--disp); font-weight:900; font-stretch:115%; font-size:88px; line-height:1; letter-spacing:-.04em; }
.mm-price-value span { font-size:20px; color:var(--fog); }
.mm-price .mm-muted { margin-top:8px; }
.mm-price .mm-ticks { margin:26px 0 30px !important; }

/* dúvidas */
.mm-faq { display:grid; grid-template-columns:1fr 1.6fr; gap:48px; }
.mm-faq-head p { margin-top:14px !important; color:var(--fog); font-size:17px; }
.mm-faq-head a { color:var(--blue2); text-decoration:underline; text-underline-offset:3px; }
.mm-faq-item { border-bottom:1px solid var(--line); }
.mm-faq-item button { width:100%; display:flex; justify-content:space-between; align-items:center; gap:16px; padding:22px 0; background:none; border:0; color:var(--ice); font:600 18px var(--text); text-align:left; cursor:pointer; }
.mm-faq-item button svg { flex:none; color:var(--fog); transition:transform .3s; }
.mm-faq-item.is-open button svg { transform:rotate(180deg); color:var(--blue2); }
.mm-faq-a { display:grid; grid-template-rows:0fr; transition:grid-template-rows .35s ease; }
.mm-faq-a p { overflow:hidden; color:#b9c3da; font-size:16px; line-height:1.65; }
.mm-faq-item.is-open .mm-faq-a { grid-template-rows:1fr; }
.mm-faq-item.is-open .mm-faq-a p { padding-bottom:22px; }

/* portão */
.mm-gate { --p:0; position:relative; margin-top:140px; min-height:110vh; display:grid; place-items:center; overflow:hidden; isolation:isolate; padding:80px 20px; }
.mm-gate-door { position:absolute; left:50%; bottom:0; width:min(560px, 86vw); height:min(86vh, 760px); transform:translateX(-50%) scale(calc(.55 + var(--p) * .75)); transform-origin:50% 100%; z-index:-1;
  border-radius:999px 999px 0 0; overflow:hidden; background:#02040a; box-shadow:0 0 0 1px rgba(130,160,255,.2), 0 0 calc(var(--p) * 160px) calc(var(--p) * 30px) rgba(37,99,255,.45); }
.mm-gate-door i { position:absolute; inset:0; background:radial-gradient(70% 60% at 50% 100%, #8fb2ff, #2563ff 35%, #0b1a4a 70%, #02040a); opacity:calc(.25 + var(--p) * .75); }
.mm-gate-door::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(90deg, transparent 0 46px, rgba(0,0,0,.35) 46px 50px); opacity:calc(1 - var(--p)); }
.mm-gate-copy { text-align:center; max-width:720px; }
.mm-gate h2 { font-size:clamp(40px, 7vw, 92px); font-weight:900; font-stretch:122%; text-shadow:0 10px 40px rgba(0,0,0,.6); }
.mm-gate p { margin:20px auto 0 !important; font-size:19px; line-height:1.6; color:#dbe4fa; max-width:52ch; text-shadow:0 4px 20px rgba(0,0,0,.8); }

.mm-footer { max-width:1200px; margin:0 auto; padding:36px 20px 48px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:20px; border-top:1px solid var(--line); }
.mm-footer nav { display:flex; gap:24px; color:var(--fog); font-size:15px; }
.mm-footer nav a:hover { color:#fff; }
.mm-wa { position:fixed; right:20px; bottom:20px; z-index:60; width:60px; height:60px; border-radius:50%; display:grid; place-items:center; background:#25d366; color:#fff; box-shadow:0 12px 30px -6px rgba(37,211,102,.6); transition:transform .2s; }
.mm-wa:hover { transform:scale(1.07); }

/* animações */
@keyframes mm-rise { from { opacity:0; transform:translateY(24px); } }
@keyframes mm-tv-in { from { opacity:0; transform:translateY(80px) rotateX(24deg) scale(.94); } }
@keyframes mm-power-bg { 0% { opacity:1; } 55% { opacity:1; } 100% { opacity:0; } }
@keyframes mm-power-line { 0% { opacity:1; transform:scaleX(0); } 35% { opacity:1; transform:scaleX(1); } 60% { opacity:1; transform:scaleX(1) scaleY(260); } 100% { opacity:0; transform:scaleX(1) scaleY(260); } }
@keyframes mm-pulse { 70% { box-shadow:0 0 0 8px rgba(255,75,92,0); } 100% { box-shadow:0 0 0 0 rgba(255,75,92,0); } }
@keyframes mm-bob { 50% { translate:0 -12px; } }
@keyframes mm-marquee { to { transform:translateX(-50%); } }
@keyframes mm-row { from { opacity:0; transform:translateX(-10px); } }
@keyframes mm-sheet { from { transform:translateY(100%); } }
@keyframes mm-toast { 0% { opacity:0; transform:translateY(-10px); } 10%, 85% { opacity:1; transform:none; } 100% { opacity:0; } }
@keyframes mm-pop { from { opacity:0; transform:scale(.8); } }
@keyframes mm-eq { from { height:6px; } to { height:34px; } }
@keyframes mm-spin { to { transform:rotate(1turn); } }

/* responsivo */
@media (max-width: 960px) {
  .mm-links { display:none; position:absolute; top:72px; left:0; right:0; flex-direction:column; gap:0; padding:8px 20px 20px; background:rgba(5,8,16,.97); border-bottom:1px solid var(--line); }
  .mm-links.is-open { display:flex; }
  .mm-links a { padding:14px 0; font-size:17px; border-bottom:1px solid var(--line); }
  .mm-burger { display:inline-flex; margin-left:0; }
  .mm-nav { gap:10px; }
  .mm-nav-cta { margin-left:auto; min-height:40px; padding:0 14px; }
  .mm-story { grid-template-columns:1fr; }
  .mm-story-stage { display:none; }
  .mm-steps li { min-height:0; opacity:1; padding:28px 0 28px 20px; }
  .mm-step-phone { display:flex; justify-content:center; margin-top:24px; }
  .mm-step-phone .mm-phone { transform:scale(.92); transform-origin:top center; margin-bottom:-48px; }
  .mm-tour-grid, .mm-retro-grid, .mm-faq { grid-template-columns:1fr; }
  .mm-retro-grid { gap:40px; }
  .b-caixa, .b-fiado, .b-equipe, .b-hist, .b-rank { grid-column:span 6; }
  .mm-origin { grid-template-columns:1fr; gap:20px; padding:44px 20px; }
  .mm-origin-logo { margin-left:24px; }
  .mm-origin > div { padding:0 24px; }
  .mm-origin p { padding-right:0; }
}
@media (max-width: 560px) {
  .mm-hero { padding-top:112px; }
  .mm-brand span { font-size:15px; }
  .mm-ctas .mm-btn { width:100%; }
  .mm-stage { margin-top:48px; }
  .mm-tv { padding:6px; border-radius:12px; }
  .mm-tv-screen { border-radius:6px; }
  .mm-section { padding-top:88px; }
  .mm-ticker { margin-top:90px; }
  .mm-bars div { grid-template-columns:64px 1fr 76px; }
  .mm-price-in { padding:32px 22px; }
  .mm-poster { padding:22px; }
  .mm-poster dl div { grid-template-columns:72px 1fr; }
  .mm-gate { min-height:90vh; }
  .mm-chip-wrap { display:none; }
}
@media (max-width: 420px) {
  .mm-nav-cta { display:none; }
  .mm-burger { margin-left:auto; }
}
@media (prefers-reduced-motion: reduce) {
  .mm *, .mm *::before, .mm *::after { animation:none !important; transition:none !important; }
  .mm-tv-power { display:none; }
  .mm-screen { transition:none; }
}
`;
