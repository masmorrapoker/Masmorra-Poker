import type { Retrospective } from './retrospective';
import { formatMinutes } from './retrospective';
import { formatMoney } from '../utils';

/**
 * Vídeo vertical (1080×1920) da retrospectiva do mês, desenhado em canvas.
 * Identidade: feltro de mesa, latão de ficha e vermelho de carta.
 */

export const W = 1080;
export const H = 1920;
const M = 96; // margem lateral

const C = {
  night: '#07120E',
  felt: '#0F3B2C',
  feltLight: '#17573F',
  brass: '#D9AE45',
  bone: '#F2E8D5',
  red: '#C8322B'
};

const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const TEXT = 'Inter, system-ui, -apple-system, sans-serif';

export const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Inter:wght@500;600;700&display=swap';

export async function loadFonts(): Promise<void> {
  if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_CSS;
    document.head.appendChild(link);
    await new Promise(r => { link.onload = r; link.onerror = r; setTimeout(r, 4000); });
  }
  try {
    await Promise.all([
      document.fonts.load(`900 200px "Big Shoulders Display"`),
      document.fonts.load(`800 200px "Big Shoulders Display"`),
      document.fonts.load(`600 40px Inter`),
      document.fonts.load(`700 40px Inter`)
    ]);
  } catch {
    /* segue com as fontes do sistema */
  }
}

export async function loadLogo(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // sem isso o canvas fica "sujo" e não grava
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export interface VideoOptions {
  clubName: string;
  logo: HTMLImageElement | null;
  showMoney: boolean;
  /** ids dos quadros desligados */
  disabled: string[];
}

interface Env {
  ctx: CanvasRenderingContext2D;
  opts: VideoOptions;
  r: Retrospective;
  monthTitle: string;
}

interface Slide {
  id: string;
  label: string;
  duration: number; // ms
  suit: string;
  draw: (env: Env, p: number) => void;
}

// ---------- utilidades de animação e texto ----------

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
/** progresso local de uma janela [a, b] dentro do quadro */
const win = (p: number, a: number, b: number) => ease((p - a) / (b - a));

function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string) {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** Maior tamanho (até max) em que o texto cabe na largura, quebrando em até `lines` linhas. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, maxSize: number, minSize: number, width: number, lines = 2) {
  for (let size = maxSize; size >= minSize; size -= 4) {
    setFont(ctx, weight, size, family);
    const wrapped = wrap(ctx, text, width);
    if (wrapped.length <= lines && wrapped.every(l => ctx.measureText(l).width <= width)) return { size, lines: wrapped };
  }
  setFont(ctx, weight, minSize, family);
  return { size: minSize, lines: wrap(ctx, text, width).slice(0, lines) };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > width && line) {
      out.push(line);
      line = w;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

/** Texto que sobe e aparece (alpha + deslocamento). */
function rise(ctx: CanvasRenderingContext2D, t: number, draw: () => void, dy = 40) {
  if (t <= 0) return;
  ctx.save();
  ctx.globalAlpha *= t;
  ctx.translate(0, (1 - t) * dy);
  draw();
  ctx.restore();
}

const money = (v: number) => formatMoney(Math.round(v)).replace(',00', '');
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

// ---------- fundo e moldura ----------

let noise: HTMLCanvasElement | null = null;
function noiseLayer(): HTMLCanvasElement {
  if (noise) return noise;
  noise = document.createElement('canvas');
  noise.width = 360;
  noise.height = 640;
  const n = noise.getContext('2d')!;
  const img = n.createImageData(360, 640);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14;
  }
  n.putImageData(img, 0, 0);
  return noise;
}

function background(ctx: CanvasRenderingContext2D, suit: string, p: number, suitColor: string) {
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.35, H * 0.42, 80, W * 0.5, H * 0.5, H * 0.75);
  g.addColorStop(0, C.feltLight);
  g.addColorStop(0.45, C.felt);
  g.addColorStop(1, C.night);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(noiseLayer(), 0, 0, W, H);

  // naipe gigante e discreto, girando devagar
  ctx.save();
  ctx.translate(W * 0.82, H * 0.8);
  ctx.rotate(-0.18 + p * 0.08);
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = suitColor;
  setFont(ctx, 900, 1100, 'serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suit, 0, 0);
  ctx.restore();
}

