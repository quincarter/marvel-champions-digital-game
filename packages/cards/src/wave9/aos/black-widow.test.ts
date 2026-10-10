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
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import {
  BLACK_CAT,
  ONE_ICON,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks,
  inPlayCard,
  piles,
  schemesBy,
  types,
} from "../testing.js";
import { wave9Scenario } from "../setup.js";
import {
  BLACK_WIDOW,
  BLACK_WIDOW_SKIPPED,
  DEFENSES_GRANTED_PREPARATION,
  GOGGLES_GRANTED_PREPARATION,
} from "./black-widow.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Black Widow (docs/phase7-wave9.md sections 3.2, 3.3 and 3.4): the villain 50064 to 50066, The Widow's Web 50067a/b,
 * the attachments 50068 to 50071 and the second half 50072 to 50079 (two minions, two side schemes, four treacheries).
 * The real `black-widow` scenario (Spider-Man and Iron Man preconds from Core, standard mode), the setup minions
 * removed from the table so no guard stands between the heroes and her.
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
  "50072.preparation",
  "50073.preparation",
  "50074.automated-defenses-constant",
  DEFENSES_GRANTED_PREPARATION,
  "50075.destroy-evidence-constant",
  "50076.when-revealed",
  "50076.preparation",
  "50077.when-revealed",
  "50077.preparation",
  "50078.when-revealed",
  "50078.preparation",
  "50079.when-revealed",
  "50079.preparation",
];
const GRANTED = [GOGGLES_GRANTED_PREPARATION, DEFENSES_GRANTED_PREPARATION];
const PRINTS_PREPARATION = ["50068", "50069", "50070", "50071", "50072", "50073", "50076", "50077", "50078", "50079"];
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
  it("registers exactly the module's refs, each a valid definition; none is skipped", () => {
    expect(Object.keys(BLACK_WIDOW).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(BLACK_WIDOW)) expect(validateDefinition(def), id).toEqual([]);
    expect(BLACK_WIDOW_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered refs (less the granted one, listed on no card) and the skipped ones", () => {
    const refs = [...FIRST_HALF, ...SECOND_HALF].flatMap((code) =>
      abilityRefIds(AOS_CARDS.find((c) => c.id === code)!),
    );
    expect([...refs].sort()).toEqual(
      [...REGISTERED.filter((id) => !GRANTED.includes(id)), ...Object.keys(BLACK_WIDOW_SKIPPED)].sort(),
    );
    // A card that listed a granted ability would print a Preparation.
    expect(GOGGLES_GRANTED_PREPARATION).toBe("50070.night-vision-goggles-granted-preparation");
    expect(DEFENSES_GRANTED_PREPARATION).toBe("50074.automated-defenses-granted-preparation");
    for (const id of GRANTED) expect(refs).not.toContain(id);
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
  it("stage III has 20 hit points per player (scan 50066)", () => {
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
          // Without the cards that print a Preparation (any of them on top would change the attack).
          [deckId]: {
            deck: [],
            discard: [...pile.deck, ...pile.discard].filter((i) => !PRINTS_PREPARATION.includes(codeOf(base.state, i))),
          },
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

// ---------------------------------------------------------------------------------------------------------------
// The second half: 50072 to 50079
// ---------------------------------------------------------------------------------------------------------------

const COMMANDO = "50072";
const GRUNT = "50073";
const DEFENSES = "50074";
const EVIDENCE = "50075";
const ATTACROBATICS = "50076";
const COVERT_OPS = "50077";
const DANCE = "50078";
const BITE = "50079";
const KICK = "01005"; // Spider-Man's Swinging Web Kick: "Hero Action (attack): Deal 8 damage to an enemy." Cost 3.
const identityDamage = (s: GameState, p: PlayerId = P1) => damage(s, identityOf(s, p));
const engagedWith = (s: GameState, code: string) => {
  const id = inPlayCard(s, code);
  return id === undefined ? undefined : inst(s, id).engagedWith;
};
/** Black Widow's interrupt on a card played by P1: the attack event 'Swinging Web Kick' on her, 8 damage. */
function kick(t: Table, pick: Picker = firstLegal, target: InstanceId = t.villain) {
  const given = moveToHand(t.state, P1, KICK);
  const [event] = given.ids as [InstanceId];
  const pay = payWith(given.state, P1, 3, [event]);
  const chooseTheTarget: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseTarget") {
      const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
      if (hit) return [hit.optionId];
    }
    return pick(s);
  };
  return driveEventsPicking(DEPS, given.state, chooseTheTarget, play(P1, event, pay));
}
/** Stacked: the boost card is a no-icon filler, so a quickstrike or an activation adds nothing. */
const GANG_UP = "01189"; // Core treachery with 1 boost icon
const ASSAULT = "01187"; // Core treachery, no boost icons, no Boost ability
const stackedFor = (t: Table, code: string): Table => stack(t, code, BLANK, ASSAULT);
/** Hero phase over for P1 (one player), the villain phase on a deck whose boost card is blank and whose dealt card is `code`. */
function reveal(t: Table, code: string, ...rest: string[]) {
  const staged = stackEncounterDeck(t.state, BLANK, code, ...(rest.length > 0 ? rest : [ASSAULT]));
  return driveEventsPicking(DEPS, staged, firstLegal, endTurn(P1));
}
/** A scripted answer to the target prompts, in order; every other prompt as `firstLegal`. */
const targeting = (...order: InstanceId[]): Picker => {
  const queue = [...order];
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "chooseTarget") return firstLegal(s);
    const want = queue.shift();
    const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === want);
    return hit ? [hit.optionId] : firstLegal(s);
  };
};

