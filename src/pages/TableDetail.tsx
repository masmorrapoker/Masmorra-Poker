import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Table, Player, Transaction, PlayerSummary, GlobalPlayer, TableEvent } from '../types';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';
import { transactionService } from '../services/transactionService';
import { playerService } from '../services/playerService';
import { clubSettingsService } from '../services/clubSettingsService';
import { fiadoService } from '../services/fiadoService';
import { formatMoney, isSamePlayer, isClosedTableError } from '../utils';
import { summarizePlayers, computeTableTotals } from '../lib/tableMath';
import { hasPaymentFeatures } from '../lib/paymentMethods';
import { triggerHaptic } from '../utils/haptic';
import { toast } from '../components/Toast';
import { useSubmitLock } from '../hooks/useSubmitLock';
import ConfirmDialog from '../components/ConfirmDialog';
import TableTimeline from '../components/TableTimeline';
import TableSummaryCard from '../components/table/TableSummaryCard';
import { ActivePlayers, FinishedPlayers } from '../components/table/PlayerLists';
import AddPlayerSheet from '../components/table/AddPlayerSheet';
import PlayerActionSheet, { type ConsumoItem, type NewTransaction } from '../components/table/PlayerActionSheet';
import CloseTableDialog from '../components/table/CloseTableDialog';
import TableReport from '../components/table/TableReport';

const TYPE_LABEL = { buy_in: 'Buy-in', cash_out: 'Cash-out', consumo: 'Consumo' } as const;

