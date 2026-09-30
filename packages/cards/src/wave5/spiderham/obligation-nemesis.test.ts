import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  traitsOf,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEvents, stageNemesisCardForReveal } from "../../testing/staging.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spiderHamScenario } from "./support.js";

const spiderHamVsRhino = (seed = 1) => startWave5Game(spiderHamScenario("rhino", { seed }));
const spiderHamAndFriendVsRhino = (seed = 1) =>
  startWave5Game(spiderHamScenario("rhino", { seed, extraPlayers: [{ starterDeckId: "core-spider-man-justice" }] }));

const ADVANCE = "01186";
const GREEN_GOBBLER = "30026";

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else. The
 * `wave5/sm/spider-man-morales/obligation-nemesis.test.ts` (itself citing `wave4/nebu`) `pickingLabelStartingWith`
 * precedent. */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** Moves a still-set-aside nemesis-set card straight into `player`'s own play area — the `wave5/ironheart/
 * obligation-nemesis.test.ts` `nemesisCardInPlay` precedent, reused here. Pulling from `setAside` leaves the deck's
 * own order untouched. `engaged: false` keeps a minion from taking its own natural villain-phase activation. */
function nemesisCardInPlay(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  opts: { readonly engaged?: boolean } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = cardId(code);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
      villainArea: [...state.villainArea, id],
      instances: {
        ...state.instances,
        [id]: {
          ...state.instances[id]!,
          faceup: true,
          controllerId: null,
          engagedWith: opts.engaged === false ? null : player,
        },
      },
    },
  };
}

/** Relocates a still-set-aside nemesis-set card into the shared encounter deck's discard pile — the state Nefarious
 * Trap's own "search the encounter deck and discard pile for [The Green Gobbler]" clause needs to have anything to
 * find (RRG 1.8 Appendix II step 10 / `packages/engine/src/setup.ts`: every nemesis-set card besides the obligation
 * starts in the player's own `setAside`, not the shared deck/discard, so nothing is there to find until something —
 * an earlier defeat, here a direct test setup — puts a copy there). */
function nemesisCardInEncounterDiscard(state: GameState, code: string, player: PlayerId = P1): GameState {
  const owner = playerOf(state, player);
  const wanted = cardId(code);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
    ),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, id] } },
  };
}

/** A basic thwart from the identity against `target`, readying it first — `wave5/sm/sinister-six/
 * scenario-cards.test.ts`'s own `thwart` precedent for defeating a side scheme through the real engine pipeline
 * (so `defeatingPlayer` resolves off a genuine `schemeDefeated` event, not test-only state surgery). */
function thwart(
  state: GameState,
  target: InstanceId,
  player: PlayerId = P1,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const identity = identityOf(state, player);
  const readied = patchInstance(state, identity, { exhausted: false });
  return driveEvents(WAVE5_DEPS, readied, toHero(player), {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: identity,
    schemeInstanceId: target,
  });
}

describe('"I Really Want a Hot Dog!" (30024, obligation)', () => {
  it("30024.obligation: exhausting Peter Porker and removing a toon counter removes it from the game", () => {
    const staged = stackEncounterDeck(spiderHamVsRhino(1), ADVANCE, "30024");
    const identity = identityOf(staged, P1);
    const withToon = patchInstance(staged, identity, { counters: { toon: 2 } });
    expect(inst(withToon, identity).exhausted).toBe(false); // alter-ego, ready, at setup (RRG 1.8 Appendix II step 1).
    const revealed = settle(
      runWave5(withToon, endTurn(P1)),
      pickingLabelStartingWith("Exhaust Peter Porker"),
      undefined,
      WAVE5_DEPS,
    );
    const [obligation] = instancesOf(revealed, "30024");
    expect(obligation).toBeDefined();
    expect(revealed.removedFromGame).toContain(obligation);
    expect(inst(revealed, identity).counters.toon).toBe(1); // 1 removed.
    expect(inst(revealed, identity).exhausted).toBe(true);
  });

  it("30024.obligation: with no toon counter on Peter Porker, the exhaust option is unavailable — falls to the stun branch and discards instead of removing", () => {
    const staged = stackEncounterDeck(spiderHamVsRhino(2), ADVANCE, "30024");
    const identity = identityOf(staged, P1);
    expect(inst(staged, identity).counters.toon ?? 0).toBe(0);
    const revealed = settle(
      runWave5(staged, endTurn(P1)),
      pickingLabelStartingWith("Exhaust Peter Porker"), // no such option exists this time; falls to firstLegal.
      undefined,
      WAVE5_DEPS,
    );
    const [obligation] = instancesOf(revealed, "30024");
    expect(obligation).toBeDefined();
    expect(revealed.removedFromGame).not.toContain(obligation);
    expect(inst(revealed, identity).exhausted).toBe(false); // never paid the exhaust cost.
    expect(inst(revealed, identity).statuses.stunned).toBeGreaterThanOrEqual(1);
    const deckId = Object.keys(revealed.encounterDecks)[0]!;
    expect(revealed.encounterDecks[deckId]!.discard).toContain(obligation);
  });

  it("30024.obligation: already stunned when revealed, gains surge in addition to discarding", () => {
    const staged = stackEncounterDeck(spiderHamVsRhino(3), ADVANCE, "30024");
    const identity = identityOf(staged, P1);
    const stunned = patchInstance(staged, identity, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { events, state: revealed } = driveEvents(WAVE5_DEPS, stunned, { type: "endTurn", playerId: P1 });
    const [obligation] = instancesOf(revealed, "30024");
    // The picker default (firstLegal) always lands on the stun branch here since the exhaust branch needs a toon
    // counter this state never has.
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === obligation)).toBe(true);
    const deckId = Object.keys(revealed.encounterDecks)[0]!;
    expect(revealed.encounterDecks[deckId]!.discard).toContain(obligation);
  });
});

describe("Nefarious Trap (30025, side scheme)", () => {
  it("30025.when-defeated: The Green Gobbler already in play attacks the player who defeated this scheme", () => {
    const base = spiderHamVsRhino(1);
    const { state: withGobbler, id: gobbler } = nemesisCardInPlay(base, GREEN_GOBBLER, P1, { engaged: false });
    const { state: withTrap, id: trap } = nemesisCardInPlay(withGobbler, "30025");
    const lowThreat = patchInstance(withTrap, trap, { threat: 1 });
    const { events } = thwart(lowThreat, trap);
    expect(events.some((e) => e.type === "schemeDefeated" && e.instanceId === trap)).toBe(true);
    const attack = events.find(
      (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
        e.type === "attackResolved" && e.enemyInstanceId === gobbler,
    );
    expect(attack).toBeDefined();
    expect(attack!.targetInstanceId).toBe(identityOf(lowThreat, P1));
  });

  it("30025.when-defeated: with The Green Gobbler not in play, searches the encounter deck and discard pile for him and puts him into play engaged with the player who defeated this scheme (no attack)", () => {
    const base = spiderHamVsRhino(2);
    const withGobblerInDiscard = nemesisCardInEncounterDiscard(base, GREEN_GOBBLER);
    const { state: withTrap, id: trap } = nemesisCardInPlay(withGobblerInDiscard, "30025");
    const lowThreat = patchInstance(withTrap, trap, { threat: 1 });
    const { events, state: after } = thwart(lowThreat, trap);
    expect(events.some((e) => e.type === "attackResolved")).toBe(false); // he wasn't in play, so he can't attack.
    const gobbler = instancesOf(after, GREEN_GOBBLER).find((id) => cardsInPlay(after).includes(id));
    expect(gobbler).toBeDefined();
    expect(inst(after, gobbler!).engagedWith).toBe(P1);
    const deckId = activeEncounterDeckId(after);
    expect(after.encounterDecks[deckId]!.discard).not.toContain(gobbler);
  });
});

describe("The Green Gobbler (30026, nemesis minion)", () => {
  it("30026.the-green-gobbler-forced-response: engaging discards every counter type from every card the engaged player controls, leaving another player's own counters untouched", () => {
    const base = spiderHamAndFriendVsRhino(1);
    const withGobblerInDiscard = nemesisCardInEncounterDiscard(base, GREEN_GOBBLER, P1);
    const { state: withTrap, id: trap } = nemesisCardInPlay(withGobblerInDiscard, "30025", P1);
    const lowThreat = patchInstance(withTrap, trap, { threat: 1 });
    const p1Identity = identityOf(lowThreat, P1);
    const p2Identity = identityOf(lowThreat, P2);
    const withCounters = {
      ...lowThreat,
      instances: {
        ...lowThreat.instances,
        [p1Identity]: { ...lowThreat.instances[p1Identity]!, counters: { toon: 2, progress: 3 } },
        [p2Identity]: { ...lowThreat.instances[p2Identity]!, counters: { toon: 5 } },
      },
    };
    const { state: after } = thwart(withCounters, trap, P1);
    expect(inst(after, p1Identity).counters.toon ?? 0).toBe(0);
    expect(inst(after, p1Identity).counters.progress ?? 0).toBe(0);
    expect(inst(after, p2Identity).counters.toon).toBe(5); // a different player's own cards are untouched.
  });
});

describe("Gobbler Glider (30027, attachment)", () => {
  it("30027.gobbler-glider-constant: attaches to The Green Gobbler when he's in play, granting the Aerial trait", () => {
    const base = spiderHamVsRhino(1);
    const { state, id: gobbler } = nemesisCardInPlay(base, GREEN_GOBBLER, P1, { engaged: false });
    const staged = stageNemesisCardForReveal(state, "30027", P1);
    const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(revealed, gobbler).attachments.length).toBeGreaterThanOrEqual(1);
    const glider = instancesOf(revealed, "30027").find((id) => inst(revealed, id).attachedTo === gobbler);
    expect(glider).toBeDefined();
    expect(traitsOf(revealed, gobbler, WAVE5_DEPS).map(String)).toContain("AERIAL");
  });

  it("30027.gobbler-glider-constant: with no minion in play at all, has nothing to attach to and is discarded (no Aerial anywhere)", () => {
    const staged = stageNemesisCardForReveal(spiderHamVsRhino(2), "30027", P1);
    const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const glider = instancesOf(revealed, "30027").find((id) => inst(revealed, id).attachedTo === null);
    expect(glider).toBeDefined();
    const deckId = activeEncounterDeckId(revealed);
    expect(revealed.encounterDecks[deckId]!.discard).toContain(glider);
  });
});

describe('"Feast on This!" (30028, treachery, quantity 2)', () => {
  it("30028.when-revealed: takes 2 damage and becomes confused, with no surge the first time", () => {
    // A nemesis-set card, not the obligation — starts in `setAside`, not the shared deck (RRG 1.8 Appendix II step
    // 10 / `packages/engine/src/setup.ts`), so `stageNemesisCardForReveal` (not `stackEncounterDeck`) stages it.
    // `stackSetAside` moves the *first* matching set-aside instance (`testing/staging.ts`), read here the same way
    // before staging so the right one of the 2 printed copies is asserted on.
    const base = spiderHamVsRhino(1);
    const treachery = playerOf(base, P1).setAside.find((i) => base.instances[i]?.cardId === cardId("30028"))!;
    const staged = stageNemesisCardForReveal(base, "30028", P1);
    const identity = identityOf(staged, P1);
    const before = inst(staged, identity).damage;
    const { events, state: revealed } = driveEvents(WAVE5_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(inst(revealed, identity).damage).toBe(before + 2);
    expect(inst(revealed, identity).statuses.confused).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === treachery)).toBe(false);
  });

  it("30028.when-revealed: already confused when revealed, still takes 2 damage and gains surge", () => {
    const base = spiderHamVsRhino(2);
    const treachery = playerOf(base, P1).setAside.find((i) => base.instances[i]?.cardId === cardId("30028"))!;
    const staged = stageNemesisCardForReveal(base, "30028", P1);
    const identity = identityOf(staged, P1);
    const confused = patchInstance(staged, identity, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const before = inst(confused, identity).damage;
    const { events, state: revealed } = driveEvents(WAVE5_DEPS, confused, { type: "endTurn", playerId: P1 });
    // Surge draws and reveals a further encounter card, which may deal its own damage too (`docs/card-scripting-
    // process.md`'s "surge chase" lesson) — this ability's own contribution is at least the printed 2, not exactly.
    expect(inst(revealed, identity).damage).toBeGreaterThanOrEqual(before + 2);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === treachery)).toBe(true);
  });
});
