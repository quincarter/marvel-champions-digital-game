import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  activeVillain,
  handSize,
  remainingHitPoints,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  payWith,
  picking,
  play,
  playerOf,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { MSM_DEPS, runMsm, startMsmGame } from "./testing.js";

// Real wave 1 content: the Ms. Marvel (Protection) precon against Rhino, standard, solo.
const msmVsRhino = () =>
  startMsmGame(wave1Scenario("rhino", { players: [{ starterDeckId: "msm-protection" }], seed: 13 }));
// A neutral boost card (0 icons, no boost ability), matching `cap`'s `ADVANCE`/`core/heroes/spider-man.test.ts`.
const ADVANCE = "01186";

/**
 * **A nemesis set never naturally enters play in this engine yet.** `createGame` (`engine/src/setup.ts`) puts each
 * identity's nemesis set into the *seated player's* `setAside` pile at setup — never into the shared encounter deck
 * — and nothing in `@mc/engine` ever moves cards out of `setAside` again (confirmed: no code path reads
 * `player.setAside` except the `CardSelector { kind: "setAside" }` a card ability could explicitly select from, and
 * no wave 1 pack's obligation script does). The real rule (RRG "Nemesis Set") shuffles a hero's nemesis set into the
 * encounter deck once that hero's obligation is discarded; that hookup doesn't exist yet, in Core or any wave 1
 * pack (`cap`'s own nemesis set has no test coverage for the same reason — see its `captain-america.test.ts`). This
 * is a cross-pack engine gap, not specific to `msm` or a reason to leave Ms. Marvel's own nemesis abilities
 * unscripted: they're correct DSL over well-proven primitives (§6 `cannotTakeDamage`/`blankTextBox`/`whenRevealed`
 * with `selectCards`), just not reachable through a real game flow yet. The two helpers below place/find a nemesis
 * card by reading `player.setAside` directly (test-only surgery, matching `patchInstance`/`moveToHand`'s
 * conventions), the way `game-rules-architect`'s own engine test suites use an internal `encounterInPlay` helper.
 */
function putMinionInPlay(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const setAside = playerOf(state, player).setAside;
  const id = setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in ${player}'s set-aside nemesis pile`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? { ...p, setAside: p.setAside.filter((x) => x !== id), playArea: [...p.playArea, id] }
          : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, engagedWith: player, controllerId: null },
      },
    },
  };
}

/** Moves a nemesis card straight from `player`'s set-aside pile to the top of the active encounter deck, the
 * set-aside analog of `../../testing/harness.ts`'s `stackEncounterDeck`. */
function stackFromSetAside(state: GameState, player: PlayerId, code: string): GameState {
  const setAside = playerOf(state, player).setAside;
  const id = setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in ${player}'s set-aside nemesis pile`);
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, setAside: p.setAside.filter((x) => x !== id) } : p,
    ),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [id, ...piles.deck] } },
  };
}

