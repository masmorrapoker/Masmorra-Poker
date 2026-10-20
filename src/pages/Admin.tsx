import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, CalendarPlus, Copy, Link2, MessageCircle, Plus, X } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import { adminService, daysUntil, friendlyError, inviteLink, type AdminClub } from '../services/teamService';
import { formatDate } from '../utils';
import { toast } from '../components/Toast';
import { useSubmitLock } from '../hooks/useSubmitLock';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

function statusOf(c: AdminClub): { label: string; tone: string } {
  if (c.blocked) return { label: 'Bloqueado', tone: 'text-danger' };
  const d = daysUntil(c.paid_until);
  if (d === null) return { label: 'Sem vencimento', tone: 'text-muted' };
  if (d < 0) return { label: `Vencido há ${-d} dia${d === -1 ? '' : 's'} (tolerância de 3)`, tone: 'text-danger' };
  if (d <= 5) return { label: `Vence em ${d} dia${d === 1 ? '' : 's'}`, tone: 'text-warning' };
  return { label: `Em dia até ${formatDate(`${c.paid_until}T12:00:00`)}`, tone: 'text-success' };
}

function shareText(clubName: string, token: string) {
  return `Olá! Este é o seu acesso ao Masmorra Manager para o ${clubName}. Abra o link, crie sua senha e pronto:\n${inviteLink(token)}`;
}

