import { PLAYABLE_CARDS, cardId } from "@mc/content";
import { characterProfile, createGame, iconsOn, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { coreScenario } from "../../core/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { WAVE11_DEPS } from "../index.js";
import { wave11Scenario } from "../setup.js";
import {
  SHADOWLAND_SHADOWS_IN_THE_NIGHT as REGISTRY,
  SHADOWLAND_SHADOWS_IN_THE_NIGHT_SKIPPED as SKIPPED,
} from "./shadows-in-the-night.js";

/**
 * Shadows in the Night (MC65): the position environments, Black Tarantula, Strategic Positioning, Chaos in Hell's
 * Kitchen and Moonlit Silhouette (docs/phase7-shadowland.md section 6, M1). The pack is gated (UNSCRIPTED), so each
 * game is built directly: Core's Spider-Man (and a second hero with two seats) against Rhino, with the two position
 * environments taken out of the encounter deck into the villain area (both on The Streets Below, so the positions are
 * the same). Reveals run through a real villain phase on a stacked encounter deck: Advance (01186) prints no boost
 * icon, so it is the blank filler for the villain's own boost card.
 */
const V_ENV = "65003a";
const H_ENV = "65004a";
const TARANTULA = "65005";
const GHOST_MAKER = "65006";
const SEALED = "65007";
const SURROUND = "65009";
const MAIN_SCHEME = "65001a";
const STRATEGIC = "65008";
const CHAOS = "65010";
const MOONLIT = "65011";
const BLANK = "01186";
const AERIAL_ALLY = "53002";
const ORDINARY_ALLY = "01002";
const CHANGED = "positionChanged";
const SPIDER = { starterDeckId: "core-spider-man-justice" };
const MARVEL = { starterDeckId: "core-captain-marvel-leadership" };
const POOL_CODES = [MAIN_SCHEME, V_ENV, H_ENV, TARANTULA, GHOST_MAKER, SEALED, STRATEGIC, SURROUND, CHAOS, MOONLIT];
const VILLAIN_FIRST = "65003a.the-streets-below-constant";
const HERO_A = "65004a.the-streets-below-constant";
const HERO_B = "65004b.atop-the-tenshu-constant";

const REFS = [
  "65001a.setup",
  "65001b.a-barricade-of-blades-constant",
  "65001b.a-barricade-of-blades-forced-interrupt",
  "65001b.a-barricade-of-blades-constant-2",
  "65002a.fortress-lockdown-constant",
  "65002a.fortress-lockdown-constant-2",
  "65002a.when-revealed",
  "65002b.fortress-lockdown-constant",
  "65002b.fortress-lockdown-forced-interrupt",
  "65002b.fortress-lockdown-constant-2",
  "65006.when-defeated",
  "65006.boost",
  "65007.when-defeated",
  "65009.when-revealed",
  "65003a.the-streets-below-constant",
  "65003a.the-streets-below-constant-2",
  "65003a.the-streets-below-constant-3",
  "65003b.atop-the-tenshu-constant",
  "65003b.atop-the-tenshu-constant-2",
  "65003b.atop-the-tenshu-constant-3",
  "65004a.the-streets-below-constant",
  "65004a.the-streets-below-constant-2",
  "65004a.the-streets-below-constant-3",
  "65004a.the-streets-below-constant-4",
  "65004b.atop-the-tenshu-constant",
  "65004b.atop-the-tenshu-constant-2",
  "65004b.atop-the-tenshu-constant-3",
  "65004b.atop-the-tenshu-constant-4",
  "65005.when-revealed",
  "65008.strategic-positioning-constant",
  "65008.strategic-positioning-constant-2",
  "65010.when-revealed",
  "65010.boost",
  "65011.when-revealed-alter-ego",
  "65011.when-revealed-hero",
];

const data = (code: string) => PLAYABLE_CARDS.find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const labelOf = (o: unknown): string => String((o as { label?: string }).label ?? "");

interface Table {
  state: GameState;
  vPos: InstanceId;
  hPos: InstanceId;
}
/** Hero form, both position environments in the villain area on their Streets Below face, `extra` cards in the deck. */
function newGame(seats: readonly { starterDeckId: string }[] = [SPIDER], extra: readonly string[] = []): Table {
  const base = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    {
      ...base,
      encounterDeck: [
        ...base.encounterDeck,
        ...[V_ENV, H_ENV, ...extra, ...Array<string>(8).fill(BLANK)].map((c) => cardId(c)),
      ],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  const v = encounterCardInVillainArea(state, V_ENV);
  const h = encounterCardInVillainArea(v.state, H_ENV);
  state = h.state;
  seats.forEach((_, i) => {
    state = withForm(state, { heroForm: 0 }, [P1, P2][i]);
  });
  return { state, vPos: v.id, hPos: h.id };
}
const flip = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { flipped: !inst(s, id).flipped });
/** The villain position already changed this phase (the marker the change leaves). */
const alreadyChanged = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { counters: { ...inst(s, id).counters, [CHANGED]: 1 } });
const atop = (s: GameState, id: InstanceId): boolean => inst(s, id).flipped === true;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
/** Test surgery: ally `code` put straight into P1's play area (no play, no reveal), ready, under the id `slot`. */
function allyInPlay(state: GameState, code: string, slot: string): { state: GameState; id: InstanceId } {
  const id = slot as InstanceId;
  const instance = {
    instanceId: id,
    cardId: code,
    ownerId: P1,
    controllerId: P1,
    home: { kind: "playArea", playerId: P1 },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  } as never;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}