describe("Home by Dawn (Ms. Marvel's obligation)", () => {
  it("offers the optional flip in hero form, then 'exhaust Kamala Khan → remove it from the game'", () => {
    const start = stackEncounterDeck(msmVsRhino(), ADVANCE, "05025");
    const atFlip = settleUntil(runMsm(start, toHero(), endTurn()), "chooseOption", firstLegal, MSM_DEPS);
    expect(atFlip.pendingChoice?.playerId).toBe(P1);
    expect(atFlip.pendingChoice?.options.map((o) => o.label)).toEqual(["Flip to alter-ego form", "Stay in hero form"]);
    const flipped = answer(atFlip, ["0"], MSM_DEPS);
    expect(playerOf(flipped, P1).identity.form).toBe("alterEgo");
    expect(flipped.pendingChoice?.options.map((o) => o.label)).toEqual([
      "Exhaust Kamala Khan → remove this obligation from the game",
      "Discard 1 Persona support you control",
    ]);
    const removed = settle(answer(flipped, ["0"], MSM_DEPS), firstLegal, undefined, MSM_DEPS);
    const obligation = instancesOf(removed, "05025")[0];
    expect(removed.removedFromGame).toContain(obligation);
    expect(inst(removed, identityOf(removed)).exhausted).toBe(true);
  });

  it("discards a controlled Persona support (no surge); with none, gains surge and discards itself", () => {
    // With a Persona support (Aamir Khan) in play, the discard is mandatory-in-effect (only 1 candidate) and no
    // surge is gained.
    const withAamir = (() => {
      const start = stackEncounterDeck(msmVsRhino(), ADVANCE, "05025");
      const given = moveToHand(start, P1, "05006");
      const [aamir] = given.ids as [never];
      return {
        state: settle(
          runMsm(given.state, play(P1, aamir, payWith(given.state, P1, 1, [aamir]))),
          firstLegal,
          undefined,
          MSM_DEPS,
        ),
        aamir,
      };
    })();
    const atChoice = settleUntil(runMsm(withAamir.state, endTurn()), "chooseOption", firstLegal, MSM_DEPS); // already alter-ego: no flip offer
    expect(atChoice.pendingChoice?.options).toHaveLength(2);
    const after = settle(
      answer(atChoice, ["1"], MSM_DEPS),
      (s) => (s.pendingChoice?.prompt.kind === "chooseCards" ? picking(withAamir.aamir)(s) : firstLegal(s)),
      undefined,
      MSM_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(withAamir.aamir);
    const obligation = instancesOf(after, "05025")[0]!;
    expect(activeEncounterDeck(after).discard).toContain(obligation);
    expect(inst(after, obligation).counters.surge ?? 0).toBe(0);
  });
});

describe("Ms. Marvel's nemesis set", () => {
  it("Thomas Edison: takes damage normally while alone (not engaged with another minion)", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05003"); // Big Hands: 4 damage, more than Thomas Edison's printed 3 hit points
    const [bigHands] = given.ids as [never];
    const hero = runMsm(given.state, toHero());
    const { state: withEdison, id: edison } = putMinionInPlay(hero, P1, "05027");
    const after = settle(
      runMsm(withEdison, play(P1, bigHands, payWith(withEdison, P1, 2, [bigHands]))),
      picking(edison),
      undefined,
      MSM_DEPS,
    );
    // Defeated outright — proof the damage actually applied (a hidden `cannotTakeDamage` would have left him at
    // 0 damage and still in play instead).
    expect(playerOf(after, P1).playArea).not.toContain(edison);
  });

  it("Thomas Edison: cannot take damage while you are engaged with another minion", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05003"); // Big Hands
    const [bigHands] = given.ids as [never];
    const hero = runMsm(given.state, toHero());
    const { state: withEdison, id: edison } = putMinionInPlay(hero, P1, "05027");
    const { state: withBoth, id: robot } = putMinionInPlay(withEdison, P1, "05028"); // a second minion engaged with you
    const after = settle(
      runMsm(withBoth, play(P1, bigHands, payWith(withBoth, P1, 2, [bigHands]))),
      picking(edison),
      undefined,
      MSM_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(edison);
    expect(inst(after, edison).damage).toBe(0);
    void robot;
  });

  it("Edison's Giant Robot: cannot take damage, until its own printed text box is treated as blank", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05003", "05009"); // Big Hands, Biokinetic Polymer Suit (a spare mental icon)
    const [bigHands, suit] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const { state: withRobot, id: robot } = putMinionInPlay(hero, P1, "05028");
    const withBoth = runMsm(withRobot, play(P1, bigHands, payWith(withRobot, P1, 2, [bigHands, suit])));
    const prevented = settle(withBoth, picking(robot), undefined, MSM_DEPS);
    expect(inst(prevented, robot).damage).toBe(0);

    // Blank its own text box (spend a [mental] resource — paid here by discarding Biokinetic Polymer Suit, whose
    // own printed icon is [mental]), then attack again: with `cannotTakeDamage` blanked away, damage now applies.
    const blanked = runMsm(prevented, use(P1, robot, "05028.edisons-giant-robot-action", [{ fromHand: suit }]));
    const given2 = moveToHand(blanked, P1, "05003");
    const [bigHands2] = given2.ids as [never];
    const after = settle(
      runMsm(given2.state, play(P1, bigHands2, payWith(given2.state, P1, 2, [bigHands2]))),
      picking(robot),
      undefined,
      MSM_DEPS,
    );
    expect(inst(after, robot).damage).toBe(4);
  });

  it("Generation Why?: discards the top card of each player's deck for each ally and Persona support in play", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05002", "05006"); // Red Dagger (ally), Aamir Khan (Persona support)
    const [redDagger, aamir] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const withRedDagger = settle(
      runMsm(hero, play(P1, redDagger, payWith(hero, P1, 3, [redDagger, aamir]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const withBoth = settle(
      runMsm(withRedDagger, play(P1, aamir, payWith(withRedDagger, P1, 1, [redDagger, aamir]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const withScheme = stackFromSetAside(withBoth, P1, "05026");
    const stacked = stackEncounterDeck(withScheme, ADVANCE, "05026");
    const deckBefore = playerOf(stacked, P1).deck;
    // `endTurn()` first runs Round 1's own end-of-phase draw (RRG "Draw", each player refills to hand size before
    // the next round's Villain Phase even begins), which — having spent most of the hand paying for Red Dagger and
    // Aamir Khan above — takes several cards off the top of the deck before Generation Why? ever reveals. Skip past
    // those so `top2` names the cards actually still on top when the reveal happens, not the pre-refill top of deck.
    const refill = handSize(stacked, P1, MSM_DEPS) - playerOf(stacked, P1).hand.length;
    // count(ally) + count(support, trait: Persona) = 1 (Red Dagger) + 1 (Aamir Khan) = 2, a `sum(...)` of two
    // disjoint queries (Aamir Khan is a Persona support, never an ally) — docs/phase7-wave1-scripting.md §6.
    const top2 = deckBefore.slice(refill, refill + 2);
    const revealed = settle(runMsm(stacked, endTurn()), firstLegal, undefined, MSM_DEPS);
    expect(playerOf(revealed, P1).discard).toEqual(expect.arrayContaining(top2));
    expect(playerOf(revealed, P1).deck.length).toBe(deckBefore.length - refill - 2);
  });

  it("Harvest: exhausts each Persona support, heals the villain 1 per support exhausted this way", () => {
    // Harvest is a nemesis card (in `player.setAside`, not the encounter deck — see the module doc comment above):
    // move it to the encounter deck first, then stack the usual neutral boost on top of it.
    const start = stackEncounterDeck(stackFromSetAside(msmVsRhino(), P1, "05029"), ADVANCE);
    const given = moveToHand(start, P1, "05006", "05003"); // Aamir Khan (a Persona support), Big Hands (to damage the villain first — healing a full-HP villain would be a no-op, masking whether Harvest fired)
    const [aamir, bigHands] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const withAamir = settle(
      runMsm(hero, play(P1, aamir, payWith(hero, P1, 1, [aamir, bigHands]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const villain = activeVillain(withAamir).instanceId;
    const damaged = settle(
      runMsm(withAamir, play(P1, bigHands, payWith(withAamir, P1, 2, [bigHands]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const hpBeforeHeal = remainingHitPoints(damaged, villain);
    const after = settle(runMsm(damaged, endTurn()), firstLegal, undefined, MSM_DEPS);
    expect(inst(after, aamir).exhausted).toBe(true); // exhausted by Harvest, not by playing him
    expect(remainingHitPoints(after, villain)).toBe(hpBeforeHeal! + 1);
  });
});
