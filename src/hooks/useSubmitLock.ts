import { useCallback, useRef, useState } from 'react';

/**
 * Evita envio duplicado (toque duplo / clique repetido).
 *
 * O estado do React é assíncrono: dois toques rápidos podem ler `busy = false`
 * antes da re-renderização. Por isso a trava real é um ref, e `busy` serve
 * apenas para desabilitar o botão na tela.
 */
export function useSubmitLock() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
