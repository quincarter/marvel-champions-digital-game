import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import { traitsOf, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { driveEventsPicking, stageNemesisCardForReveal } from "../../testing/staging.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenario } from "./support.js";

const spdrVsRhino = (seed = 1) => startWave5Game(spdrScenario("rhino", { seed }));

// "Advance" (01186, "When Revealed: The villain schemes.") — a neutral filler that soaks up the lone-player Rhino
// villain phase's own scheme-step reveal, leaving the *next* stacked card as the one drawn for Rhino's attack boost
// (`wave5/spiderham/obligation-nemesis.test.ts`'s own `ADVANCE`/`stackEncounterDeck` precedent for staging an
// obligation, which — unlike a nemesis-set card — is shuffled into the shared encounter deck, not set aside).
const ADVANCE = "01186";
const stageObligationForReveal = (state: GameState, code: string): GameState =>
  stackEncounterDeck(state, ADVANCE, code);

/** Moves a still-set-aside nemesis-set card straight into `player`'s own play area (`wave5/spiderham/
 * obligation-nemesis.test.ts`'s own `nemesisCardInPlay` helper — not exported from the shared `testing/staging.ts`,
 * so every obligation-nemesis test file carries its own copy). `engaged: false` keeps a minion from taking its own
 * natural villain-phase activation; a side scheme has no such activation, so the flag is simply ignored for one. */
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

/** A basic thwart from the identity against `target`, readying it first (`wave5/spiderham/obligation-nemesis.test.ts`'s
 * `thwart` precedent), with a caller-supplied picker for any cost prompt the thwart raises. */
function thwartPaying(
  state: GameState,
  target: InstanceId,
  pick: Picker,
  player: PlayerId = P1,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const identity = identityOf(state, player);
  const readied = patchInstance(state, identity, { exhausted: false });
  return driveEventsPicking(WAVE5_DEPS, readied, pick, toHero(player), {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: identity,
    schemeInstanceId: target,
  });
}

/** Fully pays any `spendResources` prompt offered (every option), otherwise `firstLegal` — the engine's own
 * `additional-thwart-cost.test.ts`/`resources-generated.test.ts` `payAll` precedent, ported to the card harness's
 * `Picker` shape. */
const payAll: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "spendResources") return choice.options.map((o) => o.optionId);
  return firstLegal(state);
};

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else
 * (`wave5/spiderham/obligation-nemesis.test.ts`'s own `pickingLabelStartingWith` precedent). */
function pickingLabelStartingWith(prefix: string): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };
}

/** Plays `code` from a known instance already in hand, paying with exactly `payerCode` — deterministic, unlike
 * `testing/staging.ts`'s own `playFromHand` (which pays with whatever `payWith`'s blind hand-order slice lands on),
 * so the payer's printed resource icon is guaranteed to match what the played card's cost actually needs. */
function playPayingWith(
  state: GameState,
  code: string,
  payerCode: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const given = moveToHand(state, player, code);
  const [playedId] = given.ids as [InstanceId];
  const paying = moveToHand(given.state, player, payerCode);
  const [payerId] = paying.ids as [InstanceId];
  return driveEventsPicking(WAVE5_DEPS, paying.state, firstLegal, play(player, playedId, [payerId]));
}

