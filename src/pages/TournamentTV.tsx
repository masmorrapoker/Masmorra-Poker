import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { tournamentService, type TvPayload } from '../services/tournamentService';
import {
  computeStats,
  deriveClock,
  fmtChips,
  fmtShortChips,
  fmtTime,
  payoutTable,
  type ClockState
} from '../lib/tournament';
import { sounds, speak, unlockAudio } from '../lib/tournamentSounds';
import { formatMoney } from '../utils';
import { FONT_CSS } from '../lib/wrappedVideo';

/**
 * Relógio do torneio para a TV do clube. Abre por link secreto, sem login.
 * Atualiza a cada 1,5 s e anuncia rebuys, add-ons, eliminações e subidas de blind.
 */

type Announcement = { id: string; tone: 'rebuy' | 'addon' | 'out' | 'bonus' | 'info'; title: string; name: string; detail?: string };

const money = (v: number) => formatMoney(Math.round(v)).replace(',00', '');

export default function TournamentTV() {
  const { token = '' } = useParams<{ token: string }>();
  const [data, setData] = useState<TvPayload | null>(null);
  const [missing, setMissing] = useState(false);
  const [offset, setOffset] = useState(0); // hora do servidor − hora local
  const [now, setNow] = useState(Date.now());
  const [soundOn, setSoundOn] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [takeover, setTakeover] = useState<{ title: string; big: string; sub?: string; tone: 'level' | 'break' | 'champ' } | null>(null);

  const seen = useRef<{ movements: Set<string>; out: Set<string>; first: boolean }>({ movements: new Set(), out: new Set(), first: true });
  const lastIndex = useRef<number | null>(null);
  const warned = useRef<number | null>(null);
  const champAnnounced = useRef(false);
  const soundRef = useRef(false);
  const voiceRef = useRef(true);
  soundRef.current = soundOn;
  voiceRef.current = voiceOn;

  // Fontes do relógio
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = FONT_CSS;
      document.head.appendChild(l);
    }
    document.title = 'Relógio do torneio';
  }, []);

  const enqueue = useCallback((a: Announcement) => setQueue(q => [...q, a].slice(-12)), []);

  // Busca periódica
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const t0 = Date.now();
        const p = await tournamentService.tv(token);
        if (!alive) return;
        if (!p) { setMissing(true); return; }
        const t1 = Date.now();
        setOffset(new Date(p.now).getTime() - (t0 + t1) / 2);
        detectNews(p);
        setData(p);
      } catch {
        /* sem conexão: tenta de novo no próximo ciclo */
      }
    };
    const detectNews = (p: TvPayload) => {
      const s = seen.current;
      const nameOf = (id: string) => p.entries.find(e => e.id === id)?.name ?? '';
      if (s.first) {
        p.movements.forEach(m => s.movements.add(m.id));
        p.entries.filter(e => e.eliminated_at).forEach(e => s.out.add(e.id));
        s.first = false;
        return;
      }
      for (const m of p.movements) {
        if (s.movements.has(m.id)) continue;
        s.movements.add(m.id);
        const name = nameOf(m.entry_id);
        if (m.kind === 'rebuy') enqueue({ id: m.id, tone: 'rebuy', title: 'Rebuy', name, detail: `+${fmtShortChips(m.chips)} fichas` });
        if (m.kind === 'addon') enqueue({ id: m.id, tone: 'addon', title: 'Add-on', name, detail: `+${fmtShortChips(m.chips)} fichas` });
        if (m.kind === 'buyin') enqueue({ id: m.id, tone: 'info', title: 'Entrou no torneio', name, detail: `${fmtShortChips(m.chips)} fichas` });
      }
      for (const e of p.entries) {
        if (!e.eliminated_at || s.out.has(e.id)) continue;
        s.out.add(e.id);
        enqueue({ id: `out-${e.id}`, tone: 'out', title: 'Eliminado', name: e.name, detail: e.position ? `${e.position}º lugar` : undefined });
      }
    };
    load();
    const id = window.setInterval(load, 1500);
    return () => { alive = false; window.clearInterval(id); };
  }, [token, enqueue]);

  // Relógio local (corrigido pela hora do servidor)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const cfg = data?.tournament.config;
  const clock: ClockState | null = useMemo(
    () => (data && cfg ? deriveClock(cfg.levels, data.tournament, now + offset) : null),
    [data, cfg, now, offset]
  );
  const stats = useMemo(
    () => (data && cfg ? computeStats(cfg, data.entries, data.movements) : null),
    [data, cfg]
  );
  const payouts = useMemo(() => (cfg && stats ? payoutTable(cfg, stats.prizePool, stats.entries) : []), [cfg, stats]);

  // Mudança de nível, aviso de 1 minuto
  useEffect(() => {
    if (!clock || !data) return;
    if (lastIndex.current === null) {
      lastIndex.current = clock.index;
      return;
    }
    if (clock.index !== lastIndex.current) {
      lastIndex.current = clock.index;
      warned.current = null;
      const it = clock.item;
      if (it?.kind === 'break') {
        if (soundRef.current) sounds.breakStart();
        setTakeover({ tone: 'break', title: it.label || 'Intervalo', big: fmtTime(it.minutes * 60), sub: it.addon ? 'Add-on liberado' : undefined });
        if (soundRef.current && voiceRef.current) speak(`${it.label || 'Intervalo'}.${it.addon ? ' Add-on liberado.' : ''}`);
      } else if (it?.kind === 'level') {
        if (soundRef.current) sounds.levelUp();
        setTakeover({ tone: 'level', title: `Nível ${clock.levelNumber}`, big: `${fmtChips(it.sb)} / ${fmtChips(it.bb)}`, sub: it.ante ? `Ante ${fmtChips(it.ante)}` : undefined });
        if (soundRef.current && voiceRef.current) speak(`Nível ${clock.levelNumber}. Blinds ${it.sb} e ${it.bb}.`);
      }
      window.setTimeout(() => setTakeover(t => (t?.tone === 'champ' ? t : null)), 4200);
    } else if (clock.running && clock.remaining === 60 && warned.current !== clock.index) {
      warned.current = clock.index;
      if (soundRef.current) sounds.warning();
    }
  }, [clock, data]);

  // Campeão
  useEffect(() => {
    if (!data || champAnnounced.current) return;
    const champ = data.entries.find(e => e.position === 1);
    if (data.tournament.status === 'encerrado' && champ) {
      champAnnounced.current = true;
      if (!seen.current.first) {
        if (soundRef.current) sounds.champion();
        if (soundRef.current && voiceRef.current) speak(`${champ.name} é o campeão!`);
      }
      setTakeover({ tone: 'champ', title: 'Campeão', big: champ.name, sub: payouts[0] ? money(payouts[0]) : undefined });
    }
  }, [data, payouts]);

  // Fila de avisos
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    if (soundRef.current) {
      if (next.tone === 'out') sounds.applause();
      else if (next.tone === 'rebuy') sounds.rebuy();
      else if (next.tone === 'addon') sounds.addon();
      if (voiceRef.current && (next.tone === 'out' || next.tone === 'rebuy' || next.tone === 'addon')) {
        speak(next.tone === 'out' ? `${next.name} eliminado${next.detail ? `, ${next.detail}` : ''}` : `${next.name}, ${next.title}`);
      }
    }
  }, [queue, current]);

  // Cada aviso fica 4,3 s na tela
  useEffect(() => {
    if (!current) return;
    const id = window.setTimeout(() => setCurrent(null), 4300);
    return () => window.clearTimeout(id);
  }, [current]);

  function activate() {
    unlockAudio();
    setSoundOn(true);
    sounds.rebuy();
    try { void document.documentElement.requestFullscreen?.(); } catch { /* sem tela cheia */ }
  }

  if (missing) {
    return (
      <div className="tv-root tv-center">
        <TvStyle />
        <p className="tv-muted">Este link de relógio não existe ou o acesso do clube está suspenso.</p>
      </div>
    );
  }
  if (!data || !cfg || !clock || !stats) {
    return (
      <div className="tv-root tv-center">
        <TvStyle />
        <div className="spinner" role="status" aria-label="Carregando" />
      </div>
    );
  }

  const it = clock.item;
  const isBreak = it?.kind === 'break';
  const notStarted = data.tournament.status === 'agendado' && !data.tournament.clock_running;
  const paused = !clock.running && !notStarted && data.tournament.status !== 'encerrado';
  const total = it ? it.minutes * 60 : 1;
  const progress = Math.min(1, Math.max(0, 1 - clock.remaining / total));
  const lastMinute = clock.running && clock.remaining <= 60;
  const itm = payouts.length;

  return (
    <div className={`tv-root ${isBreak ? 'tv-break' : ''}`} onClick={() => !soundOn && activate()}>
      <TvStyle />
      <div className="tv-glow" aria-hidden="true" />

      <header className="tv-top">
        <div className="tv-club">
          {data.club.logo_url && <img src={data.club.logo_url} alt="" className="tv-club-logo" />}
          <div>
            <div className="tv-club-name">{data.club.name}</div>
            <div className="tv-tournament">{data.tournament.name}</div>
          </div>
        </div>
        <div className="tv-brand">
          <img src="/logo.png?v=2" alt="" />
          <span>Masmorra Manager</span>
        </div>
      </header>

      <main className="tv-main">
        <section className="tv-side tv-blinds" aria-label="Blinds">
          {isBreak ? (
            <>
              <div className="tv-label">{it.label || 'Intervalo'}</div>
              <div className="tv-blinds-value tv-small">{it.addon ? 'Add-on liberado' : 'Pausa'}</div>
            </>
          ) : it?.kind === 'level' ? (
            <>
              <div className="tv-label">Nível {clock.levelNumber}</div>
              <div className="tv-blinds-value">{fmtShortChips(it.sb)}<span>/</span>{fmtShortChips(it.bb)}</div>
              {it.ante > 0 && <div className="tv-ante">Ante {fmtShortChips(it.ante)}</div>}
            </>
          ) : null}
          {clock.nextLevel && (
            <div className="tv-next">
              <span className="tv-label">Próximo</span>
              <span>{fmtShortChips(clock.nextLevel.sb)} / {fmtShortChips(clock.nextLevel.bb)}{clock.nextLevel.ante ? ` · ante ${fmtShortChips(clock.nextLevel.ante)}` : ''}</span>
            </div>
          )}
        </section>

        <section className="tv-clock" aria-label="Tempo do nível">
          <div className={`tv-time ${lastMinute ? 'tv-time-alert' : ''}`}>
            {fmtTime(clock.remaining).split('').map((ch, i) => (
              <span key={i} className={ch === ':' ? 'tv-colon' : 'tv-digit'}>{ch}</span>
            ))}
          </div>
          <div className="tv-progress"><div style={{ width: `${progress * 100}%` }} /></div>
          <div className="tv-state">
            {notStarted ? 'Aguardando início' : data.tournament.status === 'encerrado' ? 'Torneio encerrado' : paused ? 'Relógio pausado' : isBreak ? 'Intervalo' : ' '}
          </div>
          {cfg.notice && <div className="tv-notice">{cfg.notice}</div>}
        </section>

        <section className="tv-side tv-prize" aria-label="Premiação">
          <div className="tv-label">Prêmio</div>
          <div className="tv-prize-value">{money(stats.prizePool)}</div>
          {cfg.gtd > 0 && <div className="tv-gtd">{stats.pool >= cfg.gtd ? 'Garantido batido' : `${money(cfg.gtd)} garantidos`}</div>}
          <ol className="tv-payouts">
            {payouts.slice(0, 9).map((v, i) => (
              <li key={i}><span>{i + 1}º</span><strong>{money(v)}</strong></li>
            ))}
          </ol>
          {cfg.extras.length > 0 && (
            <ul className="tv-extras">
              {cfg.extras.map(x => <li key={x.id}>{x.label}{x.amount ? ` · ${money(x.amount)}` : ''}</li>)}
            </ul>
          )}
        </section>
      </main>

      <footer className="tv-bottom">
        <div className="tv-stat"><span>Jogadores</span><strong>{stats.alive}<em>/{stats.entries}</em></strong></div>
        <div className="tv-stat"><span>Rebuys</span><strong>{stats.rebuys}</strong></div>
        <div className="tv-stat"><span>Add-ons</span><strong>{stats.addons}</strong></div>
        <div className="tv-stat"><span>Média</span><strong>{fmtShortChips(stats.avgStack)}</strong></div>
        <div className="tv-stat"><span>Premiados</span><strong>{itm}</strong></div>
        <div className="tv-stat"><span>Próx. intervalo</span><strong>{clock.untilBreak != null ? fmtTime(clock.untilBreak) : '—'}</strong></div>
        <div className="tv-wall" aria-hidden="true" />
      </footer>

      {current && (
        <div key={current.id} className={`tv-toast tv-toast-${current.tone}`} role="status">
          <span className="tv-toast-title">{current.title}</span>
          <span className="tv-toast-name">{current.name}</span>
          {current.detail && <span className="tv-toast-detail">{current.detail}</span>}
        </div>
      )}

      {takeover && (
        <div className={`tv-takeover tv-takeover-${takeover.tone}`} role="status">
          <div className="tv-takeover-title">{takeover.title}</div>
          <div className="tv-takeover-big">{takeover.big}</div>
          {takeover.sub && <div className="tv-takeover-sub">{takeover.sub}</div>}
        </div>
      )}

      {!soundOn ? (
        <button type="button" className="tv-activate" onClick={e => { e.stopPropagation(); activate(); }}>
          Toque para ativar som e tela cheia
        </button>
      ) : (
        <button type="button" className="tv-voice" onClick={e => { e.stopPropagation(); setVoiceOn(v => !v); }}>
          {voiceOn ? 'Voz ligada' : 'Voz desligada'}
        </button>
      )}
    </div>
  );
}

