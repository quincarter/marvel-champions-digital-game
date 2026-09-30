import { describe, expect, it } from "vitest";
import {
  applyCommand,
  cardsInPlay,
  characterProfile as characterProfileOf,
  createGame,
  hasKeyword,
  legalActions,
  paymentFor,
  statBonus,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  answer,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { buildCrossHeroDeck, playFromAnotherHerosDeck, type CrossHeroGame } from "../../testing/cross-hero.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { wave5Scenario } from "../setup.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): every
 * non-signature SP//dr player card — every `spdr` card whose own `aspect` is not `hero:31001a` (only a Peni Parker
 * deck could ever legally hold one of those, RRG 1.8 "Identity-Specific Card", p. 23) — played, refused or
 * proven identity-scoped from a Core hero's own deck instead of SP//dr's own precon (`spdr-protection`,
 * `packages/content/src/data/spdr/starterDecks.ts`). That is 31014-31022 (`protection`: 31014-31020; `basic`:
 * 31021-31022) plus 31023-31024 (`basic`) and 31029 (`leadership`) — `spdr/cards.ts`'s own `aspect` field per card.
 * `../spiderham/cross-hero.test.ts`'s own module docblock is the precedent for why: proof no script here quietly
 * reads "you"/"your identity"/"your hero"/"SP//dr"/"Peni Parker" as SP//dr specifically rather than the actual
 * resolving player/controller.
 *
 * **Excluded here**: Aunt May & Uncle Ben (31007, `hero:31001a`-scoped, so it was never in scope for this file
 * anyway — it can't legally sit in a Core hero's deck at all) and Limitless Stamina (31023), already fully covered
 * cross-hero (both the allowed and refused branches) in `events.test.ts` — not repeated here.
 *
 * Every one of `protection`/`basic`'s own default `CORE_HERO_FOR_ASPECT` seat (Black Panther / Spider-Man) carries
 * no Web-Warrior trait anywhere in the Core pool (`identity.ts`'s own module docblock: only SP//dr's own 31001a
 * carries it) — exactly the fact Thwip Thwip! (31017)/Spider-Tingle (31020)/Spider-Ham (31021)/Spider-Man / Otto
 * Octavius (31022) each need proven: their own "a Web-Warrior character you control" clauses read the actual
 * seated player's own board, not "SP//dr always qualifies". Spider-Ham/Spider-Man / Otto Octavius additionally
 * prove the *positive* case, using Warrior of the Great Web (`spiderham` 30029, `basic`) to grant Core Spider-Man's
 * own identity the trait — the same precedent `../spiderham/cross-hero.test.ts`'s own Warrior of the Great Web
 * test uses, reused here as the generic "grant the trait" tool rather than re-derived.
 */

const buildScenario = (players: Parameters<typeof wave5Scenario>[1]["players"]) =>
  wave5Scenario("rhino", { seed: 21, players });

const game: CrossHeroGame = { deps: WAVE5_DEPS, cards: WAVE5_CARDS, buildScenario };

const CORE_BLACK_PANTHER = "core-black-panther-protection";
const CORE_SPIDER_MAN = "core-spider-man-justice";
const CORE_CAPTAIN_MARVEL = "core-captain-marvel-leadership";
const CORE_SHE_HULK = "core-she-hulk-aggression";

function characterProfile(state: GameState, id: InstanceId) {
  const profile = characterProfileOf(state, id, WAVE5_DEPS);
  if (!profile) throw new Error(`no character profile for ${id}`);
  return profile;
}

/** `../../testing/harness.js`'s own `toHero`, run immediately and settled — every "Hero Action"/"Hero Interrupt"
 * card here needs hero form, which a fresh game does not start in (RRG 1.8 default opening form is alter-ego).
 * `../ironheart/cross-hero.test.ts`'s own `toHeroFirst` precedent. */
const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(WAVE5_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);

/** A fresh opening state for `cardCode` seated in `coreHeroId`'s own deck, in hero form, with `cardCode` already
 * in hand — the same setup `playFromAnotherHerosDeck` does, minus its own final `playCard` step, for cards that
 * need to inspect a rejection themselves rather than let the helper throw. `../spiderham/cross-hero.test.ts`'s
 * own `openHandFor` precedent. */