describe("Inherited Burden (31025, obligation)", () => {
  it("31025.obligation: exhausting Peni Parker removes it from the game", () => {
    const base = spdrVsRhino(1);
    const identity = identityOf(base, P1);
    expect(inst(base, identity).exhausted).toBe(false); // alter-ego, ready, at setup (RRG 1.8 Appendix II step 1).
    const staged = stageObligationForReveal(base, "31025");
    const revealed = settle(
      runWave5(staged, endTurn(P1)),
      pickingLabelStartingWith("Exhaust Peni Parker"),
      undefined,
      WAVE5_DEPS,
    );
    const [obligation] = instancesOf(revealed, "31025");
    expect(obligation).toBeDefined();
    expect(revealed.removedFromGame).toContain(obligation);
    expect(inst(revealed, identity).exhausted).toBe(true);
  });

  it("31025.obligation: with no Interface upgrade in play, the discard option is unavailable — falls to exhaust instead", () => {
    const base = spdrVsRhino(2);
    const identity = identityOf(base, P1);
    const staged = stageObligationForReveal(base, "31025");
    // No Interface upgrade is in play this early (only the identity's own setup has run), so the "choose and
    // discard 1 Interface upgrade you control" option offers no legal target and is excluded outright (RRG 1.8
    // "Choose (Option)", p. 12) — `firstLegal` lands on the remaining exhaust branch.
    const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    const [obligation] = instancesOf(revealed, "31025");
    expect(obligation).toBeDefined();
    expect(revealed.removedFromGame).toContain(obligation);
    expect(inst(revealed, identity).exhausted).toBe(true);
  });
});

describe("Giant Monster Attack (31026, side scheme)", () => {
  it("31026.giant-monster-attack-constant: paying the additional [energy] cost lets the thwart remove threat", () => {
    const base = spdrVsRhino(1);
    const { state: withScheme, id: scheme } = nemesisCardInPlay(base, "31026", P1, { engaged: false });
    // `nemesisCardInPlay` is raw instance surgery, not the engine's own "put a side scheme into play" step, so it
    // never applies `startingThreat` (every instance starts at 0, `packages/engine/src/setup.ts`) — set the data's
    // own printed starting threat (4) directly, the `wave5/spiderham/obligation-nemesis.test.ts` precedent.
    const staged = patchInstance(withScheme, scheme, { threat: 4 });
    const withEnergy = moveToHand(staged, P1, "31016").state; // Repurpose: resourceIcons.energy 1.
    const { events, state: after } = thwartPaying(withEnergy, scheme, payAll);
    expect(events.some((e) => e.type === "thwartCostAsked")).toBe(true);
    expect(inst(after, scheme).threat).toBe(2); // SP//dr Suit's printed THW 2, additional cost paid.
  });

  it("31026.giant-monster-attack-constant: declining the additional cost cancels the thwart — no threat removed", () => {
    const base = spdrVsRhino(2);
    const { state: withScheme, id: scheme } = nemesisCardInPlay(base, "31026", P1, { engaged: false });
    const staged = patchInstance(withScheme, scheme, { threat: 4 });
    const withEnergy = moveToHand(staged, P1, "31016").state;
    const { state: after } = thwartPaying(withEnergy, scheme, firstLegal);
    expect(inst(after, scheme).threat).toBe(4); // unchanged: the cancelled thwart never resolved.
  });
});

describe("M.O.R.B.I.U.S. (31027, nemesis minion)", () => {
  it("31027.morbius-forced-response: in hero form, deals damage equal to the resources the engaged player generated", () => {
    const base = spdrVsRhino(1);
    const { state: withMorbius, id: morbius } = nemesisCardInPlay(base, "31027", P1, { engaged: true });
    expect(traitsOf(withMorbius, morbius, WAVE5_DEPS).map(String)).toContain("CREATURE");
    const hero = settle(runWave5(withMorbius, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    const identity = identityOf(hero, P1);
    const before = inst(hero, identity).damage;
    // 31024 "Unshakable" (cost 1, resourceIcons.physical 1) paid with 31023 (resourceIcons.physical 1): one hand
    // card spent as payment is one resource generated (RRG 1.8 "Cost", p. 13).
    const { events, state: after } = playPayingWith(hero, "31024", "31023");
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "resourcesGenerated")).toBe(true);
    expect(inst(after, identity).damage).toBe(before + 1);
  });

  it("31027.morbius-forced-response: in alter-ego form, the engaged player generating resources takes no damage (§4.1 Q24)", () => {
    const base = spdrVsRhino(2);
    const { state: withMorbius } = nemesisCardInPlay(base, "31027", P1, { engaged: true });
    expect(playerOf(withMorbius, P1).identity.form).toBe("alterEgo"); // Peni Parker, at setup — no `toHero` here.
    const identity = identityOf(withMorbius, P1);
    const before = inst(withMorbius, identity).damage;
    const { events, state: after } = playPayingWith(withMorbius, "31024", "31023");
    // It still generated a resource (Q5 doesn't apply — this is a hand card, not a spent toon counter) …
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "resourcesGenerated")).toBe(true);
    // … but M.O.R.B.I.U.S. dealt no damage for it, since the engaged player is in alter-ego form (§4.1 Q24).
    expect(inst(after, identity).damage).toBe(before);
  });
});