function TvStyle() {
  return (
    <style>{`
      .tv-root {
        --abyss: #050810; --stone: #0d1526; --wall: #16233d; --blue: #3b7bff; --blue-soft: rgba(59,123,255,.18);
        --ivory: #e8eef8; --muted: #8b98b4; --gold: #f4b942; --ember: #ff4d5e;
        position: fixed; inset: 0; overflow: hidden; background: var(--abyss); color: var(--ivory);
        font-family: Inter, system-ui, sans-serif; display: grid; grid-template-rows: auto 1fr auto; user-select: none;
      }
      .tv-center { place-items: center; display: grid; }
      .tv-muted { color: var(--muted); font-size: 1.5rem; }
      .tv-glow { position: absolute; inset: -20%; pointer-events: none;
        background: radial-gradient(40% 45% at 50% 48%, rgba(59,123,255,.22), transparent 70%),
                    radial-gradient(60% 40% at 50% 120%, rgba(59,123,255,.12), transparent 70%); }
      .tv-break .tv-glow { background: radial-gradient(40% 45% at 50% 48%, rgba(244,185,66,.18), transparent 70%); }

      .tv-top { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 2.2vh 3vw 0; }
      .tv-club { display: flex; align-items: center; gap: 1.4vw; min-width: 0; max-width: 58vw; }
      .tv-club > div { min-width: 0; }
      .tv-club-logo { width: 7vh; height: 7vh; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px rgba(232,238,248,.15); }
      .tv-club-name { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: min(5.2vh, 2.8vw); line-height: 1; letter-spacing: .01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tv-tournament { color: var(--muted); font-size: 2.3vh; font-weight: 600; margin-top: .5vh; }
      .tv-brand { display: flex; align-items: center; gap: .6vw; opacity: .55; font-size: 1.6vh; font-weight: 600; }
      .tv-brand img { width: 3.2vh; height: 3.2vh; }

      .tv-main { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.55fr) minmax(0, 1fr); align-items: center; gap: 2vw; padding: 0 3vw; }
      .tv-side { display: flex; flex-direction: column; gap: 1.2vh; }
      .tv-label { color: var(--muted); font-size: 2.4vh; font-weight: 600; }
      .tv-blinds-value { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: min(11vh, 4.6vw); line-height: .95; white-space: nowrap; }
      .tv-blinds-value span { color: var(--blue); margin: 0 .25em; }
      .tv-blinds-value.tv-small { font-size: min(6vh, 3vw); color: var(--gold); white-space: normal; }
      .tv-ante { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 800; font-size: min(4.4vh, 2.2vw); color: var(--ivory); opacity: .85; }
      .tv-next { margin-top: 3vh; display: flex; flex-direction: column; gap: .4vh; font-size: min(3vh, 1.5vw); font-weight: 700; }

      .tv-clock { text-align: center; }
      .tv-time { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: min(30vh, 13vw); line-height: .9;
        display: inline-flex; justify-content: center; text-shadow: 0 0 6vh rgba(59,123,255,.35); }
      .tv-digit { display: inline-block; width: .56em; text-align: center; }
      .tv-colon { display: inline-block; width: .28em; text-align: center; color: var(--blue); transform: translateY(-.04em); }
      .tv-time-alert { color: var(--gold); text-shadow: 0 0 6vh rgba(244,185,66,.45); animation: tv-pulse 1s ease-in-out infinite; }
      .tv-break .tv-time { color: var(--gold); text-shadow: 0 0 6vh rgba(244,185,66,.35); }
      .tv-progress { height: 1vh; margin: 2.4vh auto 0; width: 82%; border-radius: 1vh; background: rgba(232,238,248,.08); overflow: hidden; }
      .tv-progress div { height: 100%; background: linear-gradient(90deg, var(--blue), #7aa6ff); transition: width .25s linear; }
      .tv-break .tv-progress div { background: linear-gradient(90deg, var(--gold), #ffd98a); }
      .tv-state { margin-top: 1.8vh; font-size: 2.6vh; font-weight: 700; color: var(--muted); min-height: 3.2vh; }
      .tv-notice { margin-top: 1.2vh; font-size: 2.4vh; color: var(--ivory); opacity: .8; }

      .tv-prize { align-items: flex-end; text-align: right; }
      .tv-prize-value { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: min(9vh, 4vw); line-height: .95; color: var(--gold); white-space: nowrap; }
      .tv-gtd { font-size: 2.2vh; font-weight: 700; color: var(--gold); opacity: .8; }
      .tv-payouts { list-style: none; margin: 1.6vh 0 0; padding: 0; display: grid; gap: .5vh; min-width: 70%; }
      .tv-payouts li { display: flex; justify-content: space-between; gap: 2vw; font-size: 2.7vh; padding: .5vh 0; border-bottom: 1px solid rgba(232,238,248,.07); }
      .tv-payouts li span { color: var(--muted); font-weight: 700; }
      .tv-payouts li:first-child strong { color: var(--gold); }
      .tv-extras { list-style: none; margin: 1vh 0 0; padding: 0; font-size: 2.1vh; color: var(--muted); }
      .tv-extras li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

      .tv-bottom { position: relative; display: flex; justify-content: space-around; align-items: flex-end; padding: 3vh 3vw 4.4vh;
        background: linear-gradient(180deg, transparent, rgba(13,21,38,.85) 40%); }
      .tv-stat { display: flex; flex-direction: column; align-items: center; gap: .4vh; position: relative; z-index: 1; }
      .tv-stat span { color: var(--muted); font-size: 2vh; font-weight: 600; }
      .tv-stat strong { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 800; font-size: 5.4vh; line-height: 1; }
      .tv-stat em { font-style: normal; color: var(--muted); font-size: .6em; }
      /* muralha: ameias da fortaleza ao pé da tela */
      .tv-wall { position: absolute; left: 0; right: 0; bottom: 0; height: 2.2vh; background: var(--wall);
        -webkit-mask: linear-gradient(#000 0 0) bottom/100% 55% no-repeat, repeating-linear-gradient(90deg, #000 0 3vw, transparent 3vw 4.5vw) top/100% 46% no-repeat;
                mask: linear-gradient(#000 0 0) bottom/100% 55% no-repeat, repeating-linear-gradient(90deg, #000 0 3vw, transparent 3vw 4.5vw) top/100% 46% no-repeat; }

      .tv-toast { position: absolute; left: 50%; bottom: 17vh; transform: translateX(-50%); min-width: 46vw; max-width: 80vw;
        display: flex; align-items: baseline; gap: 1.6vw; padding: 2.2vh 3vw; border-radius: 2vh; background: rgba(13,21,38,.94);
        border: 2px solid var(--blue); box-shadow: 0 2vh 6vh rgba(0,0,0,.5); animation: tv-in .45s cubic-bezier(.2,.9,.3,1.2), tv-out .4s ease-in 3.9s forwards; z-index: 5; }
      .tv-toast-title { font-size: 2.6vh; font-weight: 800; color: var(--blue); white-space: nowrap; }
      .tv-toast-name { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 6.4vh; line-height: 1; }
      .tv-toast-detail { font-size: 2.8vh; font-weight: 700; color: var(--muted); white-space: nowrap; }
      .tv-toast-out { border-color: var(--ember); } .tv-toast-out .tv-toast-title { color: var(--ember); }
      .tv-toast-addon { border-color: var(--gold); } .tv-toast-addon .tv-toast-title { color: var(--gold); }

      .tv-takeover { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: radial-gradient(60% 60% at 50% 50%, rgba(22,35,61,.97), rgba(5,8,16,.98)); animation: tv-fade .35s ease-out; }
      .tv-takeover-title { font-size: 4vh; font-weight: 800; color: var(--blue); }
      .tv-takeover-big { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: min(22vh, 11vw); line-height: 1; text-align: center; padding: 0 4vw;
        animation: tv-zoom .6s cubic-bezier(.2,.9,.3,1.2); }
      .tv-takeover-sub { font-size: 4.4vh; font-weight: 700; color: var(--muted); margin-top: 1vh; }
      .tv-takeover-break .tv-takeover-title, .tv-takeover-champ .tv-takeover-title { color: var(--gold); }
      .tv-takeover-champ .tv-takeover-big { color: var(--gold); text-shadow: 0 0 8vh rgba(244,185,66,.45); font-size: 18vh; }
      .tv-takeover-champ .tv-takeover-sub { color: var(--ivory); font-size: 6vh; }

      .tv-activate { position: absolute; right: 3vw; top: 9vh; z-index: 20; padding: 2.4vh 3vw; border-radius: 2vh;
        border: 2px solid var(--blue); background: rgba(13,21,38,.95); color: var(--ivory); font-size: 2.8vh; font-weight: 700; cursor: pointer; }
      .tv-voice { position: absolute; right: 1.5vw; bottom: 1vh; z-index: 2; background: transparent; border: 0; color: var(--muted); opacity: .45; font-size: 1.5vh; cursor: pointer; }

      @keyframes tv-pulse { 50% { opacity: .55; } }
      @keyframes tv-in { from { transform: translate(-50%, 6vh); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      @keyframes tv-out { to { transform: translate(-50%, 4vh); opacity: 0; } }
      @keyframes tv-fade { from { opacity: 0; } }
      @keyframes tv-zoom { from { transform: scale(.7); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .tv-root *, .tv-root { animation: none !important; transition: none !important; } }
      @media (max-aspect-ratio: 1/1) {
        .tv-main { grid-template-columns: 1fr; text-align: center; gap: 3vh; }
        .tv-prize, .tv-blinds { align-items: center; text-align: center; }
        .tv-time { font-size: 18vh; }
      }
    `}</style>
  );
}
