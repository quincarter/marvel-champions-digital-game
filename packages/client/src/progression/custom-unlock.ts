/**
 * How an installed custom pack's heroes and scenarios unlock (issue #734). With Settings > "New custom content starts
 * unlocked" on (the default) they are always open. Off, each pack follows the way its creator chose in `pack.json`
 * (`unlock`): "open", always playable; "points", champion points spent by hand, as for an official hero; "wins", open
 * for free once the player has won `CUSTOM_WINS_TO_UNLOCK` different scenarios, or for points before that.
 *
 * Pure apart from reading which packs are loaded and the setting, both held outside (`packs/pack-registry.ts`,
 * `packs/custom-content-prefs.ts`), so `Unlocks` asks this the way it asks a wave.
 */
import { customCardPrefix, isCustomCardCode } from "@mc/content";
import { t } from "../i18n/translate.js";
import type { CardLanguage } from "../art/card-language.js";
import { customContentPrefsNow } from "../packs/custom-content-prefs.js";
import { loadedPacks } from "../packs/pack-registry.js";

export type CustomUnlockMode = "open" | "points" | "wins";

/** Different scenarios won before a "wins" pack opens for free. */
export const CUSTOM_WINS_TO_UNLOCK = 5;

/** What the lock reads for a loaded pack. */
interface UnlockablePack {
  readonly id: string;
  readonly unlock?: CustomUnlockMode;
  readonly scenarios?: readonly { readonly id: unknown; readonly name?: string }[];
  readonly cards?: readonly { readonly id: unknown; readonly name?: string }[];
}

/** The mode a hero (by its identity card code) unlocks by, or null for an official hero. */
export function customHeroMode(
  identityCardId: string,
  packs: readonly UnlockablePack[] = loadedPacks(),
  unlocked: boolean = customContentPrefsNow().unlocked,
): CustomUnlockMode | null {
  if (!isCustomCardCode(identityCardId)) return null;
  if (unlocked) return "open";
  const pack = packs.find((one) => identityCardId.startsWith(customCardPrefix(one.id)));
  return pack?.unlock ?? "open";
}

/** The mode a scenario unlocks by, or null when no loaded pack ships it (an official scenario). */
export function customScenarioMode(
  scenarioId: string,
  packs: readonly UnlockablePack[] = loadedPacks(),
  unlocked: boolean = customContentPrefsNow().unlocked,
): CustomUnlockMode | null {
  const pack = packs.find((one) => one.scenarios?.some((scenario) => scenario.id === scenarioId));
  if (!pack) return null;
  return unlocked ? "open" : (pack.unlock ?? "open");
}

/** Whether play has opened content of `mode`, given how many different scenarios the player has won. */
export function customEarned(mode: CustomUnlockMode, scenariosWon: number): boolean {
  return mode === "open" || (mode === "wins" && scenariosWon >= CUSTOM_WINS_TO_UNLOCK);
}

/** The name a loaded pack's hero or scenario goes by, for the unlock confirm; undefined when no loaded pack has it. */
export function customNameOf(id: string, packs: readonly UnlockablePack[] = loadedPacks()): string | undefined {
  for (const pack of packs) {
    const scenario = pack.scenarios?.find((one) => one.id === id);
    if (scenario?.name) return scenario.name;
    const card = pack.cards?.find((one) => one.id === id);
    if (card?.name) return card.name;
  }
  return undefined;
}

/** The free way in, as a hint ("Win 3 more different scenarios"), or null for a points-only or open pack. */
export function customFreeHint(mode: CustomUnlockMode, scenariosWon: number, lang?: CardLanguage): string | null {
  if (mode !== "wins") return null;
  return t("unlock.modWinsHint", { count: Math.max(1, CUSTOM_WINS_TO_UNLOCK - scenariosWon) }, lang);
}

/** Why locked custom content is locked, in a line: points only, or wins to go (and points meanwhile). */
export function customLockText(mode: CustomUnlockMode, scenariosWon: number, lang?: CardLanguage): string {
  if (mode === "wins") {
    return t("unlock.modWins", { count: Math.max(1, CUSTOM_WINS_TO_UNLOCK - scenariosWon) }, lang);
  }
  return t("unlock.modPoints", undefined, lang);
}
