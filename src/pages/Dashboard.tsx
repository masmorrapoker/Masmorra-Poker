import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Table } from '../types';
import { Plus, Play, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useClub } from '../contexts/ClubContext';
import { tableService } from '../services/tableService';

export default function Dashboard() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const navigate = useNavigate();
  const { clubId } = useClub();

  useEffect(() => {
    if (!clubId) return;
    fetchTables();
    
    // Subscribe to realtime changes (listens to postgres event triggers)
    const channel = supabase
      .channel('public:tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `club_id=eq.${clubId}` }, () => {
        fetchTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId]);

  async function fetchTables() {
    if (!clubId) return;
    try {
      const data = await tableService.getTables(clubId);
      setTables(data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    if (!newTableName.trim() || !clubId) return;

    try {
      const data = await tableService.createTable(clubId, newTableName);
      setIsCreating(false);
      setNewTableName('');
      navigate(`/table/${data.id}`);
    } catch (error) {
      console.error('Error creating table:', error);
    }
  }

  return (
    <div className="container animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="mb-1">Mesas de Cash Game</h1>
          <p className="text-muted text-sm">Gerencie as mesas ativas e o fluxo de caixa.</p>
        </div>
        <button className="btn btn-primary w-full md:w-auto" onClick={() => setIsCreating(true)}>
          <Plus size={20} /> Nova Mesa
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><div className="spinner"></div></div>
      ) : tables.length === 0 ? (
        <div className="glass-panel text-center p-10">
          <Info className="mx-auto mb-4 text-muted" size={48} opacity={0.5} />
          <h2>Nenhuma mesa encontrada</h2>
          <p className="mb-6">Crie uma nova mesa para começar a gerenciar.</p>
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
            <Plus size={20} /> Criar Primeira Mesa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {tables
            .sort((a, b) => {
              if (a.status === 'active' && b.status === 'closed') return -1;
              if (a.status === 'closed' && b.status === 'active') return 1;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .map(table => (
            <div key={table.id} className={`glass-panel flex flex-col justify-between ${table.status === 'closed' ? 'opacity-70' : 'border-primary border-opacity-30'}`}>
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="mb-0 text-lg">{table.name}</h3>
                  <span className={`badge ${table.status === 'active' ? 'badge-active' : 'badge-closed'}`}>
                    {table.status === 'active' ? 'Ativa' : 'Fechada'}
                  </span>
                </div>
                <div className="text-sm text-muted">
                  {table.status === 'active' ? 'Aberta em: ' : 'Fechada em: '}
                  {new Date(table.closed_at || table.created_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
              <button 
                className={`btn w-full ${table.status === 'active' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => navigate(`/table/${table.id}`)}
              >
                {table.status === 'active' ? (
                  <><Play size={18} /> Acessar Mesa</>
                ) : (
                  <><Info size={18} /> Ver Histórico</>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {isCreating && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Criar Nova Mesa</h2>
              <button className="close-btn" onClick={() => setIsCreating(false)}>✕</button>
            </div>
            <form onSubmit={createTable}>
              <div className="input-group">
                <label>Nome ou Número da Mesa</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Ex: Mesa 1, VIP, PLO5..."
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setIsCreating(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newTableName.trim()}>
                  Criar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