export default function TableDetail() {
  const { id } = useParams<{ id: string }>();
  const { clubId, clubName, beerPrice, energyPrice } = useClub();

  // Dados
  const [table, setTable] = useState<Table | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [globalPlayers, setGlobalPlayers] = useState<GlobalPlayer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [events, setEvents] = useState<TableEvent[]>([]);
  const [consumoItems, setConsumoItems] = useState<ConsumoItem[]>([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Interface
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [selected, setSelected] = useState<PlayerSummary | null>(null);
  const [selectedFiado, setSelectedFiado] = useState(0);
  const [isClosingTable, setIsClosingTable] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [pendingDeleteTxId, setPendingDeleteTxId] = useState<string | null>(null);
  const [pendingRemovePlayer, setPendingRemovePlayer] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);

  // Trava síncrona contra toque duplo nos lançamentos (o estado `busy` é visual).
  const txLock = useRef(false);
  const addPlayerLock = useSubmitLock();

  useEffect(() => {
    if (!id || !clubId) return;
    fetchTableData();
    fetchGlobalPlayers();
    hasPaymentFeatures().then(setPaymentsEnabled);

    const defaults: ConsumoItem[] = [
      { name: 'Água', price: 0 },
      { name: 'Água com gás', price: 0 },
      { name: 'Coca-Cola', price: 5 },
      { name: 'Coca-Cola Zero', price: 5 },
      { name: 'Cerveja', price: beerPrice },
      { name: 'Energético', price: energyPrice }
    ];
    clubSettingsService.getSettings(clubId)
      .then(settings => {
        const custom = Array.isArray(settings?.custom_products)
          ? settings.custom_products.filter((p: { active?: boolean }) => p.active !== false)
          : [];
        setConsumoItems(custom.length > 0 ? custom.map((p: ConsumoItem) => ({ name: p.name, price: Number(p.price) })) : defaults);
      })
      .catch(() => setConsumoItems(defaults));

    const tableChannel = supabase
      .channel(`table_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `id=eq.${id}` }, () => fetchTableData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${id}` }, () => fetchTableData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `table_id=eq.${id}` }, () => fetchTableData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_events', filter: `table_id=eq.${id}` }, () => fetchTableData())
      .subscribe();

    const playersChannel = supabase
      .channel(`players_${clubId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `club_id=eq.${clubId}` }, () => fetchGlobalPlayers())
      .subscribe();

    return () => {
      supabase.removeChannel(tableChannel);
      supabase.removeChannel(playersChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, clubId]);

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
      tableService.getTableEvents(clubId, id).then(ev => setEvents(ev ?? []));
    } catch (error) {
      console.error('Error fetching table details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGlobalPlayers() {
    if (!clubId) return;
    try {
      setGlobalPlayers(await playerService.getPlayers(clubId));
    } catch (error) {
      console.error('Error fetching global players:', error);
    }
  }

  // Cálculos (mesma regra do relatório e do Analytics)
  const summaries = useMemo(() => summarizePlayers(players, transactions), [players, transactions]);
  const totals = useMemo(() => computeTableTotals(summaries, transactions), [summaries, transactions]);
  const activeSummaries = summaries.filter(s => !s.hasCashOut);
  const finishedSummaries = summaries.filter(s => s.hasCashOut);
  const fiadoByTablePlayer = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(tx => tx.payment_method === 'fiado' && tx.type === 'buy_in')
      .forEach(tx => { map[tx.player_id] = (map[tx.player_id] ?? 0) + Number(tx.amount); });
    return map;
  }, [transactions]);

  const globalOf = (p: Player) => globalPlayers.find(g => isSamePlayer(p, g));

  async function openPlayer(summary: PlayerSummary) {
    if (table?.status !== 'active') return;
    triggerHaptic('light');
    setSelected(summary);
    setSelectedFiado(0);
    const gp = globalOf(summary.player);
    if (paymentsEnabled && clubId && gp) {
      setSelectedFiado(await fiadoService.getPlayerBalance(clubId, gp.id));
    }
  }

  // Mantém o jogador selecionado atualizado quando os lançamentos mudam.
  useEffect(() => {
    if (!selected) return;
    const fresh = summaries.find(s => s.player.id === selected.player.id);
    if (fresh && (fresh.buyIn !== selected.buyIn || fresh.consumo !== selected.consumo || fresh.player.name !== selected.player.name)) {
      setSelected(fresh);
    }
  }, [summaries, selected]);

  async function addPlayer(name: string, playerId?: string) {
    if (!id || !clubId || !name.trim()) return;
    await addPlayerLock.run(async () => {
      try {
        await tableService.addPlayerToTable(clubId, id, name, playerId);
        toast.success(`${name.trim()} entrou na mesa.`);
        triggerHaptic('success');
        setIsAddingPlayer(false);
        await fetchTableData();
      } catch (error) {
        if (error instanceof Error && error.message === 'ALREADY_AT_TABLE') {
          toast.error(`${name.trim()} já está nesta mesa.`);
        } else if (isClosedTableError(error)) {
          toast.error('Mesa encerrada: não é possível adicionar jogadores.');
        } else {
          toast.error('Não foi possível adicionar o jogador. Verifique a conexão e tente de novo.');
        }
        console.error('Error adding player to table:', error);
      }
    });
  }

  async function submitTransaction(tx: NewTransaction, settleFiado?: number): Promise<boolean> {
    if (!id || !clubId || !selected || txLock.current) return false;
    txLock.current = true;
    setBusy(true);
    try {
      await transactionService.createTransaction(clubId, {
        table_id: id,
        player_id: selected.player.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        ...(tx.payment_method ? { payment_method: tx.payment_method } : {})
      });

      if (settleFiado && settleFiado > 0) {
        const gp = globalOf(selected.player);
        if (gp) {
          await fiadoService.registerPayment(clubId, {
            player_id: gp.id,
            amount: settleFiado,
            method: 'abatido_cashout',
            note: `Abatido no cash-out da ${table?.name ?? 'mesa'}`,
            table_id: id
          });
        }
      }

      const label = tx.type === 'consumo' ? (tx.description || 'Consumo') : TYPE_LABEL[tx.type];
      toast.success(`${label} de ${formatMoney(tx.amount)} registrado para ${selected.player.name}.`);
      triggerHaptic('success');
      setSelected(null);
      await fetchTableData();
      return true;
    } catch (error) {
      toast.error(isClosedTableError(error) ? 'Mesa encerrada: lançamento não permitido.' : 'Não foi possível registrar. Verifique a conexão e tente de novo.');
      console.error('Error saving transaction:', error);
      return false;
    } finally {
      txLock.current = false;
      setBusy(false);
    }
  }

  async function editPlayer(name: string, phone: string | null): Promise<boolean> {
    if (!clubId || !selected) return false;
    const gp = globalOf(selected.player);
    if (!gp) {
      toast.error('Cadastro do jogador não encontrado.');
      return false;
    }
    try {
      await playerService.updatePlayer(clubId, gp.id, { name, phone });
      toast.success('Cadastro atualizado.');
      triggerHaptic('success');
      await Promise.all([fetchTableData(), fetchGlobalPlayers()]);
      return true;
    } catch (err) {
      const dup = (err as { code?: string })?.code === '23505';
      toast.error(dup ? 'Já existe um jogador com esse nome.' : 'Não foi possível atualizar o cadastro.');
      console.error(err);
      return false;
    }
  }

  async function confirmDeleteTransaction() {
    if (!clubId || !pendingDeleteTxId) return;
    setBusy(true);
    try {
      await transactionService.deleteTransaction(clubId, pendingDeleteTxId);
      toast.success('Lançamento removido. A remoção fica registrada no histórico.');
      triggerHaptic('success');
      setPendingDeleteTxId(null);
      await fetchTableData();
    } catch (error) {
      toast.error(isClosedTableError(error) ? 'Mesa encerrada: não é possível remover lançamentos.' : 'Não foi possível remover o lançamento.');
      console.error('Error deleting transaction:', error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemovePlayer() {
    if (!clubId || !pendingRemovePlayer) return;
    setBusy(true);
    try {
      await tableService.removePlayerFromTable(clubId, pendingRemovePlayer.id);
      toast.success(`${pendingRemovePlayer.name} removido da mesa.`);
      triggerHaptic('success');
      setPendingRemovePlayer(null);
      setSelected(null);
      await fetchTableData();
    } catch (error) {
      const msg = (error as { message?: string })?.message ?? '';
      toast.error(msg.includes('lançamentos') || isClosedTableError(error) ? msg : 'Não foi possível remover o jogador da mesa.');
      console.error('Error removing player:', error);
    } finally {
      setBusy(false);
    }
  }

  async function closeTable() {
    if (!id || !clubId) return;
    setBusy(true);
    try {
      await tableService.closeTable(clubId, id);
      toast.success('Mesa encerrada.');
      triggerHaptic('success');
      setIsClosingTable(false);
      await fetchTableData();
      setShowReport(true);
    } catch (error) {
      toast.error('Não foi possível encerrar a mesa. Verifique a conexão e tente de novo.');
      console.error('Error closing table:', error);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center p-20"><div className="spinner" role="status" aria-label="Carregando mesa" /></div>;
  if (!table) {
    return (
      <div className="container text-center p-20">
        <p className="text-white mb-4">Mesa não encontrada.</p>
        <Link to="/dashboard" className="btn btn-outline">Voltar para as mesas</Link>
      </div>
    );
  }

  const open = table.status === 'active';
  const pendingTx = transactions.find(t => t.id === pendingDeleteTxId);

  return (
    <div className="animate-fade-in max-w-6xl mx-auto mobile-view-padding text-left relative">
      <Link to="/dashboard" className="btn btn-outline mb-6 desktop-only text-white no-underline">
        <ArrowLeft size={18} /> Voltar para as mesas
      </Link>

      <TableSummaryCard
        table={table}
        totals={totals}
        paymentsEnabled={paymentsEnabled}
        onClose={() => { triggerHaptic('medium'); setIsClosingTable(true); }}
        onReport={() => setShowReport(true)}
      />

      <div className="space-y-6">
        <ActivePlayers
          players={activeSummaries}
          open={open}
          fiadoByTablePlayer={fiadoByTablePlayer}
          onSelect={openPlayer}
          onAdd={() => { triggerHaptic('light'); setIsAddingPlayer(true); }}
        />

        <FinishedPlayers players={finishedSummaries} />

        <section className="space-y-3">
          <button
            type="button"
            aria-expanded={isHistoryExpanded}
            onClick={() => setIsHistoryExpanded(v => !v)}
            className="w-full flex items-center gap-2 p-4 rounded-2xl border border-glass-border cursor-pointer text-left"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            {isHistoryExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
            <span className="text-sm font-bold text-white">Histórico da mesa</span>
            <span className="text-sm text-muted">({events.length})</span>
          </button>

          {isHistoryExpanded && (
            <div className="glass-panel animate-fade-in text-left">
              <TableTimeline
                events={events}
                canDelete={ev =>
                  open &&
                  (ev.event_type === 'buy_in' || ev.event_type === 'cash_out' || ev.event_type === 'consumo') &&
                  !!ev.ref_id &&
                  transactions.some(t => t.id === ev.ref_id)
                }
                onDelete={ev => {
                  if (!ev.ref_id) return;
                  triggerHaptic('medium');
                  setPendingDeleteTxId(ev.ref_id);
                }}
              />
            </div>
          )}
        </section>
      </div>

      {isAddingPlayer && (
        <AddPlayerSheet
          globalPlayers={globalPlayers}
          tablePlayers={players}
          busy={addPlayerLock.busy}
          onAdd={addPlayer}
          onClose={() => setIsAddingPlayer(false)}
        />
      )}

      {selected && (
        <PlayerActionSheet
          summary={selected}
          initialPhone={globalOf(selected.player)?.phone ?? ''}
          consumoItems={consumoItems}
          paymentsEnabled={paymentsEnabled}
          fiadoBalance={selectedFiado}
          canRemove={!transactions.some(tx => tx.player_id === selected.player.id)}
          submitting={busy}
          onSubmit={submitTransaction}
          onEditPlayer={editPlayer}
          onRemove={() => { triggerHaptic('medium'); setPendingRemovePlayer(selected.player); }}
          onClose={() => setSelected(null)}
        />
      )}

      <ConfirmDialog
        open={pendingDeleteTxId !== null}
        danger
        busy={busy}
        title="Remover lançamento?"
        message={pendingTx
          ? <>Remover <strong className="text-white">{TYPE_LABEL[pendingTx.type]} de {formatMoney(Number(pendingTx.amount))}</strong> de <strong className="text-white">{players.find(p => p.id === pendingTx.player_id)?.name ?? 'jogador'}</strong>? A remoção fica registrada no histórico da mesa.</>
          : 'Este lançamento será removido.'}
        confirmLabel="Remover lançamento"
        onConfirm={confirmDeleteTransaction}
        onCancel={() => setPendingDeleteTxId(null)}
      />

      <ConfirmDialog
        open={pendingRemovePlayer !== null}
        danger
        busy={busy}
        title="Remover jogador da mesa?"
        message={<><strong className="text-white">{pendingRemovePlayer?.name}</strong> sai da mesa. O cadastro continua no clube, e a remoção fica no histórico.</>}
        confirmLabel="Remover da mesa"
        onConfirm={confirmRemovePlayer}
        onCancel={() => setPendingRemovePlayer(null)}
      />

      {isClosingTable && (
        <CloseTableDialog
          tableName={table.name}
          summaries={summaries}
          totals={totals}
          busy={busy}
          onConfirm={closeTable}
          onCancel={() => setIsClosingTable(false)}
        />
      )}

      {showReport && (
        <TableReport
          clubName={clubName}
          table={table}
          summaries={summaries}
          totals={totals}
          transactions={transactions}
          players={players}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