describe("second half: card data", () => {
  it("A.I.M. Commando: ATK 2, SCH 1, 3 hit points, quickstrike, 1 boost icon, A.I.M.", () => {
    const c = dataOf(COMMANDO);
    expect([c.atk, c.sch, c.hp, c.boostIcons]).toEqual([2, 1, 3, 1]);
    expect(c.keywords).toEqual([{ name: "quickstrike" }]);
  });

  it("A.I.M. Grunt: ATK 1, SCH 1, 5 hit points, guard, no boost icons", () => {
    const c = dataOf(GRUNT);
    expect([c.atk, c.sch, c.hp, c.boostIcons]).toEqual([1, 1, 5, 0]);
    expect(c.keywords).toEqual([{ name: "guard" }]);
  });

  it("Automated Defenses: 3 threat (not per player), no icons, hinder 1 per hero, amplify 1, 3 boost icons", () => {
    const c = dataOf(DEFENSES);
    expect(c.startingThreat).toEqual({ base: 3, perPlayer: 0 });
    expect(c.icons).toEqual([]);
    expect(c.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 1 }]);
    expect([c.amplifyIcons, c.boostIcons]).toEqual([1, 3]);
  });

  it("Destroy Evidence: 2 threat, a crisis icon, hinder 2 per hero, 2 boost icons", () => {
    const c = dataOf(EVIDENCE);
    expect(c.startingThreat).toEqual({ base: 2, perPlayer: 0 });
    expect(c.icons).toEqual(["crisis"]);
    expect(c.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 2 }]);
    expect(c.boostIcons).toBe(2);
  });

  it("the treacheries' boost icons: Attacrobatics 3, Covert Ops 2, Dance of Death 2, Widow's Bite 2; none is vulnerable", () => {
    expect([ATTACROBATICS, COVERT_OPS, DANCE, BITE].map((c) => dataOf(c).boostIcons)).toEqual([3, 2, 2, 2]);
    expect([COMMANDO, GRUNT].map((c) => (dataOf(c).keywords as { name: string }[]).map((k) => k.name))).toEqual([
      ["quickstrike"],
      ["guard"],
    ]);
  });
});

describe("a Preparation is not a boost ability", () => {
  it.each([COMMANDO, GRUNT, ATTACROBATICS, COVERT_OPS, DANCE, BITE])(
    "%s turned faceup as the villain's boost card resolves nothing: no Preparation, nobody stunned",
    (code) => {
      // The villain's activation against a hero: boost card `code`, then a filler dealt card.
      const t = game(1);
      const staged = stackEncounterDeck(t.state, code, ASSAULT);
      const { state, events } = driveEventsPicking(DEPS, staged, firstLegal, endTurn(P1));
      expect(resolved(events).filter((id) => id.endsWith(".preparation"))).toEqual([]);
      expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(0);
      const attack = types(events, "attackResolved")[0]!;
      expect(attack.boostIcons).toBe((dataOf(code).boostIcons as number) ?? 0);
    },
  );
});

