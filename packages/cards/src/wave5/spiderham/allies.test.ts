import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import { activeEncounterDeck, applyCommand, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, moveToDiscard } from "../../testing/staging.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spiderHamScenario } from "./support.js";

const spiderHamVsRhino = (seed = 1) => startWave5Game(spiderHamScenario("rhino", { seed }));

/**
 * Accepts every named optional trigger/target option (by exact id, `<instanceId>:<abilityId>` suffix, or a chosen
 * target's own instance id) and greedily maxes out any card-search/cost-payment prompt that isn't itself the thing
 * being matched — `wave5/ironheart/allies.test.ts`'s own `accepting()` precedent, ported here since this module's
 * own tests need `chooseCards` handled (Captain Americat's discard search) as well as `payForCard`.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    // A named `wanted` id always wins, even inside a `chooseCards`/cost prompt (Captain Americat's own discard
    // search offers more than one identity-specific candidate once the payment itself discards a few) — checked
    // before the greedy card-search/cost-payment fallback below.
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    if (hits.length > 0) return hits.slice(0, choice.maxSelections);
    if (
      choice.prompt.kind === "chooseCostCards" ||
      choice.prompt.kind === "chooseCards" ||
      choice.prompt.kind === "payForAbility"
    ) {
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    }
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    return firstLegal(state);
  };

/** Pulls `n` more cards into P1's hand from the precon deck (distinct resource-icon fillers, well under each
 * printed quantity), so a test playing more than one costly card in sequence doesn't run the real hand dry —
 * `wave5/ironheart/allies.test.ts`'s own `TOPUP_CODES`/`topUp` precedent, spiderham's own deck codes. */
const TOPUP_CODES = [
  "30003",
  "30003",
  "30006",
  "30006",
  "30007",
  "30007",
  "30007",
  "30014",
  "30014",
  "30014",
  "30016",
  "30016",
  "30016",
];
function topUp(state: GameState, n: number): GameState {
  return moveToHand(state, P1, ...TOPUP_CODES.slice(0, n)).state;
}

/**
 * The specific instance `stackEncounterDeck(state, ..., code)` will place — computed the same way it picks one
 * (deck first, else discard) — so a test can name the *exact* card that reaches play when the modular set carries
 * more than one copy of `code` (Breakin' & Takin', 01107, quantity 2 in Rhino's own set): `instancesOf(state,
 * code)[0]` is not reliably that one, since `instancesOf` reads `Object.values` order, not deck position.
 */
function pendingInstanceOf(state: GameState, code: string): InstanceId {
  const piles = activeEncounterDeck(state);
  const wanted = cardId(code);
  const id =
    piles.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    piles.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return id;
}

