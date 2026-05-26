import type { Slide } from '../types';

/** Slide fields written by the agent harness in src/App.tsx DEFAULT_DECK. */
export const AGENT_SYNC_FIELDS: (keyof Slide)[] = [
  'tag',
  'title',
  'subtitle',
  'subtitleClass',
  'bulletTextClass',
  'bullets',
  'pollOptions',
  'imageUrl',
  'footerLeft',
  'footerRight',
];

/** Merge agent-owned fields from DEFAULT_DECK (post-HMR) into persisted deck state. */
export function mergeSlidesFromDefaults(deck: Slide[], sourceDeck: Slide[]): Slide[] {
  return deck.map((s) => {
    const src = sourceDeck.find((d) => d.id === s.id);
    if (!src) return s;
    const patch: Partial<Slide> = {};
    for (const key of AGENT_SYNC_FIELDS) {
      const value = src[key];
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
    }
    return Object.keys(patch).length > 0 ? { ...s, ...patch } : s;
  });
}

/** Apply server-read fields from src/App.tsx onto one slide in deck state. */
export function applySourcePatchToSlide(slide: Slide, patch: Partial<Slide>): Slide {
  const next = { ...slide };
  for (const key of AGENT_SYNC_FIELDS) {
    if (patch[key] !== undefined) {
      (next as Record<string, unknown>)[key as string] = patch[key];
    }
  }
  return next;
}

export async function fetchAllSlideSourcePatches(
  slideIds: string[],
  fetchSlideSourceFields: (slideId: string) => Promise<Record<string, unknown> | null>,
): Promise<Map<string, Partial<Slide>>> {
  const patches = new Map<string, Partial<Slide>>();
  await Promise.all(
    slideIds.map(async (id) => {
      const patch = await fetchSlideSourceFields(id);
      if (patch && Object.keys(patch).length > 0) {
        patches.set(id, patch as Partial<Slide>);
      }
    }),
  );
  return patches;
}

export function applyPatchesToDeck(deck: Slide[], patches: Map<string, Partial<Slide>>): Slide[] {
  return deck.map((s) => {
    const patch = patches.get(s.id);
    return patch ? applySourcePatchToSlide(s, patch) : s;
  });
}