describe("A.I.M. Commando (50072)", () => {
  it("Preparation: after the attack it is put into play engaged with the attacker; the attack is dealt; its quickstrike answers", () => {
    const t = stackedFor(game(), COMMANDO);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain("50072.preparation");
    expect(engagedWith(state, COMMANDO)).toBe(P1);
    expect(discardCodes(state)).not.toContain(COMMANDO);
    expect(damage(state, t.villain)).toBe(2);
    expect(threat(state, t.main)).toBe(3);
    // Quickstrike (RRG p. 36): its ATK 2 (a no-icon boost card) hits the exhausted attacker at once.
    expect(attacksBy(state, events, COMMANDO).map((a) => a.damageDealt)).toEqual([2]);
    expect(identityDamage(state)).toBe(2);
  });
});

describe("A.I.M. Grunt (50073)", () => {
  it("Preparation: it enters play engaged with the attacker and the attack is resolved against it: 2 damage on the Grunt, 0 on her", () => {
    const t = stackedFor(game(), GRUNT);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain("50073.preparation");
    expect(engagedWith(state, GRUNT)).toBe(P1);
    expect(damage(state, inPlayCard(state, GRUNT)!)).toBe(2);
    expect(damage(state, t.villain)).toBe(0);
    expect(threat(state, t.main)).toBe(3);
  });

  it("with the Gauntlet attached her retaliate 1 does not answer: the attacker takes nothing", () => {
    const t = attached(stackedFor(game(), GRUNT), GAUNTLET);
    const { state } = attack(t);
    expect(damage(state, inPlayCard(state, GRUNT)!)).toBe(2);
    expect(damage(state, t.villain)).toBe(0);
    expect(identityDamage(state)).toBe(0);
    // Control: the same attack against her takes retaliate 1 (see the Gauntlet tests).
  });

  it("an attack event (Swinging Web Kick, 8 damage) is resolved against the Grunt: 5 hit points, defeated; she takes 0", () => {
    const t = stackedFor(game(), GRUNT);
    const { state } = kick(t);
    expect(damage(state, t.villain)).toBe(0);
    expect(threat(state, t.main)).toBe(3);
    expect(inPlayCard(state, GRUNT)).toBeUndefined();
    expect(discardCodes(state)).toContain(GRUNT);
  });
});

describe("Automated Defenses (50074)", () => {
  /** The side scheme in play, a card with no Preparation on top. */
  const defended = (top: string): Table => {
    const base = stackedFor(game(), top);
    return { ...base, state: encounterCardInVillainArea(base.state, DEFENSES, 3).state };
  };

  it("granted Preparation on a card that prints none: the attacker takes 1 damage; the attack still deals its 2", () => {
    const t = defended(BLANK);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain(DEFENSES_GRANTED_PREPARATION);
    expect(identityDamage(state)).toBe(1);
    expect(damage(state, t.villain)).toBe(2);
    expect(threat(state, t.main)).toBe(3);
    // The side scheme itself stays in play.
    expect(inPlayCard(state, DEFENSES)).toBeDefined();
  });

  it("not on a card that prints one (Grappling Hook): only its own resolves; the attacker is undamaged", () => {
    const t = defended(HOOK);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain("50069.preparation");
    expect(resolved(events)).not.toContain(DEFENSES_GRANTED_PREPARATION);
    expect(identityDamage(state)).toBe(0);
  });

  it("not on A.I.M. Commando either (it prints one): no damage from the Defenses; its own Preparation resolves", () => {
    const t = defended(COMMANDO);
    const { events } = attack(t);
    expect(resolved(events)).not.toContain(DEFENSES_GRANTED_PREPARATION);
    expect(resolved(events)).toContain("50072.preparation");
  });

  it("without it in play a card with no Preparation resolves nothing", () => {
    const { state, events } = attack(stackedFor(game(), BLANK));
    expect(resolved(events)).not.toContain(DEFENSES_GRANTED_PREPARATION);
    expect(identityDamage(state)).toBe(0);
  });

  it("with the Goggles attached too, a no-Preparation card resolves both, in the order the attacking player chose", () => {
    const orders: string[][] = [];
    for (const first of ["night-vision-goggles", "automated-defenses"]) {
      const base = attached(defended(BLANK), GOGGLES);
      let asked = false;
      const pick: Picker = (s) => {
        const choice = s.pendingChoice!;
        const hit = choice.options.find((o) => o.optionId.includes(first));
        const other = choice.options.find((o) => o !== hit && o.optionId.includes("granted"));
        if (hit && other && choice.options.length === 2) {
          asked = true;
          return [hit.optionId, other.optionId];
        }
        return firstLegal(s);
      };
      const { state, events } = attack(base, pick);
      expect(asked, first).toBe(true);
      orders.push(resolved(events).filter((id) => GRANTED_IDS.includes(id)));
      // Whatever the order: the attack deals 0 (the Goggles), the attacker takes 1 (the Defenses), the Goggles are gone.
      expect(damage(state, base.villain)).toBe(0);
      expect(identityDamage(state)).toBe(1);
      expect(attachmentsOf(state, base.villain)).toEqual([]);
      expect(discardCodes(state)).toContain(GOGGLES);
    }
    expect(orders[0]).toEqual([GOGGLES_GRANTED_PREPARATION, DEFENSES_GRANTED_PREPARATION]);
    expect(orders[1]).toEqual([DEFENSES_GRANTED_PREPARATION, GOGGLES_GRANTED_PREPARATION]);
  });

  it("with the Goggles attached and a Preparation card on top, neither grant applies: only its own", () => {
    const base = attached(defended(HOOK), GOGGLES);
    const { state, events } = attack(base);
    expect(resolved(events).filter((id) => GRANTED_IDS.includes(id))).toEqual([]);
    expect(damage(state, base.villain)).toBe(2);
  });
});

