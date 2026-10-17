/**
 * Rules audit chunk 34 (FFG rulings post-RRG 1.6, July 25 - October 10, 2025).
 *
 * Ruling 69.95 (August 22, 2025, Alex): Spectrum (`falcon` 53018, "[mental] - +2 THW. [physical] - +2 ATK. [energy] -
 * +2 hit points. [wild] - All of the above.") tucking Salvage (`gmw` 16033, which produces one [mental] and one
 * [wild]) "would give her both the Mental and Wild resource bonuses, so +4 THW, +2 ATK, and +2 HP". RRG 1.8 is silent;
 * the June 2, 2026 Ruling 2 (2) on Spectrum only says the bonuses last while the card stays tucked.
 *
 * The script (`wave9/falcon/aspect-basic.ts` `tuckedPrints`) gives each bonus once however many icons match, so a
 * [mental] + [wild] card gives +2 THW, not +4.
 */
import { statBonus, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, firstLegal, inst, moveToHand, patchInstance, play } from "../testing/harness.js";
import { driveEventsPicking } from "../testing/staging.js";
import { cardId } from "@mc/content";
import { SPECTRUM_GRANTED_RESPONSE } from "../wave9/falcon/aspect-basic.js";
import { ASPECT_DEPS as DEPS, aspectHero } from "../wave9/falcon/aspect-basic.testing.js";

vi.setConfig({ testTimeout: 120_000 });

describe("audit 34: Spectrum tucking a [mental] + [wild] card (ruling Aug 22, 2025, 69.95)", () => {
  it("gets +4 THW, +2 ATK (Mental and Wild both count)", () => {
    const base = aspectHero();
    const given = moveToHand(base, P1, "53018", "53025", "53026", "53002");
    const [spectrum, energy, genius, redwing] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    // Genius (a [mental] resource card) stands in as a card with Salvage's printed resources [mental] + [wild].
    const salvage = cardId("16033");
    const staged = patchInstance(
      {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: [spectrum, energy, genius, redwing] } : p,
        ),
      },
      genius,
      { cardId: salvage },
    );
    expect(staged.cardPool[salvage], "Salvage is in the card pool").toBeDefined();
    const pick = (s: Parameters<typeof firstLegal>[0]): readonly string[] => {
      const choice = s.pendingChoice!;
      const offered = choice.options.map((o) => o.optionId as string);
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = offered.find((o) => o.endsWith(SPECTRUM_GRANTED_RESPONSE));
        return hit ? [hit] : [];
      }
      if (choice.prompt.kind === "chooseCards" && offered.includes(genius)) return [genius];
      return firstLegal(s);
    };
    // Salvage 2 (mental + wild) + Energy 2 + Redwing 1 (wild) = 5.
    const out = driveEventsPicking(DEPS, staged, pick, play(P1, spectrum, [genius, energy, redwing]));
    expect(inst(out.state, spectrum).tucked).toEqual([genius]);
    expect(statBonus(out.state, DEPS, spectrum, "thw")).toBe(4);
    expect(statBonus(out.state, DEPS, spectrum, "atk")).toBe(2);
  });
});

/*
 * Ruling 69.94 (August 14, 2025, Alex): "cards are drawn one at a time, so if you draw Shapeshifter Surprise when
 * drawing up to your hand size, you immediately resolve it before finishing drawing cards." RRG 1.8 "Hand Size"
 * (p. 21) agrees that the end-of-phase draw checks the hand size "after each card is drawn".
 *
 * Shapeshifter Surprise (`mut_gen` 32083): "Forced Response: After this card enters your hand, ..." Engine:
 * `drawUpTo` (`engine/src/effects.ts`) loops `drawOne` to the end and the forced response is announced afterwards.
 */
import { type GameEvent as AuditEvent } from "@mc/engine";
import { runWith, toHero } from "../testing/harness.js";
import { engageMinion } from "../wave6/mut_gen/project-wideawake-testing.js";
import { mystiqueGame, onTopOfPlayerDeck } from "../wave6/mut_gen/mystique-testing.js";
import { WAVE6_DEPS } from "../wave6/index.js";