const inPlayArea = (s: GameState, id: InstanceId): boolean => s.players[0]!.playArea.includes(id);
const handSize = (s: GameState): number => s.players.find((p) => p.playerId === P1)!.hand.length;

/** The villain phase after `endTurn` for every player, on the deck stacked with a blank boost then `codes`. */
function reveal(state: GameState, codes: readonly string[], players: readonly PlayerId[] = [P1]) {
  const stacked = stackEncounterDeck(state, BLANK, ...codes, BLANK, BLANK, BLANK);
  return driveEventsPicking(WAVE11_DEPS, stacked, firstLegal, ...players.map((p) => endTurn(p)));
}
/** At a `chooseOne`, the option whose label matches; at a payment, these hand cards; otherwise the fewest legal. */
const choosing =
  (re: RegExp, pay: readonly InstanceId[] = []): Picker =>
  (s) => {
    const prompt = s.pendingChoice!.prompt.kind;
    if (prompt === "spendResources") return pay.map((i) => `hand:${i}`);
    const hit = s.pendingChoice!.options.filter((o) => re.test(labelOf(o)));
    return hit.length > 0 ? [hit[0]!.optionId as string] : firstLegal(s);
  };

describe("registry", () => {
  const printed = POOL_CODES.flatMap((c) => abilityRefIds(data(c))).sort();
  it("registers every printed ref of the ten cards; nothing is skipped", () => {
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(printed)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
  it("carries the printed timing", () => {
    expect(REGISTRY[HERO_A]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY["65005.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(REGISTRY["65010.boost"]!.trigger).toMatchObject({ kind: "boost" });
  });
});

describe("The Streets Below / Atop the Tenshu, villain position (65003a, 65003b)", () => {
  it("same positions: each character gets +1 ATK; different: it does not (control)", () => {
    const same = newGame();
    const heroAtk = profile(same.state, identityOf(same.state)).atk;
    const villainAtk = profile(same.state, villainOf(same.state)).atk;
    const diff = flip(same.state, same.vPos);
    expect(profile(diff, identityOf(diff)).atk).toBe(heroAtk - 1);
    expect(profile(diff, villainOf(diff)).atk).toBe(villainAtk - 1);
    // Both Atop the Tenshu (the 65003b / 65004b faces) are the same again.
    const bothAtop = flip(diff, same.hPos);
    expect(profile(bothAtop, identityOf(bothAtop)).atk).toBe(heroAtk);
  });

  it("different positions: damage from each attack is reduced by 1; same positions: it is not (control)", () => {
    const same = newGame();
    const hit = (s: GameState) =>
      inst(
        applyOk(
          s,
          { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: villainOf(s) },
          WAVE11_DEPS,
        ).state,
        villainOf(s),
      ).damage;
    const atk = profile(same.state, identityOf(same.state)).atk;
    expect(hit(same.state)).toBe(atk);
    expect(hit(flip(same.state, same.vPos))).toBe(atk - 1 - 1);
  });

  it("different positions: threat cannot be removed from the main scheme; same positions: it can (control)", () => {
    const same = newGame();
    const staged = patchInstance(same.state, same.state.mainScheme!.instanceId, { threat: 5 });
    const thwart = (s: GameState) =>
      mainThreat(
        applyOk(
          s,
          {
            type: "basicThwart",
            playerId: P1,
            thwarterInstanceId: identityOf(s),
            schemeInstanceId: s.mainScheme!.instanceId,
          },
          WAVE11_DEPS,
        ).state,
      );
    expect(thwart(staged)).toBeLessThan(5);
    expect(() => thwart(flip(staged, same.vPos))).toThrow(/cannot remove threat/);
  });

  it("the Atop the Tenshu face (65003b) carries the same three rules", () => {
    expect(Object.keys(REGISTRY).filter((k) => k.startsWith("65003b."))).toHaveLength(3);
    expect(REGISTRY["65003b.atop-the-tenshu-constant"]).toEqual(REGISTRY[VILLAIN_FIRST]);
  });
});

describe("The Streets Below / Atop the Tenshu, hero position (65004a, 65004b)", () => {
  const act = (t: Table, state: GameState, pick: Picker, id = HERO_A) =>
    driveEventsPicking(WAVE11_DEPS, state, pick, use(P1, t.hPos, id));
  const handOf = (s: GameState, ...codes: string[]) => {
    const emptied: GameState = {
      ...s,
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], discard: [...p.discard, ...p.hand] } : p)),
    };
    return moveToHand(emptied, P1, ...codes);
  };
  /** `n` cards in P1's deck or hand that show exactly one printed `type` resource and nothing else (distinct copies). */
  const onlyOf = (state: GameState, type: string, n: number): string[] => {
    const p = state.players.find((x) => x.playerId === P1)!;
    const found: string[] = [];
    for (const i of [...p.hand, ...p.deck]) {
      const code = codeOf(state, i);
      const icons = (data(code) as any).resourceIcons ?? {};
      const single = icons[type] === 1 && Object.entries(icons).every(([k, v]) => k === type || !v);
      const taken = found.filter((c) => c === code).length;
      const copies = [...p.hand, ...p.deck].filter((x) => codeOf(state, x) === code).length;
      if (single && taken < copies && found.length < n) found.push(code);
    }
    expect(found).toHaveLength(n);
    return found;
  };

  it("offers the Aerial effect only when there is an Aerial character to exhaust", () => {
    const t = newGame();
    const labels = (state: GameState) =>
      applyOk(state, use(P1, t.hPos, HERO_A), WAVE11_DEPS).state.pendingChoice!.options.map(labelOf);
    expect(labels(t.state)).toEqual([
      "Place 3 threat on the main scheme and stun your identity",
      "Spend physical physical resources",
    ]);
    expect(labels(allyInPlay(t.state, AERIAL_ALLY, "aerial-ally").state)).toEqual([
      "Place 3 threat on the main scheme and stun your identity",
      "Spend physical physical resources",
      "Spend 1 resource of any type and exhaust an Aerial character you control",
    ]);
  });

  it("3 threat and stun: both happen, then the card flips (so the positions now differ)", () => {
    const t = newGame();
    const r = act(t, t.state, choosing(/Place 3 threat/));
    expect(mainThreat(r.state)).toBe(mainThreat(t.state) + 3);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(1);
    expect(atop(r.state, t.hPos)).toBe(true);
    expect(profile(r.state, identityOf(r.state)).atk).toBe(profile(t.state, identityOf(t.state)).atk - 1);
  });

  it("FAQ p. 18: with the identity already stunned, the threat is placed but the card does not flip", () => {
    const t = newGame();
    const stunned = patchInstance(t.state, identityOf(t.state), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const r = act(t, stunned, choosing(/Place 3 threat/));
    expect(mainThreat(r.state)).toBe(mainThreat(t.state) + 3);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(1);
    expect(atop(r.state, t.hPos)).toBe(false);
  });

  it("2 physical resources: spent from the hand, then the card flips", () => {
    const t = newGame();
    const given = handOf(t.state, ...onlyOf(t.state, "physical", 2));
    const r = act(t, given.state, choosing(/Spend physical/, given.ids));
    expect(handSize(r.state)).toBe(0);
    expect(atop(r.state, t.hPos)).toBe(true);
  });

  it("Aerial option: spends a resource and exhausts the Aerial hero, then flips; without one the option is not offered", () => {
    const t = newGame();
    const given = handOf(t.state, ...onlyOf(t.state, "energy", 1));
    const ally = allyInPlay(given.state, AERIAL_ALLY, "aerial-ally");
    const r = act(t, ally.state, choosing(/Aerial/, given.ids));
    expect(inst(r.state, ally.id).exhausted).toBe(true);
    expect(handSize(r.state)).toBe(0);
    expect(atop(r.state, t.hPos)).toBe(true);

    // Controls: with no unexhausted Aerial character the option is not offered at all, and nothing is spent.
    const offered = (state: GameState) =>
      applyOk(state, use(P1, t.hPos, HERO_A), WAVE11_DEPS).state.pendingChoice?.options.map(labelOf) ?? [];
    const aerial = "Spend 1 resource of any type and exhaust an Aerial character you control";
    expect(offered(ally.state)).toContain(aerial);
    expect(offered(given.state)).not.toContain(aerial);
    const plain = allyInPlay(given.state, ORDINARY_ALLY, "plain-ally");
    expect(offered(plain.state)).not.toContain(aerial);
    const tired = patchInstance(ally.state, ally.id, { exhausted: true });
    expect(offered(tired)).not.toContain(aerial);
    expect(handSize(given.state)).toBe(1);
  });

  it("Atop the Tenshu: 3 damage to your identity, then flips back", () => {
    const t = newGame();
    const r = act(t, flip(t.state, t.hPos), choosing(/Deal 3 damage/), HERO_B);
    expect(damageOf(r.state)).toBe(3);
    expect(atop(r.state, t.hPos)).toBe(false);
  });

  it("Atop the Tenshu: 2 energy resources are spent, then the card flips", () => {
    const t = newGame();
    const given = handOf(flip(t.state, t.hPos), ...onlyOf(t.state, "energy", 2));
    const r = act(t, given.state, choosing(/Spend energy/, given.ids), HERO_B);
    expect(handSize(r.state)).toBe(0);
    expect(atop(r.state, t.hPos)).toBe(false);
  });

  it("Atop the Tenshu: discarding an ally or upgrade is offered only with one, and flips the card", () => {
    const t = newGame();
    const top = flip(t.state, t.hPos);
    const none = applyOk(top, use(P1, t.hPos, HERO_B), WAVE11_DEPS);
    expect(none.state.pendingChoice!.options.map(labelOf)).not.toContain("Discard an ally or upgrade you control");
    const placed = allyInPlay(top, ORDINARY_ALLY, "ally-to-discard");
    const withAlly = applyOk(placed.state, use(P1, t.hPos, HERO_B), WAVE11_DEPS);
    expect(withAlly.state.pendingChoice!.options.map(labelOf)).toContain("Discard an ally or upgrade you control");
    const r = act(t, placed.state, choosing(/Discard an ally/), HERO_B);
    expect(inPlayArea(r.state, placed.id)).toBe(false);
    expect(atop(r.state, t.hPos)).toBe(false);
  });

  it("is a First Player Action: the second player cannot use it, the first player can", () => {
    const t = newGame([SPIDER, MARVEL]);
    expect(() => applyOk(t.state, use(P2, t.hPos, HERO_A), WAVE11_DEPS)).toThrow();
    expect(() => applyOk(t.state, use(P1, t.hPos, HERO_A), WAVE11_DEPS)).not.toThrow();
  });
});

describe("Chaos in Hell's Kitchen (65010)", () => {
  it("changes the position; Atop the Tenshu then puts 2 threat on the main scheme (control: no change, take 2)", () => {
    const t = newGame([SPIDER], [CHAOS]);
    const changed = reveal(t.state, [CHAOS]);
    expect(atop(changed.state, t.vPos)).toBe(true);
    const control = reveal(alreadyChanged(t.state, t.vPos), [CHAOS]);
    expect(atop(control.state, t.vPos)).toBe(false);
    expect(mainThreat(changed.state) - mainThreat(control.state)).toBe(2);
    expect(damageOf(control.state) - damageOf(changed.state)).toBe(2);
  });

  it("from Atop the Tenshu it changes to The Streets Below and the hero takes 2 (control: already changed)", () => {
    const t = newGame([SPIDER], [CHAOS]);
    const top = flip(t.state, t.vPos);
    const changed = reveal(top, [CHAOS]);
    expect(atop(changed.state, t.vPos)).toBe(false);
    const control = reveal(alreadyChanged(top, t.vPos), [CHAOS]);
    expect(atop(control.state, t.vPos)).toBe(true);
    expect(damageOf(changed.state) - damageOf(control.state)).toBe(2);
    expect(mainThreat(control.state) - mainThreat(changed.state)).toBe(2);
  });

  it("changes the position only once a phase: a second reveal leaves it, and the marker is gone next phase", () => {
    const t = newGame([SPIDER, MARVEL], [CHAOS, CHAOS]);
    // Two heroes: the villain activates against each (a boost card apiece), then each is dealt a card.
    const r = reveal(t.state, [BLANK, CHAOS, CHAOS], [P1, P2]);
    // P1's flips Streets -> Atop; P2's finds it changed this phase, so it stays Atop and places 2 threat instead of
    // flipping back and taking 2 damage.
    const flips = (run: typeof r) =>
      run.events.filter((e) => e.type === "cardFlipped" && (e as { instanceId?: InstanceId }).instanceId === t.vPos);
    expect(flips(r)).toHaveLength(1);
    expect(atop(r.state, t.vPos)).toBe(true);
    expect(inst(r.state, t.vPos).counters[CHANGED] ?? 0).toBe(0);
    // The next villain phase (P2 is first player now): the marker is gone, so a card can change it back.
    const next = reveal(r.state, [BLANK, BLANK, CHAOS, BLANK], [P2, P1]);
    expect(atop(next.state, t.vPos)).toBe(false);
  });

  it("Boost: resolves its When Revealed (changes the position) when it boosts the villain's attack", () => {
    const t = newGame([SPIDER], [CHAOS]);
    const stacked = stackEncounterDeck(t.state, CHAOS, BLANK, BLANK, BLANK);
    const r = driveEventsPicking(WAVE11_DEPS, stacked, firstLegal, endTurn(P1));
    expect(atop(r.state, t.vPos)).toBe(true);
    // Control: a blank boost card changes nothing.
    const blank = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(t.state, BLANK, BLANK, BLANK, BLANK),
      firstLegal,
      endTurn(P1),
    );
    expect(atop(blank.state, t.vPos)).toBe(false);
  });
});

