import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  mainSchemeValue,
  statBonus,
  keywordTotal,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { codeOf, dataOf, heroAttacks, piles, types } from "../testing.js";
import { wave9Scenario } from "../setup.js";
import { BLACK_WIDOW, BLACK_WIDOW_SKIPPED, GOGGLES_GRANTED_PREPARATION } from "./black-widow.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Black Widow, first half (docs/phase7-wave9.md sections 3.2, 3.3 and 3.4): the villain 50064 to 50066, The Widow's Web
 * 50067a/b and the attachments 50068 to 50071. The real `black-widow` scenario (Spider-Man and Iron Man preconds from
 * Core, standard mode), the setup minions removed from the table so no guard stands between the heroes and her. The
 * second half (50072 to 50079) is not scripted, so those cards on top of the deck have no Preparation that resolves.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, BLACK_WIDOW) };
const BLANK = "01186";
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-iron-man-aggression" }] as const;
const GAUNTLET = "50068";
const HOOK = "50069";
const GOGGLES = "50070";
const NET = "50071";
const REGISTERED = [
  "50064.black-widow-forced-interrupt",
  "50065.when-revealed",
  "50065.black-widow-forced-interrupt",
  "50066.when-revealed",
  "50066.black-widow-forced-interrupt",
  "50067a.setup",
  "50067b.the-widows-web-constant",
  "50068.black-widows-gauntlet-constant",
  "50068.black-widows-gauntlet-response",
  "50068.preparation",
  "50069.grappling-hook-forced-interrupt",
  "50069.preparation",
  "50070.night-vision-goggles-constant",
  "50070.preparation",
  GOGGLES_GRANTED_PREPARATION,
  "50071.stun-net-constant",
  "50071.stun-net-action",
  "50071.preparation",
];
const FIRST_HALF = ["50064", "50067a", GAUNTLET, HOOK, GOGGLES, NET];
const SECOND_HALF = ["50072", "50073", "50074", "50075", "50076", "50077", "50078", "50079"];

type Mode = "standard" | "expert";
interface Table {
  readonly state: GameState;
  readonly villain: InstanceId;
  readonly main: InstanceId;
}

/** The scenario past setup. `cleared`: the setup minions are put in the discard pile; `hero`: every seat in hero form. */
function game(players = 2, opts: { readonly mode?: Mode; readonly cleared?: boolean } = {}): Table {
  const config = wave9Scenario("black-widow", {
    players: SEATS.slice(0, players),
    seed: 1,
    difficulty: opts.mode ?? "standard",
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  if (opts.cleared !== false) {
    const minions = cardsInPlay(state).filter((i) => state.instances[i]!.engagedWith !== undefined);
    const deckId = activeEncounterDeckId(state);
    const pile = state.encounterDecks[deckId]!;
    state = {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...minions] } },
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !minions.includes(i)) })),
      instances: Object.fromEntries(
        Object.entries(state.instances).map(([id, i]) => [
          id,
          minions.includes(id as InstanceId) ? { ...i, engagedWith: undefined } : i,
        ]),
      ) as GameState["instances"],
    };
    for (let p = 0; p < players; p++) state = withForm(state, { heroForm: 0 }, state.players[p]!.playerId);
  }
  return { state, villain: state.villains[0]!.instanceId, main: state.mainScheme.instanceId };
}
/** The code of the first event in `player`'s deck. */
const eventCodeIn = (s: GameState, player: PlayerId): string => {
  // A plain Action event, one a player can simply play.
  const events = new Set(
    CORE_CARDS.filter(
      (c) => c.type === "event" && /Action:/.test(c.text.current) && !/Interrupt:|Response:/.test(c.text.current),
    ).map((c) => c.id as string),
  );
  return playerOf(s, player)
    .deck.map((i) => codeOf(s, i))
    .find((c) => events.has(c))!;
};
const threat = (s: GameState, id: InstanceId) => inst(s, id).threat;
const damage = (s: GameState, id: InstanceId) => inst(s, id).damage;
const stack = (t: Table, ...codes: string[]): Table => ({ ...t, state: stackEncounterDeck(t.state, ...codes) });
const discardCodes = (s: GameState) => piles(s).discard.map((i) => codeOf(s, i));
const attachmentsOf = (s: GameState, id: InstanceId) => inst(s, id).attachments.map((i) => codeOf(s, i));
const resolved = (events: readonly GameEvent[]) => types(events, "abilityResolved").map((e) => e.abilityId as string);
/** Accepts an optional ability whose id contains `part`; every other prompt is answered as `firstLegal`. */
const accepting =
  (part: string): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const hit = choice.options.find((o) => o.optionId !== "decline" && o.optionId.includes(part));
    return hit ? [hit.optionId] : firstLegal(s);
  };