describe("Captain Americat (ally, 30002)", () => {
  it("30002.captain-americat-response: places 1 toon counter on the identity and shuffles a Spider-Ham card from the discard pile into the deck", () => {
    const hero = runWave5(spiderHamVsRhino(), toHero(P1));
    // Ham It Up (30003): aspect "hero:30001a", Spider-Ham's own identity-specific set. Note this player's own
    // resource payment for Captain Americat also discards 3 hand cards, several of them identity-specific too (his
    // deck is mostly his own signature cards) — `accepting` is told `hamItUp`'s own id by name so the search
    // picks *that* card specifically, not merely the first candidate offered.
    const { state: withDiscard, id: hamItUp } = moveToDiscard(hero, P1, "30003");
    const identity = identityOf(withDiscard, P1);
    // `moveToHand` first, so `deckBefore` is captured *after* Captain Americat herself has already left the deck
    // (or was already in hand) — otherwise whether her own card started in the opening hand or the deck changes
    // the expected post-shuffle deck size by one, seed-dependently.
    const given = moveToHand(withDiscard, P1, "30002");
    const [card] = given.ids as [InstanceId];
    const deckBefore = playerOf(given.state, P1).deck.length;
    const settled = settle(
      runWave5(given.state, play(P1, card, payWith(given.state, P1, 3, [card]))),
      accepting("30002.captain-americat-response", hamItUp),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, identity).counters.toon ?? 0).toBe(1);
    expect(playerOf(settled, P1).discard).not.toContain(hamItUp);
    expect(playerOf(settled, P1).deck).toContain(hamItUp);
    expect(playerOf(settled, P1).deck.length).toBe(deckBefore + 1);
  });

  it("30002.captain-americat-response: with no Spider-Ham (identity-specific) card in the discard pile, places the toon counter and shuffles nothing", () => {
    const hero = runWave5(spiderHamVsRhino(2), toHero(P1));
    const identity = identityOf(hero, P1);
    // Pays with basic-aspect fillers only (30022, "Team-Building Exercise", aspect "basic"), so no identity-specific
    // card lands in the discard pile as a side effect of paying the cost.
    const given = moveToHand(hero, P1, "30022", "30022", "30022", "30002");
    const [filler1, filler2, filler3, card] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const deckBefore = playerOf(given.state, P1).deck.length;
    const discardBefore = playerOf(given.state, P1).discard.length;
    const settled = settle(
      runWave5(given.state, play(P1, card, [filler1, filler2, filler3])),
      accepting("30002.captain-americat-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(settled, identity).counters.toon ?? 0).toBe(1);
    expect(playerOf(settled, P1).deck.length).toBe(deckBefore);
    expect(playerOf(settled, P1).discard.length).toBe(discardBefore + 3); // only the 3 payment cards.
  });
});

describe("Lady Spider (ally, 30012)", () => {
  const LADY_SPIDER_RESPONSE = "30012.lady-spider-response";
  const ladyThwarts = (lady: InstanceId, scheme: InstanceId) =>
    ({ type: "basicThwart", playerId: P1, thwarterInstanceId: lady, schemeInstanceId: scheme }) as never;
  /** `accepting(...)`, counting how many times Lady Spider's Response is offered. */
  const counting = (pick: Picker) => {
    let offers = 0;
    const picker: Picker = (state) => {
      if (state.pendingChoice?.options.some((o) => o.optionId.endsWith(`:${LADY_SPIDER_RESPONSE}`))) offers++;
      return pick(state);
    };
    return { picker, offers: () => offers };
  };

  it("30012.lady-spider-response: her basic thwart removes 2, and with another Web-Warrior card controlled (Spider-Ham) exactly 2 is removed from the chosen different scheme, once", () => {
    const hero = runWave5(spiderHamVsRhino(2), toHero(P1)); // Spider-Ham (hero form) is the other Web-Warrior card.
    const { state: withLady, id: lady } = playFromHand(hero, "30012", 4, accepting());
    const { state: staged, id: scheme } = encounterCardInVillainArea(withLady, "01107", 5);
    const { state: staged2, id: other } = encounterCardInVillainArea(staged, "01109", 4);
    const main = staged2.mainScheme.instanceId;
    const mainBefore = inst(staged2, main).threat;
    const { picker, offers } = counting(accepting(LADY_SPIDER_RESPONSE, other));
    const thwarted = settle(runWave5(staged2, ladyThwarts(lady, scheme)), picker, undefined, WAVE5_DEPS);
    expect(inst(thwarted, scheme).threat).toBe(3); // her own THW 2.
    expect(inst(thwarted, other).threat).toBe(2); // "an equal amount": exactly 2, from the different scheme.
    expect(inst(thwarted, main).threat).toBe(mainBefore);
    // Her own removal from the other scheme is not a thwart: she is not offered her Response a second time.
    expect(offers()).toBe(1);
  });

  it("30012.lady-spider-response: the thwarted scheme is not offered as the different scheme", () => {
    const hero = runWave5(spiderHamVsRhino(2), toHero(P1));
    const { state: withLady, id: lady } = playFromHand(hero, "30012", 4, accepting());
    const { state: staged, id: scheme } = encounterCardInVillainArea(withLady, "01107", 5);
    const atTarget = settle(
      runWave5(staged, ladyThwarts(lady, scheme)),
      accepting(LADY_SPIDER_RESPONSE),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      WAVE5_DEPS,
    );
    const offered = atTarget.pendingChoice?.options.map((o) => o.optionId) ?? [];
    expect(offered).toContain(atTarget.mainScheme.instanceId);
    expect(offered).not.toContain(scheme);
  });

  it("30012.lady-spider-response: a thwart that removes no threat (Brute Force Barricade blocks it) removes none from a different scheme", () => {
    const hero = runWave5(startWave5Game(spiderHamScenario("sinister-six", { seed: 2 })), toHero(P1));
    const { state: withLady, id: lady } = playFromHand(topUp(hero, 4), "30012", 4, accepting());
    // Light at the End (`sm` 27102a), in play from setup; "Threat cannot be removed from other side schemes."
    // (Brute Force Barricade, `sm` 27107.)
    const light = instancesOf(withLady, "27102a")[0]!;
    const { state: staged, id: barricade } = encounterCardInVillainArea(
      patchInstance(withLady, light, { threat: 5 }),
      "27107",
      3,
    );
    const main = staged.mainScheme.instanceId;
    const mainBefore = inst(staged, main).threat;
    const thwarted = settle(
      runWave5(staged, ladyThwarts(lady, light)),
      accepting(LADY_SPIDER_RESPONSE, main, barricade),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(thwarted, lady).exhausted).toBe(true); // she did thwart,
    expect(inst(thwarted, light).threat).toBe(5); // but removed no threat,
    expect(inst(thwarted, main).threat).toBe(mainBefore); // so none is removed from a different scheme.
    expect(inst(thwarted, barricade).threat).toBe(3);
  });

  it("30012.lady-spider-response: without another Web-Warrior card controlled (alter-ego form: Peter Porker prints no Web-Warrior trait), thwarting removes no threat from a different scheme", () => {
    const hero = spiderHamVsRhino(2); // stays in alter-ego (Peter Porker): not a Web-Warrior card.
    const { state: withLady, id: lady } = playFromHand(hero, "30012", 4, accepting());
    const { state: staged, id: scheme } = encounterCardInVillainArea(withLady, "01107", 5);
    const { state: staged2, id: other } = encounterCardInVillainArea(staged, "01109", 4);
    const otherBefore = inst(staged2, other).threat;
    const thwarted = settle(
      runWave5(staged2, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: lady,
        schemeInstanceId: scheme,
      } as never),
      firstLegal, // declines every optional response/target by default
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(thwarted, scheme).threat).toBe(3); // thwarted normally.
    expect(inst(thwarted, other).threat).toBe(otherBefore); // untouched: Lady Spider alone is not "another".
  });
});

