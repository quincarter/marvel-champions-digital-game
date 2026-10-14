/**
 * A guard on the log: every kind of engine event either has a line in `log-lines.ts` or is named below as one the log
 * deliberately leaves out. A new event kind that is in neither fails here, so it is decided on (worded, or listed with
 * the reason it is bookkeeping) rather than silently missing from the log, as the wave 10 events were before this test.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), "utf8");

const eventKinds = (): string[] => {
  const source = read("../../../engine/src/events.ts");
  return [...new Set([...source.matchAll(/readonly type: "([A-Za-z]+)"/g)].map((m) => m[1]!))].sort();
};
const worded = (): Set<string> =>
  new Set([...read("./log-lines.ts").matchAll(/case "([A-Za-z]+)"/g)].map((m) => m[1]!));

/** Kinds with no line of their own: engine bookkeeping, or news the lines of neighbouring events already carry. */
const SILENT: ReadonlySet<string> = new Set([
  "abilityUseRecorded",
  "activationSkipped",
  "additionalFormChanged",
  "additionalMulligansGranted",
  "boostCardMoved",
  "boostIgnored",
  "campaignCardRemoved",
  "campaignInstructionResolved",
  "campaignLogRead",
  "campaignLogWritten",
  "cardDetached",
  "cardDiscardedFromDeck",
  "cardDrawn",
  "cardFound",
  "cardTurnedFacedown",
  "cardTurnedFaceup",
  "cardsLookedAt",
  "cardsSetAside",
  "choiceFoundNothing",
  "choiceRequested",
  "costDamageSettled",
  "damageBeyondZeroLost",
  "damageIncreased",
  "damagePlaced",
  "deckShuffled",
  "deckStacked",
  "defeatProtectionEnded",
  "defenderLeftPlay",
  "discardRefused",
  "drawnObligationPlaced",
  "encounterCardPassed",
  "encounterLookCostSettled",
  "encounterSetAutoIncluded",
  "enemyAttackCostSettled",
  "excessDamageAsThreat",
  "flipBlocked",
  "framePopped",
  "framePushed",
  "gameAreaCreated",
  "gameAreaJoined",
  "gameCreated",
  "groupChosen",
  "identitySwapped",
  "lastingEffectAdded",
  "lastingEffectEnded",
  "lastingEffectRetimed",
  "leavePlayBlocked",
  "linkedCardsSetAside",
  "mainSchemeFlippedToOtherFace",
  "mainSchemeStageRemoved",
  "mainSchemeStageRevealed",
  "optionChosen",
  "playDestinationSet",
  "playNoted",
  "playedEventReturned",
  "playerAttackRetargeted",
  "podEffectRequested",
  "preThenUnresolved",
  "readyCostAsked",
  "resourceAbilityEffects",
  "resourcesGenerated",
  "revealCancelled",
  "revealedInPlay",
  "scenarioDeckTopLeft",
  "scenarioSetupInstructionResolved",
  "separatedCardFlipped",
  "sharedStateChanged",
  "stepChanged",
  "targetChosen",
  "thenSkipped",
  "threatCostSettled",
  "threatPrevented",
  "thwartCostAsked",
  "thwartCostSettled",
  "thwartModified",
  "treatedAsChanged",
  "triggerEvent",
  "turnEnded",
  "windowOpened",
]);

describe("every engine event kind is worded or knowingly silent", () => {
  test("no kind is in neither set", () => {
    const has = worded();
    expect(eventKinds().filter((kind) => !has.has(kind) && !SILENT.has(kind))).toEqual([]);
  });

  test("a kind that now has a line is taken off the silent list", () => {
    const has = worded();
    expect([...SILENT].filter((kind) => has.has(kind))).toEqual([]);
  });

  test("a silent kind still exists in the engine", () => {
    const kinds = new Set(eventKinds());
    expect([...SILENT].filter((kind) => !kinds.has(kind))).toEqual([]);
  });

  test("the wave 10 events each have a line", () => {
    const has = worded();
    for (const kind of [
      "playedUpgradeHasNoHost",
      "cardNotTucked",
      "interruptConditionLapsed",
      "revealedCardDiscarded",
      "returnedToSeparateDeck",
      "deckDiscardStillCounted",
      "uniqueEntryBlocked",
    ]) {
      expect(has.has(kind), kind).toBe(true);
    }
  });
});