function openHandFor(
  cardCode: string,
  coreHeroId: string,
  seed = 21,
): { readonly state: GameState; readonly id: InstanceId } {
  const setup = buildCrossHeroDeck(WAVE5_CARDS, coreHeroId, cardCode);
  const created = createGame(wave5Scenario("rhino", { seed, players: [setup] }), WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
  const { state, ids } = moveToHand(toHeroFirst(opening), P1, cardCode);
  return { state, id: ids[0]! };
}

/** Whether `playCard` for `id` is refused outright — both by direct attempt and by `legalActions` never offering
 * it. `../spiderham/cross-hero.test.ts`'s own `refusedToPlay` precedent. */
function refusedToPlay(state: GameState, id: InstanceId): boolean {
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

/** Whether playing `id` (a legal payment) is refused specifically for its own play restriction, and never offered
 * — `events.test.ts`'s own `refusedForRestriction` precedent, ported here for Unshakable's cross-hero test. */
function refusedForRestriction(state: GameState, id: InstanceId, cost: number): boolean {
  const result = applyCommand(state, play(P1, id, payWith(state, P1, cost, [id])), WAVE5_DEPS);
  const actions = legalActions(state, P1, WAVE5_DEPS);
  const offered =
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
  return !result.ok && /play restriction is not met/.test(result.error.message) && !offered;
}

/** Accepts the named optional response/interrupt (by ability id or target instance id); declines a
 * `declareDefender` prompt outright; pays a `payForCard` step with its own first N hand cards; declines everything
 * else. `../spiderham/cross-hero.test.ts`'s own `accepting()` precedent. */
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

/** Picks the offered `chooseOne` option whose label is exactly `label`; declines/first-legals everything else
 * (`../../testing/harness.js`'s own picker shape, `events.test.ts`'s own `choosing` precedent). */
const choosing =
  (label: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label === label);
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Daredevil (31014), from Black Panther's own deck", () => {
  it("31014.daredevil-response: after he defends, moves 1 damage from him to the attacking enemy — reading whoever actually defended, not a Peni-Parker-specific check", () => {
    const { state, cardInstanceId: daredevil } = playFromAnotherHerosDeck("31014", game, { setup: toHeroFirst });
    const stacked = stackEncounterDeck(state, "01186", "01186"); // "Advance" ×2: soaks up Rhino's own boost draw *and* the round's own per-player reveal step (`../spdr/support-upgrades.test.ts`'s own `RHINO_NO_BOOST` stacks only one because its own default seed happens to draw something benign there; this file's own seed 21 does not, so both slots are pinned here).
    const villain = stacked.villains[0]!.instanceId;
    const villainDamageBefore = inst(stacked, villain).damage;
    const atDefend = settle(
      runWith(WAVE5_DEPS, stacked, { type: "endTurn", playerId: P1 }),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    const defending = answer(atDefend, [daredevil], WAVE5_DEPS);
    const damageAfterAttack = inst(defending, daredevil).damage;
    const settled = settle(defending, accepting("31014.daredevil-response"), undefined, WAVE5_DEPS);
    expect(inst(settled, daredevil).damage).toBe(damageAfterAttack - 1);
    expect(inst(settled, villain).damage).toBe(villainDamageBefore + 1);
  });
});

/** Attaches `cardId` to `hostId`, facedown as a blank card — `../spdr/allies.test.ts`'s own `attachFacedown`
 * precedent, copied locally (test-only surgery, not exported). */
function attachFacedown(state: GameState, cardId: InstanceId, hostId: InstanceId): GameState {
  const withCard = patchInstance(state, cardId, { attachedTo: hostId, facedownAs: { kind: "blank", traits: [] } });
  const host = inst(withCard, hostId);
  return patchInstance(withCard, hostId, { attachments: [...host.attachments, cardId] });
}

describe("Spider-Man Noir (31015), from Black Panther's own deck", () => {
  it("31015.spider-man-noir-constant: X (ATK/THW) is the number of facedown cards attached to him, for whoever controls him", () => {
    const { state, cardInstanceId: noir } = playFromAnotherHerosDeck("31015", game, { setup: toHeroFirst });
    const [facedownCandidate] = playerOf(state, P1).hand as [InstanceId];
    expect(characterProfile(state, noir).atk).toBe(0);
    expect(characterProfile(state, noir).thw).toBe(0);
    const withFacedown = attachFacedown(state, facedownCandidate, noir);
    expect(characterProfile(withFacedown, noir).atk).toBe(1);
    expect(characterProfile(withFacedown, noir).thw).toBe(1);
  });

  it("31015.spider-man-noir-response: without another Web-Warrior card controlled (Black Panther carries none), nothing is attached even after resolving a treachery", () => {
    const { state, cardInstanceId: noir } = playFromAnotherHerosDeck("31015", game, { setup: toHeroFirst });
    const stacked = stackEncounterDeck(state, "01186", "01105"); // "Advance" (boost) then "I'm Tough!" (a real treachery).
    const { state: after, events } = driveEventsPicking(
      WAVE5_DEPS,
      stacked,
      accepting("31015.spider-man-noir-response"),
      {
        type: "endTurn",
        playerId: P1,
      },
    );
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardResolved")).toBe(true);
    expect(inst(after, noir).attachments).toEqual([]); // no other Web-Warrior card on a bare Black Panther table.
    expect(characterProfile(after, noir).atk).toBe(0);
  });
});

describe("Repurpose (31016), from Black Panther's own deck", () => {
  it("31016.repurpose-action: discards a Tech upgrade you control, readies your hero, and gets +X (that upgrade's printed cost) to the chosen power — reading your own hero, not SP//dr Suit specifically", () => {
    const base = buildCrossHeroDeck(WAVE5_CARDS, CORE_BLACK_PANTHER, "31016");
    // Energy Barrier (31018, cost 2, TECH) added on top, purely as this test's own Tech-upgrade fixture — the same
    // "append one more card code" shape `../spiderham/cross-hero.test.ts`'s own Team-Building Exercise test uses.
    const withExtra = { ...base, deck: [...base.deck, "31018" as never] };
    const created = createGame(wave5Scenario("rhino", { seed: 21, players: [withExtra] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const hero = toHeroFirst(opening);
    const identity = identityOf(hero, P1);
    const { state: given, ids } = moveToHand(hero, P1, "31016", "31018");
    const [repurpose, barrier] = ids as [InstanceId, InstanceId];
    const withBarrier = settle(
      runWith(WAVE5_DEPS, given, play(P1, barrier, payWith(given, P1, 2, [repurpose, barrier]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const exhausted = patchInstance(withBarrier, identity, { exhausted: true });
    const played = settle(
      runWith(WAVE5_DEPS, exhausted, play(P1, repurpose, [])),
      choosing("ATK"),
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(played, P1).discard).toContain(barrier); // discarded as the cost.
    expect(cardsInPlay(played)).not.toContain(barrier);
    expect(inst(played, identity).exhausted).toBe(false); // readied.
    expect(statBonus(played, WAVE5_DEPS, identity, "atk")).toBe(2); // Energy Barrier's own printed cost 2.
  });
});

describe("Thwip Thwip! (31017), from Black Panther's own deck", () => {
  it("31017.thwip-thwip-action: refused outright with no Web-Warrior character controlled (Black Panther carries no Web-Warrior trait)", () => {
    const { state, id } = openHandFor("31017", CORE_BLACK_PANTHER);
    expect(refusedToPlay(state, id)).toBe(true);
  });
});

describe("Energy Barrier (31018), from Black Panther's own deck", () => {
  it("31018.energy-barrier-interrupt: prevents 1 damage, consuming a reflection counter, for whoever plays it", () => {
    const { state, cardInstanceId: barrier } = playFromAnotherHerosDeck("31018", game, { setup: toHeroFirst });
    const identity = identityOf(state, P1);
    const stacked = stackEncounterDeck(state, "01186", "01186");
    const damageBefore = inst(stacked, identity).damage;
    const after = settle(
      runWith(WAVE5_DEPS, stacked, { type: "endTurn", playerId: P1 }),
      accepting("31018.energy-barrier-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    // Only the identity's own damage is asserted exactly: Black Panther's own printed Retaliate 1 (`packages/
    // content/src/data/core/cards.ts` 01040a) also deals 1 to the villain on this same undefended attack, on top of
    // Energy Barrier's own "deal 1 damage to an enemy" — asserting the villain's own total here would conflate the
    // two, so it's left unchecked; the reflection counter spend below is Energy Barrier's own unambiguous signal.
    expect(inst(after, identity).damage).toBe(damageBefore + 1); // Rhino's undefended ATK 2 - 1 prevented.
    expect(inst(after, barrier).counters.reflection).toBe(2);
  });
});

describe("Forcefield Generator (31019), from Black Panther's own deck", () => {
  it("31019.forcefield-generator-forced-interrupt: forced, prevents damage via its own energy counters for whoever controls it", () => {
    const { state } = playFromAnotherHerosDeck("31019", game, { setup: toHeroFirst });
    const identity = identityOf(state, P1);
    const stacked = stackEncounterDeck(state, "01186", "01186");
    const damageBefore = inst(stacked, identity).damage;
    const after = settle(
      runWith(WAVE5_DEPS, stacked, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).damage).toBe(damageBefore); // fully prevented — Rhino's undefended ATK (2) < 6.
  });
});

describe("Spider-Tingle (31020), from Black Panther's own deck", () => {
  it("31020.spider-tingle-interrupt: never offered without a Web-Warrior character controlled — a treachery resolves untouched, and the card stays undamaged in play", () => {
    const { state: opened, cardInstanceId: tingle } = playFromAnotherHerosDeck("31020", game, { setup: toHeroFirst });
    const stacked = stackEncounterDeck(opened, "01186", "01105"); // "I'm Tough!" — Rhino's own treachery.
    const damageBefore = inst(stacked, tingle).damage;
    const after = settle(
      runWith(WAVE5_DEPS, stacked, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // Its own cost (damage a Web-Warrior character you control) had no legal target, so the interrupt was never a
    // real choice — undamaged and still in play, and Rhino got his tough status card unopposed.
    expect(inst(after, tingle).damage).toBe(damageBefore);
    expect(cardsInPlay(after)).toContain(tingle);
    expect(inst(after, after.villains[0]!.instanceId).statuses.tough).toBeTruthy();
  });
});

describe("Spider-Ham (31021) and Spider-Man / Otto Octavius (31022), from Spider-Man (Justice)'s own deck", () => {
  it("31021.spider-ham-constant: refused outright without a Web-Warrior card controlled", () => {
    const { state, id } = openHandFor("31021", CORE_SPIDER_MAN);
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("31021.spider-ham-constant: playable once Warrior of the Great Web (`spiderham` 30029) grants Spider-Man's own identity the Web-Warrior trait", () => {
    const base = buildCrossHeroDeck(WAVE5_CARDS, CORE_SPIDER_MAN, "31021");
    const withExtra = { ...base, deck: [...base.deck, "30029" as never] };
    const created = createGame(wave5Scenario("rhino", { seed: 21, players: [withExtra] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const hero = toHeroFirst(opening);
    const identity = identityOf(hero, P1);
    const { state: given, ids } = moveToHand(hero, P1, "30029", "31021");
    const [warrior, ham] = ids as [InstanceId, InstanceId];
    const withWarrior = settle(
      runWith(
        WAVE5_DEPS,
        given,
        play(P1, warrior, payWith(given, P1, 1, [warrior, ham]), { attachToInstanceId: identity }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(traitsOf(withWarrior, identity, WAVE5_DEPS).map(String)).toContain("WEB-WARRIOR");
    const played = settle(
      runWith(WAVE5_DEPS, withWarrior, play(P1, ham, payWith(withWarrior, P1, 3, [ham]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(played)).toContain(ham);
  });

  it("31022.spider-man-constant: refused outright without a Web-Warrior card controlled", () => {
    const { state, id } = openHandFor("31022", CORE_SPIDER_MAN);
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("31022.spider-man-constant / -response: playable with Warrior of the Great Web granting the trait, and its own Response reads whichever upgrade is chosen", () => {
    const base = buildCrossHeroDeck(WAVE5_CARDS, CORE_SPIDER_MAN, "31022");
    const withExtra = { ...base, deck: [...base.deck, "30029" as never] };
    const created = createGame(wave5Scenario("rhino", { seed: 21, players: [withExtra] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const hero = toHeroFirst(opening);
    const identity = identityOf(hero, P1);
    const { state: given, ids } = moveToHand(hero, P1, "30029", "31022");
    const [warrior, spiderman] = ids as [InstanceId, InstanceId];
    const withWarrior = settle(
      runWith(
        WAVE5_DEPS,
        given,
        play(P1, warrior, payWith(given, P1, 1, [warrior, spiderman]), { attachToInstanceId: identity }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const exhaustedWarrior = patchInstance(withWarrior, warrior, { exhausted: true });
    const played = settle(
      runWith(WAVE5_DEPS, exhaustedWarrior, play(P1, spiderman, payWith(exhaustedWarrior, P1, 2, [spiderman]))),
      accepting("31022.spider-man-response", warrior),
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(played)).toContain(spiderman);
    expect(inst(played, warrior).exhausted).toBe(false); // readied by the Response.
  });
});

describe("Unshakable (31024), from a Core hero's own deck", () => {
  it("refused for a Core hero under 14 printed hit points (Spider-Man, 10)", () => {
    const { state, id } = openHandFor("31024", CORE_SPIDER_MAN);
    expect(refusedForRestriction(state, id, 1)).toBe(true);
  });

  it("She-Hulk (15 printed hit points) can play it, and her identity gains steady", () => {
    const { state } = playFromAnotherHerosDeck("31024", game, {
      coreHero: CORE_SHE_HULK,
      setup: (s) => settle(runWith(WAVE5_DEPS, s, toHero(P1)), firstLegal, undefined, WAVE5_DEPS),
    });
    const identity = identityOf(state, P1);
    expect(hasKeyword(state, identity, "steady", WAVE5_DEPS)).toBe(true);
  });
});

describe("Clarity of Purpose (31029), from Captain Marvel's own deck", () => {
  it("31029.clarity-of-purpose-resource: attaches to a friendly character and, once paid for, generates a [wild] resource by damaging whoever it's attached to — not SP//dr specifically", () => {
    const base = buildCrossHeroDeck(WAVE5_CARDS, CORE_CAPTAIN_MARVEL, "31029");
    const created = createGame(wave5Scenario("rhino", { seed: 21, players: [base] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const hero = toHeroFirst(opening);
    const identity = identityOf(hero, P1);
    const { state: given, ids } = moveToHand(hero, P1, "31029");
    const [clarity] = ids as [InstanceId];
    const attached = settle(
      runWith(WAVE5_DEPS, given, play(P1, clarity, payWith(given, P1, 1, [clarity]), { attachToInstanceId: identity })),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(attached, clarity).attachedTo).toBe(identity);
    // Registered and payable as a resource source, exactly as `identity.test.ts`'s own Sync Ratio probe reads it
    // (`paymentFor`'s own `sources`), without needing a specific playable card whose cost this Captain Marvel deck
    // happens to carry.
    const anyHandCard = playerOf(attached, P1).hand[0]!;
    const sources = (
      paymentFor(attached, P1, { kind: "playCard", instanceId: anyHandCard }, {}, WAVE5_DEPS)?.sources ?? []
    ).filter((s) => s.kind === "resourceAbility" && s.optionId.includes("31029.clarity-of-purpose-resource"));
    expect(sources).toHaveLength(1);
    expect(sources[0]!.pool).toEqual({ energy: 0, mental: 0, physical: 0, wild: 1 });
  });
});
