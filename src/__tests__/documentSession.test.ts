import { checkpoint, initialSession } from '../persistence';
import { parseDocument, serialize } from '../document';

const next = (text: string) => serialize({ version: 1, type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

it('rejects malformed JSON and JSON that is not an ADF document', () => {
  expect(() => parseDocument('{')).toThrow('Invalid JSON');
  for (const text of ['null', '[]', '{}', '{"type":"doc","version":2,"content":[]}']) expect(() => parseDocument(text)).toThrow('ADF must');
});

it('groups continuous typing while preserving the document before the group', () => {
  const initial = initialSession();
  const versions = checkpoint(initial, next('First'), 'Typing', 1000);
  const session = { ...initial, document: next('First'), versions };
  expect(checkpoint(session, next('Second'), 'Typing', 2000)).toEqual(versions);
  expect(versions[0].document).toBe(initial.document);
  expect(checkpoint(session, next('Later'), 'Typing', 32_000)[0].document).toBe(next('First'));
});

it('always checkpoints explicit replacements and limits history to ten versions', () => {
  let session = initialSession();
  for (let i = 0; i < 15; i++) {
    const document = next(`Document ${i}`);
    session = { ...session, document, versions: checkpoint(session, document, 'Apply JSON', i) };
  }
  expect(session.versions).toHaveLength(10);
  expect(session.versions[0].document).toBe(next('Document 13'));
  expect(session.versions[9].document).toBe(next('Document 4'));
  expect(checkpoint(session, session.document, 'Clear document')).toEqual(session.versions);
});
