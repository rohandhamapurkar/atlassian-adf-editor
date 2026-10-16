import { LocalEmojiResource } from '../utils/LocalEmojiResource';
import { vi } from 'vitest';

vi.mock('@atlaskit/platform-feature-flags', () => ({ fg: () => false }));

describe('standalone emoji provider compatibility', () => {
  it('publishes searchable results through the provider subscription API', () => {
    const provider = new LocalEmojiResource();
    const result = vi.fn();
    const listener = { result };
    provider.subscribe(listener);
    provider.filter('rocket');
    expect(result).toHaveBeenCalledWith(expect.objectContaining({
      emojis: expect.arrayContaining([
        expect.objectContaining({ id: '1f680', fallback: '🚀' }),
      ]),
    }));
    provider.unsubscribe(listener);
  });

  it('resolves serialized ADF emoji IDs and falls back to short names', () => {
    const provider = new LocalEmojiResource();
    expect(provider.findByEmojiId({ id: '1f680', shortName: ':rocket:' })?.fallback).toBe('🚀');
    expect(provider.findByEmojiId({ id: 'unknown', shortName: ':rocket:' })?.fallback).toBe('🚀');
  });

  it('applies the picker skin tone option while preserving variant lookup', async () => {
    const provider = new LocalEmojiResource();
    const repository = await provider.fetchEmojiProvider();
    const result = repository.search('thumbs up', { skinTone: 5 });
    expect(result.emojis).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '1f44d-1f3ff', fallback: '👍🏿' }),
    ]));
    expect(provider.findById('1f44d-1f3fb')?.fallback).toBe('👍🏻');
  });

  it('loads all categories locally and records selections for the picker', async () => {
    vi.useFakeTimers();
    const provider = new LocalEmojiResource();
    const repository = await provider.fetchEmojiProvider();
    expect(repository.all().emojis.length).toBeGreaterThan(3000);
    expect((await provider.findInCategory('FLAGS')).length).toBeGreaterThan(200);
    const rocket = provider.findById('1f680')!;
    expect(rocket.representation).toEqual(expect.objectContaining({
      imagePath: expect.stringContaining('data:image/svg+xml,'),
    }));
    await provider.recordSelection(rocket);
    vi.runOnlyPendingTimers();
    expect(await provider.getFrequentlyUsed()).toContainEqual(rocket);
    vi.useRealTimers();
  });
});