describe("Moonlit Silhouette (65011)", () => {
  it("Alter-Ego: changes the position and you are confused (control: confused anyway, position unchanged)", () => {
    const t = newGame([SPIDER], [MOONLIT]);
    const ae = withForm(t.state, "alterEgo");
    const r = reveal(ae, [MOONLIT]);
    expect(atop(r.state, t.vPos)).toBe(true);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(1);
    const control = reveal(alreadyChanged(ae, t.vPos), [MOONLIT]);
    expect(atop(control.state, t.vPos)).toBe(false);
    expect(inst(control.state, identityOf(control.state)).statuses.confused).toBe(1);
    // Control: without the card nobody is confused.
    const none = reveal(ae, [BLANK]);
    expect(inst(none.state, identityOf(none.state)).statuses.confused).toBe(0);
  });

  it("Alter-Ego with 2 players: only the player it was dealt to is confused", () => {
    const t = newGame([SPIDER, MARVEL], [MOONLIT]);
    const ae = withForm(t.state, "alterEgo", P2);
    const r = reveal(ae, [BLANK, BLANK, MOONLIT], [P1, P2]);
    expect(inst(r.state, identityOf(r.state, P2)).statuses.confused).toBe(1);
    expect(inst(r.state, identityOf(r.state, P1)).statuses.confused).toBe(0);
    expect(atop(r.state, t.vPos)).toBe(true);
  });

  it("Hero: Atop the Tenshu the villain schemes, otherwise it attacks you; it never changes the position", () => {
    const t = newGame([SPIDER], [MOONLIT]);
    // Both position cards move together, so the positions stay the same and only the printed branch differs.
    const streets = t.state;
    const tenshu = flip(flip(t.state, t.vPos), t.hPos);
    const count = (r: { state: GameState; events: readonly { type: string }[] }, type: string) =>
      r.events.filter(
        (e) => e.type === type && (e as { enemyInstanceId?: InstanceId }).enemyInstanceId === villainOf(r.state),
      ).length;
    const onStreets = reveal(streets, [MOONLIT]);
    const onTop = reveal(tenshu, [MOONLIT]);
    // Controls: the same table with a different card dealt (Advance: the villain schemes; nothing attacks).
    const controlStreets = reveal(streets, [BLANK]);
    const controlTop = reveal(tenshu, [BLANK]);
    expect([atop(onStreets.state, t.vPos), atop(onTop.state, t.vPos)]).toEqual([false, true]);
    expect(count(onStreets, "attackResolved")).toBe(count(controlStreets, "attackResolved") + 1);
    expect(count(onStreets, "schemeResolved")).toBe(count(controlStreets, "schemeResolved") - 1);
    expect(count(onTop, "schemeResolved")).toBe(count(controlTop, "schemeResolved") + 0);
    expect(count(onTop, "attackResolved")).toBe(count(controlTop, "attackResolved"));
  });
});

