import React, { useCallback, useEffect, useState } from 'react';
import { Copy, MessageCircle, Trash2, UserPlus, X } from 'lucide-react';
import { useClub } from '../contexts/ClubContext';
import {
  friendlyError,
  inviteLink,
  ROLE_HINT,
  ROLE_LABEL,
  teamService,
  type Invite,
  type Member,
  type Role
} from '../services/teamService';
import { formatDate } from '../utils';
import { toast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { useSubmitLock } from '../hooks/useSubmitLock';

/** Equipe do clube: quem tem acesso, convites e papéis. */
export default function TeamSettings() {
  const { clubId, clubName, role: myRole } = useClub();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>('caixa');
  const [inviteLabel, setInviteLabel] = useState('');
  const [created, setCreated] = useState<Invite | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const lock = useSubmitLock();

  const canInvite = myRole === 'dono' || myRole === 'gerente';
  const invitable: Role[] = myRole === 'dono' ? ['caixa', 'gerente', 'dono'] : ['caixa'];

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      const [m, i] = await Promise.all([teamService.listMembers(), canInvite ? teamService.listInvites(clubId) : Promise.resolve([])]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      console.error(e);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [clubId, canInvite]);

  useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) return;
    await lock.run(async () => {
      try {
        const inv = await teamService.createInvite(clubId, inviteRole, inviteLabel.trim() || null);
        setCreated(inv);
        setInviteLabel('');
        await load();
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível criar o convite.'));
      }
    });
  }

  async function changeRole(m: Member, role: Role) {
    await lock.run(async () => {
      try {
        await teamService.changeRole(m.user_id, role);
        toast.success(`${m.full_name || m.email} agora é ${ROLE_LABEL[role].toLowerCase()}.`);
        await load();
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível mudar o papel.'));
      }
    });
  }

  async function remove() {
    if (!removing) return;
    await lock.run(async () => {
      try {
        await teamService.removeMember(removing.user_id);
        toast.success('Acesso removido.');
        setRemoving(null);
        await load();
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível remover.'));
      }
    });
  }

  async function cancelInvite(inv: Invite) {
    await lock.run(async () => {
      try {
        await teamService.cancelInvite(inv.id);
        if (created?.id === inv.id) setCreated(null);
        await load();
      } catch (err) {
        toast.error(friendlyError(err, 'Não foi possível cancelar o convite.'));
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  const whatsappText = (inv: Invite) =>
    `Olá${inv.label ? `, ${inv.label}` : ''}! Este é o seu acesso ao ${clubName ?? 'clube'} no Masmorra Manager, como ${ROLE_LABEL[inv.role].toLowerCase()}. Abra o link e crie sua senha:\n${inviteLink(inv.token)}`;

  const canRemove = (m: Member) => !m.is_me && (myRole === 'dono' || (myRole === 'gerente' && m.role === 'caixa'));

  if (loading) return <div className="flex justify-center p-10"><div className="spinner" role="status" aria-label="Carregando" /></div>;

  if (unavailable) {
    return (
      <div className="p-6 rounded-2xl border border-glass-border text-sm text-muted">
        A gestão de equipe ainda não foi ativada no banco de dados.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="equipe-title">
        <h2 id="equipe-title" className="text-lg font-bold text-white mb-1">Equipe</h2>
        <p className="text-xs text-muted mb-4">Quem tem acesso ao {clubName}. Cada pessoa entra com o próprio e-mail e senha.</p>
        <ul className="space-y-2">
          {members.map(m => (
            <li key={m.user_id} className="p-3 rounded-xl border border-glass-border flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ background: 'rgba(15,23,42,0.4)' }}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white mb-0 truncate">
                  {m.full_name || m.email}{m.is_me && <span className="text-muted font-normal"> (você)</span>}
                </p>
                <p className="text-xs text-muted mb-0 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {myRole === 'dono' ? (
                  <select
                    className="input text-xs py-2"
                    style={{ width: 'auto' }}
                    value={m.role}
                    onChange={e => changeRole(m, e.target.value as Role)}
                    disabled={lock.busy}
                    aria-label={`Papel de ${m.full_name || m.email}`}
                  >
                    {(['dono', 'gerente', 'caixa'] as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                ) : (
                  <span className="badge badge-closed">{ROLE_LABEL[m.role]}</span>
                )}
                {canRemove(m) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm text-danger"
                    onClick={() => setRemoving(m)}
                    aria-label={`Remover ${m.full_name || m.email}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1">
          {(['dono', 'gerente', 'caixa'] as Role[]).map(r => (
            <div key={r} className="text-xs text-muted"><dt className="inline font-bold text-white">{ROLE_LABEL[r]}:</dt> <dd className="inline">{ROLE_HINT[r]}</dd></div>
          ))}
        </dl>
      </section>

      {canInvite && (
        <section aria-labelledby="convidar-title">
          <h2 id="convidar-title" className="text-lg font-bold text-white mb-1">Convidar alguém</h2>
          <p className="text-xs text-muted mb-4">Gere um link e mande para a pessoa. Ele vale por 7 dias e só pode ser usado uma vez.</p>

          {created ? (
            <div className="p-4 rounded-xl border border-primary mb-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <p className="text-sm font-bold text-white mb-0">
                  Link para {created.label || 'o novo ' + ROLE_LABEL[created.role].toLowerCase()} ({ROLE_LABEL[created.role]})
                </p>
                <button type="button" className="text-muted border-0 cursor-pointer p-1" style={{ background: 'transparent' }} onClick={() => setCreated(null)} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
              <code className="block p-3 rounded-lg bg-black bg-opacity-30 text-xs text-white mb-3" style={{ wordBreak: 'break-all' }}>{inviteLink(created.token)}</code>
              <div className="flex flex-col md:flex-row gap-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => copy(inviteLink(created.token))}>
                  <Copy size={16} /> Copiar link
                </button>
                <a className="btn btn-success flex-1 no-underline" href={`https://wa.me/?text=${encodeURIComponent(whatsappText(created))}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> Enviar no WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={invite} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
              <label className="block">
                <span className="text-xs text-muted font-bold block mb-1">Nome (opcional)</span>
                <input className="input text-sm" value={inviteLabel} onChange={e => setInviteLabel(e.target.value)} placeholder="Ex.: João" maxLength={60} />
              </label>
              <label className="block">
                <span className="text-xs text-muted font-bold block mb-1">Papel</span>
                <select className="input text-sm" value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)}>
                  {invitable.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </label>
              <button type="submit" className="btn btn-primary" disabled={lock.busy}>
                <UserPlus size={16} /> Gerar link
              </button>
            </form>
          )}

          {invites.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-muted mb-2">Convites aguardando</h3>
              <ul className="space-y-2">
                {invites.map(inv => (
                  <li key={inv.id} className="p-3 rounded-xl border border-glass-border flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-bold mb-0 truncate">{inv.label || ROLE_LABEL[inv.role]}</p>
                      <p className="text-xs text-muted mb-0">{ROLE_LABEL[inv.role]} · vale até {formatDate(inv.expires_at)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(inviteLink(inv.token))} aria-label="Copiar link">
                        <Copy size={14} />
                      </button>
                      <button type="button" className="btn btn-outline btn-sm text-danger" onClick={() => cancelInvite(inv)} disabled={lock.busy} aria-label="Cancelar convite">
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Remover acesso?"
        message={`${removing?.full_name || removing?.email} não vai mais conseguir entrar no ${clubName}. Os lançamentos que fez continuam no histórico.`}
        confirmLabel="Remover"
        danger
        busy={lock.busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
