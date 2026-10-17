import { useEffect, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação dentro do próprio app.
 * Substitui window.confirm, que alguns navegadores embutidos bloqueiam em
 * silêncio (o clique parecia "não funcionar").
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={() => !busy && onCancel()}>
      <div className={`modal-content mobile-bottom-sheet max-w-md ${danger ? 'border-danger' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-glass-border rounded-full mx-auto mb-4 md:hidden" />
        <h2 id="confirm-title" className={`text-lg font-bold mb-2 ${danger ? 'text-danger' : 'text-white'}`}>{title}</h2>
        <div className="text-sm text-muted leading-relaxed mb-6 text-left">{message}</div>
        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'} w-full py-3 font-bold`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Aguarde...' : confirmLabel}
          </button>
          <button type="button" className="btn btn-outline w-full py-3" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
