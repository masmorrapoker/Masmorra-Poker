import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Table, Player, Transaction, PlayerSummary, GlobalPlayer } from '../types';
import { UserPlus, Coffee, XCircle, ArrowDownCircle, ArrowUpCircle, Search, UserCheck } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';
import { transactionService } from '../services/transactionService';
import { playerService } from '../services/playerService';
import { formatMoney, formatDateTime, calculatePlayerBalance } from '../utils';

export default function TableDetail() {
  const { id } = useParams<{ id: string }>();
  const { clubId, beerPrice, energyPrice } = useClub();
  
  const [table, setTable] = useState<Table | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<GlobalPlayer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'buy_in' | 'cash_out' | 'consumo';
    playerId: string;
  }>({ isOpen: false, type: 'buy_in', playerId: '' });
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isClosingTable, setIsClosingTable] = useState(false);

  const CONSUMO_ITEMS = [
    { name: 'Água', price: 0 },
    { name: 'Água com gás', price: 0 },
    { name: 'Coca-Cola', price: 0 },
    { name: 'Coca-Cola Zero', price: 0 },
    { name: 'Cerveja', price: beerPrice },
    { name: 'Energético', price: energyPrice },
  ];

  const handleQuickAdd = (val: number) => {
    setTxAmount(prev => {
      const current = parseFloat(prev);
      if (isNaN(current) || current <= 0) return val.toString();
      return (current + val).toString();
    });
  };

  useEffect(() => {
    if (id && clubId) {
      fetchTableData();
      fetchGlobalPlayers();
      
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

  async function fetchTableData() {
    if (!id || !clubId) return;
    try {
      const [tableRes, playersRes, txRes] = await Promise.all([
        tableService.getTable(clubId, id),
        tableService.getTablePlayers(clubId, id),
        transactionService.getTransactions(clubId, id)
      ]);

      if (tableRes) setTable(tableRes);
      if (playersRes) setPlayers(playersRes);
      if (txRes) setTransactions(txRes);
    } catch (error) {
      console.error('Error fetching table data:', error);
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

  async function addPlayerToTable(name: string) {
    if (!name.trim() || !id || !clubId) return;
    
    try {
      await tableService.addPlayerToTable(clubId, id, name);
      await fetchTableData();
      await fetchGlobalPlayers();
      
      setIsAddingPlayer(false);
      setPlayerSearchTerm('');
    } catch (error) {
      console.error('Error adding player to table:', error);
    }
  }

  async function saveTransaction(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount < 0 || !id || !clubId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await transactionService.createTransaction(clubId, {
        table_id: id,
        player_id: transactionModal.playerId,
        type: transactionModal.type,
        amount: amount,
        description: txDescription || (transactionModal.type === 'consumo' ? 'Consumo Manual' : undefined)
      });
      
      setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
      setTxAmount('');
      setTxDescription('');
      await fetchTableData();
    } catch (error) {
      console.error('Error saving transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function registerConsumo(itemName: string, amount: number) {
    if (!id || !clubId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await transactionService.createTransaction(clubId, {
        table_id: id,
        player_id: transactionModal.playerId,
        type: 'consumo',
        amount: amount,
        description: itemName
      });
      
      setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
      setTxAmount('');
      setTxDescription('');
      await fetchTableData();
    } catch (error) {
      console.error('Error saving consumo:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteTransaction(txId: string) {
    if (!window.confirm('Tem certeza que deseja remover esta transação?')) return;
    if (!clubId) return;
    try {
      await transactionService.deleteTransaction(clubId, txId);
      await fetchTableData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }

  async function closeTable() {
    if (!id || !clubId) return;
    try {
      await tableService.closeTable(clubId, id);
      setIsClosingTable(false);
      await fetchTableData();
    } catch (error) {
      console.error('Error closing table:', error);
    }
  }

  // Calculate results
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
  const totalCashOut = playerSummaries.reduce((sum, p) => sum + p.cashOut, 0);
  const totalConsumo = playerSummaries.reduce((sum, p) => sum + p.consumo, 0);
  const rakeTableTotal = totalBuyIn - totalCashOut; 

  const availablePlayersToAdd = globalPlayers.filter(
    gp => !players.some(tp => tp.name === gp.name) && gp.name.toLowerCase().includes(playerSearchTerm.toLowerCase())
  );
  
  const showCreateOption = playerSearchTerm.trim().length > 0 && 
    !globalPlayers.some(gp => gp.name.toLowerCase() === playerSearchTerm.toLowerCase());

  if (loading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;
  if (!table) return <div className="container text-center p-20">Mesa não encontrada.</div>;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Title Panel */}
      <div className="glass-panel mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="mb-2">{table.name}</h1>
          <div className="flex items-center gap-2">
             <span className={`badge ${table.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
               {table.status === 'active' ? 'Ativa' : 'Fechada'}
             </span>
             {table.status === 'closed' && table.closed_at && (
               <span className="text-sm text-muted">
                 Fechada em: {formatDateTime(table.closed_at)}
               </span>
             )}
          </div>
        </div>
        
        {table.status === 'active' && (
          <button className="btn btn-danger w-full md:w-auto" onClick={() => setIsClosingTable(true)}>
            <XCircle size={20} /> Fechar Mesa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Column 1 & 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Players Panel */}
          <div className="glass-panel">
            <div className="flex justify-between items-center mb-6 gap-2">
              <h2>Jogadores na Mesa</h2>
              {table.status === 'active' && (
                <button className="btn btn-success" onClick={() => setIsAddingPlayer(true)}>
                  <UserPlus size={18} /> Adicionar
                </button>
              )}
            </div>

            {players.length === 0 ? (
              <p className="text-muted text-center py-6">Nenhum jogador na mesa ainda.</p>
            ) : (
              <div className="space-y-6">
                {/* 1. JOGADORES ATIVOS */}
                <div>
                  <h3 className="text-xs font-bold text-success uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                    <span>Jogadores Ativos ({activePlayers.length})</span>
                  </h3>
                  
                  {activePlayers.length === 0 ? (
                    <p className="text-muted text-xs italic p-4 bg-black bg-opacity-20 rounded-xl">
                      Nenhum jogador ativo no momento.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {activePlayers.map(summary => (
                        <div key={summary.player.id} className="glass-panel p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-opacity-40 gap-4">
                          <div className="text-left flex-1 w-full">
                            <h4 className="mb-1 text-base md:text-lg font-bold text-white">{summary.player.name}</h4>
                            <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm justify-start mb-2">
                              <span className="text-warning font-medium">In: R$ {summary.buyIn.toFixed(2)}</span>
                              <span className="text-success font-medium">Out: R$ {summary.cashOut.toFixed(2)}</span>
                              <span className="text-danger font-medium">Consumo: R$ {summary.consumo.toFixed(2)}</span>
                            </div>
                            {table.status === 'active' && (
                              <div className="text-xs md:text-sm border-t border-white border-opacity-10 pt-2 mt-2 inline-block">
                                <span className="text-muted mr-2">Resultado parcial:</span>
                                <span className={`font-extrabold ${summary.balance > 0 ? 'text-success' : summary.balance < 0 ? 'text-danger' : 'text-white'}`}>
                                  {summary.balance > 0 ? '+' : ''}R$ {summary.balance.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {table.status === 'active' && (
                            <div className="grid grid-cols-3 gap-2 w-full md:flex md:w-auto mt-2 md:mt-0">
                              <button 
                                className="btn btn-outline border-warning text-warning hover:bg-warning hover:text-white px-2 py-3 text-xs md:text-sm flex flex-col md:flex-row gap-1 items-center justify-center cursor-pointer active:scale-95 transition-transform"
                                onClick={() => setTransactionModal({ isOpen: true, type: 'buy_in', playerId: summary.player.id })}
                              >
                                <ArrowDownCircle size={16} />
                                <span>Buy-in</span>
                              </button>
                              <button 
                                className="btn btn-outline border-success text-success hover:bg-success hover:text-white px-2 py-3 text-xs md:text-sm flex flex-col md:flex-row gap-1 items-center justify-center cursor-pointer active:scale-95 transition-transform"
                                onClick={() => setTransactionModal({ isOpen: true, type: 'cash_out', playerId: summary.player.id })}
                              >
                                <ArrowUpCircle size={16} />
                                <span>Cash-out</span>
                              </button>
                              <button 
                                className="btn btn-outline border-danger text-danger hover:bg-danger hover:text-white px-2 py-3 text-xs md:text-sm flex flex-col md:flex-row gap-1 items-center justify-center cursor-pointer active:scale-95 transition-transform"
                                onClick={() => setTransactionModal({ isOpen: true, type: 'consumo', playerId: summary.player.id })}
                              >
                                <Coffee size={16} />
                                <span>Consumo</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. JOGADORES ENCERRADOS */}
                {closedPlayers.length > 0 && (
                  <div className="pt-4 border-t border-white border-opacity-5">
                    <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-muted"></span>
                      <span>Jogadores Encerrados ({closedPlayers.length})</span>
                    </h3>
                    
                    <div className="space-y-4">
                      {closedPlayers.map(summary => (
                        <div key={summary.player.id} className="glass-panel p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center bg-opacity-20 gap-4 opacity-60">
                          <div className="text-left flex-1 w-full">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className="text-base md:text-lg font-bold text-muted line-through mb-0 leading-none">{summary.player.name}</h4>
                              <span className="text-[9px] font-bold text-muted bg-white bg-opacity-5 px-2 py-0.5 rounded-full border border-white border-opacity-10 uppercase tracking-wide">
                                Saiu da Mesa
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm justify-start mb-1">
                              <span className="text-muted font-medium">In: R$ {summary.buyIn.toFixed(2)}</span>
                              <span className="text-muted font-medium">Out: R$ {summary.cashOut.toFixed(2)}</span>
                              <span className="text-muted font-medium">Consumo: R$ {summary.consumo.toFixed(2)}</span>
                            </div>
                            <div className="text-xs md:text-sm border-t border-white border-opacity-10 pt-2 mt-2 inline-block">
                              <span className="text-muted mr-2">Resultado líquido final:</span>
                              <span className={`font-extrabold ${summary.balance > 0 ? 'text-success' : summary.balance < 0 ? 'text-danger' : 'text-muted'}`}>
                                {summary.balance > 0 ? '+' : ''}R$ {summary.balance.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Real-time Transactions Feed (Restored & Placed Under Players) */}
          <div className="glass-panel">
            <h2 className="mb-4 flex items-center gap-2">
              <span>Histórico de Lançamentos da Mesa</span>
              <span className="text-xs font-bold text-primary bg-primary bg-opacity-10 px-2.5 py-0.5 rounded-full border border-primary border-opacity-20">
                {transactions.length}
              </span>
            </h2>
            
            {transactions.length === 0 ? (
              <p className="text-muted text-sm py-8 text-center italic bg-black bg-opacity-20 rounded-xl">
                Nenhuma transação registrada nesta mesa ainda.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {transactions.map(tx => {
                  const player = players.find(p => p.id === tx.player_id);
                  const isBuyIn = tx.type === 'buy_in';
                  const isCashOut = tx.type === 'cash_out';
                  return (
                    <div key={tx.id} className="p-3.5 rounded-xl bg-dark bg-opacity-40 border border-glass-border flex items-center justify-between gap-4 transition-all hover:bg-opacity-60 animate-fade-in">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                          <span className="text-xs text-muted">
                            {new Date(tx.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          <span className="text-muted text-xs">•</span>
                          <span className="font-bold text-sm text-white truncate">{player?.name || 'Desconhecido'}</span>
                          <span className="text-muted text-xs">•</span>
                          <span className={`badge text-[10px] px-2 py-0.5 font-bold ${
                            isBuyIn ? 'bg-warning bg-opacity-10 text-warning border-warning border-opacity-25' : 
                            isCashOut ? 'bg-success bg-opacity-10 text-success border-success border-opacity-25' : 
                            'bg-danger bg-opacity-10 text-danger border-danger border-opacity-25'
                          } border rounded-md`}>
                            {isBuyIn ? 'Buy-in' : isCashOut ? 'Cash-out' : tx.description || 'Consumo'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className={`text-sm md:text-base font-extrabold ${isBuyIn ? 'text-warning' : isCashOut ? 'text-success' : 'text-danger'}`}>
                          {isBuyIn ? '+' : isCashOut ? '-' : ''} {formatMoney(tx.amount)}
                        </span>
                        
                        <button 
                          className="text-muted hover:text-danger p-2 bg-white bg-opacity-5 hover:bg-danger hover:bg-opacity-10 rounded-xl border border-glass-border hover:border-danger hover:border-opacity-20 active:scale-95 transition-all cursor-pointer font-bold text-xs"
                          onClick={() => deleteTransaction(tx.id)}
                          title="Excluir Transação"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Results Summary if Closed */}
          {table.status === 'closed' && (
            <div className="glass-panel border-success">
              <h2 className="text-success mb-6">Resultado Final da Mesa</h2>
              
              {/* Desktop Table View */}
              <div className="overflow-x-auto desktop-only">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-white border-opacity-10">
                      <th className="p-3">Jogador</th>
                      <th className="p-3">Buy-in</th>
                      <th className="p-3">Cash-out</th>
                      <th className="p-3">Consumo</th>
                      <th className="p-3 text-right">Resultado Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerSummaries.map(summary => (
                      <tr key={summary.player.id} className="border-b border-white border-opacity-5">
                        <td className="p-3 font-bold">{summary.player.name}</td>
                        <td className="p-3">{formatMoney(summary.buyIn)}</td>
                        <td className="p-3">{formatMoney(summary.cashOut)}</td>
                        <td className="p-3">{formatMoney(summary.consumo)}</td>
                        <td className={`p-3 text-right font-bold ${summary.balance > 0 ? 'text-success' : summary.balance < 0 ? 'text-danger' : ''}`}>
                          {formatMoney(summary.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-only space-y-4">
                {playerSummaries.map(summary => (
                  <div key={summary.player.id} className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-base text-white">{summary.player.name}</span>
                      <span className={`font-extrabold text-sm px-2.5 py-1 rounded-lg ${summary.balance > 0 ? 'bg-success bg-opacity-10 text-success' : summary.balance < 0 ? 'bg-danger bg-opacity-10 text-danger' : 'bg-white bg-opacity-5 text-white'}`}>
                        {summary.balance > 0 ? '+' : ''}{formatMoney(summary.balance)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 pt-2 border-t border-white border-opacity-5">
                      <div>
                        <p className="text-muted mb-0.5">Buy-in</p>
                        <p className="font-semibold text-warning">{formatMoney(summary.buyIn)}</p>
                      </div>
                      <div>
                        <p className="text-muted mb-0.5">Cash-out</p>
                        <p className="font-semibold text-success">{formatMoney(summary.cashOut)}</p>
                      </div>
                      <div>
                        <p className="text-muted mb-0.5">Consumo</p>
                        <p className="font-semibold text-danger">{formatMoney(summary.consumo)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-white border-opacity-10 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted">Total Buy-ins</p>
                  <p className="text-xl text-warning">{formatMoney(totalBuyIn)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Total Cash-outs</p>
                  <p className="text-xl text-success">{formatMoney(totalCashOut)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Total Consumo</p>
                  <p className="text-xl text-danger">{formatMoney(totalConsumo)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted">Lucro da Mesa (Rake)</p>
                  <p className="text-xl text-primary font-bold">{formatMoney(rakeTableTotal)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Table Summary Sidebar (Column 3) */}
        <div className="space-y-6">
          <div className="glass-panel border-primary border-opacity-20">
            <h2 className="mb-4">Resumo da Mesa</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex flex-col justify-center">
                <p className="text-xs text-muted mb-1 font-semibold">Total de Entradas (Buy-ins)</p>
                <p className="text-xl font-extrabold text-warning">{formatMoney(totalBuyIn)}</p>
              </div>

              <div className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex flex-col justify-center">
                <p className="text-xs text-muted mb-1 font-semibold">Total de Saídas (Cash-outs)</p>
                <p className="text-xl font-extrabold text-success">{formatMoney(totalCashOut)}</p>
              </div>

              <div className="p-4 bg-dark bg-opacity-40 rounded-xl border border-glass-border flex flex-col justify-center">
                <p className="text-xs text-muted mb-1 font-semibold">Total de Consumo</p>
                <p className="text-xl font-extrabold text-danger">{formatMoney(totalConsumo)}</p>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col justify-center ${rakeTableTotal >= 0 ? 'border-primary bg-primary bg-opacity-5' : 'border-danger bg-danger bg-opacity-5'}`}>
                <p className="text-xs text-muted mb-1 font-semibold">Lucro Estimado (Rake)</p>
                <p className={`text-2xl font-black ${rakeTableTotal >= 0 ? 'text-primary' : 'text-danger'}`}>
                  {formatMoney(rakeTableTotal)}
                </p>
                <p className="text-[10px] text-muted mt-1 leading-normal">
                  {rakeTableTotal >= 0 
                    ? 'Saldo positivo. Entradas superam as saídas.' 
                    : 'Atenção: As saídas superam as entradas.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Player Modal */}
      {isAddingPlayer && (
        <div className="modal-overlay">
          <div className="modal-content">
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
                  placeholder="Buscar ou adicionar novo..."
                  value={playerSearchTerm}
                  onChange={(e) => setPlayerSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6">
              {availablePlayersToAdd.map(gp => (
                <button 
                  key={gp.id}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-dark bg-opacity-50 text-white hover:bg-primary hover:text-white transition-colors border border-glass-border text-left cursor-pointer"
                  onClick={() => addPlayerToTable(gp.name)}
                >
                  <span className="font-medium">{gp.name}</span>
                  <UserCheck size={18} opacity={0.5} />
                </button>
              ))}
              
              {showCreateOption && (
                <button 
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white transition-colors text-left cursor-pointer"
                  onClick={() => addPlayerToTable(playerSearchTerm)}
                >
                  <UserPlus size={18} />
                  <span className="font-medium">Cadastrar "{playerSearchTerm}"</span>
                </button>
              )}

              {availablePlayersToAdd.length === 0 && !showCreateOption && (
                <div className="text-center text-muted p-4">
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

      {/* Transaction Modal */}
      {transactionModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                Registrar {transactionModal.type === 'buy_in' ? 'Buy-in' : transactionModal.type === 'cash_out' ? 'Cash-out' : 'Consumo'}
              </h2>
              <button className="close-btn" onClick={() => {
                setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
                setTxAmount('');
                setTxDescription('');
              }}>✕</button>
            </div>

            {transactionModal.type === 'consumo' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {CONSUMO_ITEMS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => registerConsumo(item.name, item.price)}
                      className="p-4 rounded-xl bg-dark bg-opacity-50 text-white border border-glass-border hover:border-success hover:bg-success hover:bg-opacity-20 transition-all text-left flex flex-col gap-1 cursor-pointer active:scale-95 transition-transform"
                    >
                      <span className="font-bold text-base">{item.name}</span>
                      <span className="text-sm text-success font-bold">{item.price === 0 ? 'Grátis' : `R$ ${item.price.toFixed(2)}`}</span>
                    </button>
                  ))}
                </div>
                
                <div className="border-t border-glass-border pt-6">
                  <p className="text-sm text-muted mb-3 font-medium">Ou registrar consumo manual:</p>
                  <form onSubmit={saveTransaction} className="flex flex-col gap-3">
                    <div className="input-group mb-0">
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Descrição (ex: Sanduíche)"
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
                          className="input" 
                          placeholder="Valor (R$)"
                          value={txAmount}
                          onChange={(e) => setTxAmount(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary h-max py-3 px-5 cursor-pointer active:scale-95 transition-transform" disabled={!txAmount || isNaN(Number(txAmount)) || Number(txAmount) < 0 || isSubmitting}>
                        {isSubmitting ? '...' : 'Lançar'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <form onSubmit={saveTransaction}>
                <div className="input-group">
                  <label>Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="input text-xl text-center font-bold" 
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
                
                {/* Touch Numeric Keypad Accumulator for One-Handed Use */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[50, 100, 200].map(val => (
                    <button 
                      key={val} 
                      type="button"
                      className="btn btn-outline py-3 text-sm font-bold cursor-pointer active:scale-95 transition-transform"
                      onClick={() => handleQuickAdd(val)}
                    >
                      +{val}
                    </button>
                  ))}
                  {[500, 1000].map(val => (
                    <button 
                      key={val} 
                      type="button"
                      className="btn btn-outline py-3 text-sm font-bold cursor-pointer active:scale-95 transition-transform"
                      onClick={() => handleQuickAdd(val)}
                    >
                      +{val}
                    </button>
                  ))}
                  <button 
                    type="button"
                    className="btn btn-danger py-3 text-sm font-bold cursor-pointer active:scale-95 transition-transform"
                    onClick={() => setTxAmount('')}
                  >
                    Limpar
                  </button>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mt-6">
                  <button 
                    type="submit" 
                    className="btn btn-primary w-full py-3.5 text-base font-bold order-1 md:order-2 cursor-pointer active:scale-95 transition-transform" 
                    disabled={!txAmount || isNaN(Number(txAmount)) || Number(txAmount) <= 0 || isSubmitting}
                  >
                    {isSubmitting ? 'Salvando...' : 'Confirmar Lançamento'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline w-full py-3.5 text-base font-semibold order-2 md:order-1 cursor-pointer active:scale-95 transition-transform" 
                    onClick={() => {
                      setTransactionModal({ isOpen: false, type: 'buy_in', playerId: '' });
                      setTxAmount('');
                      setTxDescription('');
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isClosingTable && (
        <div className="modal-overlay">
          <div className="modal-content border-danger">
            <div className="modal-header">
              <h2 className="text-danger">Atenção!</h2>
            </div>
            <p className="mb-6 text-muted">
              Tem certeza que deseja fechar esta mesa? Isso irá calcular os resultados finais e não será mais possível adicionar transações.
            </p>
            <div className="flex justify-end gap-4 mt-6">
              <button type="button" className="btn btn-outline w-full py-3" onClick={() => setIsClosingTable(false)}>Cancelar</button>
              <button type="button" className="btn btn-danger w-full py-3 font-bold" onClick={closeTable}>Sim, Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