describe("Black Tarantula (65005)", () => {
  const tarantula = (s: GameState): InstanceId =>
    (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === TARANTULA)!;
  it("is a Guard minion", () => {
    expect((data(TARANTULA) as any).keywords).toContainEqual({ name: "guard" });
  });

  it("changed to Atop the Tenshu: attacks you, and nobody is made tough", () => {
    const t = newGame([SPIDER], [TARANTULA]);
    const r = reveal(t.state, [TARANTULA]);
    const bt = tarantula(r.state);
    expect(atop(r.state, t.vPos)).toBe(true);
    expect(inst(r.state, bt).statuses.tough).toBe(0);
    expect(inst(r.state, villainOf(r.state)).statuses.tough).toBe(0);
    // Control: already changed (still The Streets Below): no attack, both made tough.
    const c = reveal(alreadyChanged(t.state, t.vPos), [TARANTULA]);
    expect(inst(c.state, tarantula(c.state)).statuses.tough).toBe(1);
    expect(inst(c.state, villainOf(c.state)).statuses.tough).toBe(1);
    // Black Tarantula's attack lands after the change, so the positions differ and its damage is reduced by 1.
    expect(damageOf(r.state) - damageOf(c.state)).toBe(profile(r.state, bt).atk - 1);
  });

  it("changed to The Streets Below: the villain and Black Tarantula each get a tough status card", () => {
    const t = newGame([SPIDER], [TARANTULA]);
    const r = reveal(flip(t.state, t.vPos), [TARANTULA]);
    expect(atop(r.state, t.vPos)).toBe(false);
    expect(inst(r.state, tarantula(r.state)).statuses.tough).toBe(1);
    expect(inst(r.state, villainOf(r.state)).statuses.tough).toBe(1);
  });

  it("already changed this phase while Atop the Tenshu: stays there and attacks", () => {
    const t = newGame([SPIDER], [TARANTULA]);
    const top = alreadyChanged(flip(t.state, t.vPos), t.vPos);
    const r = reveal(top, [TARANTULA]);
    expect(atop(r.state, t.vPos)).toBe(true);
    expect(inst(r.state, tarantula(r.state)).statuses.tough).toBe(0);
    expect(damageOf(r.state)).toBeGreaterThan(damageOf(reveal(top, [BLANK]).state));
  });
});

