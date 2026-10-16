import { AbstractResource, EmojiRepository } from '@atlaskit/emoji/resource';
import type {
  EmojiDescription, EmojiDescriptionWithVariations, EmojiId, EmojiProvider, EmojiSearchResult,
  SearchOptions, ToneSelection,
} from '@atlaskit/emoji/types';
import emojiData from '../data/emoji.json';

type CategoryId = Parameters<EmojiRepository['findInCategory']>[0];

// Native glyphs keep the catalog offline and avoid undocumented Atlassian services.
const emojis: EmojiDescriptionWithVariations[] = emojiData.map(([id, fallback, name, category], order) => ({
  id,
  shortName: `:${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}:`,
  name,
  fallback,
  category,
  order,
  type: 'STANDARD',
  searchable: true,
  representation: {
    width: 32,
    height: 32,
    imagePath: `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><text x="16" y="26" text-anchor="middle" font-size="28" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">${fallback}</text></svg>`
    )}`,
  },
}));

// Attach the five single-tone variants to their base for the picker's tone control.
// Mixed-tone sequences remain individually searchable.
const canonicalId = (id: string) => id.split('-').filter((part) => part !== 'fe0f').join('-');
const byId = new Map(emojis.map((emoji) => [canonicalId(emoji.id!), emoji]));
for (const emoji of emojis) {
  const parts = emoji.id!.split('-');
  const tones = parts.filter((part) => /^1f3f[b-f]$/.test(part));
  if (tones.length !== 1) continue;
  const base = byId.get(canonicalId(parts.filter((part) => part !== tones[0]).join('-')));
  if (!base) continue;
  const toneIndex = parseInt(tones[0], 16) - 0x1f3fb;
  base.skinVariations = base.skinVariations || [];
  base.skinVariations[toneIndex] = emoji;
}

export class LocalEmojiResource
  extends AbstractResource<string, EmojiSearchResult, Error, undefined, SearchOptions>
  implements EmojiProvider {
  private repository = new EmojiRepository(emojis);
  private tone: ToneSelection;

  filter(query?: string, options?: SearchOptions) {
    const result = this.repository.search(query, options);
    this.notifyResult(result);
  }
  fetchEmojiProvider() { return Promise.resolve(this.repository); }
  findById(id: string) { return this.repository.findById(id); }
  findByShortName(name: string) { return this.repository.findByShortName(name); }
  findByEmojiId(emoji: EmojiId) {
    return (emoji.id && this.findById(emoji.id)) || this.findByShortName(emoji.shortName);
  }
  fetchByEmojiId(emoji: EmojiId) { return this.findByEmojiId(emoji); }
  findInCategory(category: string) {
    return Promise.resolve(this.repository.findInCategory(category as CategoryId));
  }
  getAsciiMap() { return Promise.resolve(this.repository.getAsciiMap()); }
  getFrequentlyUsed(options?: SearchOptions) {
    return Promise.resolve(this.repository.getFrequentlyUsed(options));
  }
  recordSelection(emoji: EmojiDescription) {
    this.repository.used(emoji);
    return Promise.resolve();
  }
  calculateDynamicCategories() { return Promise.resolve(this.repository.getDynamicCategoryList()); }
  getSelectedTone() { return this.tone; }
  setSelectedTone(tone: ToneSelection) { this.tone = tone; }
  getCurrentUser() { return undefined; }
  getOptimisticImageURL() { return undefined; }
  loadMediaEmoji(emoji: EmojiDescription) { return emoji; }
  getMediaEmojiDescriptionURLWithInlineToken(emoji: EmojiDescription) { return Promise.resolve(emoji); }
  optimisticMediaRendering() { return false; }
  deleteSiteEmoji() { return Promise.resolve(false); }
}

export const emojiProvider = Promise.resolve(new LocalEmojiResource());