const GRANTED_IDS = [GOGGLES_GRANTED_PREPARATION, DEFENSES_GRANTED_PREPARATION];

describe("Destroy Evidence (50075)", () => {
  const withEvidence = (base: Table): Table => ({
    ...base,
    state: encounterCardInVillainArea(base.state, EVIDENCE, 2).state,
  });

  it("each other encounter card gains incite 1: a card revealed with it in play places 1 threat on the main scheme", () => {
    const base = game(1);
    const control = reveal(base, ASSAULT, BLANK);
    const run = reveal(withEvidence(base), ASSAULT, BLANK);
    expect(threat(run.state, base.main) - threat(control.state, base.main)).toBe(1);
  });

  it("it does not gain incite itself: dealt from the deck it enters play and the main scheme has the same threat as without", () => {
    const base = game(1);
    const control = reveal(base, ASSAULT, BLANK);
    const run = reveal(base, EVIDENCE, BLANK);
    expect(inPlayCard(run.state, EVIDENCE)).toBeDefined();
    expect(threat(run.state, base.main)).toBe(threat(control.state, base.main));
    // 2 starting threat and Hinder 2 per hero (one hero) more.
    expect(threat(run.state, inPlayCard(run.state, EVIDENCE)!)).toBe(4);
  });

  it("a boost card is not revealed: Covert Ops boosting a scheme adds its 2 icons and no incite (alter-ego, so she schemes)", () => {
    const base = { ...game(1), state: withForm(game(1).state, "alterEgo", P1) };
    const run = (t: Table) =>
      driveEventsPicking(DEPS, stackEncounterDeck(t.state, COVERT_OPS, BLANK, ASSAULT), firstLegal, endTurn(P1));
    const control = run(base);
    const evidence = run(withEvidence(base));
    // The dealt card (Advance, which schemes with a no-icon boost card) gains incite 1; the boost card gained nothing, so the total is exactly 1 more.
    expect(threat(evidence.state, base.main) - threat(control.state, base.main)).toBe(1);
    expect(schemesBy(control.state, control.events, "50064")[0]!.boostIcons).toBe(2);
  });
});

