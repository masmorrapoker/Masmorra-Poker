import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Film, Pause, Play, Share2 } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';
import { playerService } from '../services/playerService';
import { transactionService } from '../services/transactionService';
import { buildSessions, periodLabel, shiftPeriod, type Session } from '../lib/playerStats';
import { buildRetrospective } from '../lib/retrospective';
import { currentNight } from '../lib/nightMath';
import {
  H,
  W,
  buildSlides,
  loadFonts,
  loadLogo,
  pickMimeType,
  recordVideo,
  renderAt,
  SLIDE_LABELS,
  totalDuration
} from '../lib/wrappedVideo';
import type { Table, Transaction } from '../types';
import { toast } from '../components/Toast';

export default function Retrospectiva() {
  const { clubId, clubName, clubLogo } = useClub();
  const [params, setParams] = useSearchParams();
  const thisMonth = currentNight().slice(0, 7);
  const month = params.get('mes') || thisMonth;

  const [data, setData] = useState<{ sessions: Session[]; tables: Table[]; transactions: Transaction[] } | null>(null);
  const [ready, setReady] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [showMoney, setShowMoney] = useState(true);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true);
  const [recording, setRecording] = useState<number | null>(null);
  const [video, setVideo] = useState<{ url: string; file: File } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ ms: 0, last: 0 });

  useEffect(() => {
    if (!clubId) return;
    (async () => {
      try {
        const [tables, tablePlayers, transactions, players] = await Promise.all([
          tableService.getTables(clubId),
          playerService.getAllTablePlayers(clubId),
          transactionService.getAllTransactions(clubId),
          playerService.getPlayers(clubId)
        ]);
        setData({ sessions: buildSessions(tables, tablePlayers, transactions, players), tables, transactions });
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível carregar os dados do mês.');
      }
    })();
    Promise.all([loadFonts(), loadLogo(clubLogo)]).then(([, img]) => {
      setLogo(img);
      setReady(true);
    });
  }, [clubId, clubLogo]);

  const retro = useMemo(
    () => (data ? buildRetrospective(month, data.sessions, data.tables, data.transactions) : null),
    [data, month]
  );
  const opts = useMemo(
    () => ({ clubName: clubName || 'nosso clube', logo, showMoney, disabled }),
    [clubName, logo, showMoney, disabled]
  );
  const slides = useMemo(() => (retro ? buildSlides(retro, opts) : []), [retro, opts]);
  const duration = totalDuration(slides);

  const draw = useCallback(
    (ms: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && retro && slides.length) renderAt(ctx, slides, retro, opts, ms);
    },
    [retro, slides, opts]
  );

  // Prévia em loop
  useEffect(() => {
    if (!ready || !retro || recording !== null) return;
    let raf = 0;
    clock.current.last = performance.now();
    const tick = (now: number) => {
      if (playing) {
        clock.current.ms = (clock.current.ms + (now - clock.current.last)) % Math.max(duration, 1);
      }
      clock.current.last = now;
      draw(clock.current.ms);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, retro, draw, playing, duration, recording]);

  // Mudou o conteúdo: volta ao começo e descarta o vídeo gerado
  useEffect(() => {
    clock.current.ms = 0;
    setVideo(v => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }, [month, showMoney, disabled]);

  const shiftMonth = (step: number) => {
    const next = shiftPeriod({ kind: 'month', value: month }, step);
    return next.kind === 'month' ? next.value : month;
  };

  function goTo(m: string) {
    setParams(m === thisMonth ? {} : { mes: m });
  }

  async function generate() {
    if (!canvasRef.current) return;
    setRecording(0);
    try {
      const { blob, mime } = await recordVideo(canvasRef.current, duration, draw, f => setRecording(f));
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `retrospectiva-${month}.${ext}`, { type: blob.type });
      setVideo({ url: URL.createObjectURL(blob), file });
      toast.success('Vídeo pronto.');
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível gerar o vídeo.');
    } finally {
      setRecording(null);
      clock.current.ms = 0;
    }
  }

  async function share() {
    if (!video) return;
    try {
      await navigator.share({ files: [video.file], title: `Retrospectiva de ${periodLabel({ kind: 'month', value: month })}` });
    } catch {
      /* cancelado */
    }
  }

  const canShare = typeof navigator !== 'undefined' && !!video && !!navigator.canShare?.({ files: [video.file] });
  const mime = pickMimeType();
  const optional = SLIDE_LABELS;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto mobile-view-padding text-left">
      <Link to="/ranking" className="text-xs text-muted font-bold inline-flex items-center gap-1.5 py-2 mb-2 no-underline">
        <ArrowLeft size={14} /> Ranking
      </Link>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="mb-1">Retrospectiva do mês</h1>
          <p className="text-muted text-sm mb-0">Um vídeo vertical com os destaques do mês, pronto para o grupo e para os stories.</p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Escolher mês">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => goTo(shiftMonth(-1))} aria-label="Mês anterior" disabled={recording !== null}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold text-white text-center" style={{ minWidth: 150 }}>{periodLabel({ kind: 'month', value: month })}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => goTo(shiftMonth(1))}
            disabled={month >= thisMonth || recording !== null}
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {!retro || !ready ? (
        <div className="flex justify-center p-10"><div className="spinner" role="status" aria-label="Carregando" /></div>
      ) : retro.nights === 0 ? (
        <div className="glass-panel p-8 text-center">
          <Film className="mx-auto text-muted mb-3" size={32} aria-hidden="true" />
          <p className="text-white font-bold mb-1">Nenhuma noite de jogo em {periodLabel({ kind: 'month', value: month }).toLowerCase()}.</p>
          <p className="text-sm text-muted mb-0">Use as setas para escolher outro mês.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col items-center gap-3">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="rounded-2xl border border-glass-border w-full"
              style={{ maxWidth: 360, aspectRatio: `${W} / ${H}`, background: '#07120E' }}
              aria-label="Prévia do vídeo"
            />
            {recording === null && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPlaying(v => !v)}>
                {playing ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> Continuar</>}
              </button>
            )}
          </div>

          <div className="space-y-4">
            <section className="glass-panel p-5" aria-labelledby="retro-ajustes">
              <h2 id="retro-ajustes" className="text-base font-bold text-white mb-3">O que entra no vídeo</h2>
              <label className="flex items-center gap-3 py-2 cursor-pointer">
                <input type="checkbox" checked={showMoney} onChange={e => setShowMoney(e.target.checked)} style={{ width: 18, height: 18 }} disabled={recording !== null} />
                <span className="text-sm text-white">Mostrar valores em R$</span>
              </label>
              <div className="border-t border-glass-border my-2" />
              {optional.map(s => {
                const available = slides.some(x => x.id === s.id) || disabled.includes(s.id);
                return (
                  <label key={s.id} className={`flex items-center gap-3 py-2 ${available ? 'cursor-pointer' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={available && !disabled.includes(s.id)}
                      disabled={!available || recording !== null}
                      onChange={e => setDisabled(d => (e.target.checked ? d.filter(x => x !== s.id) : [...d, s.id]))}
                      style={{ width: 18, height: 18 }}
                    />
                    <span className="text-sm text-white">{s.label}</span>
                    {!available && <span className="text-xs text-muted">sem dados no mês</span>}
                  </label>
                );
              })}
              <p className="text-xs text-muted mt-3 mb-0">
                O vídeo só mostra feitos: ninguém aparece por ter perdido. Antes de postar no Instagram, confirme que os jogadores não se importam de aparecer.
              </p>
            </section>

            <section className="glass-panel p-5" aria-labelledby="retro-video">
              <h2 id="retro-video" className="text-base font-bold text-white mb-1">Vídeo</h2>
              <p className="text-xs text-muted mb-4">
                {Math.round(duration / 1000)} segundos, 1080×1920, sem música. Adicione a música no próprio Instagram ou WhatsApp.
              </p>

              {recording !== null ? (
                <div>
                  <div className="h-2 rounded-full bg-white bg-opacity-10 overflow-hidden mb-2">
                    <div className="h-full bg-primary" style={{ width: `${Math.round(recording * 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted mb-0">Gravando… deixe esta tela aberta até terminar.</p>
                </div>
              ) : video ? (
                <div className="space-y-2">
                  {canShare && (
                    <button type="button" className="btn btn-primary w-full py-3" onClick={share}>
                      <Share2 size={16} /> Compartilhar
                    </button>
                  )}
                  <a href={video.url} download={video.file.name} className={`btn ${canShare ? 'btn-outline' : 'btn-primary'} w-full py-3 no-underline`}>
                    <Download size={16} /> Baixar vídeo
                  </a>
                  <button type="button" className="btn btn-outline w-full py-3" onClick={generate}>
                    Gerar de novo
                  </button>
                  {video.file.name.endsWith('.webm') && (
                    <p className="text-xs text-warning mb-0">
                      Este navegador gerou o vídeo em .webm, que o Instagram não aceita. Gere pelo celular (Chrome ou Safari atualizados) para sair em .mp4.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <button type="button" className="btn btn-primary w-full py-3" onClick={generate} disabled={!mime}>
                    <Film size={16} /> Gerar vídeo
                  </button>
                  {!mime && <p className="text-xs text-warning mt-2 mb-0">Este navegador não grava vídeo. Use o Chrome ou o Safari atualizados.</p>}
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
