import { describe, expect, it } from "vitest";
import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  hasKeyword,
  keywordTotal,
  legalActions,
  maxHitPoints,
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
import { driveEventsPicking } from "../../testing/staging.js";
import { playFromAnotherHerosDeck, buildCrossHeroDeck, type CrossHeroGame } from "../../testing/cross-hero.js";
import { wave5Scenario } from "../setup.js";
import { WAVE5_CARDS } from "../cards.js";
import { WAVE5_DEPS } from "../index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): every
 * non-signature Ironheart player card — every `ironheart` card whose own `aspect` is not `hero:29001a` (only a
 * Riri Williams deck could ever legally hold one of those, RRG 1.8 "Identity-Specific Card", p. 23) — played
 * through the engine from a Core hero's own deck instead of Ironheart's own precon (`ironheart-leadership`,
 * `packages/content/src/data/ironheart/starterDecks.ts`). That is 29014-29027 (`leadership`: 29014-29021;
 * `basic`: 29022-29027, `packages/content/src/data/ironheart/cards.ts`'s own `aspect` field per card), plus the
 * Zzzax modular set's three player allies (29033 `aggression`, 29034 `justice`, 29035 `protection`). `nova/
 * cross-hero.test.ts`'s own module docblock is the precedent for why: proof no script here quietly reads
 * "you"/"your identity"/"your hero" as Ironheart specifically rather than the actual resolving player/controller.
 *
 * Each test seats the target card in a Core hero's own real precon (`playFromAnotherHerosDeck`'s own matching-
 * aspect default — a `leadership` card in Captain Marvel/Leadership, `basic` in Spider-Man/Justice,
 * `aggression`/`justice`/`protection` in She-Hulk/Spider-Man/Black Panther respectively), plays it, and checks its
 * printed effect fires (or, for the handful gated on a named trait no Core hero happens to hold — Aerial, Champion,
 * Genius — that it is never offered, refused outright at play, or never legal to play at all) exactly as it would
 * from Ironheart's own precon. Every Core hero named below is checked directly against `packages/content/src/data/
 * core/cards.ts`/`starterDecks.ts` for the trait/card it needs (or lacks): no Core identity or ally prints the
 * Champion trait; Spider-Man's alter-ego (Peter Parker) prints Genius; Cloud 9 and Falcon (29014-29015) both print
 * Aerial and Champion on themselves, so their own "Aerial"/"champion character" targets can be themselves with no
 * other ally needed; Patriot (29016) prints Champion on herself for the same reason.
 */

const buildScenario = (players: Parameters<typeof wave5Scenario>[1]["players"]) =>
  wave5Scenario("rhino", { seed: 21, players });

const game: CrossHeroGame = { deps: WAVE5_DEPS, cards: WAVE5_CARDS, buildScenario };

/** `../../testing/harness.js`'s own `toHero`, run immediately and settled — every "Hero Action"/"Hero Response"
 * card here needs hero form, which a fresh game does not start in (RRG 1.8 default opening form is alter-ego).
 * `nova/cross-hero.test.ts`'s own `toHeroFirst` precedent. */
const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(WAVE5_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);

const WAVE5_CARDS_BY_ID = new Map(WAVE5_CARDS.map((card) => [card.id as string, card]));

/** A fresh opening state for `cardCode` seated in `coreHeroId`'s own deck, with `cardCode` already in hand — the
 * same setup `playFromAnotherHerosDeck` does, minus its own final `playCard` step, for cards that need to inspect a
 * rejection themselves rather than let the helper throw (`nova/cross-hero.test.ts`'s own `openHandFor`). */
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

/** Hand instance ids covering a Requirement card's own printed icons plus enough other cards to reach `cost`
 * total. `nova/cross-hero.test.ts`'s own `paymentWithIcons` precedent. */
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
 * never offering it. `nova/cross-hero.test.ts`'s own `refusedToPlay` precedent. */
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

/** Accepts the named optional response/interrupt/trigger (by ability id or target instance id); declines
 * everything else, and pays a `payForCard` step with its own first N hand cards. `nova/cross-hero.test.ts`'s own
 * `accepting()` precedent. */
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

describe("Ironheart's leadership cards, from Captain Marvel (Leadership)'s own deck", () => {
  it("29014.cloud-9-action: exhaust -> choose a player; each Aerial character that player controls gets +1 THW until the end of the phase", () => {
    const { state, cardInstanceId: cloud9 } = playFromAnotherHerosDeck("29014", game, {
      coreHero: "core-captain-marvel-leadership",
      setup: toHeroFirst,
    });
    // Cloud 9 herself prints Aerial (and Champion), so her own action can target its own controller (P1) and
    // affect herself; Captain Marvel prints neither trait (`packages/content/src/data/core/cards.ts` 01010a), so
    // this also proves the buff is scoped to Aerial characters, not "every character that player controls".
    const identity = identityOf(state);
    const cloud9Before = characterProfile(state, cloud9, WAVE5_DEPS)!;
    const identityBefore = characterProfile(state, identity, WAVE5_DEPS)!;
    const after = settle(
      runWith(WAVE5_DEPS, state, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: cloud9,
        abilityId: "29014.cloud-9-action" as never,
        payment: [],
      }),
      accepting(P1),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, cloud9).exhausted).toBe(true);
    expect(characterProfile(after, cloud9, WAVE5_DEPS)!.thw).toBe(cloud9Before.thw + 1);
    expect(characterProfile(after, identity, WAVE5_DEPS)!.thw).toBe(identityBefore.thw); // no Aerial trait; unaffected.
  });

  it("29015.falcon-response: never offered after Falcon attacks — no other champion character to ready", () => {
    const { state, cardInstanceId: falcon } = playFromAnotherHerosDeck("29015", game, {
      coreHero: "core-captain-marvel-leadership",
      setup: toHeroFirst,
    });
    const villain = state.villains[0]!.instanceId;
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, accepting("29015.falcon-response"), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: falcon,
      targetInstanceId: villain,
    });
    expect(
      events.some(
        (e) => e.type === "windowOpened" && e.candidates.some((c) => `${c.abilityId}` === "29015.falcon-response"),
      ),
    ).toBe(false);
    expect(inst(after, falcon).exhausted).toBe(true); // her own attack exhausted her; nothing else fired.
  });

  it("29016.patriot-response: after Patriot enters play, she can choose herself (Champion trait) — +1 to each basic power until the end of the round", () => {
    const { state, cardInstanceId: patriot } = playFromAnotherHerosDeck("29016", game, {
      coreHero: "core-captain-marvel-leadership",
      setup: toHeroFirst,
      pick: accepting("29016.patriot-response"),
    });
    // Only Patriot herself carries the Champion trait in a bare Captain Marvel deck, so the response's only legal
    // target is herself, proving the query is "any champion character in play" (module docblock), not
    // "another"/"you control", unlike Falcon above. Patriot's own printed profile is atk 1/thw 2/def 0 (allies
    // print no DEF value; `characterProfile` reads a missing stat as 0).
    expect(characterProfile(state, patriot, WAVE5_DEPS)).toMatchObject({ thw: 3, atk: 2, def: 1 });
  });

  it("29017.go-all-out-action: (Requirement [energy]) exhausts your hero -> deals damage equal to THW+ATK+DEF", () => {
    const { state: opened, id: goAllOut } = openHandFor("29017", "core-captain-marvel-leadership");
    const given = moveToHand(opened, P1, "01085", "01087"); // Emergency/Haymaker, both [energy] icons.
    const hand = given.state.players[0]!.hand.filter((id) => id !== goAllOut);
    const payment = paymentWithIcons(given.state, hand, ["energy"], 2);
    const identity = identityOf(given.state);
    const profile = characterProfile(given.state, identity, WAVE5_DEPS)!;
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, goAllOut as never, payment as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(before + profile.thw + profile.atk + profile.def);
    expect(inst(after, identity).exhausted).toBe(true); // the cost.
  });

  it("29018.push-ahead-action: (Requirement [mental]) exhausts your hero -> removes threat equal to THW+ATK+DEF", () => {
    const { state: opened, id: pushAhead } = openHandFor("29018", "core-captain-marvel-leadership");
    const given = moveToHand(opened, P1, "01084", "01086"); // Nick Fury/First Aid, both [mental] icons.
    const hand = given.state.players[0]!.hand.filter((id) => id !== pushAhead);
    const payment = paymentWithIcons(given.state, hand, ["mental"], 3);
    const identity = identityOf(given.state);
    const profile = characterProfile(given.state, identity, WAVE5_DEPS)!;
    const scheme = given.state.mainScheme.instanceId;
    const withThreat = patchInstance(given.state, scheme, { threat: 20 });
    const before = inst(withThreat, scheme).threat;
    const after = settle(
      runWith(WAVE5_DEPS, withThreat, play(P1, pushAhead as never, payment as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, scheme).threat).toBe(before - (profile.thw + profile.atk + profile.def));
  });

  it("29019.morale-boost-action: choose a hero -> +1 THW, +1 ATK and +1 DEF until the end of the round", () => {
    const { state, cardInstanceId: moraleBoost } = playFromAnotherHerosDeck("29019", game, {
      coreHero: "core-captain-marvel-leadership",
      setup: toHeroFirst,
      pick: accepting(),
    });
    const identity = identityOf(state);
    // Only Captain Marvel herself is a legal "hero" target in her own solo game; `firstLegal` already picked her.
    expect(cardsInPlay(state)).not.toContain(moraleBoost); // an event: resolved and discarded, not left in play.
    // Captain Marvel (01010a) prints atk 2/thw 2/def 1, +1 each.
    expect(characterProfile(state, identity, WAVE5_DEPS)).toMatchObject({ atk: 3, thw: 3, def: 2 });
  });

  it("29020.r-and-d-facility-action: (Requirement [mental][mental], Uses 3 research) exhaust + remove 1 research counter -> chosen friendly character gets +1 THW and +1 ATK until the end of the phase", () => {
    const { state: opened, id: facility } = openHandFor("29020", "core-captain-marvel-leadership");
    const given = moveToHand(opened, P1, "01084", "01086", "01087"); // 2x [mental] + 1 filler, cost 3.
    const hand = given.state.players[0]!.hand.filter((id) => id !== facility);
    const payment = paymentWithIcons(given.state, hand, ["mental", "mental"], 3);
    const withFacility = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, facility as never, payment as never)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const facilityId = facility as InstanceId;
    expect(inst(withFacility, facilityId).counters.research).toBe(3);
    const identity = identityOf(withFacility);
    const before = characterProfile(withFacility, identity, WAVE5_DEPS)!;
    const after = settle(
      runWith(WAVE5_DEPS, withFacility, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: facilityId,
        abilityId: "29020.r-and-d-facility-action" as never,
        payment: [],
      }),
      accepting(identity),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, facilityId).exhausted).toBe(true);
    expect(inst(after, facilityId).counters.research).toBe(2);
    const boosted = characterProfile(after, identity, WAVE5_DEPS)!;
    expect(boosted.thw).toBe(before.thw + 1);
    expect(boosted.atk).toBe(before.atk + 1);
  });

  it("29021.the-power-of-leadership-constant: doubles the [wild] it generates while paying for a Leadership card", () => {
    const { state: opened, id: power } = openHandFor("29021", "core-captain-marvel-leadership");
    const given = moveToHand(opened, P1, "01070"); // Lead from the Front (leadership event, cost 2).
    const [leadFromTheFront] = given.ids as readonly [InstanceId];
    // 1 Power of Leadership alone (doubled: 2 [wild]) covers Lead from the Front's printed cost of 2 exactly.
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, leadFromTheFront as never, [power as never])),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(power); // spent, generating its own doubled [wild].
    expect(cardsInPlay(after)).not.toContain(leadFromTheFront); // an event: resolved and discarded.
  });
});

describe('Agent 13 / Snowguard / Vivian / "Go for Champions!" / Helicarrier / Ingenuity (basic, 29022-29027), from Spider-Man (Justice)\'s own deck', () => {
  it("29022.agent-13-response: never offered after she attacks or thwarts — no S.H.I.E.L.D. support in a bare Spider-Man deck", () => {
    const { state, cardInstanceId: agent13 } = playFromAnotherHerosDeck("29022", game, {
      coreHero: "core-spider-man-justice",
      setup: toHeroFirst,
    });
    const villain = state.villains[0]!.instanceId;
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, state, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: agent13,
      targetInstanceId: villain,
    });
    expect(
      events.some(
        (e) => e.type === "windowOpened" && e.candidates.some((c) => `${c.abilityId}` === "29022.agent-13-response"),
      ),
    ).toBe(false);
    expect(inst(after, agent13).exhausted).toBe(true);
  });

  it("29023.snowguard-response + -constant-3: choosing 3 shift counters grants +5 hit points and retaliate 1", () => {
    const played = playFromAnotherHerosDeck("29023", game, {
      coreHero: "core-spider-man-justice",
      setup: toHeroFirst,
      pick: (state) => {
        const choice = state.pendingChoice;
        if (!choice) return [];
        if (choice.prompt.kind === "chooseTriggers") {
          const hit = choice.options.find((o) => o.optionId.endsWith(":29023.snowguard-response"));
          return hit ? [hit.optionId] : firstLegal(state);
        }
        const hit = choice.options.find((o) => o.label === "Place 3 shift counters");
        return hit ? [hit.optionId] : firstLegal(state);
      },
    });
    const snowguard = played.cardInstanceId;
    expect(maxHitPoints(played.state, snowguard, WAVE5_DEPS)).toBe(3 + 5); // Snowguard's own printed hp is 3.
    expect(keywordTotal(played.state, snowguard, "retaliate", WAVE5_DEPS)).toBe(1);
    expect(hasKeyword(played.state, snowguard, "overkill", WAVE5_DEPS)).toBe(false);
  });

  it("29024.vivian-response: never offered entering a Spider-Man table with no eligible attachment/non-Elite minion/non-permanent side scheme", () => {
    const { state, cardInstanceId: vivian } = playFromAnotherHerosDeck("29024", game, {
      coreHero: "core-spider-man-justice",
      setup: toHeroFirst,
    });
    // A bare opening board (villain, main scheme, hero) holds nothing the response's own query matches — it
    // resolves with no legal target and thus fires no `blankTextBox` effect; Vivian still enters play normally.
    expect(cardsInPlay(state)).toContain(vivian);
  });

  it("29025.go-for-champions-action: refused outright — Spider-Man's identity has no Champion trait", () => {
    const { state, id } = openHandFor("29025", "core-spider-man-justice");
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("29026.helicarrier-action: exhausts, and reduces the cost of the chosen player's next card played this phase by 1", () => {
    const { state, cardInstanceId: helicarrier } = playFromAnotherHerosDeck("29026", game, {
      coreHero: "core-spider-man-justice",
      setup: toHeroFirst,
    });
    const after = settle(
      runWith(WAVE5_DEPS, state, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: helicarrier,
        abilityId: "29026.helicarrier-action" as never,
        payment: [],
      }),
      accepting(P1),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, helicarrier).exhausted).toBe(true);
  });

  it("29027.ingenuity-resource: playable only in alter-ego form (Peter Parker's own Genius trait); exhaust -> generate a [mental] resource", () => {
    // Deliberately stays in alter-ego (Peter Parker, GENIUS trait, `01001a`) — Ingenuity's "Play only if your
    // identity has the Genius trait" depends on staying in alter-ego here, `nova/cross-hero.test.ts`'s own Moon
    // Girl precedent for the same shape.
    const setup = buildCrossHeroDeck(WAVE5_CARDS, "core-spider-man-justice", "29027");
    const created = createGame(wave5Scenario("rhino", { seed: 21, players: [setup] }), WAVE5_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const given = moveToHand(opening, P1, "29027");
    const [ingenuity] = given.ids as readonly [InstanceId];
    const withIngenuity = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, ingenuity, payWith(given.state, P1, 2, [ingenuity]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(cardsInPlay(withIngenuity)).toContain(ingenuity);
    // Spend Ingenuity's own Resource ability while paying for another card (Web-Shooter, 01008, cost 1).
    const given2 = moveToHand(withIngenuity, P1, "01008");
    const [webShooter] = given2.ids as readonly [InstanceId];
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given2.state,
        play(P1, webShooter, [], {
          abilities: [{ ability: { instanceId: ingenuity, abilityId: "29027.ingenuity-resource" as never } }],
        }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, ingenuity).exhausted).toBe(true);
    expect(cardsInPlay(after)).toContain(webShooter);
  });
});

describe("Zzzax pack allies (Bombshell 29033, Wasp 29034, Pinpoint 29035): all refused outright from a Core hero's own deck", () => {
  // All three print "Play only if your identity has the Champion trait" (`packages/content/src/data/ironheart/
  // cards.ts`) — no Core identity (Spider-Man, Captain Marvel, She-Hulk, Black Panther) carries the Champion trait
  // (`grep trait("CHAMPION") packages/content/src/data/core/cards.ts` finds none), unlike Ironheart's own hero face
  // (`29001a`-`29003a`, `traits: [trait("CHAMPION"), …]`), which is why `ironheart/zzzax.test.ts` can seat them at
  // all (via `ironheartScenarioWithExtras`, deck legality off). Deckbuilding itself does not check this restriction
  // (`buildCrossHeroDeck` builds a legal deck by `validateDeck`'s own rules — a play restriction on an identity
  // trait is not a deckbuilding legality rule, RRG 1.8 Appendix I), so each card reaches hand normally and is
  // refused only at the moment of play — the same "refused outright" shape `nova/cross-hero.test.ts`'s own
  // She-Hulk/Locust case (`28010`) already establishes for an identity-trait-gated ally.
  it("29033.bombshell-constant (Bombshell): refused outright from She-Hulk's own deck", () => {
    const { state, id } = openHandFor("29033", "core-she-hulk-aggression");
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("29034.wasp-constant (Wasp): refused outright from Spider-Man's own deck", () => {
    const { state, id } = openHandFor("29034", "core-spider-man-justice");
    expect(refusedToPlay(state, id)).toBe(true);
  });

  it("29035.pinpoint-interrupt (Pinpoint): refused outright from Black Panther's own deck", () => {
    const { state, id } = openHandFor("29035", "core-black-panther-protection");
    expect(refusedToPlay(state, id)).toBe(true);
  });
});