/** `player` attacks her; for P2 the first player ends their turn first. */
const attack = (t: Table, pick: Picker = firstLegal, player: PlayerId = P1) => {
  const state = player === P1 ? t.state : driveEventsPicking(DEPS, t.state, firstLegal, endTurn(P1)).state;
  return heroAttacks(DEPS, state, t.villain, { player, pick });
};
/** A card put into play on the villain by surgery (an attachment already attached). */
function attached(t: Table, code: string): Table & { readonly id: InstanceId } {
  const pile = piles(t.state);
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(t.state, i) === code)!;
  const deckId = activeEncounterDeckId(t.state);
  return {
    ...t,
    id,
    state: {
      ...t.state,
      encounterDecks: {
        ...t.state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...t.state.instances,
        [id]: { ...t.state.instances[id]!, faceup: true, attachedTo: t.villain },
        [t.villain]: { ...t.state.instances[t.villain]!, attachments: [...inst(t.state, t.villain).attachments, id] },
      },
    },
  };
}

describe("registry", () => {
  it("registers exactly the first half's refs, each a valid definition; the second half is skipped with a reason", () => {
    expect(Object.keys(BLACK_WIDOW).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(BLACK_WIDOW)) expect(validateDefinition(def), id).toEqual([]);
    expect(new Set(Object.values(BLACK_WIDOW_SKIPPED))).toEqual(new Set(["second half of the module, not started"]));
  });

  it("the data names exactly the registered refs (less the granted one, listed on no card) and the skipped ones", () => {
    const refs = [...FIRST_HALF, ...SECOND_HALF].flatMap((code) =>
      abilityRefIds(AOS_CARDS.find((c) => c.id === code)!),
    );
    expect([...refs].sort()).toEqual(
      [...REGISTERED.filter((id) => id !== GOGGLES_GRANTED_PREPARATION), ...Object.keys(BLACK_WIDOW_SKIPPED)].sort(),
    );
    // A card that listed the granted ability would print a Preparation.
    expect(GOGGLES_GRANTED_PREPARATION).toBe("50070.night-vision-goggles-granted-preparation");
    expect(refs).not.toContain(GOGGLES_GRANTED_PREPARATION);
  });
});

describe("Black Widow data (50064 to 50066)", () => {
  const stages = () => (dataOf("50064").sides as { stages: Record<string, unknown>[] }[])[0]!.stages;
  it("stage I: ATK 1, SCH 2, 13 hit points per player; II: ATK 2, SCH 2, 16; III: ATK 2, SCH 3", () => {
    const [one, two, three] = stages() as { atk: number; sch: number; hp: { perPlayer: number } }[];
    expect([one!.atk, one!.sch, one!.hp.perPlayer]).toEqual([1, 2, 13]);
    expect([two!.atk, two!.sch, two!.hp.perPlayer]).toEqual([2, 2, 16]);
    expect([three!.atk, three!.sch]).toEqual([2, 3]);
  });

  // docs/phase7-wave9.md section 1.14 item 1: the scan prints 20 per player; the raw data still has 13. Remove `.fails`
  // once the data agent corrects it.
  it.fails("stage III has 20 hit points per player (scan 50066)", () => {
    expect((stages()[2] as { hp: { perPlayer: number } }).hp.perPlayer).toBe(20);
  });
});