describe("Strategic Positioning (65008)", () => {
  it("gains an acceleration icon on The Streets Below and a hazard icon Atop the Tenshu", () => {
    const t = newGame([SPIDER], [STRATEGIC]);
    const placed = encounterCardInVillainArea(t.state, STRATEGIC);
    const icons = (s: GameState, icon: "acceleration" | "hazard") => iconsOn(s, WAVE11_DEPS, placed.id, icon);
    expect([icons(placed.state, "acceleration"), icons(placed.state, "hazard")]).toEqual([1, 0]);
    const top = flip(placed.state, t.vPos);
    expect([icons(top, "acceleration"), icons(top, "hazard")]).toEqual([0, 1]);
    // The hero position environment does not count: only the VILLAIN POSITION card.
    const heroOnly = flip(placed.state, t.hPos);
    expect([icons(heroOnly, "acceleration"), icons(heroOnly, "hazard")]).toEqual([1, 0]);
  });
});

/**
 * Seeded games built through the scenario builder (the real 1A Setup: environments into play, the villain chosen
 * by card). Archpriestess (65012a, 15 hit points a hero on side A, 18 on side B).
 */
function sitnGame(options: { difficulty?: "standard" | "expert"; seats?: readonly { starterDeckId: string }[] } = {}) {
  const seats = options.seats ?? [SPIDER];
  const config = wave11Scenario("shadows-in-the-night", {
    players: seats,
    seed: 11,
    villainCardId: "65012a",
    ...(options.difficulty ? { difficulty: options.difficulty } : {}),
  });
  const created = createGame(config, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  seats.forEach((_, i) => {
    state = withForm(state, { heroForm: 0 }, [P1, P2][i]);
  });
  return state;
}
const positionCards = (s: GameState): { v: InstanceId; h: InstanceId } => {
  const envs = (Object.keys(s.instances) as InstanceId[]).filter((i) => [V_ENV, H_ENV].includes(codeOf(s, i)));
  const v = envs.find((i) => codeOf(s, i) === V_ENV)!;
  const h = envs.find((i) => codeOf(s, i) === H_ENV)!;
  return { v, h };
};
const hitPointsOf = (s: GameState, id: InstanceId): number => profile(s, id).maxHp;

describe("1A Setup (65001a): the position environments", () => {
  it("puts both The Streets Below environments into play on their Streets Below face, out of the deck", () => {
    const s = sitnGame();
    const { v, h } = positionCards(s);
    for (const id of [v, h]) {
      expect(s.villainArea).toContain(id);
      expect(inst(s, id).flipped ?? false).toBe(false);
      expect(Object.values(s.encounterDecks).some((d) => d.deck.includes(id) || d.discard.includes(id))).toBe(false);
    }
    expect(villainOf(s)).toBeDefined();
    expect(codeOf(s, villainOf(s))).toBe("65012a");
  });
});

describe("A Barricade of Blades / Fortress Lockdown (65001a): the villain's side A defeat and side B win", () => {
  const sideOf = (s: GameState): string => s.villains.find((v) => v.instanceId === villainOf(s))!.side;
  /** The hero's basic attack on the villain, which has `damage` on it already. */
  const strike = (s: GameState, damage: number) => {
    const hurt = patchInstance(patchInstance(s, villainOf(s), { damage }), identityOf(s), { exhausted: false });
    return driveEventsPicking(WAVE11_DEPS, hurt, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(hurt),
      targetInstanceId: villainOf(hurt),
    });
  };
  const dealt = (r: { events: readonly { type: string }[] }) =>
    r.events.filter((e) => e.type === "encounterCardDealt").length;

  it("the lethal attack flips the villain to side B instead, resets its hit points, changes the position, deals a card", () => {
    const s = sitnGame();
    const { v, h } = positionCards(s);
    expect(sideOf(s)).toBe("A");
    expect(hitPointsOf(s, villainOf(s))).toBe(15);
    const r = strike(s, 14);
    expect(r.state.outcome).toBeNull();
    expect(sideOf(r.state)).toBe("B");
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(hitPointsOf(r.state, villainOf(r.state))).toBe(18);
    expect(r.state.villains.find((x) => x.instanceId === villainOf(r.state))!.defeated).toBeFalsy();
    expect(atop(r.state, v)).toBe(true);
    expect(atop(r.state, h)).toBe(false);
    expect(dealt(r)).toBe(1);
    // Control: damage that is not lethal flips nothing.
    const soft = strike(s, 5);
    expect(sideOf(soft.state)).toBe("A");
    expect(atop(soft.state, v)).toBe(false);
    expect(dealt(soft)).toBe(0);
  });

  it("deals each player a facedown encounter card (2 players)", () => {
    const s = sitnGame({ seats: [SPIDER, MARVEL] });
    const r = strike(s, 29);
    expect(sideOf(r.state)).toBe("B");
    expect(dealt(r)).toBe(2);
  });

  it("the position change counts as this phase's: a position card then finds it changed", () => {
    const s = sitnGame();
    const { v } = positionCards(s);
    const r = strike(s, 14);
    expect(inst(r.state, v).counters[CHANGED]).toBe(1);
  });

  it("defeated on side B: the players win the game (control: side A is not a win)", () => {
    const s = sitnGame();
    const a = strike(s, 14);
    expect(a.state.outcome).toBeNull();
    // The hero position is flipped to match, so the positions are the same again and the attack hits for full.
    // Side B has Toughness, but the flip gave no tough status card: a villain turning over does not enter play (RRG
    // 1.8 "Toughness", p. 45; owner, docs/phase7-shadowland.md §5.1 question 10 = B, 2026-10-22).
    expect(inst(a.state, villainOf(a.state)).statuses.tough ?? 0).toBe(0);
    const bare = patchInstance(flip(a.state, positionCards(a.state).h), villainOf(a.state), {
      statuses: { stunned: 0, confused: 0, tough: 0 },
    });
    const b = strike(bare, 17);
    expect(b.state.outcome).toMatchObject({ result: "win" });
    // On side B the interrupt does not apply (the villain's real side is read): it is defeated, not flipped again,
    // and nobody is dealt a card.
    expect(sideOf(a.state)).toBe("B");
    expect(b.state.villains.find((v) => v.instanceId === villainOf(b.state))!.defeated).toBe(true);
    expect(dealt(b)).toBe(0);
  });

  it("expert mode: +3 hit points a hero, and +1 SCH on the villain (control: standard)", () => {
    const standard = sitnGame({ difficulty: "standard" });
    const expert = sitnGame({ difficulty: "expert" });
    const hp = (st: GameState) => hitPointsOf(st, villainOf(st));
    const sch = (st: GameState) => profile(st, villainOf(st)).sch;
    expect(hp(expert) - hp(standard)).toBe(3);
    expect(sch(expert) - sch(standard)).toBe(1);
    // Side B keeps the bonus: 18 + 3 for one hero.
    const flipped = strike(expert, 20);
    expect(sideOf(flipped.state)).toBe("B");
    expect(hp(flipped.state)).toBe(21);
  });
});

