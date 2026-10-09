import {
  applyCommand,
  cardsInPlay,
  createGame,
  legalActions,
  maxHitPoints,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playFromAnotherHerosDeck, buildCrossHeroDeck } from "../../testing/cross-hero.js";
import { wave5Scenario } from "../setup.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): every Nova
 * (`nova` 28001a-28032) aspect/basic player card — every one whose own `aspect` is not `hero:28001a` (a card only a
 * Sam Alexander deck could ever legally hold anyway, RRG 1.8 "Identity-Specific Card", p. 23) — played through the
 * engine from a Core hero's own deck instead of Nova's own precon (`nova-aggression`, `packages/content/src/data/
 * nova/starterDecks.ts`). That is 28010-28020, 28026 and 28027 (`packages/content/src/data/nova/cards.ts`'s own
 * `aspect` field per card): 28010-28017 are `aggression`, 28018-28020 are `basic`, 28026 is `justice`, 28027 is
 * `protection`. `sm/cross-hero.test.ts`'s own module docblock is the precedent for why: proof no script here
 * quietly reads "you"/"your identity" as "Nova" rather than the actual resolving player/controller.
 *
 * Each test seats the target card in a Core hero's own real precon (`playFromAnotherHerosDeck`'s own matching-
 * aspect default — an `aggression` card in She-Hulk/Aggression, a `basic` card in Spider-Man/Justice, `justice` in
 * Spider-Man/Justice, `protection` in Black Panther/Protection), plays it, and checks its printed effect fires (or,
 * for the cards gated on a named trait no Core hero happens to hold, that it is never offered / never legal) exactly
 * as it would from Nova's own precon.
 */

const buildScenario = (players: Parameters<typeof wave5Scenario>[1]["players"]) =>
  wave5Scenario("rhino", { seed: 11, players });

const game = { deps: WAVE5_DEPS, cards: WAVE5_CARDS, buildScenario };

/** `../../testing/harness.js`'s own `toHero`, run immediately and settled — every "Hero Action"/"Hero Response" card
 * here needs hero form, which a fresh game does not start in (RRG 1.8 default opening form is alter-ego). She-Hulk's
 * own "Do You Even Lift?" ("Response: After you change to this form, deal 2 damage to an enemy", `01019a`) leaves a
 * target choice pending after the form change, so this settles it (`firstLegal`, the villain) rather than leaving
 * `state.pendingChoice` unresolved for the next command. */
const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(WAVE5_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);

const WAVE5_CARDS_BY_ID = new Map(WAVE5_CARDS.map((card) => [card.id as string, card]));

/** A fresh opening state for `cardCode` seated in `coreHeroId`'s own deck, with `cardCode` already in hand — the
 * same setup `playFromAnotherHerosDeck` does, minus its own final `playCard` step, for the handful of cards below
 * that need to inspect a rejection themselves rather than let the helper throw. */