describe("The Widow's Web (50067a/b)", () => {
  it("data: starts at 2 per player, target 10 per player, acceleration printed X (stage number) per player", () => {
    const card = dataOf("50067a") as { stages: Record<string, unknown>[] };
    const stage = card.stages[0]!;
    expect(stage.startingThreat).toEqual({ base: 0, perPlayer: 2 });
    expect(stage.targetThreat).toEqual({ base: 0, perPlayer: 10 });
    expect(stage.printedX).toEqual(["acceleration"]);
    expect(stage.completionLoses).toBe(true);
  });

  it("setup: each player searched for a minion and has it engaged; 4 threat for two players, target 20, one shuffle", () => {
    const t = game(2, { cleared: false });
    const engaged = (p: PlayerId) =>
      cardsInPlay(t.state).filter(
        (i) => inst(t.state, i).engagedWith === p && t.state.instances[i]!.cardId !== undefined,
      );
    expect(engaged(P1).map((i) => codeOf(t.state, i))).toEqual(["50073"]);
    expect(engaged(P2)).toHaveLength(1);
    for (const id of [...engaged(P1), ...engaged(P2)]) {
      // Put into play, not revealed: nothing of a When Revealed or a surge happened, and they came from the deck.
      expect(piles(t.state).deck).not.toContain(id);
    }
    expect(threat(t.state, t.main)).toBe(4);
    expect(mainSchemeValue(t.state, "targetThreat", DEPS)).toBe(20);
  });

  it("the acceleration is the villain's stage number per player: 1 x 2 on stage I", () => {
    const t = game();
    expect(mainSchemeValue(t.state, "acceleration", DEPS)).toBe(2);
    expect(mainSchemeValue(game(1).state, "acceleration", DEPS)).toBe(1);
  });

  it("stage II places 2 per player threat when revealed and accelerates by 2 per player (expert, two players)", () => {
    const t = game(2, { mode: "expert" });
    expect(threat(t.state, t.main)).toBe(4 + 4);
    expect(mainSchemeValue(t.state, "acceleration", DEPS)).toBe(4);
  });
});

describe("the Forced Interrupt (50064)", () => {
  it("an attack removes 1 threat from the main scheme, discards the top card, then deals its damage (ATK 2)", () => {
    const t = stack(game(), BLANK);
    const { state } = attack(t);
    expect(threat(state, t.main)).toBe(3);
    expect(discardCodes(state)).toContain(BLANK);
    expect(damage(state, t.villain)).toBe(2);
    expect(piles(state).deck.map((i) => codeOf(state, i))).not.toContain(undefined);
  });

  it("a card with no Preparation ability on top: only the discard; the attack goes on", () => {
    const t = stack(game(), BLANK);
    const { state, events } = attack(t);
    expect(resolved(events).filter((id) => id.endsWith("preparation"))).toEqual([]);
    expect(threat(state, t.main)).toBe(3);
  });

  it("with a Preparation card on top (the Gauntlet): its Preparation resolves, the card leaves the discard pile", () => {
    const t = stack(game(), GAUNTLET);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain("50068.preparation");
    expect(attachmentsOf(state, t.villain)).toEqual([GAUNTLET]);
    expect(discardCodes(state)).not.toContain(GAUNTLET);
    expect(threat(state, t.main)).toBe(3);
    expect(damage(state, t.villain)).toBe(2);
  });

  it("a crisis icon in play changes nothing: the villain's removal ignores it", () => {
    const base = stack(game(), BLANK);
    const withCrisis = encounterCardInVillainArea(base.state, "50075", 3);
    const t = { ...base, state: withCrisis.state };
    const { state } = attack(t);
    expect(threat(state, t.main)).toBe(3);
    expect(discardCodes(state)).toContain(BLANK);
    expect(damage(state, t.villain)).toBe(2);
  });

  it("the main scheme at 0: no threat is removed, nothing is discarded and the attack deals its 2 damage", () => {
    const base = stack(game(), GAUNTLET);
    const t = { ...base, state: patchInstance(base.state, base.main, { threat: 0 }) };
    const before = piles(t.state).discard.length;
    const { state, events } = attack(t);
    expect(threat(state, t.main)).toBe(0);
    expect(piles(state).discard).toHaveLength(before);
    expect(piles(state).deck.map((i) => codeOf(state, i))[0]).toBe(GAUNTLET);
    expect(resolved(events)).not.toContain("50068.preparation");
    expect(damage(state, t.villain)).toBe(2);
  });

  it("the second player's attack resolves the Preparation for that player (Grappling Hook: their event is discarded)", () => {
    const base = stack(game(), HOOK);
    const events2 = moveToHand(base.state, P2, eventCodeIn(base.state, P2));
    const t = { ...base, state: events2.state };
    const handBefore = (s: GameState, p: PlayerId) => playerOf(s, p).hand.length;
    const { state } = attack(t, firstLegal, P2);
    expect(handBefore(state, P2)).toBe(handBefore(t.state, P2) - 1);
    expect(handBefore(state, P1)).toBe(handBefore(t.state, P1));
    expect(attachmentsOf(state, t.villain)).toEqual([]);
  });

  it("an empty encounter deck: the discard pile is reshuffled in first, with its acceleration token, then the card is discarded", () => {
    const base = game();
    const deckId = activeEncounterDeckId(base.state);
    const pile = piles(base.state);
    const t = {
      ...base,
      state: {
        ...base.state,
        encounterDecks: {
          ...base.state.encounterDecks,
          [deckId]: { deck: [], discard: [...pile.deck, ...pile.discard] },
        },
      },
    };
    const tokens = t.state.mainScheme.accelerationTokens;
    const { state } = attack(t);
    expect(state.mainScheme.accelerationTokens).toBe(tokens + 1);
    expect(threat(state, t.main)).toBe(3);
    expect(damage(state, t.villain)).toBe(2);
  });
});

