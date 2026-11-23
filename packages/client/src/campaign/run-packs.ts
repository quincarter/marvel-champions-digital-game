/**
 * The custom pack content a campaign run carries (docs/custom-content-packs.md §7.4 and §11.10): a pack campaign's
 * own packs (`CampaignRecord.pack`) and the packs its seats' heroes and cards came from (`CampaignRecord.heroPacks`,
 * #978).
 * Both are copied into the run when it is signed, so updating or removing a pack never changes or breaks a run.
 *
 * The screens look cards up through `content/campaign-pool.ts`, which swaps the open run's packs into the installed
 * pool (`setOpenRunPacks`, `poolWithRunPacks`), so a run whose pack was updated or removed reads its own copy of the
 * cards.
 */
import type { PackCampaignRef } from "../engine/campaign-storage.js";
import { packsUsedBySeats, withRequiredPacks, type PackRuntime } from "../packs/pack-runtime.js";
import { packIdOfCardCode, type AnyCard, type Deck } from "@mc/content";

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
 * The loaded packs a roster's decks draw on (a pack's hero, a pack's precon or any pack card in a built deck), with
 * every pack those require: what a new run copies in as `CampaignRecord.heroPacks`. Empty for a roster of base cards
 * only.
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

/**
 * `base` with a run's packs swapped in: every card of a pack the run carries comes from the run's own copy, never from
 * the installed version, and a card an installed version added after the run was signed is left out. So the campaign's
 * screens, choices and deck editor read the same cards the run's games are dealt (`CampaignService.launchConfig`),
 * whatever version of the pack is installed now. Base cards, and installed packs the run doesn't carry, stay as they
 * are.
 */
export function poolWithRunPacks(base: readonly AnyCard[], packs: readonly PackRuntime[]): readonly AnyCard[] {
  if (packs.length === 0) return base;
  const carried = new Set(packs.map((pack) => pack.id));
  const seen = new Set<string>();
  const runCards = packs
    .flatMap((pack) => pack.cards)
    .filter((card) => !seen.has(card.id as string) && seen.add(card.id as string));
  const kept = base.filter((card) => {
    const packId = packIdOfCardCode(card.id as string);
    return (packId === undefined || !carried.has(packId)) && !seen.has(card.id as string);
  });
  return [...kept, ...runCards];
}

/** The packs of the run the campaign screens have open: the latest one started, loaded or written. */
let openRunPacks: readonly PackRuntime[] = [];

/** Marks `packs` as the open run's, so the campaign screens read its own copies of their cards (`campaign-pool.ts`). */
export function setOpenRunPacks(packs: readonly PackRuntime[]): void {
  if (packs.length === openRunPacks.length && packs.every((pack, index) => pack === openRunPacks[index])) return;
  openRunPacks = packs;
}

/** The open run's packs: the same array until another run's are set. */
export const openRunPacksNow = (): readonly PackRuntime[] => openRunPacks;

/** Tests only: no run open. */
export function forgetRunPacks(): void {
  openRunPacks = [];
}
