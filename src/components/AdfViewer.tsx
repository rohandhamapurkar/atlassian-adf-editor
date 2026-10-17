import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import ResizableSplit from './ResizableSplit';
import EditorBoundary from './EditorBoundary';
import type { EditorController } from './RichEditor';
import { emptyDocument, parseDocument, serialize, documentPreview, type AdfDocument } from '../document';
import { useDocumentSession } from '../useDocumentSession';

const RichEditor = lazy(() => import('./RichEditor'));
const JsonEditor = lazy(() => import('./JsonEditor'));

export default function AdfViewer() {
  const { session, current, loading, status, storageError, canSave, commit, editDraft, discardDraft, retrySave } = useDocumentSession();
  const { document: applied, draft, dirty, versions } = session;
  const [error, setError] = useState('');
  const syntaxError = useMemo(() => {
    try { parseDocument(draft); return ''; } catch (e) { return (e as Error).message; }
  }, [draft]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const controller = useRef<EditorController>();
  const initialDocument = useRef<AdfDocument>();
  if (!loading && !initialDocument.current) initialDocument.current = parseDocument(applied);
  const onReady = useCallback((api: EditorController) => { controller.current = api; setReady(true); }, []);
  const changeDraft = (text: string) => {
    editDraft(text); setError('');
  };
  const editorChanged = useCallback((value: AdfDocument) => { commit(value, 'Typing', true); }, [commit]);
  const replace = (value: AdfDocument, reason: string) => {
    if (!controller.current) throw new Error('Wait for the editor to finish loading.');
    controller.current.apply(value); commit(value, reason); setError('');
  };
  const apply = () => {
    try { replace(parseDocument(current.current.draft), 'Apply JSON'); setNotice('JSON applied to the editor.'); }
    catch (e) { setError((e as Error).message); }
  };
  const protectDraft = (action: () => void) => {
    if (current.current.dirty) setConfirmation({ message: 'Replace your unapplied JSON draft? The applied document will stay in local history when changed.', action });
    else action();
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a JSON file smaller than 5 MB.');
      const text = await file.text(); parseDocument(text);
      protectDraft(() => { changeDraft(text); setNotice('File loaded as a draft. Review it, then choose Apply JSON.'); });
    } catch (e) { setError((e as Error).message); }
  };
  const exportDocument = () => {
    const url = URL.createObjectURL(new Blob([current.current.document], { type: 'application/json' }));
    const link = window.document.createElement('a'); link.href = url; link.download = 'document.adf.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Exported the applied editor document.');
  };
  const copyDocument = async () => {
    try { await navigator.clipboard.writeText(current.current.document); setNotice('Applied ADF copied to clipboard.'); }
    catch { setNotice('Clipboard unavailable. Use Export ADF or select and copy the JSON manually.'); }
  };
  const loadExample = async () => {
    try {
      const { default: example } = await import('../../fixtures/comment.adf.json');
      protectDraft(() => { changeDraft(JSON.stringify(example, null, 2)); setNotice('Example loaded as a draft. Choose Apply JSON to use it.'); });
    } catch { setError('Could not load the example. Please try again.'); }
  };
  const clearDocument = () => {
    try { replace(emptyDocument, 'Clear document'); setNotice('Document cleared. Recover the previous document from Local history.'); }
    catch (e) { setError((e as Error).message); }
  };
  return <ResizableSplit>
    {loading ? <div className="loading-panel" role="status">Restoring your document…</div> :
      <EditorBoundary><Suspense fallback={<div className="loading-panel" role="status">Loading rich text editor… Your document tools are ready.</div>}>
        <RichEditor initialDocument={initialDocument.current!} onReady={onReady} onChange={editorChanged} />
      </Suspense></EditorBoundary>}
    <section className="json-panel" aria-label="Document tools" aria-busy={loading}>
      <header className="panel-header"><h1>ADF Editor</h1><p>Rich text and JSON, side by side.</p></header>
      <div className="save-row"><span role="status" data-testid="save-status">{status}</span><span>Stored on this browser</span></div>
      {storageError && <div className="feedback error" role="alert">{storageError} {canSave && <button onClick={retrySave}>Retry save</button>}</div>}
      <fieldset className="document-controls" disabled={loading}>
        <legend className="sr-only">Document controls</legend>
        <div className="tool-row">
          <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label="Import ADF file" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button onClick={() => fileInput.current?.click()}>Import JSON</button>
          <button onClick={exportDocument}>Export ADF</button>
          <button onClick={copyDocument}>Copy ADF</button>
          <button onClick={loadExample}>Load example</button>
          <button onClick={() => setConfirmation({ message: 'Clear the rich text document and JSON draft? The applied document will be kept in Local history.', action: clearDocument })} disabled={!ready}>Clear document</button>
        </div>
        {dirty && <p className="feedback">Export and Copy use the applied rich text document. Apply your JSON draft to include it.</p>}
      </fieldset>
      {confirmation && <div className="confirm-box" role="alertdialog" aria-label="Confirm document change">
        <p>{confirmation.message}</p><div className="confirm-actions">
          <button onClick={() => { confirmation.action(); setConfirmation(undefined); }}>Continue</button> <button autoFocus onClick={() => setConfirmation(undefined)}>Cancel</button>
        </div>
      </div>}
      <details className="history"><summary>Local history ({versions.length}/10)</summary>
        <p className="feedback">Previous applied documents. Typing checkpoints are grouped every 30 seconds. Unapplied drafts are saved separately.</p>
        {!versions.length && <p className="feedback">Previous versions will appear as you edit.</p>}
        <ol className="history-list">{versions.map(version => <li key={version.id}>
          <div><time>{new Date(version.date).toLocaleString()}</time> · Before {version.reason}<p>{documentPreview(version.document)}</p></div>
          <button disabled={!ready} onClick={() => protectDraft(() => {
            try { replace(parseDocument(version.document), 'Restore version'); setNotice('Previous version restored.'); }
            catch (e) { setError((e as Error).message); }
          })}>Restore</button>
        </li>)}</ol>
      </details>
      {notice && <p className="feedback" role="status">{notice}</p>}
      <div className="tool-row">
        <button className="primary" onClick={apply} disabled={!ready || !dirty}>Apply JSON</button>
        <button onClick={() => { discardDraft(); setError(''); }} disabled={!dirty || loading}>Discard JSON changes</button>
        <button disabled={loading} onClick={() => { try { changeDraft(serialize(parseDocument(draft))); } catch (e) { setError((e as Error).message); } }}>Format JSON</button>
      </div>
      <p id="json-feedback" className={error || syntaxError ? 'feedback error' : 'feedback'} role="status">{error || syntaxError || (dirty ? 'Unapplied JSON changes. Apply with Ctrl/Cmd + Enter. Rich text changes will not overwrite this draft.' : 'JSON matches the editor. Edit here, then apply your changes.')}</p>
      {!loading && <Suspense fallback={<div className="loading-panel">Loading JSON editor…</div>}><JsonEditor value={draft} onChange={changeDraft} onApply={apply} /></Suspense>}
    </section>
  </ResizableSplit>;
}