export default function Admin() {
  const { isAdmin } = useClub();
  const [clubs, setClubs] = useState<AdminClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrial, setNewTrial] = useState('14');
  const [link, setLink] = useState<{ club: string; token: string } | null>(null);
  const [dateFor, setDateFor] = useState<AdminClub | null>(null);
  const [dateValue, setDateValue] = useState('');
  const lock = useSubmitLock();

  const load = useCallback(async () => {
    try {
      setClubs(await adminService.listClubs());
    } catch (e) {
      toast.error(friendlyError(e, 'Não foi possível carregar os clubes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) return <Navigate to="/inicio" replace />;

  async function createClub(e: React.FormEvent) {
    e.preventDefault();
    await lock.run(async () => {
      try {
        const days = parseInt(newTrial, 10);
        const paid = isNaN(days) || days <= 0 ? null : iso(addDays(new Date(), days));
        const res = await adminService.createClub(newName.trim(), paid);
        setLink({ club: newName.trim(), token: res.token });
        setCreating(false);
        setNewName('');
        await load();
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível criar o clube.'));
      }
    });
  }

  async function ownerLink(c: AdminClub) {
    await lock.run(async () => {
      try {
        setLink({ club: c.name, token: await adminService.newInvite(c.id, 'dono') });
        await load();
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível gerar o link.'));
      }
    });
  }

  async function setPaid(c: AdminClub, value: string | null) {
    await lock.run(async () => {
      try {
        await adminService.setPaidUntil(c.id, value);
        toast.success(value ? `${c.name}: pago até ${formatDate(`${value}T12:00:00`)}.` : `${c.name}: sem vencimento.`);
        setDateFor(null);
        await load();
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível salvar.'));
      }
    });
  }

  /** +30 dias a partir do vencimento atual (ou de hoje, se já venceu ou não tem). */
  function plus30(c: AdminClub) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current = c.paid_until ? new Date(`${c.paid_until}T00:00:00`) : null;
    const base = current && current > today ? current : today;
    return iso(addDays(base, 30));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto mobile-view-padding text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="mb-1">Clubes</h1>
          <p className="text-muted text-sm mb-0">Só você vê esta tela. Crie clubes, mande o acesso ao dono e controle o vencimento.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Novo clube
        </button>
      </div>

      {link && (
        <section className="glass-panel p-5 mb-6 border border-primary" aria-live="polite">
          <div className="flex justify-between items-start gap-3 mb-2">
            <h2 className="text-base font-bold text-white mb-0">Link de acesso do dono · {link.club}</h2>
            <button type="button" className="text-muted border-0 cursor-pointer p-2" style={{ background: 'transparent' }} onClick={() => setLink(null)} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-muted mb-3">Vale por 30 dias e só pode ser usado uma vez. Quem abrir cria a conta e entra como dono.</p>
          <code className="block p-3 rounded-xl bg-black bg-opacity-30 text-xs text-white mb-3" style={{ wordBreak: 'break-all' }}>{inviteLink(link.token)}</code>
          <div className="flex flex-col md:flex-row gap-2">
            <button type="button" className="btn btn-outline flex-1" onClick={() => copy(inviteLink(link.token))}>
              <Copy size={16} /> Copiar link
            </button>
            <a
              className="btn btn-success flex-1 no-underline"
              href={`https://wa.me/?text=${encodeURIComponent(shareText(link.club, link.token))}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} /> Enviar no WhatsApp
            </a>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center p-10"><div className="spinner" role="status" aria-label="Carregando" /></div>
      ) : (
        <ul className="space-y-3">
          {clubs.map(c => {
            const st = statusOf(c);
            return (
              <li key={c.id} className="glass-panel p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-white mb-0 flex items-center gap-2">
                      <Building2 size={16} className="text-muted flex-shrink-0" /> <span className="truncate">{c.name}</span>
                    </p>
                    <p className="text-xs text-muted mb-0">
                      {c.owners ? `Dono: ${c.owners}` : c.pending_invites > 0 ? 'Aguardando o dono aceitar o convite' : 'Sem dono'}
                      {' · '}{c.members} na equipe · {c.tables} mesa{c.tables === 1 ? '' : 's'}
                      {c.last_table && ` · última em ${formatDate(c.last_table)}`}
                    </p>
                    <p className={`text-xs font-bold mb-0 mt-1 ${st.tone}`}>{st.label}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setPaid(c, plus30(c))} disabled={lock.busy}>
                      <CalendarPlus size={14} /> +30 dias
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => { setDateFor(c); setDateValue(c.paid_until ?? iso(new Date())); }}
                      disabled={lock.busy}
                    >
                      Definir data
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => ownerLink(c)} disabled={lock.busy}>
                      <Link2 size={14} /> Link do dono
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="novo-clube" onClick={() => setCreating(false)}>
          <form className="modal-content mobile-bottom-sheet max-w-md text-left" onClick={e => e.stopPropagation()} onSubmit={createClub}>
            <h2 id="novo-clube" className="text-lg font-bold text-white mb-4">Novo clube</h2>
            <label className="block mb-3">
              <span className="text-xs text-muted font-bold block mb-1">Nome do clube</span>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
            </label>
            <label className="block mb-5">
              <span className="text-xs text-muted font-bold block mb-1">Dias de teste grátis (0 = sem vencimento)</span>
              <input className="input" type="number" min="0" inputMode="numeric" value={newTrial} onChange={e => setNewTrial(e.target.value)} />
            </label>
            <div className="flex flex-col md:flex-row gap-2">
              <button type="submit" className="btn btn-primary flex-1" disabled={!newName.trim() || lock.busy}>
                {lock.busy ? 'Criando...' : 'Criar e gerar link do dono'}
              </button>
              <button type="button" className="btn btn-outline flex-1" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {dateFor && (
        <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="vencimento" onClick={() => setDateFor(null)}>
          <form
            className="modal-content mobile-bottom-sheet max-w-md text-left"
            onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); setPaid(dateFor, dateValue || null); }}
          >
            <h2 id="vencimento" className="text-lg font-bold text-white mb-1">Vencimento · {dateFor.name}</h2>
            <p className="text-xs text-muted mb-4">O clube é avisado 5 dias antes e bloqueado 3 dias depois de vencer.</p>
            <input className="input mb-4" type="date" value={dateValue} onChange={e => setDateValue(e.target.value)} style={{ colorScheme: 'dark' }} />
            <div className="flex flex-col gap-2">
              <button type="submit" className="btn btn-primary" disabled={!dateValue || lock.busy}>Salvar data</button>
              <button type="button" className="btn btn-outline" onClick={() => setPaid(dateFor, null)} disabled={lock.busy}>Sem vencimento</button>
              <button type="button" className="btn btn-outline" onClick={() => setDateFor(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
