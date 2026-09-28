import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import {
  cardsInPlay,
  iconsInPlay,
  keywordTotal,
  maxHitPoints,
  statBonus,
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
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { driveEvents, stageNemesisCardForReveal } from "../../testing/staging.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { ironheartScenario } from "./support.js";

const ironheartVsRhino = (seed = 1) => startWave5Game(ironheartScenario("rhino", { seed }));

const ADVANCE = "01186";

/**
 * A Minor Setback (29028), Ironheart's obligation, and her nemesis set: Rule by Force (29029, side scheme), Lucia
 * von Bardas (29030, nemesis minion), Cyborg Tech (29031, attachment), Political Retribution (29032, treachery, qty
 * 2) — `obligation-nemesis.ts`'s own docblock has the full ruling discussion for each card below.
 */

/** Moves a still-set-aside nemesis-set card straight into `player`'s own play area — the `wave5/nova/obligation-
 * nemesis.test.ts` `nemesisCardInPlay` precedent, reused here. Pulling from `setAside` (never the shared encounter
 * deck) leaves the deck's own order untouched, so a baseline/with-card comparison differs only in this card's own
 * presence, not in which cards the rest of the villain phase happens to draw. `engaged: false` (the same precedent's
 * own option) keeps a minion from taking its own natural villain-phase activation, isolating the ability under test
 * from Lucia von Bardas's own separate attack/Forced Response in the same phase. */
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

describe("A Minor Setback (29028, obligation)", () => {
  it("29028.obligation: with a progress counter on Ironheart, removes it and discards this card", () => {
    const staged = stackEncounterDeck(ironheartVsRhino(1), ADVANCE, "29028");
    const identity = identityOf(staged, P1);
    const withProgress = patchInstance(staged, identity, { counters: { progress: 3 } });
    const revealed = settle(runWave5(withProgress, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const [obligation] = instancesOf(revealed, "29028");
    expect(obligation).toBeDefined();
    expect(inst(revealed, identity).counters.progress).toBe(2); // 1 removed.
    const deckId = Object.keys(revealed.encounterDecks)[0]!;
    expect(revealed.encounterDecks[deckId]!.discard).toContain(obligation);
    expect(revealed.encounterDecks[deckId]!.deck).not.toContain(obligation);
    expect(playerOf(revealed, P1).dealtEncounter).not.toContain(obligation);
  });

  it("29028.obligation: with no progress counter on Ironheart, deals a facedown encounter card and shuffles this card back into the encounter deck instead of discarding it", () => {
    const staged = stackEncounterDeck(ironheartVsRhino(2), ADVANCE, "29028");
    const identity = identityOf(staged, P1);
    expect(inst(staged, identity).counters.progress ?? 0).toBe(0);
    // A card dealt facedown to a player is revealed and resolved later in the same villain phase (RRG 1.8 "Villain
    // Phase", steps 4-5) — by the time a full `endTurn` settles, it has already left `dealtEncounter` again, so the
    // effect's own marginal contribution is read off the `cardMoved`-to-`dealtEncounter` event it caused, not off
    // the final state's zone contents (the `wave5/sm/sinister-six/guerrilla-tactics.test.ts` "Hidden in Shadow"
    // `dealtCount` precedent).
    const { events, state: revealed } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const [obligation] = instancesOf(revealed, "29028");
    expect(obligation).toBeDefined();
    expect(inst(revealed, identity).counters.progress ?? 0).toBe(0); // nothing to remove.
    expect(events.some((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === P1)).toBe(
      true,
    );
    const deckId = Object.keys(revealed.encounterDecks)[0]!;
    expect(revealed.encounterDecks[deckId]!.deck).toContain(obligation); // shuffled back in, not discarded.
    expect(revealed.encounterDecks[deckId]!.discard).not.toContain(obligation);
  });
});

describe("Rule by Force (29029, side scheme)", () => {
  // `iconsInPlay` (RRG 1.8 "Acceleration Icon"/"Hazard Icon", p. 5/p. 21) is the exact live count the villain
  // phase's own step one (threat) and step three (dealing encounter cards, `villain/phase.ts`
  // `executeDealEncounterCards`) read — reading it directly here, rather than diffing a full driven villain phase's
  // event counts, sidesteps Surge's own chase-reveal chain: two states that deal a different *number* of facedown
  // encounter cards up front go on to reveal different downstream cards from the same shuffled deck, and if either
  // draw happens to hit a Surge card, that alone adds noise no `while` condition caused (confirmed live: diffing
  // dealt-`cardMoved` event counts between a Lucia-in-play and a Lucia-absent state gave +3, not the expected +1,
  // purely from this cascade — `iconsInPlay` reads the constant's own live value with no such downstream drift).
  it("29029.rule-by-force-constant: while Lucia von Bardas is in play, gains a hazard icon (not acceleration)", () => {
    const base = ironheartVsRhino(1);
    expect(iconsInPlay(base, WAVE5_DEPS, "hazard")).toBe(0);
    const withRule = nemesisCardInPlay(base, "29029").state;
    const withBoth = nemesisCardInPlay(withRule, "29030").state;
    expect(iconsInPlay(withBoth, WAVE5_DEPS, "hazard")).toBe(1);
    expect(iconsInPlay(withBoth, WAVE5_DEPS, "acceleration")).toBe(0);
  });

  it("29029.rule-by-force-constant: while Lucia von Bardas is not in play, gains an acceleration icon (not hazard)", () => {
    const base = ironheartVsRhino(1);
    expect(iconsInPlay(base, WAVE5_DEPS, "acceleration")).toBe(0);
    const withRuleOnly = nemesisCardInPlay(base, "29029").state;
    expect(iconsInPlay(withRuleOnly, WAVE5_DEPS, "acceleration")).toBe(1);
    expect(iconsInPlay(withRuleOnly, WAVE5_DEPS, "hazard")).toBe(0);
  });
});

describe("Lucia von Bardas (29030, nemesis minion)", () => {
  it("29030.lucia-von-bardas-constant: gets +1 SCH and +1 ATK only while she has a tough status card", () => {
    const { state, id } = nemesisCardInPlay(ironheartVsRhino(1), "29030");
    expect(statBonus(state, WAVE5_DEPS, id, "sch")).toBe(0);
    expect(statBonus(state, WAVE5_DEPS, id, "atk")).toBe(0);
    const toughened = patchInstance(state, id, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    expect(statBonus(toughened, WAVE5_DEPS, id, "sch")).toBe(1);
    expect(statBonus(toughened, WAVE5_DEPS, id, "atk")).toBe(1);
  });

  it("29030.lucia-von-bardas-forced-response: gets a tough status card after the villain phase ends", () => {
    const { state, id } = nemesisCardInPlay(ironheartVsRhino(1), "29030");
    expect(inst(state, id).statuses.tough).toBe(0);
    const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, id).statuses.tough).toBeGreaterThanOrEqual(1);
  });
});

describe("Cyborg Tech (29031, attachment)", () => {
  it("29031.cyborg-tech-constant-2: attaches to the minion with the most traits, giving it +3 hit points and retaliate 1", () => {
    // Unengaged so her own natural activation this same villain phase can't confound the assertions below.
    const { state, id: lucia } = nemesisCardInPlay(ironheartVsRhino(1), "29030", P1, { engaged: false }); // 3 traits: CRIMINAL, CYBORG, ELITE.
    const baseHp = maxHitPoints(state, lucia, WAVE5_DEPS);
    // Cyborg Tech (29031) is set aside as part of the nemesis set, not shuffled into the shared encounter deck —
    // `stageNemesisCardForReveal` (the `wave5/nova/obligation-nemesis.test.ts` precedent) stacks it there for its
    // own reveal.
    const staged = stageNemesisCardForReveal(state, "29031", P1);
    const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(revealed, lucia).attachments.length).toBeGreaterThanOrEqual(1);
    const cyborgTech = instancesOf(revealed, "29031").find((id) => inst(revealed, id).attachedTo === lucia);
    expect(cyborgTech).toBeDefined();
    expect(maxHitPoints(revealed, lucia, WAVE5_DEPS)).toBe((baseHp ?? 0) + 3);
    expect(keywordTotal(revealed, lucia, "retaliate", WAVE5_DEPS)).toBe(1);
    const deckId = Object.keys(revealed.encounterDecks)[0]!;
    expect(revealed.encounterDecks[deckId]!.discard).not.toContain(cyborgTech);
  });

  it("29031.cyborg-tech-constant: with no minion in play to attach to, gains surge and is discarded instead", () => {
    const staged = stageNemesisCardForReveal(ironheartVsRhino(2), "29031", P1);
    const { events, state: revealed } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const cyborgTech = instancesOf(revealed, "29031").find((id) => inst(revealed, id).attachedTo === null);
    expect(cyborgTech).toBeDefined();
    const deckId = Object.keys(revealed.encounterDecks)[0]!;
    expect(revealed.encounterDecks[deckId]!.discard).toContain(cyborgTech);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === cyborgTech)).toBe(true);
  });
});