describe("Black Widow's Gauntlet (50068)", () => {
  it("is data: attaches to Black Widow, +1 ATK, 2 boost icons; attached it gives +1 ATK and retaliate 1", () => {
    const card = dataOf(GAUNTLET);
    expect(card.attachesTo).toEqual({ kind: "villain" });
    expect(card.statModifiers).toEqual({ atk: 1 });
    expect(card.boostIcons).toBe(2);
    const t = attached(game(), GAUNTLET);
    expect(statBonus(t.state, DEPS, t.villain, "atk")).toBe(1);
    expect(keywordTotal(t.state, t.villain, "retaliate", DEPS)).toBe(1);
  });

  it("its Preparation attaches it to her (see the Forced Interrupt); the attack's retaliate 1 hits the attacker for 1", () => {
    const t = stack(game(), GAUNTLET);
    const { state } = attack(t);
    expect(damage(state, identityOf(state, P1))).toBe(1);
    expect(damage(state, t.villain)).toBe(2);
  });

  it("response, no Preparation resolved (a blank card on top): after the retaliate it may be discarded", () => {
    const base = attached(stack(game(), BLANK), GAUNTLET);
    const { state, events } = attack(base, accepting("black-widows-gauntlet-response"));
    expect(damage(state, identityOf(state, P1))).toBe(1);
    expect(resolved(events)).toContain("50068.black-widows-gauntlet-response");
    expect(attachmentsOf(state, base.villain)).toEqual([]);
    expect(discardCodes(state)).toContain(GAUNTLET);
  });

  it("response, the main scheme at 0 (no Preparation resolved): it may be discarded", () => {
    const base = attached(stack(game(), GAUNTLET), GAUNTLET);
    const t = { ...base, state: patchInstance(base.state, base.main, { threat: 0 }) };
    const { state } = attack(t, accepting("black-widows-gauntlet-response"));
    expect(attachmentsOf(state, t.villain)).toEqual([]);
    expect(discardCodes(state)).toContain(GAUNTLET);
  });

  it("response, a Preparation resolved (Grappling Hook's): the Gauntlet stays attached", () => {
    const base = attached(stack(game(), HOOK), GAUNTLET);
    const { state } = attack(base, accepting("black-widows-gauntlet-response"));
    expect(attachmentsOf(state, base.villain)).toEqual([GAUNTLET]);
  });
});