describe("audit 34: Shapeshifter Surprise resolves before the rest of the draw up to hand size (ruling Aug 14, 2025, 69.94)", () => {
  it.fails("its Forced Response resolves before the second card is drawn", () => {
    const hero = runWith(WAVE6_DEPS, mystiqueGame(), toHero(P1));
    const withMystique = engageMinion(hero, "32080", P1);
    const emptied = {
      ...withMystique.state,
      players: withMystique.state.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] })),
    };
    const staged = onTopOfPlayerDeck(emptied, "32083", P1);
    const result = driveEventsPicking(WAVE6_DEPS, staged.state, firstLegal, { type: "endTurn", playerId: P1 });
    const events: readonly AuditEvent[] = result.events;
    const drawn = events.flatMap((e, i) => (e.type === "cardDrawn" ? [i] : []));
    const resolved = events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "32083.shapeshifter-surprise-forced-response",
    );
    expect(drawn.length).toBeGreaterThan(1);
    expect(resolved, "the forced response resolved").toBeGreaterThan(-1);
    expect(resolved).toBeLessThan(drawn[1]!);
  });
});

/*
 * Inferiority Complex (`nebu` 22027): "You may flip to alter-ego form. Choose: • Exhaust your alter-ego → remove
 * this card from the game. • Choose and discard 2 Technique upgrades you control. If no upgrade was discarded this
 * way, this card gains surge. Discard this obligation."
 *
 * RRG 1.8 "Choose (Option)" (p. 12) keeps the "cannot choose an option that cannot be at least partially resolved"
 * test for player cards only; for an encounter card it only bars "an option that requires one or more targets if
 * there are no valid targets". Inferiority Complex is an encounter card, so a ready alter-ego may take the discard
 * option with fewer than 2 Technique upgrades (or none: the card itself plans for that with its surge line).
 *
 * Conflict noted: ruling 69.105 (September 15, 2025, post-RRG 1.6) says a player "must choose the option they can
 * fully resolve" on an encounter card and applies it to exactly this card. It predates RRG 1.8, which narrows that
 * test to player cards, so the engine follows p. 12 here and these tests pin that reading.
 */
import { activeEncounterDeckId, type GameState } from "@mc/engine";
import { endTurn, instancesOf, playerOf, type Picker } from "../testing/harness.js";
import { WAVE4_DEPS } from "../wave4/index.js";
import { playFromHand, startWave4Game } from "../wave4/testing.js";
import { nebulaScenario } from "../wave4/nebu/support.js";

/** Puts Inferiority Complex second from the top of the encounter deck, under a filler card. */
function stageInferiorityComplex(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => state.instances[i]?.cardId === "22027")!;
  const filler = pile.deck.find((i) => state.instances[i]?.cardId === "01186" && i !== id);
  const rest = pile.deck.filter((i) => i !== id && i !== filler);
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [filler!, id, ...rest] } } };
}

/** Flips to alter-ego when offered, records the obligation's options, then takes the discard option. */
function takingDiscard(seen: string[][]): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const flip = choice.options.find((o) => o.label === "Flip to alter-ego form");
    if (flip) return [flip.optionId];
    if (choice.options.some((o) => o.label.startsWith("Exhaust Nebula"))) seen.push(choice.options.map((o) => o.label));
    const discard = choice.options.find((o) => o.label.startsWith("Choose and discard 2 Technique"));
    return discard ? [discard.optionId] : firstLegal(state);
  };
}