function frame(env: Env, index: number, total: number, p: number) {
  const { ctx, opts } = env;
  // barras de progresso, como nos stories
  const gap = 10;
  const top = 64;
  const bw = (W - 2 * 48 - gap * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    const x = 48 + i * (bw + gap);
    ctx.fillStyle = 'rgba(242,232,213,0.25)';
    roundRect(ctx, x, top, bw, 7, 4);
    ctx.fill();
    const f = i < index ? 1 : i === index ? clamp(p) : 0;
    if (f > 0) {
      ctx.fillStyle = C.bone;
      roundRect(ctx, x, top, bw * f, 7, 4);
      ctx.fill();
    }
  }

  // cabeçalho
  let x = 48;
  const y = 130;
  if (opts.logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 36, y + 36, 36, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(opts.logo, x, y, 72, 72);
    ctx.restore();
    x += 92;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.bone;
  setFont(ctx, 700, 34, TEXT);
  ctx.fillText(opts.clubName, x, y + 32);
  ctx.globalAlpha = 0.7;
  setFont(ctx, 500, 30, TEXT);
  ctx.fillText(`Retrospectiva de ${env.monthTitle}`, x, y + 70);
  ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- quadro padrão de destaque ----------

interface Feat {
  label: string;
  name: string;
  value?: number;
  format?: (v: number) => string;
  caption?: string;
}

function drawFeat(env: Env, p: number, f: Feat) {
  const { ctx } = env;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const width = W - 2 * M;
  let y = 800;

  rise(ctx, win(p, 0.02, 0.16), () => {
    ctx.fillStyle = C.brass;
    setFont(ctx, 600, 46, TEXT);
    ctx.fillText(f.label, M, y);
  });
  y += 40;

  const fit = fitLines(ctx, f.name, 900, DISPLAY, 230, 96, width, f.name.length > 14 ? 3 : 2);
  const lineH = fit.size * 0.92;
  const tName = win(p, 0.1, 0.32);
  fit.lines.forEach((line, i) => {
    rise(ctx, clamp(tName * (1 + 0.25 * fit.lines.length) - i * 0.25), () => {
      ctx.fillStyle = C.bone;
      setFont(ctx, 900, fit.size, DISPLAY);
      ctx.fillText(line, M, y + lineH * (i + 1));
    }, 60);
  });
  y += lineH * fit.lines.length + 50;

  if (f.value !== undefined && f.format) {
    const tv = win(p, 0.28, 0.62);
    rise(ctx, win(p, 0.26, 0.36), () => {
      ctx.fillStyle = C.brass;
      setFont(ctx, 800, 170, DISPLAY);
      ctx.fillText(f.format!(f.value! * tv), M, y + 150);
    });
    y += 200;
  }

  if (f.caption) {
    rise(ctx, win(p, 0.45, 0.62), () => {
      ctx.fillStyle = C.bone;
      ctx.globalAlpha *= 0.8;
      setFont(ctx, 500, 42, TEXT);
      wrap(ctx, f.caption!, width).slice(0, 3).forEach((l, i) => ctx.fillText(l, M, y + 40 + i * 56));
    });
  }
}

// ---------- montagem dos quadros ----------

export const SLIDE_LABELS: { id: string; label: string }[] = [
  { id: 'numeros', label: 'O mês em números' },
  { id: 'presenca', label: 'Quem mais apareceu' },
  { id: 'tempo', label: 'Mais tempo na mesa' },
  { id: 'maior_noite', label: 'Maior noite' },
  { id: 'vencedor', label: 'Maior vencedor do mês' },
  { id: 'mesa_longa', label: 'Mesa mais longa' },
  { id: 'copa', label: 'Rei da copa' },
  { id: 'estreias', label: 'Estreias' },
  { id: 'top5', label: 'Top 5 do mês' }
];

export function buildSlides(r: Retrospective, opts: VideoOptions): Slide[] {
  const on = (id: string) => !opts.disabled.includes(id);
  const nextMonth = (() => {
    const [y, m] = r.month.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 15)));
  })();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const slides: Slide[] = [];

  slides.push({
    id: 'abertura',
    label: 'Abertura',
    duration: 3400,
    suit: '♠',
    draw: ({ ctx, opts: o }, p) => {
      ctx.textAlign = 'left';
      const suits = ['♠', '♥', '♦', '♣'];
      suits.forEach((s, i) => {
        rise(ctx, win(p, 0.04 + i * 0.06, 0.22 + i * 0.06), () => {
          ctx.fillStyle = i === 1 || i === 2 ? C.red : C.bone;
          setFont(ctx, 900, 110, 'serif');
          ctx.fillText(s, M + i * 120, 640);
        }, 80);
      });
      const fit = fitLines(ctx, cap(r.monthName), 900, DISPLAY, 330, 200, W - 2 * M, 1);
      rise(ctx, win(p, 0.22, 0.45), () => {
        ctx.fillStyle = C.brass;
        setFont(ctx, 900, fit.size, DISPLAY);
        ctx.fillText(fit.lines[0], M, 640 + fit.size * 0.95);
      }, 70);
      const club = fitLines(ctx, `na ${o.clubName}`, 800, DISPLAY, 150, 80, W - 2 * M, 2);
      club.lines.forEach((l, i) => {
        rise(ctx, win(p, 0.34 + i * 0.05, 0.55 + i * 0.05), () => {
          ctx.fillStyle = C.bone;
          setFont(ctx, 800, club.size, DISPLAY);
          ctx.fillText(l, M, 640 + fit.size * 0.95 + club.size * (i + 1));
        });
      });
      rise(ctx, win(p, 0.55, 0.72), () => {
        ctx.fillStyle = C.bone;
        ctx.globalAlpha *= 0.8;
        setFont(ctx, 500, 44, TEXT);
        ctx.fillText('A retrospectiva do mês', M, 640 + fit.size * 0.95 + club.size * club.lines.length + 90);
      });
    }
  });

  if (on('numeros') && r.nights > 0) {
    slides.push({
      id: 'numeros',
      label: 'O mês em números',
      duration: 4200,
      suit: '♦',
      draw: ({ ctx }, p) => {
        ctx.textAlign = 'left';
        rise(ctx, win(p, 0.02, 0.14), () => {
          ctx.fillStyle = C.brass;
          setFont(ctx, 600, 46, TEXT);
          ctx.fillText('O mês em números', M, 700);
        });
        const rows: [number, (v: number) => string, string][] = [
          [r.nights, v => String(Math.round(v)), r.nights === 1 ? 'noite de jogo' : 'noites de jogo'],
          [r.players, v => String(Math.round(v)), 'jogadores na mesa'],
          ...(r.minutes > 0 ? [[r.minutes / 60, (v: number) => `${Math.round(v)}h`, 'de jogo somando todo mundo'] as [number, (v: number) => string, string]] : [])
        ];
        rows.forEach(([value, fmt, caption], i) => {
          const a = 0.1 + i * 0.16;
          const y = 900 + i * 320;
          rise(ctx, win(p, a, a + 0.12), () => {
            ctx.fillStyle = C.bone;
            setFont(ctx, 900, 230, DISPLAY);
            ctx.fillText(fmt(value * win(p, a, a + 0.3)), M, y + 150);
            ctx.globalAlpha *= 0.8;
            setFont(ctx, 500, 44, TEXT);
            ctx.fillText(caption, M + 6, y + 220);
          }, 50);
        });
      }
    });
  }

  if (on('presenca') && r.mostPresent) {
    const h = r.mostPresent;
    slides.push({
      id: 'presenca', label: 'Quem mais apareceu', duration: 3600, suit: '♣',
      draw: (env, p) => drawFeat(env, p, {
        label: 'Quem mais apareceu',
        name: h.name,
        value: h.value,
        format: v => plural(Math.round(v), 'noite', 'noites'),
        caption: h.value >= r.nights && r.nights > 1 ? `Não perdeu nenhuma das ${r.nights} noites.` : `De ${plural(r.nights, 'noite', 'noites')} no mês.`
      })
    });
  }

  if (on('tempo') && r.mostTime && r.mostTime.value >= 30) {
    const h = r.mostTime;
    slides.push({
      id: 'tempo', label: 'Mais tempo na mesa', duration: 3600, suit: '♠',
      draw: (env, p) => drawFeat(env, p, {
        label: 'Mais tempo na mesa',
        name: h.name,
        value: h.value,
        format: v => formatMinutes(v),
        caption: 'Somando todas as noites do mês. Cadeira cativa.'
      })
    });
  }

  if (on('maior_noite') && r.bestNight) {
    const h = r.bestNight;
    slides.push({
      id: 'maior_noite', label: 'Maior noite', duration: 3800, suit: '♥',
      draw: (env, p) => drawFeat(env, p, opts.showMoney
        ? { label: 'A maior noite do mês', name: h.name, value: h.value, format: v => `+${money(v)}`, caption: `Numa noite só. ${h.detail ?? ''}` }
        : { label: 'A maior noite do mês', name: h.name, caption: h.detail })
    });
  }

  if (on('vencedor') && r.topWinner) {
    const h = r.topWinner;
    slides.push({
      id: 'vencedor', label: 'Maior vencedor', duration: 3800, suit: '♦',
      draw: (env, p) => drawFeat(env, p, opts.showMoney
        ? { label: 'Maior vencedor do mês', name: h.name, value: h.value, format: v => `+${money(v)}`, caption: 'Somando todas as noites do mês.' }
        : { label: 'Maior vencedor do mês', name: h.name, caption: 'Somando todas as noites do mês.' })
    });
  }

  if (on('mesa_longa') && r.longestTable && r.longestTable.value >= 60) {
    const h = r.longestTable;
    slides.push({
      id: 'mesa_longa', label: 'Mesa mais longa', duration: 3400, suit: '♣',
      draw: (env, p) => drawFeat(env, p, {
        label: 'A mesa mais longa',
        name: h.name,
        value: h.value,
        format: v => formatMinutes(v),
        caption: 'Da primeira ficha ao último cash-out.'
      })
    });
  }

  if (on('copa') && r.barKing) {
    const h = r.barKing;
    slides.push({
      id: 'copa', label: 'Rei da copa', duration: 3400, suit: '♥',
      draw: (env, p) => drawFeat(env, p, {
        label: 'Rei da copa',
        name: h.name,
        value: h.value,
        format: v => plural(Math.round(v), 'pedido', 'pedidos'),
        caption: r.topProduct ? `O mais pedido do mês: ${r.topProduct.name} (${r.topProduct.value}).` : undefined
      })
    });
  }

  if (on('estreias') && r.debuts.length > 0) {
    const names = r.debuts;
    slides.push({
      id: 'estreias', label: 'Estreias', duration: 3800, suit: '♠',
      draw: ({ ctx }, p) => {
        ctx.textAlign = 'left';
        rise(ctx, win(p, 0.02, 0.14), () => {
          ctx.fillStyle = C.brass;
          setFont(ctx, 600, 46, TEXT);
          ctx.fillText('Sentaram na mesa pela primeira vez', M, 680);
        });
        rise(ctx, win(p, 0.08, 0.3), () => {
          ctx.fillStyle = C.bone;
          setFont(ctx, 900, 260, DISPLAY);
          ctx.fillText(String(Math.round(names.length * win(p, 0.08, 0.4))), M, 940);
          setFont(ctx, 800, 110, DISPLAY);
          ctx.fillText(names.length === 1 ? 'estreia' : 'estreias', M, 1060);
        }, 60);
        const shown = names.slice(0, 6);
        shown.forEach((n, i) => {
          rise(ctx, win(p, 0.32 + i * 0.05, 0.45 + i * 0.05), () => {
            ctx.fillStyle = C.bone;
            ctx.globalAlpha *= 0.85;
            setFont(ctx, 600, 48, TEXT);
            ctx.fillText(n, M, 1180 + i * 70);
          });
        });
        if (names.length > shown.length) {
          rise(ctx, win(p, 0.65, 0.75), () => {
            ctx.fillStyle = C.brass;
            setFont(ctx, 600, 40, TEXT);
            ctx.fillText(`e mais ${names.length - shown.length}`, M, 1180 + shown.length * 70);
          });
        }
      }
    });
  }

  if (on('top5') && r.top5.length >= 2) {
    const list = r.top5;
    slides.push({
      id: 'top5', label: 'Top 5', duration: 4800, suit: '♦',
      draw: ({ ctx }, p) => {
        rise(ctx, win(p, 0.02, 0.14), () => {
          ctx.textAlign = 'left';
          ctx.fillStyle = C.brass;
          setFont(ctx, 600, 46, TEXT);
          ctx.fillText(`Top ${list.length} de ${r.monthName}`, M, 640);
        });
        list.forEach((h, i) => {
          const a = 0.1 + (list.length - 1 - i) * 0.09; // revela de baixo para cima
          const y = 760 + i * 190;
          rise(ctx, win(p, a, a + 0.14), () => {
            ctx.textAlign = 'left';
            ctx.fillStyle = i === 0 ? C.brass : C.bone;
            setFont(ctx, 900, 120, DISPLAY);
            ctx.fillText(`${i + 1}`, M, y + 100);
            const valueText = `+${money(h.value)}`;
            setFont(ctx, 800, 72, DISPLAY);
            const valueWidth = opts.showMoney ? ctx.measureText(valueText).width + 40 : 0;
            const nameWidth = W - 2 * M - 110 - valueWidth;
            const fit = fitLines(ctx, h.name, 800, DISPLAY, 96, 52, nameWidth, 1);
            setFont(ctx, 800, fit.size, DISPLAY);
            ctx.fillStyle = C.bone;
            ctx.fillText(fit.lines[0], M + 110, y + 96);
            if (opts.showMoney) {
              ctx.textAlign = 'right';
              ctx.fillStyle = C.brass;
              setFont(ctx, 800, 72, DISPLAY);
              ctx.fillText(valueText, W - M, y + 92);
            }
          }, 40);
        });
      }
    });
  }

  slides.push({
    id: 'encerramento',
    label: 'Encerramento',
    duration: 3600,
    suit: '♥',
    draw: ({ ctx, opts: o }, p) => {
      ctx.textAlign = 'left';
      const fit = fitLines(ctx, `${cap(nextMonth)} tem mais.`, 900, DISPLAY, 260, 140, W - 2 * M, 2);
      fit.lines.forEach((l, i) => {
        rise(ctx, win(p, 0.06 + i * 0.08, 0.3 + i * 0.08), () => {
          ctx.fillStyle = i === 0 ? C.brass : C.bone;
          setFont(ctx, 900, fit.size, DISPLAY);
          ctx.fillText(l, M, 780 + fit.size * 0.92 * (i + 1));
        }, 70);
      });
      rise(ctx, win(p, 0.4, 0.58), () => {
        ctx.fillStyle = C.bone;
        ctx.globalAlpha *= 0.85;
        setFont(ctx, 500, 46, TEXT);
        ctx.fillText('Te vejo na mesa.', M, 780 + fit.size * 0.92 * fit.lines.length + 110);
      });
      if (o.logo) {
        rise(ctx, win(p, 0.5, 0.7), () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(M + 90, 1560, 90, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(o.logo!, M, 1470, 180, 180);
          ctx.restore();
        });
      }
    }
  });

  return slides;
}