describe("Fortress Lockdown 2A (65002a.when-revealed)", () => {
  const find = (s: GameState, code: string): InstanceId =>
    (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
  /** A game one threat short of completing stage 1, the villain phase about to place it. */
  const nearlyComplete = (seats: readonly { starterDeckId: string }[] = [SPIDER]): GameState => {
    const s = sitnGame({ seats });
    return patchInstance(s, s.mainScheme!.instanceId, { threat: 7 * seats.length - 1 });
  };
  /** At the minion search, the card titled the next of `titles`; every other prompt takes the fewest legal. */
  const finding =
    (...titles: string[]): Picker =>
    (s) => {
      if (s.pendingChoice!.prompt.kind !== "chooseCards") return firstLegal(s);
      const title = titles.shift();
      if (title === undefined) return firstLegal(s);
      const hit = s.pendingChoice!.options.find((o) => labelOf(o) === title);
      if (!hit) throw new Error(`${title} is not offered: ${s.pendingChoice!.options.map(labelOf).join(", ")}`);
      return [hit.optionId as string];
    };
  const complete = (s: GameState, pick: Picker, players: readonly PlayerId[] = [P1]) =>
    driveEventsPicking(WAVE11_DEPS, s, pick, ...players.map((p) => endTurn(p)));
  const stageOf = (s: GameState): number => s.mainScheme!.stageIndex + 1;
  const inAPile = (s: GameState, id: InstanceId): boolean =>
    Object.values(s.encounterDecks).some((d) => d.deck.includes(id) || d.discard.includes(id));

  it("changes the villain's position, then the player searches the deck for a minion and reveals it", () => {
    const s = nearlyComplete();
    const { v } = positionCards(s);
    const ghost = find(s, GHOST_MAKER);
    expect(inAPile(s, ghost)).toBe(true);
    const r = complete(s, finding("Ghost Maker"));
    expect(stageOf(r.state)).toBe(2);
    expect(atop(r.state, v)).toBe(true);
    expect(inAPile(r.state, ghost)).toBe(false);
    // Control: without the stage change nothing is searched for.
    const quiet = complete(patchInstance(s, s.mainScheme!.instanceId, { threat: 0 }), finding());
    expect(stageOf(quiet.state)).toBe(1);
    expect(atop(quiet.state, v)).toBe(false);
    expect(inAPile(quiet.state, ghost)).toBe(true);
  });

  it("finds a minion in the discard pile too", () => {
    const s = nearlyComplete();
    const ghost = find(s, GHOST_MAKER);
    const deckId = Object.keys(s.encounterDecks).find((k) => s.encounterDecks[k]!.deck.includes(ghost))!;
    const pile = s.encounterDecks[deckId]!;
    const inDiscard: GameState = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== ghost), discard: [...pile.discard, ghost] },
      },
    };
    const r = complete(inDiscard, finding("Ghost Maker"));
    expect(inAPile(r.state, ghost)).toBe(false);
  });

  it("each of 2 players finds and reveals a minion; the position changes once", () => {
    const s = nearlyComplete([SPIDER, MARVEL]);
    const { v } = positionCards(s);
    const [ghost, tarantula] = [find(s, GHOST_MAKER), find(s, TARANTULA)];
    const r = complete(s, finding("Ghost Maker", "Black Tarantula"), [P1, P2]);
    expect(stageOf(r.state)).toBe(2);
    expect(inAPile(r.state, ghost) || inAPile(r.state, tarantula)).toBe(false);
    expect(
      r.events.filter((e) => e.type === "cardFlipped" && (e as { instanceId?: InstanceId }).instanceId === v),
    ).toHaveLength(1);
  });
});

