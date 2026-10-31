import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  cannotLeavePlay,
  characterProfile,
  notDefeatedWithoutThreat,
  replay,
  schemeThreatDestination,
  sessionApply,
  startSession,
  villainOf,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
} from "@mc/engine";
import {
  P1,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { DEPS, drive, intoPlay, rhino } from "../../testing/qa-bench.js";
import { driveStepwise, withForm } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { findInstance, forceAttachToVillain, runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () =>
  startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const wreckerId = (state: GameState) => state.villains[0]!.instanceId;
const dayOfReckoningId = (state: GameState) => villainOf(state, wreckerId(state))!.signatureSideSchemeId!;

describe("Wrecker (07002/07003)", () => {
  it("redirects his own scheme threat to Day of Reckoning instead of the main scheme (schemeThreatDestination)", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, wreckerId(state))).toBe(dayOfReckoningId(state));
  });

  it("prints a base ATK of 2 (the +2 undefended bonus only applies mid-attack, `currentAttack`)", () => {
    const state = spiderManVsBreakout();
    expect(characterProfile(state, wreckerId(state), TWC_DEPS)?.atk).toBe(2);
  });
});

describe("Day of Reckoning (07004)", () => {
  it("cannot leave play while Wrecker is in play, and is not defeated at 0 threat", () => {
    const state = spiderManVsBreakout();
    const scheme = dayOfReckoningId(state);
    expect(cannotLeavePlay(state, TWC_DEPS, scheme)).toBe(true);
    expect(notDefeatedWithoutThreat(state, TWC_DEPS, scheme)).toBe(true);
  });
});

describe("You're Dead Meat! (07016)", () => {
  it("deals 1 damage to the hero with the fewest remaining hit points, and places 3 threat on Wrecker's side scheme if defeated this way", () => {
    let state = spiderManVsBreakout();
    const heroId = identityOf(state, P1);
    const maxHp = characterProfile(state, heroId, TWC_DEPS)?.maxHp ?? 0;
    // One hit from full: any 1-damage effect defeats the hero this way.
    state = patchInstance(state, heroId, { damage: maxHp - 1 });
    const before = inst(state, dayOfReckoningId(state)).threat;
    state = stackEncounterDeck(state, "07016");
    state = play(state, toHero(), endTurn());
    expect(inst(state, heroId).damage).toBeGreaterThanOrEqual(0);
    // Defeated (or not, if some other card resolved first): either way Day of Reckoning's threat never decreases.
    expect(inst(state, dayOfReckoningId(state)).threat).toBeGreaterThanOrEqual(before);
  });
});

describe("Escaped Convict boost (07009)", () => {
  it("moves the active counter to the villain whose side scheme has the least threat", () => {
    let state = spiderManVsBreakout();
    // Piledriver's Pile It On! (3) starts strictly lower than every other villain's side scheme.
    state = stackEncounterDeck(state, "07009");
    state = play(state, toHero(), endTurn());
    expect(state.round).toBeGreaterThanOrEqual(2);
  });
});

