import { describe, expect, it } from 'vitest';
import { defaultSchema } from '@atlaskit/adf-schema/schema-default';
import { JSONTransformer, isJSONDocNode } from '@atlaskit/editor-json-transformer';
import comment from '../../fixtures/comment.adf.json';

describe('saved ADF compatibility with the upgraded Atlaskit schema', () => {
  it('preserves the rich comment fixture through parsing and serialization', () => {
    const transformer = new JSONTransformer(defaultSchema);
    if (!isJSONDocNode(comment)) throw new Error('The regression fixture must be an ADF document');
    const document = transformer.parse(comment);
    document.check();
    const exported = transformer.encode(document);

    expect(exported.version).toBe(1);
    expect(exported.content.map(node => node.type)).toEqual(comment.content.map(node => node.type));
    const serialized = JSON.stringify(exported);
    for (const text of ['Standalone comment features', 'Bold text', '@Rohan Dhamapurkar', '🚀', 'Info panel', 'Check editor compatibility', 'READY', 'const stable = true;', 'Tables']) {
      expect(serialized).toContain(text);
    }
    expect(serialized).toContain('"strong"');
    expect(serialized).toContain('"TODO"');
    expect(serialized).toContain('1792108800000');
  });
});
