/**
 * The custom pack content a campaign run carries (docs/custom-content-packs.md §7.4 and §11.10): a pack campaign's own
 * packs (`CampaignRecord.pack`) and the packs its seats' heroes and cards came from (`CampaignRecord.heroPacks`, #978).
 * Both are copied into the run when it is signed, so updating or removing a pack never changes or breaks a run.
 *
 * The screens look cards up through `content/campaign-pool.ts`, which adds the packs of every run opened this session
 * (`rememberRunPacks`) to the installed pool, so a run whose pack was removed still names and draws its cards.
 */
import type { PackCampaignRef } from "../engine/campaign-storage.js";
import { packsUsedBySeats, withRequiredPacks, type PackRuntime } from "../packs/pack-runtime.js";
import type { Deck } from "@mc/content";

/** Every pack a run carries, the campaign's own first, each id once. Empty for a base-game run of base heroes. */
export function runPacksOf(record: {
  readonly pack?: PackCampaignRef;
  readonly heroPacks?: readonly PackRuntime[];
}): readonly PackRuntime[] {
  const own = record.pack?.packs ?? [];
  const heroes = record.heroPacks ?? [];
  if (heroes.length === 0) return own;
  if (own.length === 0) return heroes;
  const ids = new Set(own.map((pack) => pack.id));
  return [...own, ...heroes.filter((pack) => !ids.has(pack.id))];
}

/**
 * The loaded packs a roster's decks draw on (a pack's hero, a pack's precon or any pack card in a built deck), with every
 * pack those require: what a new run copies in as `CampaignRecord.heroPacks`. Empty for a roster of base cards only.
 */
export function heroPacksForSeats(
  seats: readonly { readonly deck: Pick<Deck, "identityCardId" | "aspects" | "cards"> }[],
  loaded: readonly PackRuntime[],
): readonly PackRuntime[] {
  if (loaded.length === 0) return [];
  const players = seats.map(({ deck }) => ({
    identityCardId: deck.identityCardId as string,
    aspects: deck.aspects,
    deck: deck.cards.map((entry) => entry.cardId as string),
  }));
  return withRequiredPacks(packsUsedBySeats(players, loaded), loaded);
}

/** The packs of the runs opened this session, by pack id; the latest run's copy of a pack wins. */
const REMEMBERED = new Map<string, PackRuntime>();
let rememberedList: readonly PackRuntime[] = [];

/** Remembers a run's packs, so the campaign screens can name its cards even after the pack is removed. */
export function rememberRunPacks(packs: readonly PackRuntime[]): void {
  let changed = false;
  for (const pack of packs) {
    if (REMEMBERED.get(pack.id) === pack) continue;
    REMEMBERED.set(pack.id, pack);
    changed = true;
  }
  if (changed) rememberedList = [...REMEMBERED.values()];
}

/** The packs `rememberRunPacks` has kept: the same array until one more is remembered. */
export const rememberedRunPacks = (): readonly PackRuntime[] => rememberedList;

/** Tests only: forgets every remembered pack. */
export function forgetRunPacks(): void {
  REMEMBERED.clear();
  rememberedList = [];
}
