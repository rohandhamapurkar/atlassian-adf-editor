import { emptyDocument, parseDocument, serialize } from './document';

export interface SavedVersion { id: string; date: number; document: string; reason: string }
export interface Session { document: string; draft: string; dirty: boolean; versions: SavedVersion[]; savedAt?: number }
export const initialSession = (): Session => ({ document: serialize(emptyDocument), draft: serialize(emptyDocument), dirty: false, versions: [] });

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('adf-editor-state', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('editorState')) request.result.createObjectStore('editorState');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Local storage is blocked by another tab.'));
  });
}

export async function loadSession(): Promise<Session> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('editorState', 'readonly');
      const store = tx.objectStore('editorState');
      const request = store.get('workspace-v2');
      const legacy = store.get('latest-adf');
      tx.oncomplete = () => {
        try {
          if (request.result) {
            const saved = request.result as Session;
            parseDocument(saved.document);
            if (typeof saved.draft !== 'string' || typeof saved.dirty !== 'boolean' || !Array.isArray(saved.versions)) throw new Error('Invalid saved workspace.');
            const versions = saved.versions.filter(version => {
              try {
                if (!version || typeof version.id !== 'string' || typeof version.date !== 'number' || typeof version.reason !== 'string') return false;
                parseDocument(version.document); return true;
              } catch { return false; }
            }).slice(0, 10);
            resolve({ ...saved, versions });
          } else if (legacy.result) {
            const document = serialize(parseDocument(legacy.result));
            resolve({ ...initialSession(), document, draft: document });
          } else resolve(initialSession());
        } catch (e) { reject(e); }
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function saveSession(session: Session): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('editorState', 'readwrite');
      const store = tx.objectStore('editorState');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      try {
        store.put(session, 'workspace-v2');
        store.put(session.document, 'latest-adf');
      } catch (error) { tx.abort(); reject(error); }
    });
  } finally { db.close(); }
}

export function checkpoint(session: Session, nextDocument: string, reason: string, now = Date.now()): SavedVersion[] {
  if (nextDocument === session.document) return session.versions;
  const recent = session.versions[0];
  // Group continuous typing into one checkpoint; explicit operations always
  // preserve the document they replace. Keep at most ten previous documents.
  if (reason === 'Typing' && recent?.reason === 'Typing' && now - recent.date < 30_000) return session.versions;
  return [{ id: crypto.randomUUID(), date: now, document: session.document, reason }, ...session.versions].slice(0, 10);
}