describe("Spider-Man / Pavitr Prabhakar (ally, 30013)", () => {
  it("30013.spider-man-response: removes 1 threat from a chosen scheme for each Web-Warrior card controlled, including himself", () => {
    const hero = spiderHamVsRhino(1); // alter-ego: the identity itself does not count here.
    const { state: staged, id: scheme } = encounterCardInVillainArea(hero, "01107", 5);
    const { state: after } = playFromHand(staged, "30013", 3, accepting("30013.spider-man-response", scheme));
    expect(inst(after, scheme).threat).toBe(4); // 1 Web-Warrior card (himself, "including Spider-Man").
  });

  it("30013.spider-man-response: with a second Web-Warrior card already controlled, removes 2 threat", () => {
    const hero = topUp(spiderHamVsRhino(2), 4);
    const { state: withLady } = playFromHand(hero, "30012", 4, accepting());
    const { state: staged, id: scheme } = encounterCardInVillainArea(withLady, "01107", 5);
    const { state: after } = playFromHand(staged, "30013", 3, accepting("30013.spider-man-response", scheme));
    expect(inst(after, scheme).threat).toBe(3); // Lady Spider + himself = 2 Web-Warrior cards.
  });
});

describe("Scarlet Spider (ally, 30020)", () => {
  it("30020.scarlet-spider-constant: cannot be played without controlling a Web-Warrior card (alter-ego: Peter Porker)", () => {
    const hero = spiderHamVsRhino();
    const given = moveToHand(hero, P1, "30020");
    const [card] = given.ids as [InstanceId];
    const result = applyCommand(given.state, play(P1, card, payWith(given.state, P1, 4, [card])), WAVE5_DEPS);
    expect(result.ok).toBe(false);
  });

  it("30020.scarlet-spider-constant: can be played while controlling a Web-Warrior card (the identity, in hero form)", () => {
    const hero = runWave5(spiderHamVsRhino(), toHero(P1));
    const { state: after, id } = playFromHand(hero, "30020", 4, accepting("30020.scarlet-spider-interrupt"));
    expect(cardsInPlay(after)).toContain(id);
  });

  /**
   * Plays Scarlet Spider, stages "01107" (a side scheme) as the actual reveal (Advance, "01186", 0 boost, drawn as
   * the villain's own boost card first — `events.ts`'s own "I Don't Think So!" precedent), and settles P1's turn
   * *up to* the moment her own interrupt is offered — stopping there, rather than after the whole villain phase, is
   * load-bearing: "End of Player Phase" step 1/2 (discard down to hand size, then draw back up to it, `flow.ts`
   * `executeEndPhaseDiscard`/`endPhaseDraw`) runs *before* the villain phase even begins, so a hand-size snapshot
   * taken before `endTurn` is not a valid "before" baseline for "draws 1 card" — it has to be taken here, after
   * that ordinary refill and before Scarlet Spider's own draw.
   */
  function toScarletInterruptOffer(hero: GameState) {
    const { state: withScarlet, id: scarlet } = playFromHand(hero, "30020", 4, accepting());
    const revealedInstance = pendingInstanceOf(withScarlet, "01107");
    const stacked = stackEncounterDeck(withScarlet, "01186", "01107");
    const atOffer = settle(
      runWave5(stacked, endTurn(P1)),
      firstLegal,
      (s) => (s.pendingChoice?.options ?? []).some((o) => o.optionId.endsWith(":30020.scarlet-spider-interrupt")),
      WAVE5_DEPS,
    );
    return { atOffer, scarlet, revealedInstance };
  }

  it("30020.scarlet-spider-interrupt: naming the revealed card's actual type deals 1 damage to Scarlet Spider and draws 1 card", () => {
    const hero = runWave5(spiderHamVsRhino(2), toHero(P1));
    const { atOffer, scarlet, revealedInstance } = toScarletInterruptOffer(hero);
    const handBefore = playerOf(atOffer, P1).hand.length;
    const damageBefore = inst(atOffer, scarlet).damage;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      const named = choice.options.find((o) => o.optionId.endsWith(":30020.scarlet-spider-interrupt"));
      if (named) return [named.optionId];
      const hit = choice.options.find((o) => o.label === "sideScheme"); // the revealed card's actual type.
      return hit ? [hit.optionId] : firstLegal(s);
    };
    const settled = settle(atOffer, pick, (s) => cardsInPlay(s).includes(revealedInstance), WAVE5_DEPS);
    expect(inst(settled, scarlet).damage).toBe(damageBefore + 1);
    expect(playerOf(settled, P1).hand.length).toBe(handBefore + 1);
  });

  it("30020.scarlet-spider-interrupt: naming the wrong type deals no damage and draws no card", () => {
    const hero = runWave5(spiderHamVsRhino(3), toHero(P1));
    const { atOffer, scarlet, revealedInstance } = toScarletInterruptOffer(hero);
    const handBefore = playerOf(atOffer, P1).hand.length;
    const damageBefore = inst(atOffer, scarlet).damage;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      const named = choice.options.find((o) => o.optionId.endsWith(":30020.scarlet-spider-interrupt"));
      if (named) return [named.optionId];
      const hit = choice.options.find((o) => o.label === "minion"); // wrong: the revealed card is a side scheme.
      return hit ? [hit.optionId] : firstLegal(s);
    };
    const settled = settle(atOffer, pick, (s) => cardsInPlay(s).includes(revealedInstance), WAVE5_DEPS);
    expect(inst(settled, scarlet).damage).toBe(damageBefore);
    expect(playerOf(settled, P1).hand.length).toBe(handBefore);
  });

  it("30020.scarlet-spider-interrupt: declined, the card resolves normally with no damage or draw", () => {
    const hero = runWave5(spiderHamVsRhino(4), toHero(P1));
    const { atOffer, scarlet, revealedInstance } = toScarletInterruptOffer(hero);
    const handBefore = playerOf(atOffer, P1).hand.length;
    const damageBefore = inst(atOffer, scarlet).damage;
    const settled = settle(
      atOffer,
      firstLegal, // declines the interrupt entirely
      (s) => cardsInPlay(s).includes(revealedInstance),
      WAVE5_DEPS,
    );
    expect(inst(settled, scarlet).damage).toBe(damageBefore);
    expect(playerOf(settled, P1).hand.length).toBe(handBefore);
  });
});

