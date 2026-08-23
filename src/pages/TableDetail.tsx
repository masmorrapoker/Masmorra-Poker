import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Table, Player, Transaction, PlayerSummary, GlobalPlayer } from '../types';
import { UserPlus, XCircle, Search, UserCheck, Trash2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';
import { transactionService } from '../services/transactionService';
import { playerService } from '../services/playerService';
import { clubSettingsService } from '../services/clubSettingsService';
import { formatMoney, calculatePlayerBalance } from '../utils';
import { triggerHaptic } from '../utils/haptic';
import { toast } from '../components/Toast';

export default function TableDetail() {
  const { id } = useParams<{ id: string }>();
  const { clubId, beerPrice, energyPrice } = useClub();
  
  const [table, setTable] = useState<Table | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<GlobalPlayer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Collapsible states
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [isClosedPlayersExpanded, setIsClosedPlayersExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Player action overlay states
  const [activePlayerAction, setActivePlayerAction] = useState<PlayerSummary | null>(null);
  const [activeActionType, setActiveActionType] = useState<'buy_in' | 'cash_out' | 'consumo' | 'edit' | null>(null);

  // Input states
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerPhone, setEditPlayerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isClosingTable, setIsClosingTable] = useState(false);
  const [consumoItems, setConsumoItems] = useState<any[]>([]);

  // Load custom products and initialize table channels
  useEffect(() => {
    if (id && clubId) {
      fetchTableData();
      fetchGlobalPlayers();
      
      clubSettingsService.getSettings(clubId)
        .then(settings => {
          if (settings && Array.isArray(settings.custom_products) && settings.custom_products.length > 0) {
            setConsumoItems(settings.custom_products.filter((p: any) => p.active !== false));
          } else {
            setConsumoItems([
              { name: 'Água', price: 0 },
              { name: 'Água com gás', price: 0 },
              { name: 'Coca-Cola', price: 5.0 },
              { name: 'Coca-Cola Zero', price: 5.0 },
              { name: 'Cerveja', price: beerPrice },
              { name: 'Energético', price: energyPrice },
            ]);
          }
        })
        .catch(err => {
          console.error(err);
          setConsumoItems([
            { name: 'Água', price: 0 },
            { name: 'Água com gás', price: 0 },
            { name: 'Coca-Cola', price: 5.0 },
            { name: 'Coca-Cola Zero', price: 5.0 },
            { name: 'Cerveja', price: beerPrice },
            { name: 'Energético', price: energyPrice },
          ]);
        });
      
      const tablesSub = supabase
        .channel(`table_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `id=eq.${id}` }, () => fetchTableData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${id}` }, () => fetchTableData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `table_id=eq.${id}` }, () => fetchTableData())
        .subscribe();

      const playersSub = supabase
        .channel('public:players')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `club_id=eq.${clubId}` }, () => fetchGlobalPlayers())
        .subscribe();

      return () => {
        supabase.removeChannel(tablesSub);
        supabase.removeChannel(playersSub);
      };
    }
  }, [id, clubId]);

  // Sync edit form fields when a player is selected
  useEffect(() => {
    if (activePlayerAction) {
      setEditPlayerName(activePlayerAction.player.name);
      const gp = globalPlayers.find(g => g.name === activePlayerAction.player.name);
      setEditPlayerPhone(gp?.phone || '');
    }
  }, [activePlayerAction, globalPlayers]);

  const handleQuickAdd = (val: number) => {
    triggerHaptic('light');
    setTxAmount(prev => {
      const current = parseFloat(prev);
      if (isNaN(current) || current <= 0) return val.toString();
      return (current + val).toString();
    });
  };

  async function fetchTableData() {
    if (!id || !clubId) return;
    try {
      const [tableData, playersData, txData] = await Promise.all([
        tableService.getTable(clubId, id),
        tableService.getTablePlayers(clubId, id),
        transactionService.getTransactions(clubId, id)
      ]);
      setTable(tableData);
      setPlayers(playersData || []);
      setTransactions(txData || []);
    } catch (error) {
      console.error('Error fetching table details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGlobalPlayers() {
    if (!clubId) return;
    try {
      const data = await playerService.getPlayers(clubId);
      setGlobalPlayers(data);
    } catch (error) {
      console.error('Error fetching global players:', error);
    }
  }

  async function addPlayerToTable(playerName: string) {
    if (!id || !clubId) return;
    try {
      await tableService.addPlayerToTable(clubId, id, playerName);
      toast.success(`${playerName} adicionado na mesa!`);
      triggerHaptic('success');
      await fetchTableData();
      setIsAddingPlayer(false);
      setPlayerSearchTerm('');
    } catch (error) {
      toast.error('Erro ao adicionar jogador.');
      console.error('Error adding player to table:', error);
    }
  }

  async function saveTransaction(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount < 0 || !id || !clubId || isSubmitting || !activePlayerAction) return;

    setIsSubmitting(true);
    try {
      await transactionService.createTransaction(clubId, {
        table_id: id,
        player_id: activePlayerAction.player.id,
        type: activeActionType as any,
        amount: amount,
        description: txDescription || (activeActionType === 'consumo' ? 'Consumo Manual' : undefined)
      });
      
      const typeLabel = activeActionType === 'buy_in' ? 'Buy-in' : activeActionType === 'cash_out' ? 'Cash-out' : 'Consumo';
      toast.success(`${typeLabel} registrado!`);
      triggerHaptic('success');

      setActivePlayerAction(null);
      setActiveActionType(null);
      setTxAmount('');
      setTxDescription('');
      await fetchTableData();
    } catch (error) {
      toast.error('Erro ao registrar.');
      console.error('Error saving transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function registerConsumo(itemName: string, amount: number) {
    if (!id || !clubId || isSubmitting || !activePlayerAction) return;
    setIsSubmitting(true);
    try {
      await transactionService.createTransaction(clubId, {
        table_id: id,
        player_id: activePlayerAction.player.id,
        type: 'consumo',
        amount: amount,
        description: itemName
      });
      
      toast.success('Consumo registrado.');
      triggerHaptic('success');

      setActivePlayerAction(null);
      setActiveActionType(null);
      setTxAmount('');
      setTxDescription('');
      await fetchTableData();
    } catch (error) {
      toast.error('Erro ao lançar consumo.');
      console.error('Error saving consumo:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleEditPlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlayerAction || !clubId || !editPlayerName.trim()) return;
    const gp = globalPlayers.find(g => g.name === activePlayerAction.player.name);
    if (!gp) return;
    try {
      await playerService.updatePlayer(clubId, gp.id, {
        name: editPlayerName,
        phone: editPlayerPhone.trim() || null
      });
      toast.success('Cadastro atualizado!');
      triggerHaptic('success');
      await fetchTableData();
      setActivePlayerAction(null);
      setActiveActionType(null);
    } catch (err) {
      toast.error('Erro ao atualizar cadastro.');
      console.error(err);
    }
  };

  async function deleteTransaction(txId: string) {
    if (!window.confirm('Tem certeza que deseja remover esta transação?')) return;
    if (!clubId) return;
    triggerHaptic('medium');
    try {
      await transactionService.deleteTransaction(clubId, txId);
      toast.success('Transação removida!');
      await fetchTableData();
    } catch (error) {
      toast.error('Erro ao remover transação.');
      console.error('Error deleting transaction:', error);
    }
  }

  async function closeTable() {
    if (!id || !clubId) return;
    try {
      await tableService.closeTable(clubId, id);
      toast.success('Mesa encerrada com sucesso!');
      triggerHaptic('success');
      setIsClosingTable(false);
      await fetchTableData();
    } catch (error) {
      toast.error('Erro ao fechar mesa.');
      console.error('Error closing table:', error);
    }
  }

  const getTableDuration = () => {
    if (!table) return '0m';
    const start = new Date(table.created_at).getTime();
    const end = table.closed_at ? new Date(table.closed_at).getTime() : Date.now();
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Compile calculations
  const playerSummaries: PlayerSummary[] = players.map(player => {
    const playerTxs = transactions.filter(tx => tx.player_id === player.id);
    const buyIn = playerTxs.filter(tx => tx.type === 'buy_in').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const cashOut = playerTxs.filter(tx => tx.type === 'cash_out').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const consumo = playerTxs.filter(tx => tx.type === 'consumo').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const balance = calculatePlayerBalance(buyIn, cashOut, consumo);
    return { player, buyIn, cashOut, consumo, balance };
  });

  const activePlayers = playerSummaries.filter(p => p.cashOut === 0);
  const closedPlayers = playerSummaries.filter(p => p.cashOut > 0);

  const totalBuyIn = playerSummaries.reduce((sum, p) => sum + p.buyIn, 0);
  const totalConsumo = playerSummaries.reduce((sum, p) => sum + p.consumo, 0); 

  const availablePlayersToAdd = globalPlayers.filter(
    gp => !players.some(tp => tp.name === gp.name) && gp.name.toLowerCase().includes(playerSearchTerm.toLowerCase())
  );
  
  const showCreateOption = playerSearchTerm.trim().length > 0 && 
    !globalPlayers.some(gp => gp.name.toLowerCase() === playerSearchTerm.toLowerCase());

  if (loading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
  if (!table) return <div className="container text-center p-20">Mesa não encontrada.</div>;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto mobile-view-padding text-left relative">
      
      {/* Back button (Mobile uses layout header) */}
      <Link 
        to="/dashboard" 
        onClick={() => triggerHaptic('light')}
        className="btn btn-outline mb-6 desktop-only text-white no-underline"
      >
        <ArrowLeft size={18} /> Voltar para Painel
      </Link>

      {/* 1. COMPACT TABLE SUMMARY CARD */}
      <div className="glass-panel mb-6 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-glass-border">
        <div className="text-left">
          <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Painel Operacional</span>
          <h1 className="text-2xl md:text-3xl font-black text-white mt-1 mb-2">{table.name}</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="badge badge-active flex items-center gap-1">
              {table.status === 'active' ? '🟢 Aberta' : '🔴 Fechada'}
            </span>
            <span className="bg-black bg-opacity-35 px-2.5 py-1 rounded-lg text-muted font-semibold">
              ⏳ {getTableDuration()}
            </span>
          </div>
        </div>

        {/* Stats compact grid layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto text-left">
          <div className="p-3 bg-black bg-opacity-20 rounded-xl border border-glass-border">
            <span className="text-[9px] text-muted uppercase font-bold block">Jogadores Ativos</span>
            <span className="text-sm font-extrabold text-white">{activePlayers.length}</span>
          </div>
          <div className="p-3 bg-black bg-opacity-20 rounded-xl border border-glass-border">
            <span className="text-[9px] text-muted uppercase font-bold block">Jogadores Saíram</span>
            <span className="text-sm font-extrabold text-muted">{closedPlayers.length}</span>
          </div>
          <div className="p-3 bg-black bg-opacity-20 rounded-xl border border-glass-border">
            <span className="text-[9px] text-muted uppercase font-bold block">Movimentação Total</span>
            <span className="text-sm font-extrabold text-warning">{formatMoney(totalBuyIn)}</span>
          </div>
          <div className="p-3 bg-black bg-opacity-20 rounded-xl border border-glass-border">
            <span className="text-[9px] text-muted uppercase font-bold block">Consumo Copa</span>
            <span className="text-sm font-extrabold text-danger">{formatMoney(totalConsumo)}</span>
          </div>
        </div>

        {table.status === 'active' && (
          <button 
            className="btn btn-danger w-full md:w-auto active:scale-95 transition-transform" 
            onClick={() => {
              triggerHaptic('medium');
              setIsClosingTable(true);
            }}
          >
            <XCircle size={18} /> Encerrar Mesa
          </button>
        )}
      </div>

      {/* 2. ACTIVE PLAYERS SECTION */}
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-opacity-80">
            Jogadores Ativos na Mesa ({activePlayers.length})
          </h2>
          
          {activePlayers.length === 0 ? (
            <div className="glass-panel text-center p-12">
              <span className="text-muted text-xs block mb-4">Nenhum jogador ativo nesta mesa.</span>
              {table.status === 'active' && (
                <button 
                  className="btn btn-success mx-auto active:scale-95 transition-transform"
                  onClick={() => setIsAddingPlayer(true)}
                >
                  <UserPlus size={16} /> Adicionar Jogador
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePlayers.map(summary => (
                <div 
                  key={summary.player.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setActivePlayerAction(summary);
                    setActiveActionType(null);
                  }}
                  className="mobile-card p-5 bg-card border border-glass-border hover:border-primary rounded-2xl flex items-center justify-between shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary bg-opacity-10 text-primary flex items-center justify-center font-bold text-sm">
                      {summary.player.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-base text-white block">{summary.player.name}</span>
                      <span className="text-[10px] text-muted block mt-0.5">Em jogo</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-muted font-bold block uppercase">Saldo Parcial</span>
                    <span className={`text-base font-extrabold block mt-0.5 ${
                      summary.balance > 0 ? 'text-success' : summary.balance < 0 ? 'text-danger' : 'text-muted'
                    }`}>
                      {summary.balance > 0 ? '+' : ''}{formatMoney(summary.balance)}
                    </span>
                    <span className="text-[9px] text-muted block mt-0.5">Consumo: {formatMoney(summary.consumo)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. CLOSED PLAYERS ACCORDION (COLLAPSED BY DEFAULT) */}
        {closedPlayers.length > 0 && (
          <div className="space-y-3">
            <button 
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsClosedPlayersExpanded(!isClosedPlayersExpanded);
              }}
              style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
              className="w-full flex items-center justify-between p-4 bg-white bg-opacity-5 rounded-2xl border border-glass-border cursor-pointer transition-all active:bg-opacity-10"
            >
              <span className="text-xs font-extrabold text-muted uppercase tracking-wider flex items-center gap-2">
                {isClosedPlayersExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />} 
                Jogadores Encerrados ({closedPlayers.length})
              </span>
            </button>
            
            {isClosedPlayersExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                {closedPlayers.map(summary => (
                  <div key={summary.player.id} className="p-4 bg-dark bg-opacity-20 border border-glass-border rounded-2xl flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted bg-opacity-10 text-muted flex items-center justify-center font-bold text-xs">
                        {summary.player.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-xs text-muted block">{summary.player.name}</span>
                        <span className="text-[9px] text-muted block">Mesa Encerrada</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-muted font-bold block uppercase">Resultado Final</span>
                      <span className={`text-xs font-bold block mt-0.5 ${
                        summary.balance > 0 ? 'text-success' : summary.balance < 0 ? 'text-danger' : 'text-muted'
                      }`}>
                        {summary.balance > 0 ? '+' : ''}{formatMoney(summary.balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. HISTORICO ACCORDION (COLLAPSED BY DEFAULT) */}
        <div className="space-y-3">
          <button 
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsHistoryExpanded(!isHistoryExpanded);
            }}
            style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
            className="w-full flex items-center justify-between p-4 bg-white bg-opacity-5 rounded-2xl border border-glass-border cursor-pointer transition-all active:bg-opacity-10"
          >
            <span className="text-xs font-extrabold text-muted uppercase tracking-wider flex items-center gap-2">
              {isHistoryExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />} 
              Histórico ({transactions.length})
            </span>
          </button>

          {isHistoryExpanded && (
            <div className="glass-panel space-y-3 animate-fade-in text-left">
              {transactions.length === 0 ? (
                <p className="text-muted text-center py-6 text-xs font-semibold">Nenhuma movimentação financeira.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {transactions.map(tx => {
                    const pName = players.find(p => p.id === tx.player_id)?.name || 'Outro';
                    return (
                      <div key={tx.id} className="p-3 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`badge ${
                              tx.type === 'buy_in' ? 'badge-active border-warning text-warning' :
                              tx.type === 'cash_out' ? 'badge-active border-success text-success' :
                              'badge-active border-danger text-danger'
                            }`} style={{ fontSize: '7px', padding: '1px 5px' }}>
                              {tx.type === 'buy_in' ? 'Buy-in' : tx.type === 'cash_out' ? 'Cash-out' : 'Consumo'}
                            </span>
                            <span className="text-white font-bold">{pName}</span>
                          </div>
                          <span className="text-[10px] text-muted">
                            {tx.description || (tx.type === 'buy_in' ? 'Fundo adicionado' : tx.type === 'cash_out' ? 'Resgate' : 'Item')} • {new Date(tx.created_at).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`font-black text-sm ${
                            tx.type === 'buy_in' ? 'text-warning' :
                            tx.type === 'cash_out' ? 'text-success' :
                            'text-danger'
                          }`}>
                            {tx.type === 'cash_out' ? '+' : '-'}{formatMoney(Number(tx.amount))}
                          </span>
                          
                          {table.status === 'active' && (
                            <button 
                              onClick={() => deleteTransaction(tx.id)}
                              className="w-7 h-7 bg-white bg-opacity-5 hover:bg-danger hover:bg-opacity-10 rounded-lg text-muted hover:text-danger flex items-center justify-center cursor-pointer border-none"
                              style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FLOATING ACTION BUTTON (FAB) FOR ADDING PLAYERS */}
      {table.status === 'active' && (
        <button
          onClick={() => {
            triggerHaptic('medium');
            setIsAddingPlayer(true);
          }}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center z-50 cursor-pointer active:scale-90 transition-transform"
          style={{ 
            boxShadow: '0 8px 30px rgba(59, 130, 246, 0.45)',
            border: 'none',
            outline: 'none'
          }}
        >
          <UserPlus size={24} />
        </button>
      )}

      {/* ADD PLAYER BOTTOM SHEET / CENTRALIZED DESKTOP MODAL */}
      {isAddingPlayer && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content mobile-bottom-sheet max-w-lg">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" onClick={() => setIsAddingPlayer(false)} />
            
            <div className="modal-header mb-4">
              <h2>Adicionar Jogador</h2>
              <button className="close-btn" onClick={() => setIsAddingPlayer(false)}>✕</button>
            </div>
            
            <div className="input-group mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={20} />
                <input 
                  type="text" 
                  className="input pl-10" 
                  placeholder="Buscar ou cadastrar novo..."
                  value={playerSearchTerm}
                  onChange={(e) => setPlayerSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6 text-left">
              {availablePlayersToAdd.map(gp => (
                <button 
                  key={gp.id}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-dark bg-opacity-50 text-white hover:bg-primary hover:text-white border border-glass-border text-left cursor-pointer active:scale-95 transition-all"
                  onClick={() => addPlayerToTable(gp.name)}
                  style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid var(--glass-border)' }}
                >
                  <span className="font-bold text-xs">{gp.name}</span>
                  <UserCheck size={18} opacity={0.5} />
                </button>
              ))}
              
              {showCreateOption && (
                <button 
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white transition-colors text-left cursor-pointer active:scale-95 transition-all"
                  onClick={() => addPlayerToTable(playerSearchTerm)}
                >
                  <UserPlus size={18} />
                  <span className="font-bold text-xs">Cadastrar "{playerSearchTerm}"</span>
                </button>
              )}

              {availablePlayersToAdd.length === 0 && !showCreateOption && (
                <div className="text-center text-muted p-4 text-xs font-semibold">
                  Todos os jogadores filtrados já estão na mesa.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 mt-2">
              <button type="button" className="btn btn-outline w-full py-3" onClick={() => setIsAddingPlayer(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. REDESIGNED SINGLE PLAYER ACTIONS OVERLAY SHEET/MODAL */}
      {activePlayerAction && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content mobile-bottom-sheet max-w-lg">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" onClick={() => setActivePlayerAction(null)} />

            {/* Header user name banner */}
            <div className="flex justify-between items-center border-b border-glass-border pb-4 mb-4">
              <div className="text-left">
                <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Operações Rápidas</span>
                <span className="text-base font-black text-white">{activePlayerAction.player.name}</span>
              </div>
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setActivePlayerAction(null);
                }}
                className="w-8 h-8 rounded-full bg-white bg-opacity-5 flex items-center justify-center text-muted hover:text-white font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none' }}
              >
                ✕
              </button>
            </div>

            {/* FLOW SWITCH: KEYPADS OR ITEM BUTTONS */}
            {activeActionType === null ? (
              /* PRIMARY LARGE BUTTON SELECTIONS */
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveActionType('buy_in');
                  }}
                  className="w-full py-4 rounded-xl bg-warning bg-opacity-10 text-warning hover:bg-opacity-20 border border-warning border-opacity-25 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
                >
                  🟢 Registrar Buy-in
                </button>
                
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveActionType('cash_out');
                  }}
                  className="w-full py-4 rounded-xl bg-success bg-opacity-10 text-success hover:bg-opacity-20 border border-success border-opacity-25 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
                >
                  🔴 Registrar Cash-out
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveActionType('consumo');
                  }}
                  className="w-full py-4 rounded-xl bg-danger bg-opacity-10 text-danger hover:bg-opacity-20 border border-danger border-opacity-25 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
                >
                  🥤 Registrar Consumo
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveActionType('edit');
                  }}
                  className="w-full py-4 rounded-xl bg-white bg-opacity-5 text-white hover:bg-opacity-10 border border-glass-border text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
                >
                  ✏️ Editar Jogador
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActivePlayerAction(null);
                  }}
                  className="w-full py-4 rounded-xl bg-dark text-muted font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-glass-border active:scale-95 transition-transform"
                >
                  ❌ Fechar
                </button>
              </div>
            ) : activeActionType === 'buy_in' || activeActionType === 'cash_out' ? (
              /* NUMERIC KEYPAD WITH ACCUMULATOR BUTTONS */
              <form onSubmit={saveTransaction}>
                <div className="input-group mb-4">
                  <label className="text-xs text-muted font-bold text-left block mb-2">
                    Valor do {activeActionType === 'buy_in' ? 'Buy-in' : 'Cash-out'} (R$)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="input text-2xl text-center font-bold py-3.5" 
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[50, 100, 200].map(val => (
                    <button 
                      key={val} 
                      type="button"
                      className="btn btn-outline py-3.5 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                      onClick={() => handleQuickAdd(val)}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                    >
                      +{val}
                    </button>
                  ))}
                  {[500, 1000].map(val => (
                    <button 
                      key={val} 
                      type="button"
                      className="btn btn-outline py-3.5 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                      onClick={() => handleQuickAdd(val)}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                    >
                      +{val}
                    </button>
                  ))}
                  <button 
                    type="button"
                    className="btn btn-danger py-3.5 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                    onClick={() => {
                      triggerHaptic('medium');
                      setTxAmount('');
                    }}
                  >
                    Limpar
                  </button>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-6">
                  <button 
                    type="submit" 
                    className="btn btn-primary w-full py-4 text-sm font-bold active:scale-95 transition-transform" 
                    disabled={!txAmount || isNaN(Number(txAmount)) || Number(txAmount) <= 0 || isSubmitting}
                  >
                    {isSubmitting ? 'Salvando...' : 'Confirmar Lançamento'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline w-full py-4 text-sm font-semibold active:scale-95 transition-transform" 
                    onClick={() => {
                      setActiveActionType(null);
                      setTxAmount('');
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </form>
            ) : activeActionType === 'consumo' ? (
              /* ONE-TAP CONSUMPTION BUTTONS */
              <div className="space-y-6 text-left">
                <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {consumoItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => registerConsumo(item.name, item.price)}
                      className="p-4 rounded-xl bg-dark bg-opacity-50 text-white border border-glass-border hover:border-success hover:bg-success hover:bg-opacity-20 transition-all text-left flex flex-col gap-1 cursor-pointer active:scale-95 transition-transform"
                      style={{ background: 'rgba(15,23,42,0.5)' }}
                    >
                      <span className="font-bold text-xs text-white">{item.name}</span>
                      <span className="text-xs text-success font-bold">{item.price === 0 ? 'Grátis' : `R$ ${item.price.toFixed(2)}`}</span>
                    </button>
                  ))}
                </div>
                
                <div className="border-t border-glass-border pt-4">
                  <p className="text-xs text-muted mb-3 font-semibold text-left">Lançamento de produto manual:</p>
                  <form onSubmit={saveTransaction} className="flex flex-col gap-3">
                    <div className="input-group mb-0">
                      <input 
                        type="text" 
                        className="input text-sm py-2.5 rounded-xl" 
                        placeholder="Nome do produto"
                        value={txDescription}
                        onChange={(e) => setTxDescription(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3 items-end">
                      <div className="input-group mb-0 flex-1">
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          className="input text-sm py-2.5 rounded-xl" 
                          placeholder="Preço (R$)"
                          value={txAmount}
                          onChange={(e) => setTxAmount(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary h-max py-3 px-5 cursor-pointer active:scale-95 transition-transform" disabled={!txAmount || isNaN(Number(txAmount)) || Number(txAmount) < 0 || isSubmitting}>
                        Lançar
                      </button>
                    </div>
                  </form>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    className="btn btn-outline w-full py-3.5 text-xs font-bold active:scale-95 transition-transform" 
                    onClick={() => setActiveActionType(null)}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              /* EDIT PROFILE FORM FIELDS */
              <form onSubmit={handleEditPlayerSubmit}>
                <div className="input-group mb-4">
                  <label className="text-xs font-bold text-muted block mb-2 text-left">Nome do Jogador *</label>
                  <input 
                    type="text" 
                    className="input text-sm py-3 rounded-xl" 
                    value={editPlayerName}
                    onChange={(e) => setEditPlayerName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group mb-6">
                  <label className="text-xs font-bold text-muted block mb-2 text-left">Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    className="input text-sm py-3 rounded-xl" 
                    placeholder="(00) 00000-0000"
                    value={editPlayerPhone}
                    onChange={(e) => setEditPlayerPhone(e.target.value)}
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-6">
                  <button 
                    type="submit" 
                    className="btn btn-primary w-full py-4 text-xs font-bold active:scale-95 transition-transform" 
                    disabled={!editPlayerName.trim()}
                  >
                    Salvar Alterações
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline w-full py-4 text-xs font-semibold active:scale-95 transition-transform" 
                    onClick={() => setActiveActionType(null)}
                  >
                    Voltar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CLOSE TABLE CONFIRMATION OVERLAY */}
      {isClosingTable && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content mobile-bottom-sheet max-w-lg border-danger">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" onClick={() => setIsClosingTable(false)} />
            
            <div className="modal-header">
              <h2 className="text-danger">Atenção!</h2>
            </div>
            <p className="mb-6 text-muted text-sm text-left leading-relaxed">
              Tem certeza que deseja fechar esta mesa? Isso irá consolidar os resultados de lucro/rake finais do caixa e não será mais possível adicionar ou remover transações.
            </p>
            <div className="flex flex-col md:flex-row gap-3 mt-6">
              <button type="button" className="btn btn-danger w-full py-3.5 font-bold cursor-pointer active:scale-95 transition-transform" onClick={closeTable}>Sim, Fechar Mesa</button>
              <button type="button" className="btn btn-outline w-full py-3.5" onClick={() => setIsClosingTable(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
