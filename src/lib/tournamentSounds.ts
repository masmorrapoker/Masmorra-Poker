/**
 * Sons do relógio, gerados no próprio navegador (Web Audio): sem arquivos de
 * áudio e sem música de terceiros. O navegador só libera som depois de um
 * toque/clique na tela, por isso a TV pede "Ativar som" uma vez.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio(): boolean {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export const audioReady = () => !!ctx && ctx.state === 'running';

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, glideTo?: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Sino: fundamental + parciais inarmônicos. */
function bell(freq: number, start: number, vol = 0.35, dur = 2.2) {
  tone(freq, start, dur, 'sine', vol);
  tone(freq * 2.76, start, dur * 0.6, 'sine', vol * 0.35);
  tone(freq * 5.4, start, dur * 0.35, 'sine', vol * 0.15);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(): AudioBuffer | null {
  if (!ctx) return null;
  if (noiseBuffer) return noiseBuffer;
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** Estalo curto de ruído filtrado (palma, ficha). */
function burst(start: number, dur: number, vol: number, freq: number, q: number) {
  if (!ctx || !master) return;
  const buf = noise();
  if (!buf) return;
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Ficha de cerâmica batendo. */
function chip(start: number, vol = 0.5) {
  burst(start, 0.05, vol, 3200 + Math.random() * 1500, 8);
  tone(2400 + Math.random() * 600, start, 0.08, 'triangle', vol * 0.25);
}

export const sounds = {
  /** Subida de blind: três sinos ascendentes. */
  levelUp() {
    if (!unlockAudio()) return;
    bell(523.25, 0);
    bell(659.25, 0.18);
    bell(783.99, 0.36, 0.4, 2.8);
    tone(130.8, 0, 1.6, 'sine', 0.25);
  },

  /** Falta 1 minuto. */
  warning() {
    if (!unlockAudio()) return;
    tone(880, 0, 0.18, 'square', 0.08);
    tone(880, 0.3, 0.18, 'square', 0.08);
  },

  /** Intervalo: gongo grave. */
  breakStart() {
    if (!unlockAudio()) return;
    tone(98, 0, 4, 'sine', 0.45, 92);
    tone(196, 0, 3, 'sine', 0.2, 188);
    tone(294, 0.02, 2.2, 'sine', 0.12);
    burst(0, 0.4, 0.15, 400, 1);
  },

  /** Rebuy: fichas batendo. */
  rebuy() {
    if (!unlockAudio()) return;
    [0, 0.07, 0.13, 0.22].forEach((s, i) => chip(s, 0.45 - i * 0.06));
    tone(1046.5, 0.25, 0.4, 'sine', 0.12);
  },

  /** Add-on: cascata de fichas + brilho. */
  addon() {
    if (!unlockAudio()) return;
    for (let i = 0; i < 12; i++) chip(i * 0.045 + Math.random() * 0.02, 0.4);
    bell(1046.5, 0.5, 0.18, 1.2);
    bell(1318.5, 0.62, 0.15, 1.2);
  },

  /** Eliminação: palmas (vários "aplaudidores" com ritmos diferentes). */
  applause(seconds = 3.2) {
    if (!unlockAudio()) return;
    const people = 14;
    for (let p = 0; p < people; p++) {
      const rate = 0.16 + Math.random() * 0.12;
      let t = Math.random() * 0.3;
      while (t < seconds) {
        const env = t < 0.5 ? t / 0.5 : 1 - Math.max(0, (t - seconds * 0.55) / (seconds * 0.45));
        burst(t, 0.03 + Math.random() * 0.03, 0.18 * Math.max(0.05, env), 1100 + Math.random() * 1600, 1.4);
        t += rate * (0.8 + Math.random() * 0.4);
      }
    }
  },

  /** Campeão: fanfarra + palmas longas. */
  champion() {
    if (!unlockAudio()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone(f, i * 0.16, 0.5, 'sawtooth', 0.07);
      tone(f, i * 0.16, 0.5, 'triangle', 0.12);
    });
    tone(1046.5, 0.7, 1.6, 'triangle', 0.15);
    tone(783.99, 0.7, 1.6, 'triangle', 0.1);
    setTimeout(() => sounds.applause(5), 600);
  }
};

/** Anúncio por voz (português), se o aparelho tiver voz instalada. */
export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.rate = 1;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('pt'));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    /* sem voz */
  }
}
