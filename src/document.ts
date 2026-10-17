export type AdfDocument = { version: 1; type: 'doc'; content: Record<string, unknown>[] };
export const emptyDocument: AdfDocument = { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [] }] };
export const serialize = (document: AdfDocument) => JSON.stringify(document, null, 2);

export function parseDocument(text: string): AdfDocument {
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON: ${(error as Error).message}`); }
  if (!value || value.type !== 'doc' || value.version !== 1 || !Array.isArray(value.content)) {
    throw new Error('ADF must have type "doc", version 1, and a content array.');
  }
  return value;
}

export function documentPreview(text: string): string {
  try {
    const texts: string[] = [];
    const walk = (node: { text?: string; content?: typeof node[] }) => {
      if (node.text) texts.push(node.text);
      node.content?.forEach(walk);
    };
    walk(JSON.parse(text));
    return texts.join(' ').slice(0, 90) || 'Empty document';
  } catch { return 'Document'; }
}
