import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Spade, Check, Star, Menu, X, TrendingDown, Coffee, 
  RefreshCw, CheckCircle, FileText, MessageSquare, 
  HelpCircle, Activity, Landmark
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Live simulator state for the Hero mockup
  const [heroLogs, setHeroLogs] = useState<string[]>([
    '15:00 - Gabriel - Buy-in - R$ 100,00',
    '15:04 - Felipe - Buy-in - R$ 200,00',
  ]);
  const [simStep, setSimStep] = useState(0);

  // Monitor scroll to change navbar background
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Set up the body class for the landing page theme
  useEffect(() => {
    document.body.classList.add('lp-body');
    return () => {
      document.body.classList.remove('lp-body');
    };
  }, []);

  // Action log simulation inside the Hero visual mockup
  useEffect(() => {
    const actions = [
      '15:12 - Gabriel - Consumo (Cerveja) - R$ 8,00',
      '15:25 - Felipe - Re-buy - R$ 100,00',
      '15:40 - Marta - Buy-in - R$ 300,00',
      '15:45 - Gabriel - Cash-out - R$ 250,00',
      '15:50 - Marta - Consumo (Energético) - R$ 12,00'
    ];

    const timer = setInterval(() => {
      setHeroLogs(prev => {
        const nextLogs = [...prev, actions[simStep]];
        // Keep the latest 5 logs
        return nextLogs.slice(-5);
      });
      setSimStep(prev => (prev + 1) % actions.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [simStep]);

  const toggleFaq = (index: number) => {
    setActiveFaq(prev => (prev === index ? null : index));
  };

  const handleCtaClick = () => {
    window.open('https://wa.me/5551998811587?text=Olá!%20Gostaria%20de%20conhecer%20o%20Masmorra%20Manager%20para%20meu%20clube%20de%20poker.', '_blank');
  };

  const faqs = [
    {
      q: 'Funciona no celular?',
      a: 'Sim! Toda a interface do Masmorra Manager foi desenhada seguindo os princípios de Mobile-First. Operadores de mesa e gerentes conseguem lançar todas as transações com facilidade diretamente do celular ou tablet de dentro do clube.'
    },
    {
      q: 'Posso usar em mais de um clube?',
      a: 'Sim, o sistema possui suporte nativo multi-clube para proprietários que gerenciam mais de uma unidade. Cada clube possui seu ambiente, jogadores, mesas e caixas totalmente isolados e seguros.'
    },
    {
      q: 'Os dados ficam seguros?',
      a: 'Absolutamente. Todas as comunicações são criptografadas e os dados são salvos na nuvem do Supabase, que possui infraestrutura de nível bancário e backups contínuos automáticos.'
    },
    {
      q: 'Preciso instalar algo?',
      a: 'Não. O Masmorra Manager é um SaaS em nuvem (Web App). Você pode acessá-lo por qualquer navegador no celular, tablet ou computador sem precisar baixar nenhum aplicativo da loja.'
    },
    {
      q: 'Como funciona o suporte?',
      a: 'Nosso suporte é realizado diretamente via WhatsApp com gerentes de contas dedicados para ajudar no onboarding, treinamento de operadores e dúvidas no dia a dia.'
    },
    {
      q: 'Posso testar antes?',
      a: 'Claro! Fale com nossa equipe de vendas pelo botão de WhatsApp e criamos um ambiente de teste gratuito e exclusivo para você avaliar a plataforma.'
    }
  ];

  return (
    <div className="lp-container text-white">
      {/* Navbar */}
      <header className={`lp-navbar ${scrolled ? 'lp-navbar-scrolled' : ''}`}>
        <div className="flex items-center gap-2 font-bold text-white text-lg">
          <Spade size={22} className="text-primary" />
          <span>Masmorra Manager</span>
        </div>
        
        <nav className="lp-nav-links">
          <a href="#recursos" className="lp-nav-link">Recursos</a>
          <a href="#como-funciona" className="lp-nav-link">Como Funciona</a>
          <a href="#planos" className="lp-nav-link">Planos</a>
          <a href="#faq" className="lp-nav-link">FAQ</a>
        </nav>

        <div className="lp-nav-actions">
          {user ? (
            <button className="btn btn-outline btn-sm desktop-only" onClick={() => navigate('/dashboard')}>
              Acessar Painel
            </button>
          ) : (
            <button className="btn btn-outline btn-sm desktop-only" style={{ borderColor: 'rgba(255,255,255,0.1)' }} onClick={() => navigate('/login')}>
              Entrar
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleCtaClick}>
            Começar Agora
          </button>
          <button className="lp-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Dropdown */}
      <nav className={`lp-mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
        <a href="#recursos" className="lp-nav-link text-center py-2" onClick={() => setMobileMenuOpen(false)}>Recursos</a>
        <a href="#como-funciona" className="lp-nav-link text-center py-2" onClick={() => setMobileMenuOpen(false)}>Como Funciona</a>
        <a href="#planos" className="lp-nav-link text-center py-2" onClick={() => setMobileMenuOpen(false)}>Planos</a>
        <a href="#faq" className="lp-nav-link text-center py-2" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
        <hr className="border-glass-border my-2" />
        {user ? (
          <button className="btn btn-outline w-full py-3" onClick={() => { setMobileMenuOpen(false); navigate('/dashboard'); }}>
            Acessar Painel
          </button>
        ) : (
          <button className="btn btn-outline w-full py-3" onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}>
            Entrar
          </button>
        )}
      </nav>

      {/* Hero Section */}
      <section className="lp-section">
        <div className="lp-hero-grid">
          <div className="lp-hero-left">
            <span className="lp-hero-tag">SaaS B2B PARA CLUBES DE POKER</span>
            <h1 className="lp-hero-title">
              Gerencie seu clube de poker como um verdadeiro negócio.
            </h1>
            <p className="lp-hero-subtitle">
              Controle mesas, jogadores, buy-ins, cash-outs, consumo de bar e o fechamento de caixa em uma única plataforma web moderna e em tempo real.
            </p>
            
            <div className="lp-hero-bullets">
              <span className="lp-hero-bullet">
                <Check size={16} className="lp-hero-bullet-check" /> Sem papel
              </span>
              <span className="lp-hero-bullet">
                <Check size={16} className="lp-hero-bullet-check" /> Sem planilhas
              </span>
              <span className="lp-hero-bullet">
                <Check size={16} className="lp-hero-bullet-check" /> Sem erros de caixa
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button className="btn btn-primary btn-lg" onClick={handleCtaClick}>
                Começar Agora
              </button>
              <button className="btn btn-outline btn-lg" style={{ borderColor: 'rgba(255,255,255,0.08)' }} onClick={handleCtaClick}>
                Solicitar Demonstração
              </button>
            </div>

            <div className="lp-social-proof flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="lp-stars">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
              </div>
              <p className="text-xs text-muted mb-0 font-medium">
                Utilizado e aprovado por clubes de poker do Rio Grande do Sul.
              </p>
            </div>
          </div>

          {/* Right Column: Hero Visual CSS Mockup (Active Cash Game Table) */}
          <div className="lp-hero-right">
            <div className="lp-mockup-wrapper animate-fade-in">
              <div className="lp-mock-header">
                <div className="lp-mock-dot bg-danger"></div>
                <div className="lp-mock-dot bg-warning"></div>
                <div className="lp-mock-dot bg-success"></div>
                <span className="text-[10px] text-muted ml-2 font-mono">masmorramanager.com/table/vip-poker</span>
              </div>
              <div className="lp-table-view">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-white mb-1">Mesa 1 - Cash Game VIP</h4>
                    <span className="text-[10px] text-muted">Aberto às 14:00 (PLO5)</span>
                  </div>
                  <span className="badge badge-active text-[10px] px-2 py-0.5">Mesa Ativa</span>
                </div>
                
                {/* Simulated Player Rows */}
                <div className="space-y-2 mb-6">
                  <div className="lp-player-row">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary bg-opacity-20 text-primary flex items-center justify-center text-[10px] font-bold">G</div>
                      <span className="text-xs font-semibold">Gabriel (Botão)</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted" style={{ margin: 0 }}>Saldo Atual</p>
                      <p className="text-xs font-bold text-success" style={{ margin: 0 }}>+ R$ 142,00</p>
                    </div>
                  </div>

                  <div className="lp-player-row">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-warning bg-opacity-20 text-warning flex items-center justify-center text-[10px] font-bold">F</div>
                      <span className="text-xs font-semibold">Felipe (Cutoff)</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted" style={{ margin: 0 }}>Saldo Atual</p>
                      <p className="text-xs font-bold text-danger" style={{ margin: 0 }}>- R$ 108,00</p>
                    </div>
                  </div>

                  <div className="lp-player-row">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-500 bg-opacity-20 text-purple-400 flex items-center justify-center text-[10px] font-bold">M</div>
                      <span className="text-xs font-semibold">Marta (Dealer)</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted" style={{ margin: 0 }}>Saldo Atual</p>
                      <p className="text-xs font-bold text-white" style={{ margin: 0 }}>R$ 0,00</p>
                    </div>
                  </div>
                </div>

                {/* Simulated Action Log */}
                <div className="border-t border-glass-border pt-4">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Ações Recentes da Mesa</p>
                  <div className="space-y-1.5 font-mono">
                    {heroLogs.map((log, idx) => (
                      <div key={idx} className="lp-log-entry animate-fade-in truncate">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Trust */}
      <section className="lp-trust-section">
        <div className="lp-trust-container">
          <p className="lp-trust-title">Clubes que já estão profissionalizando sua operação</p>
          <div className="lp-trust-list">
            <span className="lp-trust-item">♠ Masmorra Poker Club</span>
            <span className="lp-trust-item">♥ Caramelo's Poker</span>
            <span className="lp-trust-item">♣ Holy Cross Poker Club</span>
          </div>
        </div>
      </section>

      {/* Seção - O Problema */}
      <section className="lp-section">
        <div className="lp-section-header">
          <h2>Seu clube ainda controla tudo no papel?</h2>
          <p>Planilhas confusas e anotações manuais causam rombos financeiros ocultos e estressam sua equipe.</p>
        </div>

        <div className="lp-problem-grid">
          <div className="lp-problem-card">
            <div className="lp-problem-icon">
              <FileText size={20} />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">Anotações em folhas</h3>
            <p className="text-xs text-muted leading-relaxed">
              Fichas perdidas e rasuras em blocos de papel dificultam o rastreamento das transações.
            </p>
          </div>

          <div className="lp-problem-card">
            <div className="lp-problem-icon">
              <TrendingDown size={20} />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">Erros de caixa</h3>
            <p className="text-xs text-muted leading-relaxed">
              Diferenças entre o valor em caixa e os buy-ins geram prejuízos não identificados no fechamento.
            </p>
          </div>

          <div className="lp-problem-card">
            <div className="lp-problem-icon">
              <Coffee size={20} />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">Consumos esquecidos</h3>
            <p className="text-xs text-muted leading-relaxed">
              Bebidas e snacks anotados incorretamente ou não cobrados no momento do cash-out do jogador.
            </p>
          </div>

          <div className="lp-problem-card">
            <div className="lp-problem-icon">
              <RefreshCw size={20} />
            </div>
            <h3 className="text-sm font-bold text-white mb-2">Fechamento demorado</h3>
            <p className="text-xs text-muted leading-relaxed">
              Gerentes passando horas na madrugada para calcular o rake e consolidar as contas da noite.
            </p>
          </div>
        </div>
      </section>

      {/* Seção - A Solução (Recursos com Mockups) */}
      <section id="recursos" className="lp-section border-t border-glass-border">
        <div className="lp-section-header">
          <h2>Tudo o que seu clube precisa em um único sistema</h2>
          <p>Desenhado sob medida para simplificar processos e aumentar o rake médio do seu clube.</p>
        </div>

        {/* Feature 1 */}
        <div className="lp-solution-row">
          <div className="lp-solution-content">
            <span className="lp-solution-badge">MESAS DE CASH GAME</span>
            <h3 className="lp-solution-title">Controle de Mesas em Tempo Real</h3>
            <p className="lp-solution-desc">
              Gerencie a abertura e o fechamento de mesas instantaneamente. Adicione e remova jogadores com poucos cliques. Tenha uma linha do tempo clara de todas as ações ocorridas.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs font-semibold text-white">
                <CheckCircle size={16} className="text-primary" /> Visualização simples e mobile-friendly
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-white">
                <CheckCircle size={16} className="text-primary" /> Histórico de ações ordenado das mais recentes às antigas
              </div>
            </div>
          </div>
          <div className="lp-mockup-wrapper">
            <div className="lp-mock-header">
              <div className="lp-mock-dot bg-danger"></div>
              <div className="lp-mock-dot bg-warning"></div>
              <div className="lp-mock-dot bg-success"></div>
              <span className="text-[10px] text-muted ml-2 font-mono">Gerenciamento de Mesas</span>
            </div>
            <div className="p-4 bg-dark bg-opacity-65 rounded-xl border border-glass-border text-left">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-white">Mesa Ativa - Rake 5%</span>
                <span className="badge badge-active text-[9px]">Ativa</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-black bg-opacity-40 rounded-lg text-center">
                  <p className="text-[9px] text-muted uppercase font-bold">Total Entradas</p>
                  <p className="text-sm font-extrabold text-white">R$ 1.800,00</p>
                </div>
                <div className="flex-1 p-3 bg-black bg-opacity-40 rounded-lg text-center">
                  <p className="text-[9px] text-muted uppercase font-bold">Total Saídas</p>
                  <p className="text-sm font-extrabold text-white">R$ 1.150,00</p>
                </div>
                <div className="flex-1 p-3 bg-black bg-opacity-40 rounded-lg text-center">
                  <p className="text-[9px] text-muted uppercase font-bold">Rake Acumulado</p>
                  <p className="text-sm font-extrabold text-primary">R$ 90,00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2 */}
        <div className="lp-solution-row reverse">
          <div className="lp-solution-content">
            <span className="lp-solution-badge">COPA E PRODUTOS</span>
            <h3 className="lp-solution-title">Consumo de Bar Totalmente Integrado</h3>
            <p className="lp-solution-desc">
              Chega de bilhetes de papel perdidos ou fiado esquecido. Lance águas, refrigerantes, cervejas e energéticos diretamente no nome do jogador e debite tudo no fechamento de forma integrada.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs font-semibold text-white">
                <CheckCircle size={16} className="text-primary" /> Preços de bar customizáveis nas configurações do clube
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-white">
                <CheckCircle size={16} className="text-primary" /> Lançamentos fáceis pelo celular com apenas um clique
              </div>
            </div>
          </div>
          <div className="lp-mockup-wrapper">
            <div className="lp-mock-header">
              <div className="lp-mock-dot bg-danger"></div>
              <div className="lp-mock-dot bg-warning"></div>
              <div className="lp-mock-dot bg-success"></div>
              <span className="text-[10px] text-muted ml-2 font-mono">Consumo da Copa</span>
            </div>
            <div className="p-4 bg-dark bg-opacity-65 rounded-xl border border-glass-border text-left">
              <p className="text-[10px] font-bold text-muted uppercase mb-3">Lançamento de Copa</p>
              <div className="grid grid-cols-2 gap-2">
                <button className="p-3 bg-white bg-opacity-5 hover:bg-opacity-10 border border-glass-border rounded-lg text-center text-xs font-semibold">
                  🍺 Cerveja (R$ 6,00)
                </button>
                <button className="p-3 bg-white bg-opacity-5 hover:bg-opacity-10 border border-glass-border rounded-lg text-center text-xs font-semibold">
                  ⚡ Energético (R$ 8,00)
                </button>
                <button className="p-3 bg-white bg-opacity-5 hover:bg-opacity-10 border border-glass-border rounded-lg text-center text-xs font-semibold">
                  🥤 Coca-Cola (R$ 5,00)
                </button>
                <button className="p-3 bg-white bg-opacity-5 hover:bg-opacity-10 border border-glass-border rounded-lg text-center text-xs font-semibold">
                  💧 Água (R$ 3,00)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção - Como Funciona */}
      <section id="como-funciona" className="lp-section border-t border-glass-border" style={{ backgroundColor: 'rgba(15, 23, 42, 0.1)' }}>
        <div className="lp-section-header">
          <h2>Fluxo operacional simplificado</h2>
          <p>Profissionalize sua equipe para rodar o clube com rapidez e controle de ponta a ponta.</p>
        </div>

        <div className="lp-timeline">
          <div className="lp-timeline-item">
            <div className="lp-timeline-dot"></div>
            <div className="lp-timeline-card">
              <h3>1. Crie a mesa</h3>
              <p className="text-xs text-muted leading-relaxed">
                Defina o nome da mesa, número e modalidade de jogo (ex: PLO5, Texas Holdem) no seu dashboard em segundos.
              </p>
            </div>
          </div>

          <div className="lp-timeline-item left">
            <div className="lp-timeline-dot"></div>
            <div className="lp-timeline-card">
              <h3>2. Adicione os jogadores</h3>
              <p className="text-xs text-muted leading-relaxed">
                Cadastre ou selecione jogadores da sua base unificada de forma extremamente ágil pelo celular.
              </p>
            </div>
          </div>

          <div className="lp-timeline-item">
            <div className="lp-timeline-dot"></div>
            <div className="lp-timeline-card">
              <h3>3. Registre movimentações</h3>
              <p className="text-xs text-muted leading-relaxed">
                Lance entradas de fichas (buy-in), re-buys e saídas (cash-out), além de consumos da copa direto no operador.
              </p>
            </div>
          </div>

          <div className="lp-timeline-item left">
            <div className="lp-timeline-dot"></div>
            <div className="lp-timeline-card">
              <h3>4. Feche o caixa</h3>
              <p className="text-xs text-muted leading-relaxed">
                Ao final da sessão, confira o rake acumulado, filtre as saídas e confira os fechamentos com 100% de exatidão.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção - Dashboard Financeira */}
      <section className="lp-section border-t border-glass-border">
        <div className="lp-section-header">
          <h2>Veja o caixa do seu clube em tempo real</h2>
          <p>Monitore mesas ativas, rake acumulado e consumos através de gráficos elegantes e estatísticas automáticas.</p>
        </div>

        {/* SVG/HTML Dashboard Mockup */}
        <div className="lp-mockup-wrapper max-w-5xl mx-auto mb-12">
          <div className="lp-mock-header">
            <div className="lp-mock-dot bg-danger"></div>
            <div className="lp-mock-dot bg-warning"></div>
            <div className="lp-mock-dot bg-success"></div>
            <span className="text-[10px] text-muted ml-2 font-mono">Estatísticas Gerais do Clube</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-left">
            <div className="p-5 bg-dark bg-opacity-80 rounded-xl border border-glass-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-muted uppercase">Faturamento Diário</span>
                <Landmark className="text-primary" size={16} />
              </div>
              <p className="text-2xl font-black text-white">R$ 14.850,00</p>
              <span className="text-[10px] text-success font-semibold">↑ 18.5% em relação a ontem</span>
            </div>

            <div className="p-5 bg-dark bg-opacity-80 rounded-xl border border-glass-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-muted uppercase">Rake Total Acumulado</span>
                <Activity className="text-primary" size={16} />
              </div>
              <p className="text-2xl font-black text-white">R$ 1.920,00</p>
              <span className="text-[10px] text-success font-semibold">↑ 12% de rake médio</span>
            </div>

            <div className="p-5 bg-dark bg-opacity-80 rounded-xl border border-glass-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-muted uppercase">Copa / Bar</span>
                <Coffee className="text-primary" size={16} />
              </div>
              <p className="text-2xl font-black text-white">R$ 840,00</p>
              <span className="text-[10px] text-muted">142 itens de copa lançados</span>
            </div>
          </div>

          {/* SVG Vector Chart */}
          <div className="p-5 bg-dark bg-opacity-80 rounded-xl border border-glass-border">
            <div className="flex justify-between items-center mb-6 text-left">
              <div>
                <span className="text-xs font-bold text-muted uppercase">Volume de Caixa (7 dias)</span>
              </div>
            </div>
            
            <div className="h-48 w-full relative flex items-end">
              <svg className="w-full h-full" viewBox="0 0 600 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Chart Area background fill */}
                <path d="M 0 140 Q 100 110 200 130 T 400 60 T 600 30 L 600 150 L 0 150 Z" fill="url(#chart-glow)" />
                {/* Chart line path */}
                <path d="M 0 140 Q 100 110 200 130 T 400 60 T 600 30" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-4">
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Recursos (Grid 3x4) */}
      <section className="lp-section border-t border-glass-border">
        <div className="lp-section-header">
          <h2>Completo de ponta a ponta</h2>
          <p>Tudo o que seu gerente precisa para rodar o clube com a maior eficiência do mercado.</p>
        </div>

        <div className="lp-rec-grid">
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Mesas ilimitadas</h3>
            <p className="text-xs text-muted leading-relaxed">Crie e controle quantas mesas de cash game desejar de forma simultânea.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Jogadores ilimitados</h3>
            <p className="text-xs text-muted leading-relaxed">Cadastre seu pool completo de jogadores sem limite de faturamento.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Histórico completo</h3>
            <p className="text-xs text-muted leading-relaxed">Consulte movimentações, fechamentos antigos e auditoria a qualquer momento.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Relatórios por jogador</h3>
            <p className="text-xs text-muted leading-relaxed">Veja saldos acumulados, ganhos, perdas e frequências individuais do pool.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Controle de consumo</h3>
            <p className="text-xs text-muted leading-relaxed">Evite furos de estoque. Lance a copa do bar no exato momento da venda.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Fechamento de caixa</h3>
            <p className="text-xs text-muted leading-relaxed">Consolide todas as transações financeiras em menos de 5 minutos.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Multi-clube</h3>
            <p className="text-xs text-muted leading-relaxed">Gerencie mais de uma franquia ou unidade física de forma isolada.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Sistema em nuvem</h3>
            <p className="text-xs text-muted leading-relaxed">Acesse os caixas do seu clube de qualquer lugar e a qualquer hora.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Login seguro</h3>
            <p className="text-xs text-muted leading-relaxed">Sua conta protegida via Supabase Auth com níveis avançados de acesso.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">100% Responsivo</h3>
            <p className="text-xs text-muted leading-relaxed">Experiência adaptada para celulares, tablets, computadores e monitores.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Backup automático</h3>
            <p className="text-xs text-muted leading-relaxed">Seus dados e históricos protegidos contra falhas de hardware locais.</p>
          </div>
          <div className="lp-rec-card">
            <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Atualizações contínuas</h3>
            <p className="text-xs text-muted leading-relaxed">Acesso garantido a novas features sem taxas ou cobranças extras.</p>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="lp-section border-t border-glass-border">
        <div className="lp-section-header">
          <h2>Aprovado por proprietários de poker</h2>
          <p>O que os donos de clubes de cash game dizem sobre a plataforma.</p>
        </div>

        <div className="lp-dep-grid">
          <div className="lp-dep-card">
            <div className="lp-stars mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
            </div>
            <p className="lp-dep-quote">
              "O fechamento de caixa ficou muito mais rápido. Não usamos mais papel na mesa e agora eu controlo as movimentações mesmo viajando."
            </p>
            <p className="text-xs font-bold text-white mb-1">Gabriel Silveira</p>
            <p className="text-[10px] text-muted">Masmorra Poker Club</p>
          </div>

          <div className="lp-dep-card">
            <div className="lp-stars mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
            </div>
            <p className="lp-dep-quote">
              "Consegui zerar a perda de faturamento do bar. A copa integrada funciona super bem com toque no tablet e meus operadores adoraram."
            </p>
            <p className="text-xs font-bold text-white mb-1">Enzo Azevedo</p>
            <p className="text-[10px] text-muted">Aces High Arena</p>
          </div>

          <div className="lp-dep-card">
            <div className="lp-stars mb-4">
              {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
            </div>
            <p className="lp-dep-quote">
              "Auditoria de saldo completa. Se há alguma diferença de caixa no final da noite, conseguimos conferir todo o histórico da mesa com cliques."
            </p>
            <p className="text-xs font-bold text-white mb-1">Marta Linhares</p>
            <p className="text-[10px] text-muted">Vegas Holdem Arena</p>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="lp-section border-t border-glass-border">
        <div className="lp-section-header">
          <h2>Um plano simples para qualquer clube</h2>
          <p>Sem taxas ocultas, limites de rake ou complicação. Profissionalize seu caixa agora.</p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="glass-panel text-center p-8 border-2 border-primary border-opacity-30 relative overflow-hidden" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
            <div className="absolute top-0 right-0 bg-primary text-white text-[9px] font-bold px-3 py-1 uppercase tracking-wider rounded-bl-lg">SaaS ILIMITADO</div>
            <span className="text-xs font-bold text-primary uppercase tracking-widest block mb-4">Plano Único</span>
            <div className="flex justify-center items-baseline gap-2 mb-6">
              <span className="text-4xl font-black text-white">R$ 99</span>
              <span className="text-xs text-muted font-semibold">/ mês</span>
            </div>
            
            <hr className="border-glass-border my-6" />

            <ul className="space-y-4 text-left max-w-xs mx-auto mb-8 text-xs font-semibold text-white">
              <li className="flex items-center gap-3">
                <Check size={16} className="text-primary flex-shrink-0" /> Mesas de Cash Game Ilimitadas
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} className="text-primary flex-shrink-0" /> Cadastro Ilimitado de Jogadores
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} className="text-primary flex-shrink-0" /> Histórico Completo & Rake
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} className="text-primary flex-shrink-0" /> Relatórios Dinâmicos
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} className="text-primary flex-shrink-0" /> Multi-clube Integrado
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} className="text-primary flex-shrink-0" /> Atualizações Inclusas
              </li>
              <li className="flex items-center gap-3">
                <Check size={16} className="text-primary flex-shrink-0" /> Suporte VIP via WhatsApp
              </li>
            </ul>

            <button className="btn btn-primary w-full py-4 rounded-xl font-bold hover:shadow-lg transition-all" onClick={handleCtaClick}>
              Começar Agora
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="lp-section border-t border-glass-border">
        <div className="lp-section-header">
          <h2>Perguntas Frequentes</h2>
          <p>Tudo o que você precisa saber sobre o funcionamento da plataforma.</p>
        </div>

        <div className="lp-faq-container">
          {faqs.map((faq, index) => {
            const isOpen = activeFaq === index;
            return (
              <div key={index} className={`lp-faq-item ${isOpen ? 'open' : ''}`}>
                <button className="lp-faq-question" onClick={() => toggleFaq(index)}>
                  <span>{faq.q}</span>
                  <HelpCircle size={18} className={`text-muted transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                </button>
                <div className="lp-faq-answer">
                  <p className="mb-0">{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="lp-section">
        <div className="lp-cta-panel">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Pronto para profissionalizar seu clube?</h2>
          <p className="text-sm text-muted max-w-lg mx-auto mb-8 leading-relaxed">
            Agende uma demonstração hoje mesmo e veja como o Masmorra Manager pode simplificar toda a operação das suas mesas de poker.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button className="btn btn-primary btn-lg w-full sm:w-auto" onClick={handleCtaClick}>
              Solicitar Demonstração
            </button>
            <button className="btn btn-outline btn-lg w-full sm:w-auto" style={{ borderColor: 'rgba(255,255,255,0.08)' }} onClick={() => navigate('/login')}>
              Entrar no Sistema
            </button>
          </div>
        </div>
      </section>

      {/* Rodapé (Footer) */}
      <footer className="border-t border-glass-border bg-dark bg-opacity-30 py-16">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 text-left">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-white text-lg mb-4">
              <Spade size={22} className="text-primary" />
              <span>Masmorra Manager</span>
            </div>
            <p className="text-xs text-muted max-w-sm leading-relaxed mb-4">
              O sistema completo e moderno na nuvem para gerenciamento financeiro de mesas de cash game e controle da copa para clubes de poker.
            </p>
            <div className="text-xs text-muted space-y-1">
              <p>WhatsApp: (51) 99881-1587</p>
              <p>Instagram: @masmorrapoker</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Links</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#recursos" className="text-muted hover:text-white transition-colors">Recursos</a></li>
              <li><a href="#como-funciona" className="text-muted hover:text-white transition-colors">Como Funciona</a></li>
              <li><a href="#planos" className="text-muted hover:text-white transition-colors">Planos</a></li>
              <li><a href="#faq" className="text-muted hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Acesso</h4>
            <ul className="space-y-2 text-xs">
              <li><span onClick={() => navigate('/login')} className="text-muted hover:text-white transition-colors cursor-pointer">Login do Sistema</span></li>
              <li><span onClick={handleCtaClick} className="text-muted hover:text-white transition-colors cursor-pointer">Suporte Comercial</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 mt-12 pt-8 border-t border-glass-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted">
          <p>© 2026 Masmorra Manager. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white">Termos de Uso</a>
            <a href="#" className="hover:text-white">Privacidade</a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <div className="lp-whatsapp-float" onClick={handleCtaClick} title="Fale no WhatsApp">
        <MessageSquare size={24} />
      </div>
    </div>
  );
}