// ---------- linha do tempo ----------

export function totalDuration(slides: Slide[]) {
  return slides.reduce((s, x) => s + x.duration, 0);
}

export function renderAt(ctx: CanvasRenderingContext2D, slides: Slide[], r: Retrospective, opts: VideoOptions, ms: number) {
  let acc = 0;
  let index = slides.length - 1;
  for (let i = 0; i < slides.length; i++) {
    if (ms < acc + slides[i].duration) { index = i; break; }
    acc += slides[i].duration;
  }
  if (ms >= totalDuration(slides)) acc = totalDuration(slides) - slides[index].duration;
  const slide = slides[index];
  const p = clamp((ms - acc) / slide.duration);
  const [y, m] = r.month.split('-').map(Number);
  const monthTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
  const env: Env = { ctx, opts, r, monthTitle };

  ctx.save();
  background(ctx, slide.suit, p, slide.suit === '♥' || slide.suit === '♦' ? C.red : C.bone);
  // saída suave no fim de cada quadro (menos o último)
  const fadeOut = index < slides.length - 1 ? 1 - clamp((p - 0.93) / 0.07) : 1;
  ctx.globalAlpha = fadeOut;
  slide.draw(env, p);
  ctx.globalAlpha = 1;
  frame(env, index, slides.length, p);
  ctx.restore();
}

// ---------- gravação ----------

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? null;
}

/**
 * Grava o vídeo em tempo real (leva a duração do vídeo).
 * A aba precisa ficar aberta e visível enquanto grava.
 */
export function recordVideo(
  canvas: HTMLCanvasElement,
  duration: number,
  draw: (ms: number) => void,
  onProgress: (fraction: number) => void
): Promise<{ blob: Blob; mime: string }> {
  const mime = pickMimeType();
  if (!mime) return Promise.reject(new Error('Este navegador não consegue gravar vídeo. Tente pelo Chrome ou Safari atualizados.'));
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime.split(';')[0] }), mime });
    rec.onerror = () => reject(new Error('A gravação falhou.'));
    draw(0);
    rec.start(250);
    const start = performance.now();
    const tick = () => {
      const ms = performance.now() - start;
      draw(Math.min(ms, duration));
      onProgress(Math.min(1, ms / duration));
      if (ms < duration + 400) requestAnimationFrame(tick);
      else rec.stop();
    };
    requestAnimationFrame(tick);
  });
}