describe("Grappling Hook (50069)", () => {
  it("Forced Interrupt: a player plays an event: its effects are canceled, it is discarded, then the Hook is discarded", () => {
    const base = attached(game(), HOOK);
    const code = eventCodeIn(base.state, P1);
    const given = moveToHand(base.state, P1, code);
    const [event] = given.ids as [InstanceId];
    const cost = (CORE_CARDS.find((c) => c.id === code) as unknown as { cost: number }).cost;
    const pay = payWith(given.state, P1, cost, [event]);
    const { state } = driveEventsPicking(DEPS, given.state, firstLegal, play(P1, event, pay));
    expect(playerOf(state, P1).discard).toContain(event);
    expect(playerOf(state, P1).hand).not.toContain(event);
    expect(attachmentsOf(state, base.villain)).toEqual([]);
    expect(discardCodes(state)).toContain(HOOK);
  });

  it("Preparation: the attacking player discards 1 event card from their hand (Hook is not attached)", () => {
    const base = stack(game(), HOOK);
    const code = eventCodeIn(base.state, P1);
    const given = moveToHand(base.state, P1, code);
    const [event] = given.ids as [InstanceId];
    const { state } = attack({ ...base, state: given.state });
    expect(playerOf(state, P1).discard).toContain(event);
    expect(attachmentsOf(state, base.villain)).toEqual([]);
    expect(discardCodes(state)).toContain(HOOK);
  });

  it("Preparation with no event in hand: nothing is discarded", () => {
    const base = stack(game(), HOOK);
    const events = new Set(CORE_CARDS.filter((c) => c.type === "event").map((c) => c.id as string));
    const noEvents = {
      ...base.state,
      players: base.state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((i) => !events.has(codeOf(base.state, i))),
      })),
    };
    const { state } = attack({ ...base, state: noEvents });
    expect(playerOf(state, P1).hand).toEqual(playerOf(noEvents, P1).hand);
    expect(playerOf(state, P1).discard).toEqual(playerOf(noEvents, P1).discard);
    expect(discardCodes(state)).toContain(HOOK);
  });
});

describe("Night Vision Goggles (50070)", () => {
  it("is data: +1 SCH; its own Preparation attaches it to her; attached it gives +1 SCH", () => {
    expect(dataOf(GOGGLES).statModifiers).toEqual({ sch: 1 });
    const t = attached(game(), GOGGLES);
    expect(statBonus(t.state, DEPS, t.villain, "sch")).toBe(1);
  });

  it("Preparation on top: the Goggles attach to her and no granted Preparation resolves (it prints one)", () => {
    const t = stack(game(), GOGGLES);
    const { state, events } = attack(t);
    expect(attachmentsOf(state, t.villain)).toEqual([GOGGLES]);
    expect(resolved(events).filter((id) => id === GOGGLES_GRANTED_PREPARATION)).toEqual([]);
    expect(damage(state, t.villain)).toBe(2);
  });

  it("with the Goggles attached and a blank card on top: the attack deals 0 and the Goggles are discarded", () => {
    const t = attached(stack(game(), BLANK), GOGGLES);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain(GOGGLES_GRANTED_PREPARATION);
    expect(damage(state, t.villain)).toBe(0);
    expect(threat(state, t.main)).toBe(3);
    expect(attachmentsOf(state, t.villain)).toEqual([]);
    expect(discardCodes(state)).toContain(GOGGLES);
    expect(discardCodes(state)).toContain(BLANK);
  });

  it("with the Goggles attached and a card that prints a Preparation on top (Grappling Hook): only its own resolves", () => {
    const t = attached(stack(game(), HOOK), GOGGLES);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain("50069.preparation");
    expect(resolved(events)).not.toContain(GOGGLES_GRANTED_PREPARATION);
    expect(attachmentsOf(state, t.villain)).toEqual([GOGGLES]);
    expect(damage(state, t.villain)).toBe(2);
  });

  it("with the main scheme at 0 the villain's interrupt stops: no Preparation, the damage is dealt, the Goggles stay", () => {
    const base = attached(stack(game(), BLANK), GOGGLES);
    const t = { ...base, state: patchInstance(base.state, base.main, { threat: 0 }) };
    const { state } = attack(t);
    expect(damage(state, t.villain)).toBe(2);
    expect(attachmentsOf(state, t.villain)).toEqual([GOGGLES]);
  });
});

