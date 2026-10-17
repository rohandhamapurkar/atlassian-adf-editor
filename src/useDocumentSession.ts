import { useCallback, useEffect, useRef, useState } from 'react';
import { checkpoint, initialSession, loadSession, saveSession, type Session } from './persistence';
import { serialize, type AdfDocument } from './document';

export function useDocumentSession() {
  const [session, setSession] = useState(initialSession);
  const current = useRef(session);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Loading saved document…');
  const [storageError, setStorageError] = useState('');
  const canSave = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const save = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (!canSave.current) return;
    const snapshot = { ...current.current, savedAt: Date.now() };
    const savedRevision = revision.current;
    queue.current = queue.current.catch(() => {}).then(() => saveSession(snapshot)).then(() => {
      if (savedRevision === revision.current) {
        setStatus(`Saved locally at ${new Date(snapshot.savedAt).toLocaleTimeString()}`); setStorageError('');
      }
    }).catch(() => { setStatus('Not saved'); setStorageError('Could not save locally. Export your document to keep a copy, then retry.'); });
  }, []);
  const update = useCallback((next: Session) => {
    current.current = next; setSession(next); revision.current++;
    setStatus(canSave.current ? 'Saving…' : 'Local saving unavailable');
    clearTimeout(timer.current); timer.current = setTimeout(save, 500);
  }, [save]);
  useEffect(() => {
    let active = true;
    loadSession().then(value => {
      if (!active) return;
      current.current = value; setSession(value); canSave.current = true;
      setStatus(value.savedAt ? `Restored from ${new Date(value.savedAt).toLocaleString()}` : 'Local saving ready');
    }).catch(() => {
      if (active) { setStorageError('Could not read local storage. Existing saved data has been left untouched. Export changes before reloading.'); setStatus('Local saving unavailable'); }
    }).finally(() => { if (active) setLoading(false); });
    const flush = () => { if (timer.current) { clearTimeout(timer.current); timer.current = undefined; save(); } };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
    return () => { active = false; clearTimeout(timer.current); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
  }, [save]);
  const commit = useCallback((document: AdfDocument, reason: string, keepDraft = false) => {
    const text = serialize(document); const previous = current.current;
    if (text === previous.document && keepDraft) return;
    update({ ...previous, document: text, versions: checkpoint(previous, text, reason),
      draft: keepDraft && previous.dirty ? previous.draft : text,
      dirty: keepDraft && previous.dirty });
  }, [update]);
  const editDraft = useCallback((draft: string) => { update({ ...current.current, draft, dirty: draft !== current.current.document }); }, [update]);
  const discardDraft = useCallback(() => { update({ ...current.current, draft: current.current.document, dirty: false }); }, [update]);
  return { session, current, loading, status, storageError, canSave: canSave.current, commit, editDraft, discardDraft, retrySave: save };
}
