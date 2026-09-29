import { describe, expect, it } from "vitest";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  legalActions,
  playCostOf,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  payWith,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { playFromAnotherHerosDeck, buildCrossHeroDeck, type CrossHeroGame } from "../../testing/cross-hero.js";
import { wave5Scenario } from "../setup.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): every
 * non-signature Spider-Ham player card — every `spiderham` card whose own `aspect` is not `hero:30001a` (only a
 * Peter Porker deck could ever legally hold one of those, RRG 1.8 "Identity-Specific Card", p. 23) — played through
 * the engine from a Core hero's own deck instead of Spider-Ham's own precon (`spiderham-justice`, `packages/
 * content/src/data/spiderham/starterDecks.ts`). That is 30012-30023 (`justice`: 30012-30019; `basic`: 30020-30023,
 * `packages/content/src/data/spiderham/cards.ts`'s own `aspect` field per card) plus 30029 (Warrior of the Great
 * Web, `basic`, printed in this pack but not part of his own starter decklist). `../ironheart/cross-hero.test.ts`'s
 * own module docblock is the precedent for why: proof no script here quietly reads "you"/"your identity"/"your
 * hero"/"Spider-Ham" as Peter Porker specifically rather than the actual resolving player/controller.
 *
 * Every one of these cards' own aspect (`justice`/`basic`) matches Core Spider-Man (Justice)'s own precon, so
 * `CORE_HERO_FOR_ASPECT`'s default seats every card here at the same Core hero — no Web-Warrior trait exists
 * anywhere in the Core pool (`grep trait("WEB-WARRIOR") packages/content/src/data/core/cards.ts` finds none;
 * `identity.ts`'s own module docblock notes his own hero face 30001a *does* carry it), which is exactly the fact
 * Lady Spider (30012)/Scarlet Spider (30020)/SP//dr (30021)/Web of Life and Destiny (30023)/Warrior of the Great
 * Web (30029) each need proven: their own "you control a Web-Warrior card"/"your identity has the Web-Warrior
 * trait" clauses read the actual seated player's own board and identity, not "Spider-Ham always qualifies".
 */

const buildScenario = (players: Parameters<typeof wave5Scenario>[1]["players"]) =>
  wave5Scenario("rhino", { seed: 21, players });

const game: CrossHeroGame = { deps: WAVE5_DEPS, cards: WAVE5_CARDS, buildScenario };

const CORE_SPIDER_MAN = "core-spider-man-justice";

/** `../../testing/harness.js`'s own `toHero`, run immediately and settled — every "Hero Action"/"Hero Interrupt"
 * card here needs hero form, which a fresh game does not start in (RRG 1.8 default opening form is alter-ego).
 * `../ironheart/cross-hero.test.ts`'s own `toHeroFirst` precedent. */
const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(WAVE5_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);

/** A fresh opening state for `cardCode` seated in `coreHeroId`'s own deck, with `cardCode` already in hand — the
 * same setup `playFromAnotherHerosDeck` does, minus its own final `playCard` step, for cards that need to inspect a
 * rejection themselves rather than let the helper throw. `../ironheart/cross-hero.test.ts`'s own `openHandFor`. */
function openHandFor(
  cardCode: string,
  coreHeroId: string,
  seed = 21,
): { readonly state: GameState; readonly id: string } {
  const setup = buildCrossHeroDeck(WAVE5_CARDS, coreHeroId, cardCode);
  const created = createGame(wave5Scenario("rhino", { seed, players: [setup] }), WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
  const { state, ids } = moveToHand(toHeroFirst(opening), P1, cardCode);
  return { state, id: ids[0]! };
}

/** Whether `playCard` for `id` is refused outright — both by direct attempt and by `legalActions` never offering
 * it. `../ironheart/cross-hero.test.ts`'s own `refusedToPlay` precedent. */
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

/** Accepts the named optional response/interrupt (by ability id or target instance id); declines a
 * `declareDefender` prompt outright; pays a `payForCard` step with its own first N hand cards; declines everything
 * else. `../ironheart/cross-hero.test.ts`'s own `accepting()` precedent, extended with the `declareDefender`
 * handling `../spiderham/e2e.test.ts` also needs. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** A basic thwart from the identity against `target`, readying it (and flipping to hero form if not already there)
 * first — `obligation-nemesis.test.ts`'s own `thwart` precedent, reused here for a real engine-driven thwart. */
function thwart(state: GameState, target: InstanceId, pick: Picker = firstLegal) {
  const identity = identityOf(state, P1);
  const readied = patchInstance(state, identity, { exhausted: false });
  const commands = readied.players[0]!.identity.form === "hero" ? [] : [toHero(P1)];
  return driveEventsPicking(WAVE5_DEPS, readied, pick, ...commands, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identity,
    schemeInstanceId: target,
  });
}

describe("Spider-Ham's justice cards (30012-30019), from Spider-Man (Justice)'s own deck", () => {
  it("30012.lady-spider-response: with no other Web-Warrior card controlled, only her own printed removal happens — no second scheme's threat moves", () => {
    const { state, cardInstanceId: ladySpider } = playFromAnotherHerosDeck("30012", game, {
      coreHero: CORE_SPIDER_MAN,
      setup: toHeroFirst,
    });
    const { state: withThreatened, id: thwarted } = encounterCardInVillainArea(state, "01107", 4);
    const { state: withBoth, id: other } = encounterCardInVillainArea(withThreatened, "01109", 3);
    const otherBefore = inst(withBoth, other).threat;
    const { state: after, events } = thwart(withBoth, thwarted);
    expect(events.some((e) => e.type === "threatRemoved")).toBe(true);
    // No `A_WEB_WARRIOR_CARD` besides Lady Spider herself on a bare Spider-Man table (module docblock: Core carries
    // no Web-Warrior card at all), so the Response's own conditional second removal never opens — the "different
    // scheme" (01109) never loses any threat, unlike Overwatch's own precedent below (30019) which *does* remove
    // threat from it.
    expect(inst(after, other).threat).toBe(otherBefore);
    expect(inst(after, ladySpider)).toBeDefined();
  });

  it("30013.spider-man-response: removes 1 threat from a scheme for each Web-Warrior card controlled (herself included) — exactly 1 on a bare table", () => {
    const { state: rawOpened, id: pavitr } = openHandFor("30013", CORE_SPIDER_MAN);
    // Rhino's own main scheme starts at 0 threat (`packages/content/src/data/core/cards.ts`), so a genuine target
    // to remove threat from needs staging first — the same threat-staging `events.test.ts`'s own Ham It Up test
    // uses for the same reason.
    const opened = patchInstance(rawOpened, rawOpened.mainScheme.instanceId, { threat: 5 });
    const before = inst(opened, opened.mainScheme.instanceId).threat;
    const after = settle(
      runWith(WAVE5_DEPS, opened, play(P1, pavitr as never, payWith(opened, P1, 3, [pavitr as never]))),
      accepting("30013.spider-man-response"),
      undefined,
      WAVE5_DEPS,
    );
    // Only Pavitr Prabhakar himself carries the Web-Warrior trait in a bare Spider-Man table, so the Response's own
    // count is exactly 1 (not, say, counting Core Spider-Man's own identity, which carries no such trait).
    expect(cardsInPlay(after)).toContain(pavitr);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(before - 1);
  });

  it("30014.even-the-odds-action: (Requirement [energy]) removes 1 threat from each side scheme, dealing 1 damage to the villain per side scheme defeated this way", () => {
    const { state: opened, id: evenTheOdds } = openHandFor("30014", CORE_SPIDER_MAN);
    const villain = opened.villains[0]!.instanceId;
    const { state: withFirst, id: defeated } = encounterCardInVillainArea(opened, "01107", 1); // 1 threat: defeated.
    const { state: withBoth, id: surviving } = encounterCardInVillainArea(withFirst, "01109", 3); // 3 threat: survives at 2.
    const before = inst(withBoth, villain).damage;
    const hand = withBoth.players[0]!.hand.filter((id) => id !== evenTheOdds);
    const after = settle(
      runWith(WAVE5_DEPS, withBoth, play(P1, evenTheOdds as never, hand.slice(0, 2) as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(after)).not.toContain(defeated);
    expect(inst(after, surviving).threat).toBe(2);
    expect(inst(after, villain).damage).toBe(before + 1); // exactly 1 side scheme defeated this way.
  });

  it("30015.great-responsibility-interrupt: aliased to Core's own `01061` — you take threat that would be placed on a scheme as damage instead", () => {
    const { state: opened, id: greatResponsibility } = openHandFor("30015", CORE_SPIDER_MAN);
    const identity = identityOf(opened, P1);
    const before = inst(opened, identity).damage;
    const declined = settle(
      runWith(WAVE5_DEPS, opened, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const threatAfterDeclining = inst(declined, declined.mainScheme.instanceId).threat;
    const accepted = settle(
      runWith(WAVE5_DEPS, opened, { type: "endTurn", playerId: P1 }),
      accepting("30015.great-responsibility-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(accepted, accepted.mainScheme.instanceId).threat).toBeLessThan(threatAfterDeclining);
    expect(inst(accepted, identity).damage).toBeGreaterThan(before);
    expect(cardsInPlay(accepted)).not.toContain(greatResponsibility); // an event: resolved and discarded.
  });

  it("30016.making-an-entrance-interrupt: aliased to Venom's own `20013` — a basic thwart gets +2 THW; fully clearing the scheme heals 2", () => {
    const { state: opened, id: makingAnEntrance } = openHandFor("30016", CORE_SPIDER_MAN);
    const identity = identityOf(opened, P1);
    const profile = characterProfile(opened, identity, WAVE5_DEPS)!;
    // Exactly her base THW + 2: clearable only with the interrupt's own +2 bonus applied, not by her base THW alone
    // — proof the bonus is real, not just "the thwart happened to clear it anyway".
    const { state: withThreat, id: scheme } = encounterCardInVillainArea(opened, "01107", profile.thw + 2);
    const hurt = patchInstance(withThreat, identity, { damage: 2 });
    const readied = patchInstance(hurt, identity, { exhausted: false });
    const { events, state: after } = driveEventsPicking(
      WAVE5_DEPS,
      readied,
      accepting("30016.making-an-entrance-interrupt"),
      { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: scheme },
    );
    expect(
      events.some(
        (e) =>
          e.type === "windowOpened" &&
          e.candidates.some((c) => `${c.abilityId}` === "30016.making-an-entrance-interrupt"),
      ),
    ).toBe(true);
    expect(after.villainArea).not.toContain(scheme); // fully thwarted -> defeated, out of play.
    expect(inst(after, identity).damage).toBe(0); // fully removed threat -> healed 2 (from 2 down to 0).
    expect(cardsInPlay(after)).not.toContain(makingAnEntrance);
  });

  it("30017.one-way-or-another-action: aliased to Nebula's own `22015` — searches the encounter deck for a side scheme, reveals it, and draws 3", () => {
    const hero = openHandFor("30017", CORE_SPIDER_MAN, 16).state;
    const oneWayOrAnother = hero.players[0]!.hand.find((id) => hero.instances[id]?.cardId === ("30017" as never))!;
    const before = playerOf(hero, P1).hand.length;
    const after = settle(runWith(WAVE5_DEPS, hero, play(P1, oneWayOrAnother, [])), firstLegal, undefined, WAVE5_DEPS);
    // -1 played (0-cost, no payment), +3 drawn = net +2.
    expect(playerOf(after, P1).hand.length).toBe(before - 1 + 3);
  });

  it("30018.followed-interrupt: aliased to Captain America's own `03032` — attached to a side scheme, deals 4 damage to an enemy when that scheme is defeated", () => {
    const { state: opened, id: followed } = openHandFor("30018", CORE_SPIDER_MAN);
    const { state: withThreat, id: scheme } = encounterCardInVillainArea(opened, "01107", 1);
    const attached = settle(
      runWith(
        WAVE5_DEPS,
        withThreat,
        play(P1, followed as never, payWith(withThreat, P1, 1, [followed as never]), { attachToInstanceId: scheme }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const villain = attached.villains[0]!.instanceId;
    const before = inst(attached, villain).damage;
    const { events, state: after } = thwart(attached, scheme, accepting("30018.followed-interrupt"));
    expect(events.some((e) => e.type === "schemeDefeated" && e.instanceId === scheme)).toBe(true);
    expect(inst(after, villain).damage).toBe(before + 4);
  });

  it("30019.overwatch-interrupt: attached to a scheme, discards itself to remove an equal amount of threat from a different scheme", () => {
    const { state: opened, id: overwatch } = openHandFor("30019", CORE_SPIDER_MAN);
    const mainScheme = opened.mainScheme.instanceId;
    // Rhino's own main scheme starts at 0 threat (module docblock precedent, 30013 above) — staged here so the
    // thwart below has a genuine target.
    const withMainThreat = patchInstance(opened, mainScheme, { threat: 4 });
    const attached = settle(
      runWith(WAVE5_DEPS, withMainThreat, play(P1, overwatch as never, [], { attachToInstanceId: mainScheme })),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const { state: withOther, id: otherScheme } = encounterCardInVillainArea(attached, "01109", 3);
    const threatBefore = inst(withOther, mainScheme).threat;
    const otherBefore = inst(withOther, otherScheme).threat;
    const { state: after } = thwart(withOther, mainScheme, accepting("30019.overwatch-interrupt"));
    // The printed effect *removes* an equal amount from "a different scheme" too — both schemes lose threat, not
    // "move" it from one to the other (this docblock's own initial misreading, caught by this very test: the
    // engine's own `threatRemoved` events on the interrupt's own scheme, not a threat *gain*).
    const removedFromHost = threatBefore - inst(after, mainScheme).threat;
    expect(inst(after, otherScheme).threat).toBe(otherBefore - Math.min(removedFromHost, threatBefore));
    expect(cardsInPlay(after)).not.toContain(overwatch); // discarded, its own printed cost.
  });
});

describe("Scarlet Spider (30020) and SP//dr (30021): both refused outright — Core Spider-Man controls no Web-Warrior card", () => {
  it("30020.scarlet-spider-constant: refused outright from Spider-Man's own deck", () => {
    const { state, id } = openHandFor("30020", CORE_SPIDER_MAN);
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("30021.sp-dr-constant: refused outright from Spider-Man's own deck", () => {
    const { state, id } = openHandFor("30021", CORE_SPIDER_MAN);
    expect(refusedToPlay(state, id)).toBe(true);
  });
});

describe("Team-Building Exercise (30022) and Web of Life and Destiny (30023), from Spider-Man's own deck", () => {
  it("30022.team-building-exercise-action: aliased to Ant-Man's own `12024` — exhausts to play a card sharing a trait with your hero (Avenger), reducing its cost by 1", () => {
    // Core Spider-Man's own hero face prints the Avenger trait (`packages/content/src/data/core/cards.ts` 01001a);
    // Avengers Mansion (01091, `basic`, deckLimit 3) is the one Avenger-trait card legal in any deck, so it is the
    // shared-trait target here rather than a card foreign to a bare Spider-Man/basic-aspect deck.
    const base = buildCrossHeroDeck(WAVE5_CARDS, CORE_SPIDER_MAN, "30022");
    const withExtra = { ...base, deck: [...base.deck, "01091" as never] };
    const created = createGame(wave5Scenario("rhino", { seed: 21, players: [withExtra] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const { state: given, ids } = moveToHand(toHeroFirst(opening), P1, "30022", "01091");
    const [exercise, avengersMansion] = ids;
    const played = settle(
      runWith(WAVE5_DEPS, given, play(P1, exercise!, payWith(given, P1, 2, [exercise!, avengersMansion!]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(played)).toContain(exercise);
    const handBefore = playerOf(played, P1).hand.length;
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseCards") {
        const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === avengersMansion);
        if (option) return [option.optionId];
      }
      if (choice.prompt.kind === "spendResources") {
        const req = choice.prompt.requirement;
        const needed =
          (req.generic ?? 0) + (req.physical ?? 0) + (req.mental ?? 0) + (req.energy ?? 0) + (req.wild ?? 0);
        return playerOf(state, P1)
          .hand.filter((id) => id !== avengersMansion)
          .slice(0, needed)
          .map((id) => `hand:${id}`);
      }
      return firstLegal(state);
    };
    const after = settle(
      runWith(WAVE5_DEPS, played, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: exercise!,
        abilityId: "30022.team-building-exercise-action" as never,
        payment: [],
      }),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(after)).toContain(avengersMansion);
    // Avengers Mansion (cost 4) leaves hand (-1); its own reduced cost (4 - 1 = 3) is paid from 3 more hand cards
    // (-3). Net -4.
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 4);
  });

  it("30023.web-of-life-and-destiny-constant: aliased to Ghost-Spider's own `27023` — full printed cost on Spider-Man, who has no Web-Warrior trait to ignore it for", () => {
    // Built without `openHandFor`'s own automatic hero-form flip (unlike every other test above), since this test's
    // whole point is comparing the *alter-ego* cost against the *hero* cost — `../sm/ghost-spider/support-upgrades-
    // allies.test.ts`'s own `27023.web-of-life-and-destiny-constant` precedent for exactly this shape.
    const setup = buildCrossHeroDeck(WAVE5_CARDS, CORE_SPIDER_MAN, "30023");
    const created = createGame(wave5Scenario("rhino", { seed: 21, players: [setup] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const { state, ids } = moveToHand(opening, P1, "30023");
    const [id] = ids;
    expect(playCostOf(state, P1, id!, WAVE5_DEPS)?.current).toBe(3); // Alter-ego: no discount, matching hero form below.
    const hero = toHeroFirst(state);
    // Core Spider-Man's identity carries no Web-Warrior trait in either form (`identity.ts`'s own module docblock:
    // only Spider-Ham's own 30001a carries it), so hero form grants no discount the way Ghost-Spider's own test
    // proves it does for her — the printed conditional reads the actual controller's identity, not Spider-Ham's.
    expect(playCostOf(hero, P1, id!, WAVE5_DEPS)?.current).toBe(3);
  });
});

describe("Warrior of the Great Web (30029, basic — printed in this pack, not part of Spider-Ham's own starter deck)", () => {
  it("30029.warrior-of-the-great-web-constant: attaches to any character with 'Spider' in its title (Core Spider-Man's own identity) and grants the Web-Warrior trait", () => {
    const { state, id } = openHandFor("30029", CORE_SPIDER_MAN);
    const identity = identityOf(state, P1);
    expect(traitsOf(state, identity, WAVE5_DEPS).map(String)).not.toContain("WEB-WARRIOR");
    const attached = settle(
      runWith(
        WAVE5_DEPS,
        state,
        play(P1, id as never, payWith(state, P1, 1, [id as never]), { attachToInstanceId: identity }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attached, identity).attachments).toContain(id);
    expect(traitsOf(attached, identity, WAVE5_DEPS).map(String)).toContain("WEB-WARRIOR");
  });
});
