import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu, MessageCircle, Play, X } from 'lucide-react';
import { FONT_CSS } from '../lib/wrappedVideo';

/**
 * Página de vendas. Só mostra o que o sistema faz de verdade.
 * Contato comercial pelo WhatsApp; demonstração do relógio em /demo.
 */

const WHATSAPP = '5551998811587';
const wa = (text: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
const WA_DEFAULT = wa('Olá! Quero conhecer o Masmorra Manager para o meu clube de poker.');
const PRICE = 99;
const TRIAL_DAYS = 14;

const EVENTS = [
  { tone: 'rebuy', title: 'Rebuy', name: 'Rafael', detail: '+30K fichas' },
  { tone: 'out', title: 'Eliminado', name: 'Thiago', detail: '17º lugar' },
  { tone: 'addon', title: 'Add-on', name: 'Bruno', detail: '+120K fichas' },
  { tone: 'rebuy', title: 'Rebuy', name: 'Diego', detail: '+15K fichas' }
] as const;

/** Relógio de torneio em miniatura (decorativo, mesma identidade da TV). */
function MiniClock({ big = false }: { big?: boolean }) {
  const [sec, setSec] = useState(12 * 60 + 34);
  const [ev, setEv] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setInterval(() => setSec(s => (s <= 0 ? 20 * 60 : s - 1)), 1000);
    const e = window.setInterval(() => setEv(i => (i + 1) % EVENTS.length), 3600);
    return () => { window.clearInterval(t); window.clearInterval(e); };
  }, []);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  const e = EVENTS[ev];
  return (
    <div className={`mc ${big ? 'mc-big' : ''}`} aria-hidden="true">
      <div className="mc-in">
      <div className="mc-top">
        <span className="mc-club">Seu Clube de Poker</span>
        <span className="mc-tour">Domingo · 5K garantidos</span>
      </div>
      <div className="mc-grid">
        <div className="mc-blinds">
          <span className="mc-label">Nível 7</span>
          <span className="mc-bb">500<i>/</i>1.000</span>
          <span className="mc-ante">Ante 1.000</span>
        </div>
        <div className="mc-time">{mm}<i>:</i>{ss}</div>
        <div className="mc-prize">
          <span className="mc-label">Prêmio</span>
          <span className="mc-gold">R$ 6.240</span>
          <span className="mc-small">1º R$ 2.500</span>
        </div>
      </div>
      <div className="mc-bar"><span style={{ width: `${(1 - sec / (20 * 60)) * 100}%` }} /></div>
      <div key={ev} className={`mc-toast mc-${e.tone}`}>
        <b>{e.title}</b> <strong>{e.name}</strong> <em>{e.detail}</em>
      </div>
      <div className="mc-stats">
        <span><b>23</b>/41 jogadores</span><span><b>20</b> rebuys</span><span>média <b>92K</b></span>
      </div>
      </div>
    </div>
  );
}

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
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_CSS}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = FONT_CSS;
      document.head.appendChild(l);
    }
  }, []);

  return (
    <div className="lp2">
      <LpStyle />

      <header className="lp2-nav">
        <a href="#topo" className="lp2-brand">
          <img src="/logo.png?v=2" alt="" />
          <span>Masmorra Manager</span>
        </a>
        <nav className={`lp2-links ${menu ? 'is-open' : ''}`} aria-label="Seções">
          <a href="#noite" onClick={() => setMenu(false)}>Como funciona</a>
          <a href="#torneios" onClick={() => setMenu(false)}>Torneios</a>
          <a href="#preco" onClick={() => setMenu(false)}>Preço</a>
          <a href="#duvidas" onClick={() => setMenu(false)}>Dúvidas</a>
          <Link to="/login" className="lp2-login" onClick={() => setMenu(false)}>Entrar</Link>
        </nav>
        <a className="lp2-btn lp2-btn-primary lp2-nav-cta" href={WA_DEFAULT} target="_blank" rel="noreferrer">
          <MessageCircle size={18} /> Falar no WhatsApp
        </a>
        <button type="button" className="lp2-burger" aria-label={menu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menu} onClick={() => setMenu(v => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <main id="topo">
        {/* HERO */}
        <section className="lp2-hero">
          <div className="lp2-hero-text">
            <h1>Seu clube de poker, do buy-in ao campeão.</h1>
            <p className="lp2-lead">
              Mesas de cash, torneios com relógio na TV, fiado e fechamento de caixa num sistema só.
              Feito dentro de um clube de verdade, para quem toca a noite pelo celular.
            </p>
            <div className="lp2-ctas">
              <a className="lp2-btn lp2-btn-primary" href="/demo" target="_blank" rel="noreferrer">
                <Play size={18} /> Ver o relógio ao vivo
              </a>
              <a className="lp2-btn lp2-btn-ghost" href={WA_DEFAULT} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> Testar {TRIAL_DAYS} dias grátis
              </a>
            </div>
            <p className="lp2-fine">Sem cartão. Sem instalar nada. Funciona no celular, no computador e na TV.</p>
          </div>
          <div className="lp2-hero-visual">
            <div className="lp2-tv"><MiniClock /></div>
          </div>
        </section>

        {/* A NOITE */}
        <section id="noite" className="lp2-section">
          <h2>A noite inteira, num lugar só.</h2>
          <p className="lp2-sub">Do primeiro buy-in até o último centavo conferido na gaveta.</p>
          <ol className="lp2-night">
            <li>
              <span className="lp2-step">1</span>
              <h3>Antes</h3>
              <ul>
                <li>Monte o torneio uma vez e repita toda semana.</li>
                <li>Convide gerente e caixa por um link no WhatsApp.</li>
                <li>Cadastre jogadores com telefone e aniversário.</li>
              </ul>
            </li>
            <li>
              <span className="lp2-step">2</span>
              <h3>Durante</h3>
              <ul>
                <li>Buy-in, rebuy, add-on e consumo com um toque.</li>
                <li>Relógio na TV com avisos e sons a cada rebuy e eliminação.</li>
                <li>Mesa de cash e torneio rodando ao mesmo tempo.</li>
              </ul>
            </li>
            <li>
              <span className="lp2-step">3</span>
              <h3>Depois</h3>
              <ul>
                <li>Acerto de cada jogador na saída: pagou, recebeu ou ficou devendo.</li>
                <li>Fechamento do caixa: bateu, faltou ou sobrou, e quanto.</li>
                <li>Relatório da noite pronto para colar no grupo.</li>
              </ul>
            </li>
          </ol>
        </section>

        {/* TORNEIOS */}
        <section id="torneios" className="lp2-section lp2-split">
          <div>
            <h2>Torneio com cara de evento grande.</h2>
            <p className="lp2-sub">O relógio vai para a TV do clube por um link. Você comanda tudo pelo celular.</p>
            <ul className="lp2-list">
              <li><b>Do seu jeito:</b> buy-in 90+30, rebuy simples e duplo, add-on no intervalo, bônus de pontualidade, garantido e prêmios extras.</li>
              <li><b>Blinds editáveis</b> nível a nível, com intervalos. Modelos prontos para começar.</li>
              <li><b>Na TV:</b> blinds, tempo, prêmio, premiação, jogadores restantes e média de fichas.</li>
              <li><b>Avisos e sons:</b> “Rafael deu rebuy”, palmas a cada eliminação, sino quando a blind sobe e fanfarra para o campeão.</li>
              <li><b>Premiação calculada</b> pelo número de inscritos, com o garantido e o que a casa precisa completar.</li>
            </ul>
            <a className="lp2-btn lp2-btn-primary" href="/demo" target="_blank" rel="noreferrer">
              <Play size={18} /> Abrir a demonstração na TV
            </a>
          </div>
          <div className="lp2-tv lp2-tv-big"><MiniClock big /></div>
        </section>

        {/* CASH */}
        <section className="lp2-section lp2-split lp2-split-rev">
          <div className="lp2-card-acerto" aria-hidden="true">
            <p className="lp2-ac-head">Acerto · Diego</p>
            <p className="lp2-ac-calc">Fichas R$ 50 − buy-in R$ 200</p>
            <p className="lp2-ac-total">Jogador paga R$ 150</p>
            <div className="lp2-ac-chips">
              <span>Dinheiro</span><span className="on">PIX</span><span>Cartão</span><span className="debt">Fica devendo</span>
            </div>
            <p className="lp2-ac-note">Pagou R$ 100 agora · R$ 50 vai para o fiado</p>
          </div>
          <div>
            <h2>Cash game sem caderninho.</h2>
            <p className="lp2-sub">Do jeito que os clubes daqui trabalham: ninguém paga a ficha na hora, o acerto é na saída.</p>
            <ul className="lp2-list">
              <li><b>Acerto na saída:</b> o sistema mostra quanto o jogador paga ou recebe, já descontando buy-in e consumo.</li>
              <li><b>Fiado sob controle:</b> quem deve, quanto e desde quando, com extrato e cobrança pelo WhatsApp.</li>
              <li><b>Copa no nome do jogador:</b> cerveja, refri, água, com os seus produtos e preços.</li>
              <li><b>Histórico de tudo:</b> cada lançamento com data e hora, inclusive o que foi apagado.</li>
            </ul>
          </div>
        </section>

        {/* DONO */}
        <section className="lp2-section">
          <h2>O dono no controle, de qualquer lugar.</h2>
          <div className="lp2-grid">
            <div><h3>Fechamento de caixa</h3><p>Troco inicial, dinheiro, PIX e cartão da noite. Você conta a gaveta e o sistema diz se bateu.</p></div>
            <div><h3>Equipe com permissões</h3><p>Dono, gerente e caixa. O caixa opera tudo, mas não vê o faturamento do clube.</p></div>
            <div><h3>Relatórios prontos</h3><p>Rake, consumo, receita e resultado de cada jogador. Copie para o WhatsApp ou salve em PDF.</p></div>
            <div><h3>Seus dados, só seus</h3><p>Cada clube enxerga apenas o que é dele. Conexão criptografada e login individual.</p></div>
          </div>
        </section>

        {/* JOGADORES */}
        <section className="lp2-section">
          <h2>Jogador que se sente em casa volta.</h2>
          <div className="lp2-grid">
            <div><h3>Ranking do mês</h3><p>Resultado, presença e maior noite. Um toque copia o top 10 para o grupo.</p></div>
            <div><h3>Retrospectiva em vídeo</h3><p>Todo mês, um vídeo vertical com os destaques para os stories e o grupo do clube.</p></div>
            <div><h3>Ficha do jogador</h3><p>Noites jogadas, resultado, maior prêmio e fiado em aberto, num lugar só.</p></div>
            <div><h3>Relacionamento</h3><p>Aniversariantes e quem sumiu há tempo, com mensagem pronta para o WhatsApp.</p></div>
          </div>
        </section>

        {/* ORIGEM */}
        <section className="lp2-section lp2-origin">
          <h2>Nasceu dentro de um clube de verdade.</h2>
          <p>
            O Masmorra Manager foi criado para rodar as noites do Masmorra Poker, no Rio Grande do Sul. Cada função existe porque
            fez falta numa mesa real: o acerto na saída, o fiado de quem manda o PIX amanhã, o caixa que precisa bater
            e o relógio que deixa o torneio com cara de evento.
          </p>
        </section>

        {/* PREÇO */}
        <section id="preco" className="lp2-section lp2-price">
          <div>
            <h2>Um plano, tudo incluso.</h2>
            <p className="lp2-sub">Sem taxa por mesa, por jogador ou por torneio. O mesmo valor para o clube inteiro, com toda a equipe.</p>
          </div>
          <div className="lp2-price-card">
            <p className="lp2-price-value"><span>R$</span>{PRICE}<small>/mês por clube</small></p>
            <ul>
              <li>Mesas de cash e torneios ilimitados</li>
              <li>Relógio de torneio para TV com sons</li>
              <li>Acerto, fiado e fechamento de caixa</li>
              <li>Equipe com permissões</li>
              <li>Ranking, retrospectiva e relatórios</li>
              <li>Suporte e implantação pelo WhatsApp</li>
            </ul>
            <a className="lp2-btn lp2-btn-primary lp2-btn-block" href={WA_DEFAULT} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Começar {TRIAL_DAYS} dias grátis
            </a>
            <p className="lp2-fine">Sem cartão no teste. Sem fidelidade.</p>
          </div>
        </section>

        {/* DÚVIDAS */}
        <section id="duvidas" className="lp2-section lp2-faq">
          <h2>Dúvidas</h2>
          <div>
            {FAQ.map((f, i) => (
              <div key={f.q} className={`lp2-q ${open === i ? 'is-open' : ''}`}>
                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span>{f.q}</span><ChevronDown size={18} />
                </button>
                {open === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="lp2-section lp2-final">
          <h2>Bora organizar a próxima noite?</h2>
          <p className="lp2-sub">Chama no WhatsApp: a gente cria seu clube e você já usa no próximo torneio.</p>
          <div className="lp2-ctas lp2-ctas-center">
            <a className="lp2-btn lp2-btn-primary" href={WA_DEFAULT} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Falar no WhatsApp
            </a>
            <a className="lp2-btn lp2-btn-ghost" href="/demo" target="_blank" rel="noreferrer">
              <Play size={18} /> Ver o relógio ao vivo
            </a>
          </div>
        </section>
      </main>

      <footer className="lp2-footer">
        <span>© {new Date().getFullYear()} Masmorra Manager</span>
        <nav aria-label="Rodapé">
          <Link to="/termos">Termos de uso</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/login">Entrar</Link>
        </nav>
      </footer>

      <a className="lp2-float" href={WA_DEFAULT} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp">
        <MessageCircle size={26} />
      </a>
    </div>
  );
}

function LpStyle() {
  return (
    <style>{`
      .lp2 { --abyss:#060a14; --stone:#0e1628; --wall:#16233d; --blue:#3b7bff; --ivory:#eef2fa; --muted:#8d99b3; --gold:#f4b942; --ember:#ff4d5e;
        background: var(--abyss); color: var(--ivory); font-family: Inter, system-ui, sans-serif; min-height: 100vh; overflow-x: hidden; text-align: left; }
      .lp2 a { color: inherit; text-decoration: none; }
      .lp2 h1, .lp2 h2 { font-family: "Big Shoulders Display", Impact, "Arial Narrow", sans-serif; font-weight: 900; letter-spacing: .005em; line-height: .95; margin: 0; color: var(--ivory); }
      .lp2 h1 { font-size: clamp(52px, 8.4vw, 112px); max-width: 11ch; }
      .lp2 h2 { font-size: clamp(38px, 5.2vw, 68px); max-width: 18ch; }
      .lp2 h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px; color: var(--ivory); }
      .lp2 p { margin: 0; }
      .lp2-lead { font-size: clamp(17px, 1.6vw, 20px); line-height: 1.6; color: #c9d2e4; max-width: 52ch; margin-top: 24px !important; }
      .lp2-sub { font-size: 17px; line-height: 1.6; color: var(--muted); max-width: 56ch; margin-top: 14px !important; }
      .lp2-fine { font-size: 14px; color: var(--muted); margin-top: 14px !important; }

      .lp2-nav { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 24px; padding: 14px clamp(16px, 4vw, 48px);
        background: rgba(6,10,20,.82); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(238,242,250,.06); }
      .lp2-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; margin-right: auto; }
      .lp2-brand img { width: 34px; height: 34px; }
      .lp2-links { display: flex; align-items: center; gap: 24px; font-size: 15px; font-weight: 600; color: var(--muted); }
      .lp2-links a:hover { color: var(--ivory); }
      .lp2-login { color: var(--ivory) !important; }
      .lp2-burger { display: none; background: transparent; border: 0; color: var(--ivory); padding: 8px; cursor: pointer; }

      .lp2-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; padding: 0 24px; border-radius: 14px;
        font-weight: 800; font-size: 16px; cursor: pointer; transition: transform .15s ease, background .15s ease; white-space: nowrap; }
      .lp2-btn:active { transform: scale(.98); }
      .lp2-btn-primary { background: var(--blue); color: #fff !important; box-shadow: 0 10px 30px rgba(59,123,255,.3); }
      .lp2-btn-primary:hover { background: #2f6af0; }
      .lp2-btn-ghost { border: 1px solid rgba(238,242,250,.18); color: var(--ivory) !important; }
      .lp2-btn-ghost:hover { background: rgba(238,242,250,.06); }
      .lp2-btn-block { width: 100%; }
      .lp2-nav-cta { min-height: 44px; padding: 0 18px; font-size: 15px; }
      .lp2-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
      .lp2-ctas-center { justify-content: center; }

      .lp2-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: clamp(32px, 5vw, 72px); align-items: center;
        padding: clamp(48px, 8vw, 110px) clamp(16px, 4vw, 48px) clamp(56px, 7vw, 96px); max-width: 1320px; margin: 0 auto; position: relative; }
      .lp2-hero::before { content: ""; position: absolute; inset: -10% -20% auto auto; width: 70%; height: 90%; pointer-events: none;
        background: radial-gradient(closest-side, rgba(59,123,255,.22), transparent 70%); }

      .lp2-tv { position: relative; border-radius: 22px; padding: 12px; background: linear-gradient(180deg, #1a2440, #0b1222); border: 1px solid rgba(238,242,250,.08);
        box-shadow: 0 40px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.4) inset; }
      .lp2-tv::after { content: ""; position: absolute; left: 50%; bottom: -26px; transform: translateX(-50%); width: 34%; height: 14px; border-radius: 0 0 12px 12px; background: #0b1222; }

      .mc { container-type: inline-size; position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden;
        background: radial-gradient(45% 55% at 50% 50%, rgba(59,123,255,.22), transparent 70%), #050810; }
      .mc-in { position: absolute; inset: 0; padding: 4cqw 4.5cqw 0; display: grid; grid-template-rows: auto 1fr auto auto; }
      .mc-top { display: flex; flex-direction: column; }
      .mc-club { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 3.6cqw; line-height: 1; white-space: nowrap; }
      .mc-tour { color: var(--muted); font-weight: 600; font-size: 1.6cqw; }
      .mc-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.55fr) minmax(0, 1fr); align-items: center; gap: 2cqw; }
      .mc-label { display: block; color: var(--muted); font-weight: 600; font-size: 1.6cqw; }
      .mc-bb { display: block; font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 4.2cqw; line-height: 1.05; white-space: nowrap; }
      .mc-bb i, .mc-time i { font-style: normal; color: var(--blue); margin: 0 .1em; }
      .mc-ante { display: block; font-weight: 800; font-size: 1.9cqw; opacity: .85; }
      .mc-time { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 13cqw; line-height: .9; text-align: center;
        font-variant-numeric: tabular-nums; text-shadow: 0 0 .25em rgba(59,123,255,.4); white-space: nowrap; }
      .mc-prize { text-align: right; }
      .mc-gold { display: block; font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 4.2cqw; line-height: 1.05; color: var(--gold); white-space: nowrap; }
      .mc-small { display: block; font-size: 1.6cqw; color: var(--ivory); opacity: .8; margin-top: .3em; white-space: nowrap; }
      .mc-bar { height: .7cqw; margin: 1.5cqw 14% 0; border-radius: 1em; background: rgba(238,242,250,.08); overflow: hidden; }
      .mc-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--blue), #7aa6ff); }
      .mc-toast { position: absolute; left: 50%; bottom: 15cqw; transform: translateX(-50%); display: flex; align-items: baseline; gap: 1.2cqw; white-space: nowrap;
        padding: 1.1cqw 2.2cqw; border-radius: 1.2cqw; background: rgba(13,21,38,.95); border: 2px solid var(--blue); animation: mc-in .45s cubic-bezier(.2,.9,.3,1.2); font-size: 1.7cqw; }
      .mc-toast b { color: var(--blue); }
      .mc-toast strong { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 3.4cqw; line-height: 1; }
      .mc-toast em { font-style: normal; color: var(--muted); font-weight: 700; }
      .mc-out { border-color: var(--ember); } .mc-out b { color: var(--ember); }
      .mc-addon { border-color: var(--gold); } .mc-addon b { color: var(--gold); }
      .mc-stats { display: flex; justify-content: space-around; padding: 2cqw 0 2.6cqw; margin-top: 3cqw; color: var(--muted); font-size: 1.6cqw; white-space: nowrap;
        background: linear-gradient(180deg, transparent, rgba(22,35,61,.8)); }
      .mc-stats b { color: var(--ivory); font-family: "Big Shoulders Display", Impact, sans-serif; font-size: 2.8cqw; font-weight: 800; margin-right: .2em; }
      @keyframes mc-in { from { transform: translate(-50%, 40%); opacity: 0; } }

      .lp2-section { max-width: 1200px; margin: 0 auto; padding: clamp(56px, 8vw, 112px) clamp(16px, 4vw, 48px); }
      .lp2-night { list-style: none; padding: 0; margin: 48px 0 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
      .lp2-night > li { position: relative; padding: 28px 24px 24px; border-radius: 18px; background: var(--stone); border: 1px solid rgba(238,242,250,.06); }
      .lp2-step { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 56px; line-height: 1; color: var(--blue); opacity: .9; display: block; margin-bottom: 8px; }
      .lp2-night h3 { font-size: 22px; }
      .lp2-night ul, .lp2-list { margin: 0; padding: 0; list-style: none; }
      .lp2-night ul li { color: #c9d2e4; line-height: 1.55; padding: 8px 0; border-top: 1px solid rgba(238,242,250,.06); font-size: 15.5px; }
      .lp2-list { margin: 28px 0 32px; }
      .lp2-list li { color: #c9d2e4; line-height: 1.6; padding: 12px 0; border-top: 1px solid rgba(238,242,250,.07); font-size: 16px; max-width: 60ch; }
      .lp2-list b { color: var(--ivory); }

      .lp2-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: clamp(32px, 5vw, 72px); align-items: center; }
      .lp2-split-rev { grid-template-columns: minmax(0, .9fr) minmax(0, 1fr); }

      .lp2-card-acerto { padding: 28px; border-radius: 20px; background: var(--stone); border: 1px solid rgba(238,242,250,.08); box-shadow: 0 30px 60px rgba(0,0,0,.4); max-width: 440px; justify-self: center; width: 100%; }
      .lp2-ac-head { font-weight: 800; font-size: 18px; }
      .lp2-ac-calc { color: var(--muted); font-size: 14px; margin-top: 18px !important; }
      .lp2-ac-total { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: clamp(30px, 4vw, 44px); white-space: nowrap; color: var(--ember); line-height: 1.05; margin-top: 4px !important; }
      .lp2-ac-chips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 18px; }
      .lp2-ac-chips span { text-align: center; padding: 12px 4px; border-radius: 12px; font-size: 12.5px; font-weight: 700; color: var(--muted); background: rgba(238,242,250,.04); border: 1px solid rgba(238,242,250,.08); }
      .lp2-ac-chips .on { color: #fff; border-color: var(--blue); background: rgba(59,123,255,.18); }
      .lp2-ac-chips .debt { color: var(--gold); }
      .lp2-ac-note { margin-top: 16px !important; color: var(--gold); font-weight: 700; font-size: 14px; }

      .lp2-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px; margin-top: 44px; }
      .lp2-grid > div { border-top: 2px solid var(--blue); padding-top: 18px; }
      .lp2-grid p { color: var(--muted); line-height: 1.6; font-size: 15.5px; }

      .lp2-origin p { font-size: clamp(18px, 1.8vw, 22px); line-height: 1.65; color: #c9d2e4; max-width: 62ch; margin-top: 24px !important; }

      .lp2-price { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; align-items: center; }
      .lp2-price-card { padding: 32px; border-radius: 22px; background: linear-gradient(180deg, #121d36, #0b1222); border: 1px solid rgba(59,123,255,.35); }
      .lp2-price-value { font-family: "Big Shoulders Display", Impact, sans-serif; font-weight: 900; font-size: 88px; line-height: 1; }
      .lp2-price-value span { font-size: 36px; color: var(--muted); margin-right: 6px; vertical-align: super; }
      .lp2-price-value small { font-family: Inter, sans-serif; font-size: 16px; font-weight: 600; color: var(--muted); margin-left: 8px; }
      .lp2-price-card ul { list-style: none; padding: 0; margin: 24px 0 28px; }
      .lp2-price-card li { padding: 10px 0; border-top: 1px solid rgba(238,242,250,.07); color: #c9d2e4; font-size: 16px; }

      .lp2-faq > div { margin-top: 36px; max-width: 820px; }
      .lp2-q { border-top: 1px solid rgba(238,242,250,.08); }
      .lp2-q button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 0; background: transparent; border: 0;
        color: var(--ivory); font-size: 17px; font-weight: 700; text-align: left; cursor: pointer; }
      .lp2-q button svg { flex-shrink: 0; transition: transform .2s ease; color: var(--muted); }
      .lp2-q.is-open button svg { transform: rotate(180deg); }
      .lp2-q p { padding: 0 0 20px; color: var(--muted); line-height: 1.65; max-width: 68ch; font-size: 16px; }

      .lp2-final { text-align: center; }
      .lp2-final h2, .lp2-final .lp2-sub { margin-left: auto; margin-right: auto; }

      .lp2-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; padding: 28px clamp(16px, 4vw, 48px) 96px; color: var(--muted); font-size: 14px;
        border-top: 1px solid rgba(238,242,250,.06); }
      .lp2-footer nav { display: flex; gap: 8px; }
      .lp2-footer nav a { padding: 12px 8px; }
      .lp2-footer a:hover { color: var(--ivory); }
      .lp2-float { position: fixed; right: 18px; bottom: 18px; z-index: 40; width: 58px; height: 58px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        background: #25d366; color: #fff !important; box-shadow: 0 10px 30px rgba(0,0,0,.4); }

      @media (max-width: 960px) {
        .lp2-hero, .lp2-split, .lp2-split-rev, .lp2-price { grid-template-columns: 1fr; }
        .lp2-split-rev .lp2-card-acerto { order: 2; }
        .lp2-night { grid-template-columns: 1fr; }
        .lp2-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .lp2-links { display: none; }
        .lp2-links.is-open { display: flex; position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 0;
          background: var(--abyss); border-bottom: 1px solid rgba(238,242,250,.08); padding: 8px 16px 16px; }
        .lp2-links.is-open a { padding: 14px 4px; font-size: 17px; border-top: 1px solid rgba(238,242,250,.06); }
        .lp2-burger { display: inline-flex; }
        .lp2-nav-cta { display: none; }
      }
      @media (max-width: 560px) {
        .lp2-grid { grid-template-columns: 1fr; }
        .lp2-ctas .lp2-btn { width: 100%; }
        .lp2-ac-chips { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (prefers-reduced-motion: reduce) { .lp2 *, .lp2 *::before { animation: none !important; transition: none !important; } }
    `}</style>
  );
}
