/**
 * The Mod Store's packs grouped by the batch they shipped in, newest batch first, for the landing page's Mod Store
 * section. A batch has the owner's poster and the store ids of its packs. A store pack in no batch's list is newer than
 * all of them, so it joins the newest batch. A batch may also list packs announced before the store lists them; each
 * shows with its own cover until a store pack of the same kind and name, outside the older batches, takes its place,
 * and never again once such a pack has been withdrawn from the store.
 */

/** What the page shows of a pack: a store pack, or an announced one. */
export interface BatchMod {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly creator: string;
  readonly summary?: string;
  readonly thumbnail?: string;
  /** Announced, not in the store yet. */
  readonly soon?: boolean;
}

export interface ModBatch {
  readonly number: number;
  /** The batch's poster, a bundled asset URL. */
  readonly poster: string;
  /** Store ids of the batch's packs. */
  readonly ids: readonly string[];
  /** Packs announced for the batch before the store lists them. */
  readonly announced: readonly BatchMod[];
}

export interface BatchGroup {
  readonly batch: ModBatch;
  readonly mods: readonly BatchMod[];
}

const sameKey = (mod: Pick<BatchMod, "kind" | "name">) => `${mod.kind}|${mod.name.trim().toLowerCase()}`;

const byKindThenName = (a: BatchMod, b: BatchMod) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);

/**
 * Groups `mods` into `batches` (any order in, newest batch first out). `withdrawn` are the store's withdrawn packs: one
 * that would have taken an announced pack's place keeps that announcement hidden.
 */
export function groupByBatch(
  mods: readonly BatchMod[],
  batches: readonly ModBatch[],
  withdrawn: readonly Pick<BatchMod, "id" | "kind" | "name">[] = [],
): BatchGroup[] {
  const ordered = [...batches].sort((a, b) => b.number - a.number);
  const newest = ordered[0];
  if (!newest) return [];
  const listed = new Map<number, BatchMod[]>(ordered.map((batch) => [batch.number, []]));
  for (const mod of mods) {
    const home = ordered.find((batch) => batch.ids.includes(mod.id)) ?? newest;
    listed.get(home.number)!.push(mod);
  }
  const gone = new Map<number, string[]>(ordered.map((batch) => [batch.number, []]));
  for (const pack of withdrawn) {
    const home = ordered.find((batch) => batch.ids.includes(pack.id)) ?? newest;
    gone.get(home.number)!.push(sameKey(pack));
  }
  return ordered.map((batch) => {
    const own = listed.get(batch.number)!;
    // An announced pack shows until a store pack outside the older batches' lists has its kind and name, listed or
    // withdrawn.
    const inStore = new Set([...own.map(sameKey), ...gone.get(batch.number)!]);
    const waiting = batch.announced.filter((mod) => !inStore.has(sameKey(mod)));
    return { batch, mods: [...own, ...waiting].sort(byKindThenName) };
  });
}