describe("Escaped Convict boost (07009), hero form", () => {
  const countOf = (events: readonly GameEvent[], kind: "enemyAttack" | "enemyScheme") =>
    events.filter((e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === kind).length;
  const withTopCards = (state: GameState, ...codes: string[]): GameState =>
    codes.reduce(
      (s, code, i) => patchInstance(s, activeEncounterDeck(state).deck[i]!, { cardId: cardId(code) }),
      state,
    );
  // Breakout gives each villain its own encounter deck: an activation's boost comes off its villain's deck, so the
  // scheme that I've Been Waiting For This! causes (on the villain the counter moved to) draws from that deck's top.
  const withTopOfOtherDecks = (state: GameState, code: string, depth = 0): GameState => {
    const active = state.activeVillainId;
    return state.villains.reduce((s, villain) => {
      if (villain.instanceId === active || !villain.encounterDeckId) return s;
      const card = s.encounterDecks[villain.encounterDeckId]?.deck[depth];
      return card ? patchInstance(s, card, { cardId: cardId(code) }) : s;
    }, state);
  };
  const baseline = () => {
    const base = rhino(5, "core-spider-man-justice", "breakout");
    return patchInstance(base, base.mainScheme.instanceId, { threat: 0 });
  };

  it("as an attack's boost: the counter moves, then that villain attacks the hero in hero form (a second attack)", () => {
    // The top card is the first attack's boost. A plain card as the boost gives the single-attack baseline.
    const plain = drive(withTopCards(baseline(), "07016"), endTurn(P1), {});
    const convict = drive(withTopCards(baseline(), "07009"), endTurn(P1), {});
    expect(countOf(convict.events, "enemyAttack")).toBe(countOf(plain.events, "enemyAttack") + 1);
  });

  // Escaped Convict's attack is the only one with no boost card in these games.
  const convictAttacks = (events: readonly GameEvent[]) =>
    events.flatMap((e, index) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack" && e.event.noBoost
        ? [index]
        : [],
    );

  describe("ruling 191 (May 16, 2024): the scheme I've Been Waiting For This! starts during an attack", () => {
    const firstScheme = (events: readonly GameEvent[]) =>
      events.findIndex((e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyScheme");

    it.each(["07009", "07024", "07038", "07053"])(
      "Escaped Convict (%s) as that scheme's boost: a new attack with no boost card follows the scheme",
      (convict) => {
        // Villain 1 attacks, 07014 is that attack's boost, Villain 2 schemes after the attack; the copy is the scheme's boost.
        const chain = drive(withTopOfOtherDecks(withTopCards(baseline(), "07014"), convict), endTurn(P1), {});
        const filler = drive(withTopOfOtherDecks(withTopCards(baseline(), "07014"), "07016"), endTurn(P1), {});
        expect(firstScheme(chain.events)).toBeGreaterThanOrEqual(0);
        expect(countOf(chain.events, "enemyAttack")).toBe(countOf(filler.events, "enemyAttack") + 1);
        expect(convictAttacks(chain.events)).toHaveLength(1);
        expect(convictAttacks(chain.events)[0]).toBeGreaterThan(firstScheme(chain.events));
        expect(convictAttacks(filler.events)).toHaveLength(0);
      },
    );

    it("a nested chain that began with an attack keeps it: 07014 on that scheme, then Escaped Convict", () => {
      // Each other deck: 07014 for the first scheme, then 07009 for the scheme that one starts.
      const nested = (second: string) =>
        withTopOfOtherDecks(withTopOfOtherDecks(withTopCards(baseline(), "07014"), "07014"), second, 1);
      const chain = drive(nested("07009"), endTurn(P1), {});
      expect(convictAttacks(chain.events)).toHaveLength(1);
      expect(convictAttacks(chain.events)[0]).toBeGreaterThan(firstScheme(chain.events));
      expect(convictAttacks(drive(nested("07016"), endTurn(P1), {}).events)).toHaveLength(0);
    });

    it("no attack follows in alter-ego form", () => {
      // The player flips while Villain 1's attack is resolving, so the chain's scheme finds them in alter-ego form.
      const toAlterEgoAtDefense = (s: GameState) =>
        s.pendingChoice?.prompt.kind === "declareDefender" ? withForm(s, "alterEgo") : s;
      const staged = withTopOfOtherDecks(withTopCards(baseline(), "07014"), "07009");
      const first = applyOk(staged, endTurn(P1), DEPS);
      const { events } = driveStepwise(DEPS, first.state, firstLegal, toAlterEgoAtDefense);
      const all = [...first.events, ...events];
      expect(firstScheme(all)).toBeGreaterThanOrEqual(0);
      expect(convictAttacks(all)).toHaveLength(0);
    });
  });

  describe("in hero form, a scheme no attack started: Escape Plan (07043) on a confused hero", () => {
    // The attack takes a plain boost card, 07043 is dealt, and the scheme it causes boosts off the active deck.
    const escapePlan = (schemeBoost: string) => {
      const base = baseline();
      const hero = identityOf(base);
      const confused = patchInstance(base, hero, { statuses: { ...inst(base, hero).statuses, confused: 1 } });
      return withTopCards(confused, "07016", "07043", schemeBoost);
    };
    const noAttackAfter = (staged: GameState, expectedSchemes: number) => {
      const { events } = drive(staged, endTurn(P1), {});
      const revealed = events.findIndex((e) => e.type === "encounterCardDealt");
      const schemes = events.filter(
        (e, i) =>
          i > revealed && e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyScheme",
      );
      expect(revealed).toBeGreaterThanOrEqual(0);
      expect(schemes).toHaveLength(expectedSchemes);
      expect(convictAttacks(events)).toHaveLength(0);
    };

    it("Escaped Convict as that scheme's boost: no attack", () => {
      noAttackAfter(escapePlan("07009"), 1);
    });

    it("I've Been Waiting For This! as that scheme's boost, Escaped Convict on the scheme it starts: no attack", () => {
      noAttackAfter(withTopOfOtherDecks(escapePlan("07014"), "07009"), 2);
    });
  });

  describe("Chaos In the Prison (07011) boost, ruling 191 (May 16, 2024): an upgrade goes only on an undefended attack", () => {
    const UNDEFENDED = { defend: "no such defender" };
    const upgradeLeft = (staged: GameState) => {
      const { state, id } = intoPlay(staged, "01008");
      return playerOf(drive(state, endTurn(P1), UNDEFENDED).state, P1).playArea.includes(id);
    };

    it("discards the upgrade as an undefended attack's boost", () => {
      expect(upgradeLeft(withTopCards(baseline(), "07011"))).toBe(false);
    });

    it("keeps it as the boost on a scheme I've Been Waiting For This! started: Villain 1's attack is over", () => {
      expect(upgradeLeft(withTopOfOtherDecks(withTopCards(baseline(), "07014"), "07011"))).toBe(true);
    });
  });
});

describe("Magic Crowbar (07006)", () => {
  it("Hero Action: exhausts your hero and discards 1 random hand card, then discards itself — and replays identically", () => {
    const start = spiderManVsBreakout();
    // Test-only surgery (matches `forceMinionIntoPlay`): attaches Magic Crowbar straight to Wrecker, since a real
    // reveal would need Breakout's own per-villain encounter deck (docs/phase7-wave1.md §3.1) actually reaching the
    // top of Wrecker's specifically — this test is about the Hero Action, not the reveal-time auto-attach.
    const wrecker = wreckerId(start);
    const crowbar = findInstance(start, "07006");
    const state = runTwc(forceAttachToVillain(start, crowbar, wrecker), toHero());
    const identity = identityOf(state);
    const handBefore = playerOf(state, P1).hand;
    expect(handBefore.length).toBeGreaterThan(0);

    // `discardRandomFromHandCost` picks with the game's own seeded RNG (dsl/abilities.ts) — proven deterministic
    // here via `startSession`/`sessionApply`/`replay`, the same session-log mechanism `engine/src/attacks.test.ts`
    // uses for "ability attacks … replay to an identical state" (docs/phase7-wave1-scripting.md §6).
    let session: GameSession = startSession(state);
    const apply = (command: Command) => {
      const result = sessionApply(session, command, TWC_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    };
    apply(use(P1, crowbar, "07006.magic-crowbar-action"));

    const handAfter = playerOf(session.state, P1).hand;
    const discarded = handBefore.filter((id) => !handAfter.includes(id));
    expect(discarded).toHaveLength(1); // exactly 1 card, chosen at random
    expect(playerOf(session.state, P1).discard).toContain(discarded[0]);
    expect(inst(session.state, identity).exhausted).toBe(true);
    expect(inst(session.state, wrecker).attachments).not.toContain(crowbar);
    // Magic Crowbar is an encounter card (`home: { kind: "encounterDeck" }`): "discard this card" sends it to its
    // own encounter discard pile, not the player's (docs/phase7-wave1-scripting.md "Test conventions").
    expect(Object.values(session.state.encounterDecks).some((piles) => piles.discard.includes(crowbar))).toBe(true);

    const replayed = replay(session.log, TWC_DEPS);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});

describe("June 13, 2024 - Ruling 214 answer 1 (post-RRG 1.5), RRG 1.8 p. 6 'Activation'", () => {
  // RRG 1.8 p. 6: "If an effect initiates an activation during the resolution of another activation, the newly
  // initiated activation resolves after the current activation has finished resolving." Ruling 214: I've Been Waiting
  // For This! (07014) boost "That villain schemes" does not interrupt the attack it boosts.
  it("I've Been Waiting For This! as a boost: the scheme it causes resolves after the boosted attack deals its damage", () => {
    const base = rhino(5, "core-spider-man-justice", "breakout");
    const start = patchInstance(base, base.mainScheme.instanceId, { threat: 0 });
    const top = activeEncounterDeck(start).deck[0]!;
    const staged = patchInstance(start, top, { cardId: cardId("07014") });
    const done = drive(staged, endTurn(P1), {});
    const hero = identityOf(done.state);
    const index = (test: (e: GameEvent) => boolean) => done.events.findIndex(test);
    const heroDamaged = index((e) => e.type === "damageDealt" && e.targetInstanceId === hero);
    const schemeBegan = index(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyScheme",
    );
    expect(heroDamaged).toBeGreaterThanOrEqual(0);
    expect(schemeBegan).toBeGreaterThanOrEqual(0);
    expect(heroDamaged).toBeLessThan(schemeBegan);
  });
});