describe("Attacrobatics (50076)", () => {
  it("When Revealed in hero form: the villain attacks you with 2 boost cards (1 and 1 icon): 1 + 2 = 3 damage", () => {
    const base = game(1);
    const { state, events } = driveEventsPicking(
      DEPS,
      stackEncounterDeck(base.state, BLANK, ATTACROBATICS, ONE_ICON, GANG_UP),
      firstLegal,
      endTurn(P1),
    );
    const attacks = attacksBy(state, events, "50064");
    expect(attacks).toHaveLength(2);
    expect(attacks[0]!.boostIcons).toBe(0);
    expect(attacks[1]!.boostIcons).toBe(2);
    expect(attacks[1]!.damageDealt).toBe(3);
  });

  it("When Revealed in alter-ego form: changes to hero form first, then she attacks (not schemes) with the extra boost card", () => {
    const base = game(1);
    const alter = withForm(base.state, "alterEgo", P1);
    const { state, events } = driveEventsPicking(
      DEPS,
      stackEncounterDeck(alter, BLANK, ATTACROBATICS, ONE_ICON, GANG_UP),
      firstLegal,
      endTurn(P1),
    );
    expect(schemesBy(state, events, "50064")).toHaveLength(1);
    const attacks = attacksBy(state, events, "50064");
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.boostIcons).toBe(2);
    expect(playerOf(state, P1).identity.form).toBe("hero");
  });

  it("Preparation (standard): all damage of a basic attack is prevented; the attacker takes nothing", () => {
    const t = stackedFor(game(), ATTACROBATICS);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain("50076.preparation");
    expect(damage(state, t.villain)).toBe(0);
    expect(identityDamage(state)).toBe(0);
    expect(threat(state, t.main)).toBe(3);
  });

  it("Preparation (standard): an attack event's 8 damage is prevented too", () => {
    const t = stackedFor(game(), ATTACROBATICS);
    const { state } = kick(t);
    expect(damage(state, t.villain)).toBe(0);
    expect(identityDamage(state)).toBe(0);
  });

  it("Preparation (expert): the basic attack's 2 damage is prevented and dealt to the attacker", () => {
    const t = stackedFor(game(2, { mode: "expert" }), ATTACROBATICS);
    const { state } = attack(t);
    expect(damage(state, t.villain)).toBe(0);
    expect(identityDamage(state)).toBe(2);
  });

  it("Preparation (expert): an attack event's 8 damage is prevented and 8 is dealt to the attacker", () => {
    const t = stackedFor(game(2, { mode: "expert" }), ATTACROBATICS);
    const { state } = kick(t);
    expect(damage(state, t.villain)).toBe(0);
    expect(identityDamage(state)).toBe(8);
  });
});

describe("Covert Ops (50077)", () => {
  it("When Revealed: you are confused and Black Widow schemes (SCH 2, a no-icon boost card: 2 threat on the main scheme)", () => {
    const base = game(1);
    const control = reveal(base, ASSAULT, BLANK);
    const { state, events } = reveal(base, COVERT_OPS, ASSAULT);
    expect(inst(state, identityOf(state, P1)).statuses.confused).toBe(1);
    expect(inst(control.state, identityOf(control.state, P1)).statuses.confused).toBe(0);
    expect(schemesBy(state, events, "50064")).toHaveLength(1);
    expect(threat(state, base.main) - threat(control.state, base.main)).toBe(2);
  });

  it("Preparation: 1 threat on the main scheme and on each side scheme", () => {
    const base = stackedFor(game(), COVERT_OPS);
    const { state, id } = (() => {
      const placed = encounterCardInVillainArea(base.state, DEFENSES, 3);
      return { state: placed.state, id: placed.id };
    })();
    const { state: after, events } = attack({ ...base, state });
    expect(resolved(events)).toContain("50077.preparation");
    // The interrupt removed 1 first (4 to 3), then the Preparation placed 1.
    expect(threat(after, base.main)).toBe(4);
    expect(threat(after, id)).toBe(4);
  });

  it("Preparation with no side scheme: only the main scheme gets 1", () => {
    const base = stackedFor(game(), COVERT_OPS);
    const { state } = attack(base);
    expect(threat(state, base.main)).toBe(4);
  });
});