const withCode = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const strikeIt = (s: GameState, target: InstanceId) =>
  driveEventsPicking(WAVE11_DEPS, patchInstance(s, identityOf(s), { exhausted: false }), firstLegal, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(s),
    targetInstanceId: target,
  });

describe("Ghost Maker (65006)", () => {
  /** Ghost Maker revealed (engaged with P1), then wounded to 1 hit point left so the next attack defeats him. */
  const wounded = (state: GameState): { state: GameState; id: InstanceId } => {
    const revealed = reveal(state, [GHOST_MAKER]).state;
    const id = withCode(revealed, GHOST_MAKER);
    return { state: patchInstance(revealed, id, { damage: 3 }), id };
  };

  it("defeated Atop the Tenshu: the position changes first, then you discard 1 card you control", () => {
    const t = newGame([SPIDER], [GHOST_MAKER]);
    const w = wounded(t.state);
    const ally = allyInPlay(w.state, ORDINARY_ALLY, "ally-to-discard");
    const before = damageOf(ally.state);
    const r = strikeIt(ally.state, w.id);
    expect(atop(r.state, t.vPos)).toBe(true);
    expect(inPlayArea(r.state, ally.id)).toBe(false);
    expect(damageOf(r.state)).toBe(before);
  });

  it("defeated otherwise (already changed this phase, still The Streets Below): 2 indirect damage, nothing discarded", () => {
    const t = newGame([SPIDER], [GHOST_MAKER]);
    const w = wounded(t.state);
    const ally = allyInPlay(alreadyChanged(w.state, t.vPos), ORDINARY_ALLY, "ally-to-keep");
    const r = strikeIt(ally.state, w.id);
    expect(atop(r.state, t.vPos)).toBe(false);
    expect(inPlayArea(r.state, ally.id)).toBe(true);
    // The indirect damage is assigned among the player's characters: 2 in all, on the hero and the ally.
    const taken = damageOf(r.state) + inst(r.state, ally.id).damage;
    expect(taken - (damageOf(ally.state) + inst(ally.state, ally.id).damage)).toBe(2);
  });

  it("Atop the Tenshu with nothing to discard: the discard simply does not happen", () => {
    const t = newGame([SPIDER], [GHOST_MAKER]);
    const w = wounded(t.state);
    const r = strikeIt(w.state, w.id);
    expect(atop(r.state, t.vPos)).toBe(true);
    expect(damageOf(r.state)).toBe(damageOf(w.state));
  });

  it("Boost: revealed (after the activation) when an ally defends against the attack", () => {
    const t = newGame([SPIDER], [GHOST_MAKER]);
    const ally = allyInPlay(t.state, ORDINARY_ALLY, "defending-ally");
    const defendWithAlly: Picker = (s) => {
      const c = s.pendingChoice!;
      const pick = c.options.find((o) => o.optionId === ally.id);
      return c.prompt.kind === "declareDefender" && pick ? [pick.optionId as string] : firstLegal(s);
    };
    const stacked = stackEncounterDeck(ally.state, GHOST_MAKER, BLANK, BLANK, BLANK);
    const run = driveEventsPicking(WAVE11_DEPS, stacked, defendWithAlly, endTurn(P1));
    const id = withCode(run.state, GHOST_MAKER);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    // Control: the hero defends, so Ghost Maker stays a boost card and is discarded.
    const control = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(t.state, GHOST_MAKER, BLANK, BLANK, BLANK),
      firstLegal,
      endTurn(P1),
    );
    expect(inst(control.state, withCode(control.state, GHOST_MAKER)).engagedWith ?? null).toBeNull();
  });
});

