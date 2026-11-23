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
export function poolWithRunPacks(
  base: readonly AnyCard[],
  packs: readonly PackRuntime[],
  /** Installed packs to leave out as well (`packsClashingWithRun`): their cards are never offered to this run. */
  leaveOut: ReadonlySet<string> = new Set(),
): readonly AnyCard[] {
  if (packs.length === 0 && leaveOut.size === 0) return base;
  const carried = new Set([...packs.map((pack) => pack.id), ...leaveOut]);
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

/**
 * The installed packs a run must not take cards from (#978): ones it doesn't carry that need, directly or through
 * another such pack, a pack the run keeps at a different version than the one installed. The run's copy stays as it
 * was signed, so such a pack was never checked against it. The campaign's choices and deck editor leave their cards
 * out, so neither a reward nor a deck edit can copy one in.
 */
export function packsClashingWithRun(
  installed: readonly PackRuntime[],
  runPacks: readonly PackRuntime[],
): ReadonlySet<string> {
  const clashing = new Set<string>();
  if (runPacks.length === 0) return clashing;
  const carried = new Map(runPacks.map((pack) => [pack.id, pack] as const));
  const byId = new Map(installed.map((pack) => [pack.id, pack] as const));
  const clashes = (id: string): boolean => {
    const kept = carried.get(id);
    const now = byId.get(id);
    return clashing.has(id) || (kept !== undefined && now !== undefined && kept.version !== now.version);
  };
  for (let changed = true; changed;) {
    changed = false;
    for (const pack of installed) {
      if (carried.has(pack.id) || clashing.has(pack.id) || !pack.requires.some(clashes)) continue;
      clashing.add(pack.id);
      changed = true;
    }
  }
  return clashing;
}