describe("Stun Net (50071)", () => {
  /** P1's hero is hit by the net: the Net on top, P1 attacks. */
  const netted = () => {
    const t = stack(game(), NET);
    return { t, ...attack(t) };
  };

  it("Preparation: after the attack it is attached to the attacking character (the identity), and the attack is dealt", () => {
    const { t, state, events } = netted();
    expect(damage(state, t.villain)).toBe(2);
    expect(resolved(events)).toContain("50071.preparation");
    expect(inst(state, identityOf(state, P1)).attachments.map((i) => codeOf(state, i))).toEqual([NET]);
    expect(discardCodes(state)).not.toContain(NET);
  });

  it("Constant: the attached character cannot attack (even readied)", () => {
    const { state } = netted();
    const ready = patchInstance(state, identityOf(state, P1), { exhausted: false });
    expect(() => heroAttacks(DEPS, ready, ready.villains[0]!.instanceId, { player: P1 })).toThrow(/rejected/);
    // Control: without the net the same readied hero attacks.
    const free = patchInstance(ready, identityOf(ready, P1), { attachments: [] });
    expect(() => heroAttacks(DEPS, free, free.villains[0]!.instanceId, { player: P1 })).not.toThrow();
  });

  it("Hero Action: any player exhausts a character they control to discard it", () => {
    const { state } = netted();
    const net = inst(state, identityOf(state, P1)).attachments[0]!;
    const turn = driveEventsPicking(DEPS, state, firstLegal, endTurn(P1)).state;
    const freed = driveEventsPicking(DEPS, turn, firstLegal, use(P2, net, "50071.stun-net-action")).state;
    expect(inst(freed, identityOf(freed, P1)).attachments).toEqual([]);
    expect(discardCodes(freed)).toContain(NET);
    expect(inst(freed, identityOf(freed, P2)).exhausted).toBe(true);
  });
});

describe("stages II and III (50065, 50066)", () => {
  /** Defeats stage I with a basic attack's last point (the interrupt first removes 1 threat) and returns the next stage. */
  const advanced = (t: Table): Table => {
    const near = patchInstance(t.state, t.villain, { damage: 99 });
    const { state } = heroAttacks(DEPS, stack({ ...t, state: near }, BLANK).state, t.villain, { player: P1 });
    return { state: settle(state, firstLegal, undefined, DEPS), villain: state.villains[0]!.instanceId, main: t.main };
  };

  it("stage II's When Revealed places 2 per player threat on the main scheme (two players: 4)", () => {
    const base = game();
    const next = advanced({ ...base, state: patchInstance(base.state, base.main, { threat: 10 }) });
    expect(codeOf(next.state, next.state.villains[0]!.instanceId)).toBe("50064");
    // 10 - 1 (the interrupt) + 4 (stage II revealed)
    expect(threat(next.state, base.main)).toBe(13);
  });

  it("stage III's When Revealed places 3 per player threat (two players: 6)", () => {
    const base = game(2, { mode: "expert" });
    const t = { ...base, state: patchInstance(base.state, base.main, { threat: 10 }) };
    const next = advanced(t);
    expect(threat(next.state, base.main)).toBe(10 - 1 + 6);
  });

  it("every stage's interrupt behaves alike: stage II (expert start) removes 1 threat, discards a card, then 2 damage", () => {
    const base = stack(game(2, { mode: "expert" }), GAUNTLET);
    const before = threat(base.state, base.main);
    const { state, events } = attack(base);
    expect(threat(state, base.main)).toBe(before - 1);
    expect(resolved(events)).toContain("50068.preparation");
    expect(damage(state, base.villain)).toBe(2);
  });
});