describe("Energy Drain (31028, treachery, quantity 3)", () => {
  it("31028.when-revealed-alter-ego: paying [energy][energy] avoids the exhaust", () => {
    const base = spdrVsRhino(1);
    const identity = identityOf(base, P1);
    const withEnergy = moveToHand(base, P1, "31016", "31016").state;
    const staged = stageNemesisCardForReveal(withEnergy, "31028", P1);
    const { state: revealed } = driveEventsPicking(WAVE5_DEPS, staged, payAll, endTurn(P1));
    expect(inst(revealed, identity).exhausted).toBe(false);
  });

  it("31028.when-revealed-alter-ego: declining exhausts your identity instead", () => {
    const base = spdrVsRhino(2);
    const identity = identityOf(base, P1);
    expect(inst(base, identity).exhausted).toBe(false);
    const withEnergy = moveToHand(base, P1, "31016", "31016").state;
    const staged = stageNemesisCardForReveal(withEnergy, "31028", P1);
    const { state: revealed } = driveEventsPicking(WAVE5_DEPS, staged, firstLegal, endTurn(P1));
    expect(inst(revealed, identity).exhausted).toBe(true);
  });

  // Once in hero form, ending the turn runs the real Rhino villain phase, which attacks the lone player for its
  // own incidental damage before Energy Drain's own reveal — so these two tests read the damage *this card's own
  // instance dealt* off `damageDealt.sourceInstanceId`, not a raw before/after total (which Rhino's own attack
  // would also move).
  const dealtBy = (events: readonly GameEvent[], source: InstanceId) =>
    events
      .filter((e): e is Extract<GameEvent, { type: "damageDealt" }> => e.type === "damageDealt")
      .filter((e) => e.sourceInstanceId === source)
      .reduce((sum, e) => sum + e.amount, 0);

  it("31028.when-revealed-hero: paying [energy][energy] avoids the 3 damage", () => {
    const base = spdrVsRhino(3);
    const hero = settle(runWave5(base, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    const treachery = playerOf(hero, P1).setAside.find((i) => hero.instances[i]?.cardId === cardId("31028"))!;
    const withEnergy = moveToHand(hero, P1, "31016", "31016").state;
    const staged = stageNemesisCardForReveal(withEnergy, "31028", P1);
    const { events } = driveEventsPicking(WAVE5_DEPS, staged, payAll, endTurn(P1));
    expect(dealtBy(events, treachery)).toBe(0);
  });

  it("31028.when-revealed-hero: declining deals 3 damage instead", () => {
    const base = spdrVsRhino(4);
    const hero = settle(runWave5(base, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    const treachery = playerOf(hero, P1).setAside.find((i) => hero.instances[i]?.cardId === cardId("31028"))!;
    const withEnergy = moveToHand(hero, P1, "31016", "31016").state;
    const staged = stageNemesisCardForReveal(withEnergy, "31028", P1);
    const { events } = driveEventsPicking(WAVE5_DEPS, staged, firstLegal, endTurn(P1));
    expect(dealtBy(events, treachery)).toBe(3);
  });
});
