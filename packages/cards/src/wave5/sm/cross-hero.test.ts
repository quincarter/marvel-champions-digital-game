import { cardId } from "@mc/content";
import { applyCommand, cardsInPlay, characterProfile, createGame, legalActions, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  runWith,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playFromAnotherHerosDeck, buildCrossHeroDeck } from "../../testing/cross-hero.js";
import { wave5Scenario } from "../setup.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): every
 * Ghost-Spider and Spider-Man (Miles Morales) card whose own aspect is Protection/Justice/basic — never the
 * hero-specific `hero:27001a`/`hero:27030a` aspect a Core hero could never legally hold anyway (RRG 1.8 "Identity-
 * Specific Card", p. 23) — played through the engine from a Core hero's own deck instead of its own precon.
 *
 * `27020`–`27022` and `27051`–`27053` are the two boxes' own basic resource cards (`aspect: "basic"`, `abilities:
 * []`): no ability script exists for them (the engine's own generic resource-card handling covers them already),
 * so they're out of scope here the same way `docs/custom-deck-testing.md`'s own "Cards in another hero's deck" row
 * only asks for scripted cards. `27045` (Surveillance Team) is Core's own `01064` verbatim (`precon-player-
 * cards.ts`'s own docblock) — included anyway, since it's still a real card id in this box's own deck.
 *
 * Each test seats the target card in a Core hero's own real precon (`playFromAnotherHerosDeck`'s own matching-
 * aspect default — Spider-Man/Justice for Protection cards would be wrong, so Protection cards seat in Black
 * Panther/Protection, Justice cards in Spider-Man/Justice, basic cards in Spider-Man/Justice), plays it, and checks
 * its printed effect fires (or, for the few gated on a named trait/identity the Core hero doesn't have, that it's
 * refused) exactly as it would from its own precon — proof no script here quietly reads "you" as "the box's own
 * hero" rather than the actual resolving player.
 */

const buildScenario = (players: Parameters<typeof wave5Scenario>[1]["players"]) =>
  wave5Scenario("rhino", { seed: 7, players });

const game = { deps: WAVE5_DEPS, cards: WAVE5_CARDS, buildScenario };

/** `../../testing/harness.js`'s own `toHero`, run immediately — every "Hero Action"/"Hero Interrupt" card here
 * needs hero form, which a fresh game does not start in (RRG 1.8 default opening form is alter-ego). */
const toHeroFirst = (state: GameState): GameState => runWith(WAVE5_DEPS, state, toHero(P1));

/**
 * A fresh opening state for `cardCode` seated in `coreHeroId`'s own deck, with `cardCode` already in hand — the
 * same setup `playFromAnotherHerosDeck` does, minus its own final `playCard` step. For the handful of cards below
 * that either can't be played through a plain `playCard` command at all (Jump Flip, a reactive Hero Interrupt
 * event) or are expected to be refused (Across the Spider-Verse, Global Logistics, the Ghost-Spider ally): each
 * needs to inspect or attempt that step itself rather than let the helper's own `playFromHand` throw on rejection.
 */
function openHandFor(
  cardCode: string,
  coreHeroId: string,
  seed = 7,
): { readonly state: GameState; readonly id: string } {
  const setup = buildCrossHeroDeck(WAVE5_CARDS, coreHeroId, cardCode);
  const created = createGame(wave5Scenario("rhino", { seed, players: [setup] }), WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
  const { state, ids } = moveToHand(opening, P1, cardCode);
  return { state, id: ids[0]! };
}

const WAVE5_CARDS_BY_ID = new Map(WAVE5_CARDS.map((card) => [card.id as string, card]));

/** Hand instance ids covering a Requirement card's own printed icons (`27016.what-doesnt-kill-me-action`'s own
 * `[physical]`, RRG 1.8 "Requirement (Resources)", p. 37) plus enough other cards to reach `cost` total —
 * `playFromHand`'s own generic `payWith` doesn't check icon type, so a Requirement card needs this instead. */
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

/** Whether `playCard` for `id` is refused outright — both by direct attempt and by `legalActions` never offering
 * it — the `ghost-spider/support-upgrades-allies.test.ts` `27017.spider-man-constant` precedent. */
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

/** Accepts the named optional response/interrupt (by ability id) or a specific target/option id; declines
 * everything else, and pays a `payForCard` step with its own first N hand cards — the shared `accepting()` shape
 * `ghost-spider/events-a.test.ts` and `spider-man-morales/support-upgrades-allies.test.ts` both already use. */
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

describe("Ghost-Spider's aspect/basic cards, from a Core hero's own deck", () => {
  it("27010.silk-response: enters play; with no other Web-Warrior card controlled, its own search never fires", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("27010", game, {
      pick: accepting("27010.silk-response"),
    });
    expect(cardsInPlay(state)).toContain(cardInstanceId);
  });

  it("27011.spider-man-response: enters play; with fewer than 3 Web-Warrior cards controlled, no stun/confuse", () => {
    const { state } = playFromAnotherHerosDeck("27011", game, { pick: accepting("27011.spider-man-response") });
    const villain = state.villains[0]!.instanceId;
    expect(inst(state, villain).statuses.stunned).toBe(0);
    expect(inst(state, villain).statuses.confused).toBe(0);
  });

  it("27012.spider-uk-interrupt: deals damage (equal to Web-Warrior cards controlled) to an enemy it defends against", () => {
    // The villain only *attacks* (rather than schemes) while the player resolving its activation is in hero form
    // (RRG 1.8 "Villain Phase", p. 114: "If the identity of the player resolving the activation is in alter-ego
    // form, the villain initiates a scheme"), so this needs `toHeroFirst` before ending the turn.
    const { state: withSpiderUk, cardInstanceId: spiderUk } = playFromAnotherHerosDeck("27012", game, {
      setup: toHeroFirst,
    });
    const villain = withSpiderUk.villains[0]!.instanceId;
    const before = inst(withSpiderUk, villain).damage;
    const stacked = stackEncounterDeck(withSpiderUk, "01186"); // Advance: filler for Rhino's own boost draw.
    const atDeclare = settleUntil(runWith(WAVE5_DEPS, stacked, endTurn(P1)), "declareDefender", firstLegal, WAVE5_DEPS);
    const defending = answer(atDeclare, [spiderUk], WAVE5_DEPS);
    const after = settle(defending, accepting("27012.spider-uk-interrupt"), undefined, WAVE5_DEPS);
    // Spider-UK himself is the only Web-Warrior card this Core hero controls: 1 damage.
    expect(inst(after, villain).damage).toBe(before + 1);
  });

  it("27013.bait-and-switch-action: the villain attacks you (undeclared defender), then removes 4 threat from the main scheme", () => {
    const { state } = playFromAnotherHerosDeck("27013", game, {
      setup: (s) => patchInstance(toHeroFirst(s), s.mainScheme.instanceId, { threat: 6 }),
    });
    expect(mainThreat(state)).toBe(2); // 6 - 4.
  });

  it("27015.return-the-favor-action: discards from the encounter deck until a treachery, then deals 5 damage to the villain", () => {
    const { state } = playFromAnotherHerosDeck("27015", game, {
      setup: toHeroFirst,
      pick: accepting(),
    });
    const villain = state.villains[0]!.instanceId;
    expect(inst(state, villain).damage).toBeGreaterThanOrEqual(5);
  });

  it("27016.what-doesnt-kill-me-action: heals 2 damage from your hero, then readies it", () => {
    // Requirement ([physical]): needs an explicit icon-matched payment (`paymentWithIcons`), not the generic
    // `playFromAnotherHerosDeck` default (`playFromHand`'s own `payWith` doesn't check icon type).
    const { state: opened, id: whatDoesntKillMe } = openHandFor("27016", "core-black-panther-protection");
    // A [physical] card from the deck into hand to meet the Requirement, rather than relying on the seed's draw.
    const physical = opened.players[0]!.deck.map((id) => opened.instances[id]!.cardId as string).find((cardId) => {
      const card = WAVE5_CARDS_BY_ID.get(cardId);
      return card !== undefined && "resourceIcons" in card && (card.resourceIcons.physical ?? 0) > 0;
    });
    if (!physical) throw new Error("no [physical] card in Black Panther's deck");
    const hero = toHeroFirst(moveToHand(opened, P1, physical).state);
    const identity = identityOf(hero);
    const staged = patchInstance(hero, identity, { damage: 2, exhausted: true });
    const hand = staged.players[0]!.hand.filter((id) => id !== whatDoesntKillMe);
    const payment = paymentWithIcons(staged, hand, ["physical"], 2);
    const after = settle(
      runWith(WAVE5_DEPS, staged, play(P1, whatDoesntKillMe as never, payment as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, identity).exhausted).toBe(false);
    expect(after.players[0]!.discard).toContain(whatDoesntKillMe);
  });

  it("27018.across-the-spider-verse-action: with no Web-Warrior card to exhaust, is refused (the exhaust is a cost)", () => {
    // "Exhaust a Web-Warrior card you control →" comes before the arrow: a cost (RRG 1.8 "Cost", p. 13).
    expect(() =>
      playFromAnotherHerosDeck("27018", game, { coreHero: "core-black-panther-protection", setup: toHeroFirst }),
    ).toThrow(/exhaust/);
  });

  it("27019.young-love-action: a Team-Up card for Gwen Stacy and Miles Morales — refused for any other identity's deck", () => {
    expect(() => playFromAnotherHerosDeck("27019", game, { coreHero: "core-black-panther-protection" })).toThrow(
      /Team-Up/,
    );
  });

  it("27023.web-of-life-and-destiny-response: enters play at full cost (no Web-Warrior trait on this Core hero)", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("27023", game);
    expect(cardsInPlay(state)).toContain(cardInstanceId);
  });

  it("27024.plan-b-action: (upgrade) once in play, its Hero Action deals 2 damage to an enemy", () => {
    const { state: withPlanB, cardInstanceId: planB } = playFromAnotherHerosDeck("27024", game, { setup: toHeroFirst });
    const villain = withPlanB.villains[0]!.instanceId;
    const before = inst(withPlanB, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, withPlanB, use(P1, planB, "27024.plan-b-action" as never)),
      accepting(villain),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(before + 2);
  });
});

describe("Ghost-Spider's Jump Flip (27014): a reactive Hero Interrupt event, not played via `playCard`", () => {
  // Not a scripting bug: `buildCrossHeroDeck` seats all 3 copies of Jump Flip (`deckLimit: 3`, RRG 1.8 Appendix I)
  // in Black Panther's 40-card deck, and with this seed a *second* copy lands in the opening hand alongside the
  // one `moveToHand` finds/tracks. `endTurn`'s own mandatory `discardDownToHandSize` (settled with `firstLegal`,
  // which takes the prompt's own option order) discards exactly the tracked copy before the villain ever attacks,
  // leaving the untracked sibling copy to be the one actually offered — and correctly resolved — as the Hero
  // Interrupt. The original test still keyed its `option`/`payForCard` matching off the now-discarded instance id,
  // so `pick` never recognized the real offer, fell through to `firstLegal`'s decline (`chooseTriggers` allows
  // `minSelections: 0`), and the villain's attack landed unprevented — a false failure in the test's own
  // instance-tracking, not in `ghost-spider/events-b.ts`'s `27014.jump-flip-interrupt` (`preventDamage(2)` +
  // `ifThen(paidWith("energy"), removeThreat(2, theMainScheme))`, unchanged, and already proven correct from
  // Ghost-Spider's own precon in `events-b.test.ts`).
  //
  // Fixed here by matching the trigger option (and the cost prompt) on the printed ability id / card id rather
  // than a single instance id captured before the discard step, so whichever of the 3 copies actually survives to
  // combat is the one this test drives — proof the ability itself reads `you` as the real controller (Black
  // Panther), not "Ghost-Spider", RRG 1.8 "Identity-Specific Card" p. 23 / "Interrupt" p. 39.
  it("prevents 2 damage from the villain's own attack", () => {
    const { state } = openHandFor("27014", "core-black-panther-protection", 1);
    const preAttack = toHeroFirst(state);
    const identity = identityOf(preAttack);
    const villain = preAttack.villains[0]!.instanceId;
    const rawAtk = characterProfile(preAttack, villain, WAVE5_DEPS)?.atk ?? 0;
    expect(rawAtk).toBeGreaterThan(0); // sanity: Rhino really does have a printed ATK to attack with.
    const stacked = stackEncounterDeck(preAttack, "01186"); // Advance: filler for Rhino's own boost draw.
    const damageBefore = inst(stacked, identity).damage;
    const atDeclare = settleUntil(runWith(WAVE5_DEPS, stacked, endTurn(P1)), "declareDefender", firstLegal, WAVE5_DEPS);
    const declined = answer(atDeclare, ["decline"], WAVE5_DEPS);
    const abilitySuffix = ":27014.jump-flip-interrupt";
    let triggered: string | undefined;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      const trigger = choice.options.find((o) => o.optionId.endsWith(abilitySuffix));
      if (trigger) {
        triggered = trigger.optionId.slice(0, -abilitySuffix.length);
        return [trigger.optionId];
      }
      if (choice.prompt.kind === "payForCard" && s.instances[choice.prompt.instanceId]?.cardId === cardId("27014")) {
        return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
      }
      return firstLegal(s);
    };
    const after = settle(declined, pick, undefined, WAVE5_DEPS);
    expect(triggered).toBeDefined(); // sanity: the interrupt really was offered and taken, not silently declined.
    expect(after.players[0]!.discard).toContain(triggered);
    // Rhino's own printed ATK, undefended, minus Jump Flip's own 2 prevented.
    expect(inst(after, identity).damage).toBe(damageBefore + Math.max(0, rawAtk - 2));
  });
});

describe("Spider-Man (Miles Morales)'s aspect/basic cards, from a Core hero's own deck", () => {
  it("27040.monica-chang-response: enters play; with no copy of Surveillance Team anywhere, its search finds nothing", () => {
    const { state } = playFromAnotherHerosDeck("27040", game, { pick: accepting("27040.monica-chang-response") });
    expect(cardsInPlay(state).some((id) => state.instances[id]?.cardId === "27045")).toBe(false);
  });

  it("27041.spider-woman-constant: enters play (no confused enemy to reduce its cost)", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("27041", game);
    expect(cardsInPlay(state)).toContain(cardInstanceId);
  });

  it('27042.homeland-intervention-action: with no S.H.I.E.L.D. card to exhaust, resolves as "exhaust 0" — no threat removed', () => {
    const { state } = playFromAnotherHerosDeck("27042", game, {
      setup: (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 5 }),
      pick: accepting(),
    });
    expect(mainThreat(state)).toBe(5);
  });

  it("27043.global-logistics-action: with no S.H.I.E.L.D. card to exhaust, its own cost cannot be paid — refused", () => {
    const { state, id } = openHandFor("27043", "core-spider-man-justice");
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("27044.field-agent-interrupt: enters play with 3 backup counters (Uses)", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("27044", game);
    expect(inst(state, cardInstanceId).counters.backup).toBe(3);
  });

  it("27045.surveillance-team-action: Core's own 01064 verbatim — enters play with 3 snoop counters, its own action removes 1 threat", () => {
    const { state: withTeam, cardInstanceId: team } = playFromAnotherHerosDeck("27045", game, {
      setup: (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 3 }),
    });
    expect(inst(withTeam, team).counters.snoop).toBe(3);
    const after = settle(
      runWith(WAVE5_DEPS, withTeam, use(P1, team, "27045.surveillance-team-action" as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBe(2);
    expect(inst(after, team).counters.snoop).toBe(2);
  });

  it("27046.agent-13-response: attacks normally (a S.H.I.E.L.D. support ready is offered only when one is controlled)", () => {
    const { state: withAgent, cardInstanceId: agent } = playFromAnotherHerosDeck("27046", game);
    const villain = withAgent.villains[0]!.instanceId;
    const before = inst(withAgent, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, withAgent, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: agent,
        targetInstanceId: villain,
      }),
      accepting("27046.agent-13-response"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBeGreaterThan(before);
  });

  it("27047.dum-dum-dugan-interrupt: a basic power resolves at its printed value (no S.H.I.E.L.D. card to exhaust for the interrupt)", () => {
    const { state: withDugan, cardInstanceId: dugan } = playFromAnotherHerosDeck("27047", game);
    const villain = withDugan.villains[0]!.instanceId;
    const before = inst(withDugan, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, withDugan, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: dugan,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBeGreaterThan(before);
  });

  it("27048.ghost-spider-constant: cannot be played without a Web-Warrior card in play — refused", () => {
    const { state, id } = openHandFor("27048", "core-spider-man-justice");
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("27049.spider-man-response: (Requirement) is playable by a Core hero given an [energy][mental][physical] payment", () => {
    // Not Spider-Man/Justice: his own identity (Peter Parker, `01001a`) matches this ally's own unique title, and
    // RRG 1.8 Appendix I refuses a deck whose unique card matches its own identity — Captain Marvel/Leadership has
    // no such conflict. Not gated on a named identity or trait this Core hero lacks (unlike 27017/27048's own
    // Web-Warrior gate) — Requirement only constrains *how* the cost is paid (RRG 1.8 "Requirement (Resources)",
    // p. 37), so this needs an explicit icon-matched payment, not the generic `playFromAnotherHerosDeck` default.
    const { state: opened, id } = openHandFor("27049", "core-captain-marvel-leadership");
    // Her own deck's own [energy]/[mental]/[physical] cards (01012/01015/01013), guaranteed into hand rather than
    // hoping the opening hand happened to draw one of each.
    const state = moveToHand(opened, P1, "01012", "01015", "01013").state;
    const hand = state.players[0]!.hand.filter((h) => h !== id);
    const payment = paymentWithIcons(state, hand, ["physical", "mental", "energy"], 3);
    const after = settle(
      runWith(WAVE5_DEPS, state, play(P1, id as never, payment as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(after)).toContain(id);
  });

  it("27050.young-love-action: a Team-Up card for Gwen Stacy and Miles Morales — refused for any other identity's deck", () => {
    // Unlike every other card in this file, this is refused at deckbuilding itself (RRG 1.8 "Team-Up"): "only a
    // deck whose identity is one of them may include it" (`validateDeck`'s own message), not merely at play time.
    expect(() => playFromAnotherHerosDeck("27050", game)).toThrow(/Team-Up/);
  });

  it("27054.government-liaison-action: enters play", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("27054", game);
    expect(cardsInPlay(state)).toContain(cardInstanceId);
  });

  it("27055.sky-destroyer-response: enters play; with no S.H.I.E.L.D. card played after it, its own response never fires", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("27055", game);
    expect(cardsInPlay(state)).toContain(cardInstanceId);
    const villain = state.villains[0]!.instanceId;
    expect(inst(state, villain).damage).toBe(0);
  });
});