describe("Sealed Entrances (65007)", () => {
  const sealed = (state: GameState) => encounterCardInVillainArea(state, SEALED, 1);
  it("defeating it changes the villain's position (control: already changed this phase)", () => {
    const t = newGame([SPIDER], [SEALED]);
    const placed = sealed(t.state);
    const r = driveEventsPicking(
      WAVE11_DEPS,
      patchInstance(placed.state, identityOf(placed.state), { exhausted: false }),
      firstLegal,
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(placed.state),
        schemeInstanceId: placed.id,
      },
    );
    expect(inst(r.state, placed.id).threat).toBe(0);
    expect(atop(r.state, t.vPos)).toBe(true);
    const c = alreadyChanged(sealed(t.state).state, t.vPos);
    const rc = driveEventsPicking(WAVE11_DEPS, patchInstance(c, identityOf(c), { exhausted: false }), firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(c),
      schemeInstanceId: placed.id,
    });
    expect(atop(rc.state, t.vPos)).toBe(false);
  });

  it("Assault: a basic thwart against it uses ATK", () => {
    expect((data(SEALED) as any).keywords).toContainEqual({ name: "assault" });
  });
});

describe("Surround the Fortress (65009)", () => {
  /** The threat the card itself placed when revealed, as [scheme, amount] pairs (its own entering threat is no placement). */
  const placedBy = (run: ReturnType<typeof reveal>) => {
    const id = withCode(run.state, SURROUND);
    return run.events
      .filter((e) => e.type === "threatPlaced" && !(e as { entering?: true }).entering)
      .map((e) => e as unknown as { schemeInstanceId: InstanceId; amount: number; sourceInstanceId: InstanceId | null })
      .filter((e) => e.sourceInstanceId === id)
      .map((e) => [e.schemeInstanceId, e.amount] as const);
  };
  it("changed to Atop the Tenshu: 1 threat a hero on the main scheme, none here", () => {
    const t = newGame([SPIDER], [SURROUND]);
    const run = reveal(t.state, [SURROUND]);
    expect(atop(run.state, t.vPos)).toBe(true);
    expect(placedBy(run)).toEqual([[run.state.mainScheme!.instanceId, 1]]);
  });

  it("not changed (already changed this phase, Streets Below): 1 threat a hero on this scheme instead", () => {
    const t = newGame([SPIDER], [SURROUND]);
    const run = reveal(alreadyChanged(t.state, t.vPos), [SURROUND]);
    expect(atop(run.state, t.vPos)).toBe(false);
    expect(placedBy(run)).toEqual([[withCode(run.state, SURROUND), 1]]);
  });

  it("from Atop the Tenshu it changes back to The Streets Below and the threat goes here", () => {
    const t = newGame([SPIDER], [SURROUND]);
    const run = reveal(flip(t.state, t.vPos), [SURROUND]);
    expect(atop(run.state, t.vPos)).toBe(false);
    expect(placedBy(run)).toEqual([[withCode(run.state, SURROUND), 1]]);
  });

  it("scales with the heroes: 2 players place 2 threat", () => {
    const t = newGame([SPIDER, MARVEL], [SURROUND]);
    const run = reveal(t.state, [BLANK, SURROUND], [P1, P2]);
    expect(placedBy(run)).toEqual([[run.state.mainScheme!.instanceId, 2]]);
  });
});