function openHandFor(
  cardCode: string,
  coreHeroId: string,
  seed = 11,
): { readonly state: GameState; readonly id: string } {
  const setup = buildCrossHeroDeck(WAVE5_CARDS, coreHeroId, cardCode);
  const created = createGame(wave5Scenario("rhino", { seed, players: [setup] }), WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
  const { state, ids } = moveToHand(toHeroFirst(opening), P1, cardCode);
  return { state, id: ids[0]! };
}

/** Hand instance ids covering a Requirement card's own printed icons plus enough other cards to reach `cost`
 * total — `playFromHand`'s own generic `payWith` doesn't check icon type, so a Requirement card needs this instead.
 * `sm/cross-hero.test.ts`'s own `paymentWithIcons` precedent. */
function paymentWithIcons(
  state: GameState,
  hand: readonly string[],
  icons: readonly ("physical" | "mental" | "energy")[],
  cost: number,
): string[] {
  const used = new Set<string>();
  const payment: string[] = [];
  for (const icon of icons) {
    const found = hand.find((id) => {
      if (used.has(id)) return false;
      const card = WAVE5_CARDS_BY_ID.get(state.instances[id]?.cardId ?? "");
      return card && "resourceIcons" in card && (card.resourceIcons[icon] ?? 0) > 0;
    });
    if (!found) throw new Error(`no hand card with a [${icon}] icon`);
    used.add(found);
    payment.push(found);
  }
  for (const id of hand) {
    if (payment.length >= cost) break;
    if (!used.has(id)) {
      used.add(id);
      payment.push(id);
    }
  }
  return payment;
}

/** Whether `playCard`/`useAbility` for `id` is refused outright — both by direct attempt and by `legalActions`
 * never offering it — the `sm/cross-hero.test.ts`/`ghost-spider/support-upgrades-allies.test.ts` `refusedToPlay`
 * precedent, generalized to also cover a support's own ability use. */
function refusedToPlay(state: GameState, id: string): boolean {
  const played = applyCommand(
    state,
    { type: "playCard", playerId: P1, cardInstanceId: id as never, payment: [], attachToInstanceId: null },
    WAVE5_DEPS,
  );
  const actions = legalActions(state, P1, WAVE5_DEPS);
  const offered =
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
  return !played.ok && !offered;
}

function refusedToUse(state: GameState, id: string, abilityId: string): boolean {
  const result = applyCommand(state, use(P1, id as never, abilityId), WAVE5_DEPS);
  return !result.ok;
}

/** Accepts the named optional response/interrupt/trigger (by ability id); declines everything else, and pays a
 * `payForCard` step with its own first N hand cards — the shared `accepting()` shape `sm/cross-hero.test.ts` and
 * `nova/events.test.ts` both already use. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Nova's aggression cards, from She-Hulk (Aggression)'s own deck", () => {
  it("28010.the-locust-response: refused outright — She-Hulk's identity has no champion trait", () => {
    const { state, id } = openHandFor("28010", "core-she-hulk-aggression");
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("28011.chase-them-down-response: removes 2 threat from a scheme after your hero attacks and defeats an enemy", () => {
    const { state } = openHandFor("28011", "core-she-hulk-aggression");
    const heroIdentity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    const scheme = state.mainScheme.instanceId;
    const withThreat = patchInstance(state, scheme, { threat: 8 });
    const max = maxHitPoints(withThreat, villain, WAVE5_DEPS) ?? 1;
    // She-Hulk's own basic ATK is 3 (`01019a`).
    const primed = patchInstance(withThreat, villain, { damage: Math.max(0, max - 3) });
    // `buildCrossHeroDeck` seats both legal copies of Chase Them Down (`deckLimit: 3`, only 2 printed) in She-Hulk's
    // 40-card deck, and the opening draw can land a second, untracked copy alongside the one `moveToHand` finds —
    // both are then offered as the same chooseTriggers option (`sm/cross-hero.test.ts`'s own Jump Flip precedent),
    // so this picks exactly one rather than `accepting`'s own "every match" default, which would fire it twice.
    // The window stays open after a pick (RRG 1.8 "Response", p. 36), so the second copy is offered again: declined.
    let played = false;
    const oneChaseThemDown: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      const hit = choice.options.find((o) => o.optionId.endsWith(":28011.chase-them-down-response"));
      if (!hit) return firstLegal(s);
      if (played) return [];
      played = true;
      return [hit.optionId];
    };
    const attacked = settle(
      runWith(WAVE5_DEPS, primed, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: heroIdentity,
        targetInstanceId: villain,
      }),
      oneChaseThemDown,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(0); // defeated; the stage's own dial resets.
    expect(mainThreat(attacked)).toBe(8 - 2);
  });

  it("28012.pitchback-response: never offered — She-Hulk's identity has no Aerial trait", () => {
    const { state } = openHandFor("28012", "core-she-hulk-aggression");
    const heroIdentity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    const before = inst(state, villain).damage;
    const attacked = settle(
      runWith(WAVE5_DEPS, state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: heroIdentity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(before + 3); // only She-Hulk's own basic ATK; Pitchback was never playable.
  });

  it("28013.no-quarter-action: (Requirement [physical]) deals 4 damage; excess damage mills Aggression cards to hand", () => {
    const { state: opened, id: noQuarter } = openHandFor("28013", "core-she-hulk-aggression");
    const villain = opened.villains[0]!.instanceId;
    const max = maxHitPoints(opened, villain, WAVE5_DEPS) ?? 4;
    const primed = patchInstance(opened, villain, { damage: Math.max(0, max - 2) }); // 2 remaining hit points: 4 damage is 2 excess.
    // Uppercut (01054, aggression) on top, then Nick Fury (01084, basic, not aggression).
    const stacked = putOnTopOfDeck(primed, P1, "01054", "01084");
    const given = moveToHand(stacked.state, P1, "01023", "01024"); // [physical] icon cards, She-Hulk's own deck.
    const hand = given.state.players[0]!.hand.filter((id) => id !== noQuarter);
    const payment = paymentWithIcons(given.state, hand, ["physical"], 2);
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, noQuarter as never, payment as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(0); // defeated; the stage's own dial resets.
    const [uppercut, nickFury] = stacked.ids as readonly [InstanceId, InstanceId];
    expect(playerOf(after, P1).hand).toContain(uppercut); // the Aggression card, added to hand.
    expect(playerOf(after, P1).discard).toContain(nickFury); // the non-Aggression card, left discarded.
    expect(playerOf(after, P1).discard).not.toContain(uppercut);
  });

  it("28014.one-by-one-action: deals 2 damage to an enemy, then 2 more to an enemy if that attack defeats it", () => {
    const { state: opened, id: oneByOne } = openHandFor("28014", "core-she-hulk-aggression");
    const villain = opened.villains[0]!.instanceId;
    const undamaged = patchInstance(opened, villain, { damage: 0 }); // Rhino's own hit points are well above 2.
    const given = moveToHand(undamaged, P1, "01023"); // 1 other hand card to cover the printed cost of 1.
    const [payment] = given.ids as readonly [InstanceId];
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, oneByOne as never, [payment] as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(before + 2); // no defeat: only the first "deal 2 damage".
  });

  it("28015.the-power-of-aggression-constant: doubles the [wild] it generates while paying for an Aggression card", () => {
    const { state } = openHandFor("28015", "core-she-hulk-aggression"); // Power of Aggression, in hand.
    const given = moveToHand(state, P1, "28015", "01054"); // a second copy + Uppercut (aggression, cost 3).
    const [power, uppercut] = given.ids as readonly [InstanceId, InstanceId];
    // 1 Power of Aggression (doubled: 2 [wild]) + 1 other card = 3, paying Uppercut's printed cost of 3 exactly.
    const other = given.state.players[0]!.hand.find((id) => id !== power && id !== uppercut)!;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, uppercut as never, [power, other] as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // If Power of Aggression's own [wild] were not doubled, this payment (1 wild + 1 other = 2) would fall short of
    // Uppercut's printed cost of 3, and `runWith` (which throws on an illegal command) would have thrown already —
    // so reaching this line at all is the doubling's own proof; the two cards actually spent confirm what paid it.
    expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([power, other]));
    // Uppercut itself resolves (an event, discarded after use) — it was legally played, at exactly this payment.
    expect(playerOf(after, P1).discard).toContain(uppercut);
  });

  it("28016.fluid-motion-response: your hero gets +1 ATK until the end of the phase after you play an Attack event", () => {
    const { state, cardInstanceId: fluidMotion } = playFromAnotherHerosDeck("28016", game, {
      coreHero: "core-she-hulk-aggression",
      setup: toHeroFirst,
    });
    const heroIdentity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    const given = moveToHand(state, P1, "01054", "01023", "01024", "01026"); // Uppercut (aggression Attack event, cost 3).
    const [uppercut, ...payment] = given.ids as readonly [InstanceId, ...InstanceId[]];
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, uppercut as never, payment.slice(0, 3) as never)),
      accepting("28016.fluid-motion-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(before + 5); // Uppercut's own printed "deal 5 damage".
    expect(inst(after, fluidMotion).exhausted).toBe(true); // the exhaust cost was paid.
    // She-Hulk's own basic ATK (3) + Fluid Motion's own +1, until the end of the phase.
    const attacked = settle(
      runWith(WAVE5_DEPS, after, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: heroIdentity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(before + 5 + 4);
  });

  it("28017.honed-technique-interrupt: increases an Aggression Attack event's damage by its printed cost, when paid with [mental]", () => {
    const { state: opened, id: honedTechnique } = openHandFor("28017", "core-she-hulk-aggression");
    const givenPayment = moveToHand(opened, P1, "01021", "01022", "01023"); // Requirement [mental][mental]: cost 3.
    const handForHoned = givenPayment.state.players[0]!.hand.filter((id) => id !== honedTechnique);
    const honedPayment = paymentWithIcons(givenPayment.state, handForHoned, ["mental", "mental"], 3);
    const withHoned = settle(
      runWith(WAVE5_DEPS, givenPayment.state, play(P1, honedTechnique as never, honedPayment as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(withHoned, P1).playArea.concat(inst(withHoned, identityOf(withHoned)).attachments ?? [])).toContain(
      honedTechnique,
    );
    const villain = withHoned.villains[0]!.instanceId;
    const given = moveToHand(withHoned, P1, "01054", "01021", "01023", "01024"); // Uppercut, plus a [mental] resource.
    const [uppercut, mentalCard, ...rest] = given.ids as readonly [InstanceId, InstanceId, ...InstanceId[]];
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, uppercut as never, [mentalCard, ...rest.slice(0, 2)] as never)),
      accepting("28017.honed-technique-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    // Uppercut's own printed 5, plus Honed Technique's own bonus (its own printed cost, 3): 5 + 3 = 8.
    expect(inst(after, villain).damage).toBe(before + 8);
  });
});

describe("Nova's basic cards, from Spider-Man (Justice)'s own deck", () => {
  it("28018.moon-girl-constant + -response: enters play as Peter Parker (Genius trait, alter-ego); draws 1 per [mental] paid", () => {
    const setup = buildCrossHeroDeck(WAVE5_CARDS, "core-spider-man-justice", "28018");
    const created = createGame(wave5Scenario("rhino", { seed: 11, players: [setup] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    // Deliberately stays in alter-ego (Peter Parker, GENIUS trait, `01001a`) — Spider-Man's own hero face carries
    // only AVENGER, so Moon Girl's own "champion or genius" play restriction depends on staying in alter-ego here.
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const given = moveToHand(opening, P1, "28018", "01061", "01064", "01084"); // Moon Girl (cost 3) + 3 [mental] cards.
    const [moonGirl, ...mentalCards] = given.ids as readonly [InstanceId, ...InstanceId[]];
    const beforeHand = playerOf(given.state, P1).hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, moonGirl as never, mentalCards.slice(0, 3) as never)),
      accepting("28018.moon-girl-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(after)).toContain(moonGirl);
    // 4 cards left hand to pay her cost of 3; her Response draws back exactly 3 (1 per [mental] resource paid).
    expect(playerOf(after, P1).hand.length).toBe(beforeHand - 4 + 3);
  });

  it("28019.everyday-hero: a resource card, discarded to generate 1 [wild] resource paying for another card", () => {
    // Resource-type cards are discarded to pay a cost, never `playCard`ed (`card_type_not_playable`) — `openHandFor`
    // plus a direct payment, not `playFromAnotherHerosDeck`'s own `playFromHand` step.
    const { state: opened, id: everydayHero } = openHandFor("28019", "core-spider-man-justice");
    const given = moveToHand(opened, P1, "01008"); // Web-Shooter (`01001a`'s own signature upgrade, cost 1).
    const [webShooter] = given.ids as readonly [InstanceId];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, webShooter as never, [everydayHero] as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(everydayHero); // spent, generating its own printed [wild].
    expect(cardsInPlay(after)).toContain(webShooter); // its own [wild] paid Web-Shooter's cost of 1.
  });

  it("28020.champions-mobile-bunker-action: enters play; its own Hero Action has no legal target — no Core hero has the champion trait", () => {
    const { state, cardInstanceId: bunker } = playFromAnotherHerosDeck("28020", game, {
      coreHero: "core-spider-man-justice",
      setup: toHeroFirst,
    });
    expect(cardsInPlay(state)).toContain(bunker);
    expect(refusedToUse(state, bunker, "28020.champions-mobile-bunker-action")).toBe(true);
  });
});

describe("Yaw and Roll (28026), from Spider-Man (Justice)'s own deck", () => {
  it("28026.yaw-and-roll-response: never offered — Spider-Man's identity has no Aerial trait", () => {
    const { state } = openHandFor("28026", "core-spider-man-justice");
    const heroIdentity = identityOf(state);
    const scheme = state.mainScheme.instanceId;
    const withThreat = patchInstance(state, scheme, { threat: 10 });
    const thwarted = settle(
      runWith(WAVE5_DEPS, withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: heroIdentity,
        schemeInstanceId: scheme,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(thwarted)).toBe(10 - 1); // only Spider-Man's own basic THW (1); Yaw and Roll was never playable.
  });
});

describe("Height Advantage (28027), from Black Panther (Protection)'s own deck", () => {
  it("28027.height-advantage-constant + -forced-interrupt: enters play; is discarded at the start of your own next turn", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("28027", game, {
      coreHero: "core-black-panther-protection",
      setup: toHeroFirst,
    });
    // An upgrade with no printed `attachesTo` attaches to the player's own identity by default.
    const identity = identityOf(state);
    expect(inst(state, identity).attachments ?? []).toContain(cardInstanceId);
    // "Forced Interrupt: When your turn begins, discard this card" — ending this turn and starting the next fires it.
    const afterTurn = settle(
      runWith(WAVE5_DEPS, state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(afterTurn, P1).discard).toContain(cardInstanceId);
  });
});