describe("Political Retribution (29032, treachery, qty 2)", () => {
  it("29032.when-revealed: Lucia von Bardas schemes when she's in play, and Rule by Force stays untouched when it's not in play", () => {
    const { state, id: lucia } = nemesisCardInPlay(ironheartVsRhino(1), "29030", P1, { engaged: false });
    const staged = stageNemesisCardForReveal(state, "29032", P1);
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const schemed = events.find(
      (e): e is Extract<GameEvent, { type: "schemeResolved" }> =>
        e.type === "schemeResolved" && e.enemyInstanceId === lucia,
    );
    expect(schemed).toBeDefined();
    expect(schemed!.baseSch).toBe(2); // printed SCH 2, no tough bonus yet.
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
  });

  it("29032.when-revealed: places 3 threat on Rule by Force when it's in play, and Lucia von Bardas does not scheme when she's not in play", () => {
    const { state, id: ruleByForce } = nemesisCardInPlay(ironheartVsRhino(2), "29029");
    const before = inst(state, ruleByForce).threat;
    const staged = stageNemesisCardForReveal(state, "29032", P1);
    const { events, state: revealed } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    expect(inst(revealed, ruleByForce).threat).toBe(before + 3);
    // Lucia von Bardas is never put into play in this state (only Rule by Force is; she's still set aside), so no
    // `schemeResolved` event can possibly name her own instance — the villain's own natural activation (which
    // schemes rather than attacks while P1 is in alter-ego form) still fires, but that's an unrelated mechanic,
    // not this ability's own effect.
    expect(instancesOf(revealed, "29030").some((id) => cardsInPlay(revealed).includes(id))).toBe(false);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
  });

  it("29032.when-revealed: with both Lucia von Bardas and Rule by Force in play, she schemes AND 3 threat is placed on it (independent clauses, not if/else-if), and no surge", () => {
    const withLucia = nemesisCardInPlay(ironheartVsRhino(1), "29030", P1, { engaged: false });
    const withBoth = nemesisCardInPlay(withLucia.state, "29029");
    const lucia = withLucia.id;
    const ruleByForce = withBoth.id;
    const threatBefore = inst(withBoth.state, ruleByForce).threat;
    const staged = stageNemesisCardForReveal(withBoth.state, "29032", P1);
    const { events, state: revealed } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const schemed = events.find(
      (e): e is Extract<GameEvent, { type: "schemeResolved" }> =>
        e.type === "schemeResolved" && e.enemyInstanceId === lucia,
    );
    expect(schemed).toBeDefined();
    expect(inst(revealed, ruleByForce).threat).toBe(threatBefore + 3);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
  });

  it("29032.when-revealed: with neither Lucia von Bardas nor Rule by Force in play, gains surge", () => {
    const staged = stageNemesisCardForReveal(ironheartVsRhino(3), "29032", P1);
    const { events } = driveEvents(WAVE5_DEPS, staged, endTurn(P1));
    const [politicalRetribution] = instancesOf(staged, "29032");
    expect(politicalRetribution).toBeDefined();
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === politicalRetribution)).toBe(true);
  });
});