describe("SP//dr (ally, 30021)", () => {
  it("30021.sp-dr-constant: cannot be played without controlling a Web-Warrior card (alter-ego: Peter Porker)", () => {
    const hero = spiderHamVsRhino();
    const given = moveToHand(hero, P1, "30021");
    const [card] = given.ids as [InstanceId];
    const result = applyCommand(given.state, play(P1, card, payWith(given.state, P1, 2, [card])), WAVE5_DEPS);
    expect(result.ok).toBe(false);
  });

  it("30021.sp-dr-constant: can be played while controlling a Web-Warrior card (the identity, in hero form)", () => {
    const hero = runWave5(spiderHamVsRhino(2), toHero(P1));
    const { state: after, id } = playFromHand(hero, "30021", 2, accepting());
    expect(cardsInPlay(after)).toContain(id);
  });

  // "When Defeated: Add SP//dr to your hand if she was defeated by taking excess consequential damage." — a known
  // engine gap (`allies.ts`'s own module docblock): `characterDefeated`/`DefeatHint`
  // (`packages/engine/src/{trigger-events,resolve/defeat}.ts`) carry no `consequential` flag distinguishing a defeat
  // caused by an ally's own consequential damage (`dealDamage.consequential`, `pushConsequentialDamage`,
  // `packages/engine/src/actions.ts`) from an ordinary attack or treachery defeat, so `30021.when-defeated` is
  // intentionally left unregistered rather than guessed at.
  it.skip("30021.when-defeated: adds SP//dr back to hand only when the excess damage that defeated her was consequential — blocked on a DefeatHint.consequential engine primitive", () => {});
});