describe("audit 34: Inferiority Complex keeps the discard option for a ready alter-ego (RRG 1.8 p. 12, overrides ruling 69.105)", () => {
  it("with one Technique upgrade, both options are offered and the discard option discards that upgrade", () => {
    const hero = runWith(WAVE4_DEPS, startWave4Game(nebulaScenario("rhino", { seed: 2 })), toHero());
    const { state: withOne, id: technique } = playFromHand(hero, "22004", 1);
    const seen: string[][] = [];
    const { state, events } = driveEventsPicking(
      WAVE4_DEPS,
      stageInferiorityComplex(withOne),
      takingDiscard(seen),
      endTurn(),
    );
    expect(seen, "the obligation's choice was reached from a ready alter-ego").toHaveLength(1);
    expect(seen[0]!.some((l) => l.startsWith("Exhaust Nebula"))).toBe(true);
    expect(seen[0]!.some((l) => l.startsWith("Choose and discard 2 Technique"))).toBe(true);
    expect(playerOf(state, P1).discard).toContain(technique);
    const [obligation] = instancesOf(state, "22027");
    expect(state.removedFromGame).not.toContain(obligation);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
  });

  it("with no Technique upgrades, the discard option is offered and the short discard gains surge", () => {
    const seen: string[][] = [];
    const { state, events } = driveEventsPicking(
      WAVE4_DEPS,
      stageInferiorityComplex(startWave4Game(nebulaScenario("rhino", { seed: 3 }))),
      takingDiscard(seen),
      endTurn(),
    );
    expect(seen, "the obligation's choice was reached from a ready alter-ego").toHaveLength(1);
    expect(seen[0]!.some((l) => l.startsWith("Exhaust Nebula"))).toBe(true);
    expect(seen[0]!.some((l) => l.startsWith("Choose and discard 2 Technique"))).toBe(true);
    const [obligation] = instancesOf(state, "22027");
    expect(state.removedFromGame).not.toContain(obligation);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });
});

/*
 * Ruling 69.98 (August 22, 2025, Alex), question 2: "Can I use the resource ability of a support or upgrade card to
 * pay for the cost of Spectrum (leadership ally) and tuck this card under Spectrum? Yes, you can use a resource
 * ability to pay for Spectrum and then tuck that card under her." RRG 1.8 is silent on this.
 *
 * The engine's `paid.cards` slot (`cardsThatPaid`, `engine/src/actions.ts`) lists only cards discarded from a hand,
 * and the script's own docblock says "never a resource a 'Resource' ability generated", so a card in play whose
 * resource ability paid (here Falcon's Flock, an Aerial support that pays [energy] for Spectrum) is not offered.
 */
import { FALCON_DEPS, falconHeroGame, stagedInPlay } from "../wave9/falcon/testing.js";
import { resourceAbility } from "../testing/harness.js";

describe("audit 34: Spectrum may tuck the support whose resource ability paid for her (ruling Aug 22, 2025, 69.98)", () => {
  it.fails("Falcon's Flock, used to pay for Spectrum, is among the cards offered to tuck", () => {
    const base = falconHeroGame();
    const flock = stagedInPlay(base, "53006", { counters: { bird: 5 } });
    const given = moveToHand(flock.state, P1, "53018", "53026", "53027");
    const [spectrum, genius, strength] = given.ids as [InstanceId, InstanceId, InstanceId];
    const offeredOptions: string[] = [];
    const pick = (s: Parameters<typeof firstLegal>[0]): readonly string[] => {
      const choice = s.pendingChoice!;
      const offered = choice.options.map((o) => o.optionId as string);
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = offered.find((o) => o.endsWith(SPECTRUM_GRANTED_RESPONSE));
        return hit ? [hit] : [];
      }
      if (choice.prompt.kind === "chooseCards") offeredOptions.push(...offered);
      return firstLegal(s);
    };
    // Flock [energy] 1 + Genius 2 + Strength 2 = 5.
    driveEventsPicking(
      FALCON_DEPS,
      given.state,
      pick,
      play(P1, spectrum, [genius, strength], {
        abilities: [resourceAbility(flock.id, "53006.falcons-flock-resource")],
      }),
    );
    expect(offeredOptions, "a tuck prompt was shown").not.toEqual([]);
    expect(offeredOptions).toContain(flock.id);
  });
});