describe("Dance of Death (50078)", () => {
  /** P1 in alter-ego form (the villain schemes, nothing else damages) with Black Cat (2 hp) and Mockingbird (3 hp). */
  const crew = () => {
    const base = game(1);
    const cat = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    const bird = playFromHand(DEPS, cat.state, "01083", 3);
    return { base, cat: cat.id, bird: bird.id, state: withForm(bird.state, "alterEgo", P1) };
  };
  const hero = (s: GameState) => identityOf(s, P1);
  const dance = (state: GameState, pick: Picker) =>
    driveEventsPicking(DEPS, stackEncounterDeck(state, BLANK, DANCE, BLANK), pick, endTurn(P1));

  it("1, 2 and 3 damage to three different characters the player chooses, in that order", () => {
    const c = crew();
    const { state } = dance(c.state, targeting(c.bird, hero(c.state), c.cat));
    // Mockingbird 3 hp takes 1; the identity takes 2; Black Cat (2 hp) takes 3 and is defeated.
    expect(damage(state, c.bird)).toBe(1);
    expect(damage(state, hero(state))).toBe(2);
    expect(cardsInPlay(state)).not.toContain(c.cat);
  });

  it("the same character cannot be chosen twice: the second choice leaves out the first, the third leaves out both", () => {
    const c = crew();
    const offered: InstanceId[][] = [];
    const first = targeting(hero(c.state), c.bird, c.cat);
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget")
        offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : [])));
      return first(s);
    };
    dance(c.state, pick);
    expect(offered.map((o) => o.length)).toEqual([3, 2, 1]);
    expect(offered[1]).not.toContain(hero(c.state));
    expect(offered[2]).toEqual([c.cat]);
  });

  it("with one character only the 1 damage is dealt; with two, 1 and 2", () => {
    const base = game(1);
    const alone = dance(withForm(base.state, "alterEgo", P1), firstLegal);
    expect(damage(alone.state, hero(alone.state))).toBe(1);
    const cat = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    const two = dance(withForm(cat.state, "alterEgo", P1), targeting(hero(cat.state), cat.id));
    expect(damage(two.state, hero(two.state))).toBe(1);
    // Black Cat has 2 hit points: the 2 damage defeats her.
    expect(cardsInPlay(two.state)).not.toContain(cat.id);
  });

  it("Preparation: 1 damage to each character the attacker controls (identity and allies), none to the other player", () => {
    const base = stackedFor(game(), DANCE);
    const cat = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    const { state } = attack({ ...base, state: cat.state });
    expect(identityDamage(state)).toBe(1);
    expect(damage(state, cat.id)).toBe(1);
    expect(identityDamage(state, P2)).toBe(0);
    expect(damage(state, base.villain)).toBe(2);
  });
});

describe("Widow's Bite (50079)", () => {
  /** Alter-ego, so the villain's own activation is a scheme and deals no damage. */
  const bitten = (setup?: (s: GameState) => GameState) => {
    const base = game(1);
    const state = withForm(setup ? setup(base.state) : base.state, "alterEgo", P1);
    return driveEventsPicking(DEPS, stackEncounterDeck(state, BLANK, BITE, BLANK), firstLegal, endTurn(P1));
  };

  it("When Revealed: you are stunned and take 1 damage", () => {
    const { state } = bitten();
    expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(1);
    expect(identityDamage(state)).toBe(1);
  });

  it("When Revealed, already stunned: 2 damage, and the status card stays at 1 (no room for another)", () => {
    const { state } = bitten((s) =>
      patchInstance(s, identityOf(s, P1), { statuses: { ...inst(s, identityOf(s, P1)).statuses, stunned: 1 } }),
    );
    expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(1);
    expect(identityDamage(state)).toBe(2);
  });

  it("Preparation: after the attack the attacking character is stunned (the attack is dealt first)", () => {
    const t = stackedFor(game(), BITE);
    const { state, events } = attack(t);
    expect(resolved(events)).toContain("50079.preparation");
    expect(damage(state, t.villain)).toBe(2);
    expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(1);
    expect(inst(state, identityOf(state, P2)).statuses.stunned).toBe(0);
  });

  it("Preparation, the attacking ally is defeated by retaliate first: nobody is stunned", () => {
    const base = attached(stackedFor(game(), BITE), GAUNTLET);
    const cat = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    const hurt = patchInstance(cat.state, cat.id, { damage: 1 });
    const { state } = driveEventsPicking(DEPS, hurt, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cat.id,
      targetInstanceId: base.villain,
    });
    expect(cardsInPlay(state)).not.toContain(cat.id);
    expect(inst(state, identityOf(state, P1)).statuses.stunned).toBe(0);
  });
});
