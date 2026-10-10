import { SILK_CARDS, cardId, type SupportCard, type UpgradeCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  legalActions,
  traitsOf,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  putOnTopOfDeck,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  runWith,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../../../testing/staging.js";
import { SILK_DEPS, engageMinion, silkGame, silkHeroGame, tuckEncounterCard } from "../testing.js";
import {
  SILK_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  SILK_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Silk's supports and upgrades (52006 to 52012), docs/phase7-wave9.md sections 3.39 and 3.41. Core's Rhino set stands
 * in for the encounter sets (Hydra Mercenary 01101, Sandman 01102, Shocker 01103 are the Rhino set; Advance 01186 is
 * the Standard set). The cards tucked under Silk are staged by surgery.
 */
const ALBERT = "52006";
const JAMESON = "52007";
const MEMORY = "52008";
const WEBBING = "52009";
const OUTWIT = "52010";
const CLAWS = "52011";
const REFLEXES = "52012";
const SCOOP = "52005";

const ALBERT_ACTION = "52006.albert-moon-action";
const JAMESON_SEARCH = "52007.j-jonah-jameson-action";
const JAMESON_THWART = "52007.j-jonah-jameson-action-2";
const MEMORY_INTERRUPT = "52008.eidetic-memory-interrupt";
const WEBBING_CONSTANT = "52009.organic-webbing-constant";
const WEBBING_ACTION = "52009.organic-webbing-action";
const OUTWIT_INTERRUPT = "52010.outwit-interrupt";
const CLAWS_INTERRUPT = "52011.spider-claws-interrupt";
const REFLEXES_INTERRUPT = "52012.spider-reflexes-interrupt";

const MERC = "01101";
const SANDMAN = "01102";
const SHOCKER = "01103";
const ADVANCE = "01186";

const card = <T>(code: string): T => SILK_CARDS.find((c) => c.id === cardId(code)) as T;
const refsOf = (code: string): string[] =>
  (card<{ abilities: { id: string }[] }>(code).abilities ?? []).map((a) => a.id as string);
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const tuckedOf = (s: GameState): readonly InstanceId[] => inst(s, identityOf(s)).tucked;
const tuckedCodes = (s: GameState): string[] => tuckedOf(s).map((id) => codeOf(s, id));
const run = (s: GameState, ...c: Parameters<typeof runWith>[2][]): GameState => runWith(SILK_DEPS, s, ...c);
const drive = (s: GameState, pick: Picker = firstLegal): GameState => settle(s, pick, undefined, SILK_DEPS);

/** A support or upgrade `code` of P1's put into play by playing it from hand for its printed cost. */
const cast = (state: GameState, code: string, cost: number) => playFromHand(SILK_DEPS, state, code, cost);

/** `n` tucked copies of the given codes, staged one after the other. */
function withTucked(state: GameState, ...codes: readonly string[]): GameState {
  let s = state;
  for (const code of codes) s = tuckEncounterCard(s, code).state;
  return s;
}

describe("Silk supports and upgrades registry", () => {
  it("every registered ability validates", () => {
    for (const [ref, def] of Object.entries(REGISTRY)) expect(validateDefinition(def), ref).toEqual([]);
  });
  it("registers every printed ref of 52006 to 52012; nothing is skipped", () => {
    const printed = [ALBERT, JAMESON, MEMORY, WEBBING, OUTWIT, CLAWS, REFLEXES].flatMap(refsOf);
    expect(Object.keys(REGISTRY).sort()).toEqual([...printed].sort());
    expect(SKIPPED).toEqual({});
  });
  it("trigger kinds, forms and costs", () => {
    expect(REGISTRY[ALBERT_ACTION]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[ALBERT_ACTION]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[JAMESON_SEARCH]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[JAMESON_SEARCH]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[JAMESON_THWART]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY[JAMESON_THWART]!.trigger).not.toHaveProperty("form");
    // The erratum's "your identity": an Interrupt with no form, so it works on either face.
    expect(REGISTRY[MEMORY_INTERRUPT]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: false,
      on: { on: "encounterCardRevealing", playerIs: "controller" },
    });
    expect(REGISTRY[MEMORY_INTERRUPT]!.trigger).not.toHaveProperty("form");
    expect(REGISTRY[MEMORY_INTERRUPT]!.cost).toEqual({ exhaustSelf: true });
    expect(REGISTRY[MEMORY_INTERRUPT]).not.toHaveProperty("limit");
    expect(REGISTRY[WEBBING_ACTION]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[WEBBING_ACTION]!.cost).toEqual({
      exhaustSelf: true,
      discardTucked: {
        slot: "discarded",
        query: {},
        under: { kind: "identityOf", player: { kind: "controller" } },
        min: 1,
        max: 1,
      },
    });
    expect(REGISTRY[WEBBING_ACTION]).not.toHaveProperty("limit");
    for (const ref of [OUTWIT_INTERRUPT, CLAWS_INTERRUPT, REFLEXES_INTERRUPT]) {
      expect(REGISTRY[ref]!.trigger, ref).toMatchObject({ kind: "interrupt", forced: false, form: "hero" });
      expect(REGISTRY[ref]!.cost, ref).toEqual({ exhaustSelf: true });
    }
  });
});

describe("printed data", () => {
  it("Albert Moon: unique support, cost 2, PERSONA", () => {
    const c = card<SupportCard>(ALBERT);
    expect([c.cost, c.unique, c.type]).toEqual([2, true, "support"]);
    expect(c.traits.map(String)).toEqual(["PERSONA"]);
  });
  it("J. Jonah Jameson: unique support, cost 3, PERSONA", () => {
    const c = card<SupportCard>(JAMESON);
    expect([c.cost, c.unique, c.type]).toEqual([3, true, "support"]);
    expect(c.traits.map(String)).toEqual(["PERSONA"]);
  });
  it("the upgrades: costs 1, 2, 2, 2, 2 and their traits", () => {
    for (const [code, cost, trait] of [
      [MEMORY, 1, "SUPERPOWER"],
      [WEBBING, 2, "SUPERPOWER"],
      [OUTWIT, 2, "SKILL"],
      [CLAWS, 2, "WEAPON"],
      [REFLEXES, 2, "SUPERPOWER"],
    ] as const) {
      const c = card<UpgradeCard>(code);
      expect([c.cost, c.type, c.unique], code).toEqual([cost, "upgrade", false]);
      expect(c.traits.map(String), code).toEqual([trait]);
    }
  });
  it("Eidetic Memory's current text is the RRG 1.8 p. 70 erratum ('your identity' twice); the printed text keeps 'Silk'", () => {
    const text = card<UpgradeCard>(MEMORY).text;
    expect(text.current).toBe(
      "Interrupt: When you reveal a card from the same encounter set as a card tucked under your identity, exhaust Eidetic Memory → swap those cards. Reveal the card that had been tucked under your identity instead.",
    );
    expect(text.printed).toContain("under Silk instead");
  });
});

describe("Albert Moon (52006)", () => {
  const albertIn = (state: GameState) => cast(state, ALBERT, 2);
  const useIt = (s: GameState, id: InstanceId, option: string): GameState =>
    drive(run(s, use(P1, id, ALBERT_ACTION)), (x) => {
      const choice = x.pendingChoice!;
      const hit = choice.options.find((o) => o.label.startsWith(option));
      return hit ? [hit.optionId] : firstLegal(x);
    });

  it("played for 2 resources: in play, ready", () => {
    const { state, id } = albertIn(silkGame());
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("tuck mode: the top card of the encounter deck goes under Cindy Moon and Albert Moon exhausts", () => {
    const { state, id } = albertIn(silkGame());
    const topId = state.encounterDecks[activeEncounterDeckId(state)]!.deck[0]!;
    const used = useIt(state, id, "Tuck");
    expect(tuckedOf(used)).toEqual([topId]);
    expect(inst(used, id).exhausted).toBe(true);
    expect(used.encounterDecks[activeEncounterDeckId(used)]!.deck).not.toContain(topId);
  });
  for (const [tucked, healed] of [
    [0, 0],
    [1, 1],
    [4, 4],
  ] as const) {
    it(`heal mode with ${tucked} tucked: heals ${healed}`, () => {
      const { state, id } = albertIn(silkGame());
      let s = withTucked(state, ...[MERC, SANDMAN, SHOCKER, ADVANCE].slice(0, tucked));
      s = patchInstance(s, identityOf(s), { damage: 5 });
      const used = useIt(s, id, "Heal");
      expect(inst(used, identityOf(used)).damage).toBe(5 - healed);
      expect(tuckedOf(used)).toHaveLength(tucked);
    });
  }
  it("tucking a fifth card triggers the cap (4 remain)", () => {
    const { state, id } = albertIn(silkGame());
    const s = withTucked(state, MERC, SANDMAN, SHOCKER, ADVANCE);
    const used = useIt(s, id, "Tuck");
    expect(tuckedOf(used)).toHaveLength(4);
  });
  it("is an alter-ego action: refused in hero form; exhausted it cannot be used again", () => {
    const { state, id } = albertIn(silkGame());
    const hero = withForm(state, { heroForm: 0 });
    expect(() => run(hero, use(P1, id, ALBERT_ACTION))).toThrow();
    const used = useIt(state, id, "Heal");
    expect(() => run(used, use(P1, id, ALBERT_ACTION))).toThrow();
  });
});

describe("J. Jonah Jameson (52007)", () => {
  const jameson = () => cast(silkGame(), JAMESON, 3);
  const SIDE = "01107";

  it("played for 3 resources: in play, ready", () => {
    const { state, id } = jameson();
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("alter-ego action: Get the Scoop from the deck is put into play with 4 threat; Jameson exhausts; it leaves the deck", () => {
    const { state, id } = jameson();
    const [scoop] = putOnTopOfDeck(state, P1, SCOOP).ids;
    const staged = putOnTopOfDeck(state, P1, SCOOP).state;
    expect(playerOf(staged, P1).deck).toContain(scoop);
    const used = drive(run(staged, use(P1, id, JAMESON_SEARCH)), (x) =>
      x.pendingChoice!.options.some((o) => o.optionId === scoop) ? [scoop!] : firstLegal(x),
    );
    expect(inst(used, id).exhausted).toBe(true);
    expect(used.villainArea).toContain(scoop);
    expect(inst(used, scoop!).threat).toBe(4);
    expect(playerOf(used, P1).deck).not.toContain(scoop);
  });
  it("found in the discard pile too", () => {
    const { state, id } = jameson();
    const [scoop] = instancesOf(state, SCOOP);
    const moved = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              deck: p.deck.filter((i) => i !== scoop),
              hand: p.hand.filter((i) => i !== scoop),
              discard: [...p.discard, scoop!],
            }
          : p,
      ),
    };
    const used = drive(run(moved, use(P1, id, JAMESON_SEARCH)), (x) => {
      const choice = x.pendingChoice!;
      return choice.options.some((o) => o.optionId === scoop) ? [scoop!] : firstLegal(x);
    });
    expect(used.villainArea).toContain(scoop);
    expect(inst(used, scoop!).threat).toBe(4);
    expect(playerOf(used, P1).discard).not.toContain(scoop);
  });
  it("the search action is alter-ego only: refused in hero form", () => {
    const { state, id } = jameson();
    expect(() => run(withForm(state, { heroForm: 0 }), use(P1, id, JAMESON_SEARCH))).toThrow();
  });
  it("action: exhaust, remove 2 threat from a side scheme, in alter-ego form", () => {
    const { state, id } = jameson();
    const side = encounterCardInVillainArea(state, SIDE, 3);
    const used = drive(run(side.state, use(P1, id, JAMESON_THWART)), (x) =>
      x.pendingChoice!.options.some((o) => o.optionId === side.id) ? [side.id] : firstLegal(x),
    );
    expect(inst(used, side.id).threat).toBe(1);
    expect(inst(used, id).exhausted).toBe(true);
  });
  it("the same action in hero form, and with 1 threat left on the side scheme only 1 is removed", () => {
    const { state, id } = jameson();
    const side = encounterCardInVillainArea(withForm(state, { heroForm: 0 }), SIDE, 1);
    const used = drive(run(side.state, use(P1, id, JAMESON_THWART)), (x) =>
      x.pendingChoice!.options.some((o) => o.optionId === side.id) ? [side.id] : firstLegal(x),
    );
    expect(inst(used, side.id).threat).toBe(0);
  });
  it("the main scheme is not a side scheme: it is never offered as the target", () => {
    const { state, id } = jameson();
    const side = encounterCardInVillainArea(state, SIDE, 3);
    const after = run(side.state, use(P1, id, JAMESON_THWART));
    const offered = after.pendingChoice ? after.pendingChoice.options.map((o) => o.optionId as string) : [];
    expect(offered).not.toContain(state.mainScheme.instanceId as string);
  });
});

/** Takes the optional ability whose id ends `ref` when offered, declares Silk the defender, otherwise as `firstLegal`. */
const accepting =
  (ref: string, target?: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers") {
      const hit = ids.find((o) => o.endsWith(ref));
      return hit ? [hit] : firstLegal(s);
    }
    if (choice.prompt.kind === "declareDefender") return [identityOf(s)];
    if (target && ids.includes(target)) return [target];
    return firstLegal(s);
  };
const declining: Picker = (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(s)] : firstLegal(s));
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const basicAttack = (s: GameState, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s), targetInstanceId: target }) as const;
const basicThwart = (s: GameState, scheme: InstanceId) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(s), schemeInstanceId: scheme }) as const;

/** The upgrade `code` put on Silk's identity by playing it from hand for `cost`. */
const upgraded = (state: GameState, code: string, cost: number): GameState => cast(state, code, cost).state;
const upgradeOf = (s: GameState, code: string): InstanceId =>
  inst(s, identityOf(s)).attachments.find((a) => codeOf(s, a) === code)!;

describe("Eidetic Memory (52008): Interrupt: When you reveal a card from the same encounter set as a card tucked under your identity, exhaust Eidetic Memory → swap those cards. Reveal the card that had been tucked under your identity instead.", () => {
  const HARD = "01104";
  const TOUGH = "01105";
  const BREAKIN = "01107";
  const ASSAULT = "01187";

  /**
   * Eidetic Memory in play (cost 1), these cards tucked in this order, and the encounter deck stacked: Advance for
   * Rhino's boost card, then `dealt` as the card dealt to Silk in the villain phase, then `next`.
   */
  function staged(
    tucked: readonly string[],
    dealt: string,
    next: readonly string[] = [],
    start: GameState = silkHeroGame(),
  ) {
    let state = cast(start, MEMORY, 1).state;
    const ids: InstanceId[] = [];
    for (const code of tucked) {
      const placed = tuckEncounterCard(state, code);
      state = placed.state;
      ids.push(placed.id);
    }
    state = stackEncounterDeck(state, ADVANCE, dealt, ...next);
    const deck = state.encounterDecks[activeEncounterDeckId(state)]!.deck;
    return { state, ids, dealt: deck[1]!, memory: upgradeOf(state, MEMORY) };
  }
  /** Ends the turn: the villain phase plays out, the interrupt taken when offered, `tucked` chosen when asked. */
  const villainPhase = (s: GameState, tucked?: InstanceId) =>
    driveEventsPicking(SILK_DEPS, s, accepting(MEMORY_INTERRUPT, tucked), { type: "endTurn", playerId: P1 });
  const encounterDiscard = (s: GameState): readonly InstanceId[] => s.encounterDecks[activeEncounterDeckId(s)]!.discard;
  const inPlay = (s: GameState, id: InstanceId): boolean =>
    playerOf(s, P1).playArea.includes(id) || s.villainArea.includes(id);
  const toughOn = (s: GameState): number => inst(s, villainOf(s)).statuses.tough;
  const revealedCodes = (events: readonly { readonly type: string }[]): string[] =>
    events
      .filter((e): e is { type: "encounterCardRevealed"; cardId: string } => e.type === "encounterCardRevealed")
      .map((e) => e.cardId);
  const memoryOffers = (events: readonly { readonly type: string }[]): number =>
    events.filter((e) => e.type === "choiceRequested" && JSON.stringify(e).includes(MEMORY_INTERRUPT)).length;

  it("played for 1: attached to Silk's identity", () => {
    const { state } = cast(silkHeroGame(), MEMORY, 1);
    expect(inst(state, identityOf(state)).attachments.map((a) => codeOf(state, a))).toContain(MEMORY);
  });

  it('0 tucked: not offered; "I\'m Tough!" resolves as usual (Rhino gets a tough status card) and Eidetic Memory stays ready', () => {
    const { state: at, dealt } = staged([], TOUGH);
    const { state, events } = villainPhase(at);
    expect(memoryOffers(events)).toBe(0);
    expect(toughOn(state)).toBe(1);
    expect(tuckedOf(state)).toEqual([]);
    expect(encounterDiscard(state)).toContain(dealt);
    expect(inst(state, upgradeOf(state, MEMORY)).exhausted).toBe(false);
  });

  it("only a card of another encounter set tucked (Assault, Standard): not offered for a Rhino-set card", () => {
    const { state: at, ids } = staged([ASSAULT], TOUGH);
    const { state, events } = villainPhase(at);
    expect(memoryOffers(events)).toBe(0);
    expect(toughOn(state)).toBe(1);
    expect(tuckedOf(state)).toEqual(ids);
  });

  it('1 tucked minion (Hydra Mercenary), a treachery revealed ("I\'m Tough!"): the treachery is tucked unresolved and the minion is revealed and engages Silk', () => {
    const { state: at, ids, dealt, memory } = staged([MERC], TOUGH);
    const { state, events } = villainPhase(at);
    expect(memoryOffers(events)).toBe(1);
    expect(tuckedOf(state)).toEqual([dealt]);
    expect(tuckedCodes(state)).toEqual([TOUGH]);
    expect(toughOn(state)).toBe(0);
    expect(encounterDiscard(state)).not.toContain(dealt);
    expect(playerOf(state, P1).playArea).toContain(ids[0]);
    expect(inst(state, ids[0]!).engagedWith).toBe(P1);
    expect(revealedCodes(events)).toEqual([TOUGH, MERC]);
    expect(events.filter((e) => e.type === "revealReplaced")).toEqual([
      { type: "revealReplaced", instanceId: dealt, withInstanceIds: [ids[0]], playerId: P1 },
    ]);
    // It was exhausted for this in the villain phase; the next round has readied it.
    expect(events.some((e) => e.type === "cardExhausted" && e.instanceId === memory)).toBe(true);
  });

  it('1 tucked treachery ("I\'m Tough!"), a minion revealed (Sandman): Sandman is tucked and never enters play; Rhino gets the tough status card', () => {
    const { state: at, ids, dealt } = staged([TOUGH], SANDMAN);
    const { state, events } = villainPhase(at);
    expect(tuckedOf(state)).toEqual([dealt]);
    expect(inPlay(state, dealt)).toBe(false);
    expect(inst(state, dealt).engagedWith).toBeNull();
    expect(toughOn(state)).toBe(1);
    expect(encounterDiscard(state)).toContain(ids[0]);
    expect(revealedCodes(events)).toEqual([SANDMAN, TOUGH]);
  });

  it("1 tucked side scheme (Breakin' & Takin'), a treachery revealed: the side scheme enters play with 2 + 1 = 3 threat; the treachery is tucked", () => {
    const { state: at, ids, dealt } = staged([BREAKIN], TOUGH);
    const { state } = villainPhase(at);
    expect(tuckedOf(state)).toEqual([dealt]);
    expect(toughOn(state)).toBe(0);
    expect(state.villainArea).toContain(ids[0]);
    expect(inst(state, ids[0]!).threat).toBe(3);
  });

  it("1 tucked minion, a side scheme revealed (Breakin' & Takin'): the side scheme is tucked with no threat; the minion engages", () => {
    const { state: at, ids, dealt } = staged([SHOCKER], BREAKIN);
    const { state } = villainPhase(at);
    expect(tuckedOf(state)).toEqual([dealt]);
    expect(state.villainArea).not.toContain(dealt);
    expect(inst(state, dealt).threat).toBe(0);
    expect(inst(state, ids[0]!).engagedWith).toBe(P1);
  });

  it('the card revealed instead surges: "I\'m Tough!" with Rhino already tough gains surge, and the next card (Hydra Mercenary) is revealed', () => {
    const base = staged([TOUGH], SANDMAN, [MERC]);
    const at = patchInstance(base.state, villainOf(base.state), {
      statuses: { ...inst(base.state, villainOf(base.state)).statuses, tough: 1 },
    });
    const merc = at.encounterDecks[activeEncounterDeckId(at)]!.deck[2]!;
    const { state, events } = villainPhase(at);
    expect(tuckedOf(state)).toEqual([base.dealt]);
    expect(revealedCodes(events)).toEqual([SANDMAN, TOUGH, MERC]);
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    expect(inst(state, merc).engagedWith).toBe(P1);
  });

  it("the card swapped away does not surge: Hard to Keep Down (Rhino undamaged) is tucked and the next card stays on the deck", () => {
    const { state: at, ids, dealt } = staged([MERC], HARD, [SHOCKER]);
    const next = at.encounterDecks[activeEncounterDeckId(at)]!.deck[2]!;
    const { state, events } = villainPhase(at);
    expect(tuckedOf(state)).toEqual([dealt]);
    expect(events.filter((e) => e.type === "surgeTriggered")).toEqual([]);
    expect(revealedCodes(events)).toEqual([HARD, MERC]);
    expect(inst(state, ids[0]!).engagedWith).toBe(P1);
    expect(inPlay(state, next)).toBe(false);
  });

  it("4 tucked, 3 of Rhino's set: those 3 are offered; choosing \"I'm Tough!\" puts Sandman in its place, still 4 tucked and the cap discards nothing", () => {
    const { state: at, ids, dealt } = staged([MERC, ASSAULT, TOUGH, BREAKIN], SANDMAN);
    const { state, events } = villainPhase(at, ids[2]);
    const asked = events.find((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseCards");
    const options = asked?.type === "choiceRequested" ? asked.choice.options.map((o) => o.optionId as string) : [];
    expect(options.sort()).toEqual([ids[0], ids[2], ids[3]].sort());
    expect(tuckedOf(state)).toEqual([ids[0], ids[1], dealt, ids[3]]);
    expect(tuckedCodes(state)).toEqual([MERC, ASSAULT, SANDMAN, BREAKIN]);
    expect(toughOn(state)).toBe(1);
    expect(encounterDiscard(state)).toContain(ids[2]);
    for (const kept of [ids[0], ids[1], ids[3]]) expect(encounterDiscard(state)).not.toContain(kept);
    expect(state.villainArea).not.toContain(ids[3]);
  });

  it("declined: the revealed card resolves as usual and nothing is swapped", () => {
    const { state: at, ids, dealt } = staged([MERC], TOUGH);
    const { state, events } = driveEventsPicking(SILK_DEPS, at, declining, { type: "endTurn", playerId: P1 });
    expect(memoryOffers(events)).toBe(1);
    expect(tuckedOf(state)).toEqual(ids);
    expect(toughOn(state)).toBe(1);
    expect(encounterDiscard(state)).toContain(dealt);
    expect(events.filter((e) => e.type === "revealReplaced")).toEqual([]);
  });

  it("alter-ego form (the erratum's 'your identity'): Cindy Moon uses it the same way", () => {
    const { state: at, ids, dealt } = staged([MERC], TOUGH, [], silkGame());
    expect(playerOf(at, P1).identity.form).toBe("alterEgo");
    const { state, events } = villainPhase(at);
    expect(tuckedOf(state)).toEqual([dealt]);
    expect(toughOn(state)).toBe(0);
    expect(inst(state, ids[0]!).engagedWith).toBe(P1);
    expect(revealedCodes(events)).toEqual([TOUGH, MERC]);
  });
});

describe("Organic Webbing (52009)", () => {
  it("played for 2: attached to Silk's identity", () => {
    const { state } = cast(silkHeroGame(), WEBBING, 2);
    expect(inst(state, identityOf(state)).attachments.map((a) => codeOf(state, a))).toContain(WEBBING);
  });
  it("hero form: Silk's basic thwart removes 1 + 1 = 2 threat (1 without it)", () => {
    const base = patchInstance(silkHeroGame(), silkHeroGame().mainScheme.instanceId, { threat: 10 });
    const before = 10;
    const without = run(base, basicThwart(base, schemeOf(base)));
    expect(before - inst(without, schemeOf(without)).threat).toBe(1);
    const armed = upgraded(base, WEBBING, 2);
    const withIt = run(armed, basicThwart(armed, schemeOf(armed)));
    expect(before - inst(withIt, schemeOf(withIt)).threat).toBe(2);
  });
});

describe("Organic Webbing's action (52009): Hero Action: Exhaust Organic Webbing and discard a card tucked under Silk → ready Silk. She gains the Aerial trait until the end of the round.", () => {
  it("both printed abilities are registered", () => {
    expect(
      Object.keys(REGISTRY)
        .filter((r) => r.startsWith("52009"))
        .sort(),
    ).toEqual([WEBBING_ACTION, WEBBING_CONSTANT].sort());
  });

  /** Silk in hero form, exhausted, with Organic Webbing ready on her and these cards tucked under her, in this order. */
  function webbed(...codes: readonly string[]): {
    readonly state: GameState;
    readonly webbing: InstanceId;
    readonly ids: readonly InstanceId[];
  } {
    let state = upgraded(silkHeroGame(), WEBBING, 2);
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const tucked = tuckEncounterCard(state, code);
      state = tucked.state;
      ids.push(tucked.id);
    }
    state = patchInstance(state, identityOf(state), { exhausted: true });
    return { state, webbing: upgradeOf(state, WEBBING), ids };
  }
  const web = (s: GameState, pick?: InstanceId): Command =>
    use(P1, upgradeOf(s, WEBBING), WEBBING_ACTION, [], pick ? { discarded: [pick] } : undefined);
  const go = (s: GameState, pick?: InstanceId) => driveEventsPicking(SILK_DEPS, s, firstLegal, web(s, pick));
  const encounterDiscard = (s: GameState): readonly InstanceId[] => s.encounterDecks[activeEncounterDeckId(s)]!.discard;
  const aerial = (s: GameState): boolean => traitsOf(s, identityOf(s), SILK_DEPS).map(String).includes("AERIAL");
  /** How `legalActions` lists the action: "legal", or the engine's reason for refusing it; null when not listed. */
  function listed(s: GameState): string | null {
    const actions = legalActions(s, P1, SILK_DEPS);
    if (actions.kind !== "turn") return null;
    const mine = (a: { readonly action: unknown }) => JSON.stringify(a.action).includes(`"${WEBBING_ACTION}"`);
    if (actions.legal.some(mine)) return "legal";
    return actions.illegal.find(mine)?.reason ?? null;
  }

  it("0 tucked: the cost cannot be paid; the action is not legal, the command is refused, nothing exhausts or readies", () => {
    const { state, webbing } = webbed();
    expect(listed(state)).toBe("no_valid_target");
    const result = applyCommand(state, web(state), SILK_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("not enough tucked cards to discard for this cost");
    expect([inst(state, webbing).exhausted, inst(state, identityOf(state)).exhausted, aerial(state)]).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("1 tucked (Hydra Mercenary): it goes to the encounter discard pile, Organic Webbing exhausts, Silk readies and is Aerial", () => {
    const { state, webbing, ids } = webbed(MERC);
    expect(listed(state)).toBe("legal");
    expect(aerial(state)).toBe(false);
    const { state: after, events } = go(state);
    expect(tuckedOf(after)).toEqual([]);
    expect(encounterDiscard(after)).toEqual([ids[0], ...encounterDiscard(state)]);
    expect(inst(after, webbing).exhausted).toBe(true);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(aerial(after)).toBe(true);
    expect(events.filter((e) => e.type === "cardMoved" && e.from.kind === "tucked")).toEqual([
      {
        type: "cardMoved",
        instanceId: ids[0],
        cardId: MERC,
        from: { kind: "tucked", hostInstanceId: identityOf(state) },
        to: { kind: "encounterDiscard", deckId: activeEncounterDeckId(state) },
      },
    ]);
  });

  it("4 tucked: the player must name one; naming the third (Shocker) discards only it and the other 3 stay in order", () => {
    const { state, ids } = webbed(MERC, SANDMAN, SHOCKER, ADVANCE);
    expect(listed(state)).toBe("legal");
    const bare = applyCommand(state, web(state), SILK_DEPS);
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.error.code).toBe("invalid_choice");
    const { state: after } = go(state, ids[2]);
    expect(tuckedOf(after)).toEqual([ids[0], ids[1], ids[3]]);
    expect(tuckedCodes(after)).toEqual([MERC, SANDMAN, ADVANCE]);
    expect(encounterDiscard(after)).toEqual([ids[2], ...encounterDiscard(state)]);
    expect([inst(after, identityOf(after)).exhausted, aerial(after)]).toEqual([false, true]);
  });

  it("a card that is not tucked under Silk cannot pay: naming a card in hand is refused", () => {
    const { state } = webbed(MERC);
    const result = applyCommand(state, web(state, playerOf(state, P1).hand[0]), SILK_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
  });

  it("the readied Silk thwarts again: 2 threat (THW 1 + 1) before and 2 more after, 10 to 6", () => {
    const { state, ids } = webbed(MERC);
    const ready = patchInstance(
      patchInstance(state, identityOf(state), { exhausted: false }),
      state.mainScheme.instanceId,
      { threat: 10 },
    );
    const once = run(ready, basicThwart(ready, schemeOf(ready)));
    expect([inst(once, schemeOf(once)).threat, inst(once, identityOf(once)).exhausted]).toEqual([8, true]);
    const { state: readied } = go(once, ids[0]);
    const twice = run(readied, basicThwart(readied, schemeOf(readied)));
    expect(inst(twice, schemeOf(twice)).threat).toBe(6);
  });

  it("no printed limit, but exhausted it cannot be used again: with 2 tucked the second use is refused and 1 stays tucked", () => {
    const { state, ids } = webbed(MERC, SANDMAN);
    const { state: once } = go(state, ids[0]);
    expect(listed(once)).not.toBe("legal");
    expect(applyCommand(once, web(once, ids[1]), SILK_DEPS).ok).toBe(false);
    expect(tuckedOf(once)).toEqual([ids[1]]);
  });

  it("readied by another effect in the same round, it is used a second time: no once-per-round limit", () => {
    const { state, webbing, ids } = webbed(MERC, SANDMAN);
    const { state: once } = go(state, ids[0]);
    const again = patchInstance(once, webbing, { exhausted: false });
    expect(listed(again)).toBe("legal");
    const { state: twice } = go(again, ids[1]);
    expect(tuckedOf(twice)).toEqual([]);
    // The top of the pile is first: the second discard lies on the first.
    expect(encounterDiscard(twice).slice(0, 2)).toEqual([ids[1], ids[0]]);
  });

  it("the Aerial trait lasts until the end of the round: still there in the villain phase's wake, gone on her next turn", () => {
    const { state } = webbed(MERC);
    const { state: after } = go(state);
    expect(aerial(after)).toBe(true);
    const { state: next } = driveEventsPicking(SILK_DEPS, after, firstLegal, { type: "endTurn", playerId: P1 });
    expect(next.outcome).toBeNull();
    expect(next.round).toBe(after.round + 1);
    expect(aerial(next)).toBe(false);
  });

  it("a Hero Action: in alter-ego form (Cindy Moon) it is not available, with a card tucked", () => {
    const { state } = webbed(MERC);
    const cindy = withForm(state, "alterEgo");
    expect(playerOf(cindy, P1).identity.form).toBe("alterEgo");
    expect(listed(cindy)).not.toBe("legal");
    expect(applyCommand(cindy, web(cindy), SILK_DEPS).ok).toBe(false);
    expect(tuckedOf(cindy)).toHaveLength(1);
  });
});

describe("Outwit (52010)", () => {
  /** Silk in hero form with Outwit and `tucked` staged; the main scheme (Rhino's set) has 10 threat. */
  const setup = (...tucked: string[]) => {
    const armed = upgraded(silkHeroGame(), OUTWIT, 2);
    const s = withTucked(armed, ...tucked);
    return patchInstance(s, schemeOf(s), { threat: 10 });
  };
  const thwartWith = (s: GameState, pick: Picker) =>
    driveEventsPicking(SILK_DEPS, s, pick, basicThwart(s, schemeOf(s)));
  for (const [tucked, removed] of [
    [[], 1],
    [[SANDMAN], 2],
    [[SANDMAN, SHOCKER, MERC], 4],
  ] as const) {
    it(`${tucked.length} tucked cards of the scheme's set: THW 1 + ${tucked.length} = ${removed}`, () => {
      const s = setup(...tucked);
      const { state } = thwartWith(s, accepting(OUTWIT_INTERRUPT));
      expect(10 - inst(state, schemeOf(state)).threat).toBe(removed);
      expect(inst(state, upgradeOf(state, OUTWIT)).exhausted).toBe(tucked.length >= 0);
    });
  }
  it("only cards of the thwarted scheme's set count: 1 Rhino card and 3 of another set give 1 + 1 = 2", () => {
    const s = setup(SANDMAN, ADVANCE);
    const { state } = thwartWith(s, accepting(OUTWIT_INTERRUPT));
    expect(10 - inst(state, schemeOf(state)).threat).toBe(2);
  });
  it("4 tucked of the set: 1 + 4 = 5", () => {
    const s = setup(SANDMAN, SHOCKER, MERC, "01104");
    const { state } = thwartWith(s, accepting(OUTWIT_INTERRUPT));
    expect(10 - inst(state, schemeOf(state)).threat).toBe(5);
  });
  it("declined: THW 1 only and Outwit stays ready", () => {
    const s = setup(SANDMAN);
    const { state } = thwartWith(s, declining);
    expect(10 - inst(state, schemeOf(state)).threat).toBe(1);
    expect(inst(state, upgradeOf(state, OUTWIT)).exhausted).toBe(false);
  });
  it("with Organic Webbing: 1 + 1 + 1 = 3", () => {
    const s = upgraded(setup(SANDMAN), WEBBING, 2);
    const { state } = thwartWith(s, accepting(OUTWIT_INTERRUPT));
    expect(10 - inst(state, schemeOf(state)).threat).toBe(3);
  });
  it("is a Hero Interrupt: Cindy Moon cannot thwart at all, so there is no basic thwart to answer in alter-ego form", () => {
    const s = withForm(setup(SANDMAN), "alterEgo");
    expect(() => thwartWith(s, accepting(OUTWIT_INTERRUPT))).toThrow(/wrong_form/);
  });
});

describe("Spider Claws (52011)", () => {
  const setup = (...tucked: string[]) => withTucked(upgraded(silkHeroGame(), CLAWS, 2), ...tucked);
  const hit = (s: GameState, pick: Picker, target = villainOf(s)) =>
    driveEventsPicking(SILK_DEPS, s, pick, basicAttack(s, target)).state;
  for (const [tucked, damage] of [
    [[], 2],
    [[SANDMAN], 3],
    [[SANDMAN, SHOCKER, MERC, "01104"], 6],
  ] as const) {
    it(`${tucked.length} tucked cards of Rhino's set: ATK 2 + ${tucked.length} = ${damage}`, () => {
      const s = setup(...tucked);
      const after = hit(s, accepting(CLAWS_INTERRUPT));
      expect(inst(after, villainOf(after)).damage).toBe(damage);
      expect(inst(after, upgradeOf(after, CLAWS)).exhausted).toBe(true);
    });
  }
  it("two Morlun-set style cards: only the attacked enemy's set counts (1 Rhino + 2 of another set: 2 + 1 = 3)", () => {
    const after = hit(setup(SANDMAN, ADVANCE, "01187"), accepting(CLAWS_INTERRUPT));
    expect(inst(after, villainOf(after)).damage).toBe(3);
  });
  it("declined: ATK 2 and Spider Claws stays ready", () => {
    const after = hit(setup(SANDMAN), declining);
    expect(inst(after, villainOf(after)).damage).toBe(2);
    expect(inst(after, upgradeOf(after, CLAWS)).exhausted).toBe(false);
  });
  it("the attack gains piercing (RRG 1.8 p. 32): the tough status card is discarded first and the damage is dealt", () => {
    const placed = engageMinion(setup(SHOCKER), SANDMAN);
    const tough = patchInstance(placed.state, placed.id, {
      statuses: { ...inst(placed.state, placed.id).statuses, tough: 1 },
    });
    // Without the interrupt the status card absorbs the whole attack.
    const without = hit(tough, declining, placed.id);
    expect(inst(without, placed.id).damage).toBe(0);
    expect(inst(without, placed.id).statuses.tough).toBe(0);
    // With it: piercing discards the status card, then 2 + 1 = 3 damage on Sandman's 4 hit points.
    const after = hit(tough, accepting(CLAWS_INTERRUPT), placed.id);
    expect(inst(after, placed.id).damage).toBe(3);
    expect(inst(after, placed.id).statuses.tough).toBe(0);
  });
  it("a Hero Interrupt: not offered to an alter-ego form's attack", () => {
    expect(REGISTRY[CLAWS_INTERRUPT]!.trigger).toMatchObject({ form: "hero" });
  });
});

describe("Spider Reflexes (52012)", () => {
  /**
   * Hero form, Reflexes on Silk, `tucked` staged; ending the turn makes Rhino attack her with Sandman (2 boost icons) as
   * the boost card: ATK 2 + 2 = 4 against DEF 3, so 1 damage with no bonus. Silk Sense is declined throughout.
   */
  const setup = (...tucked: string[]) =>
    stackEncounterDeck(withTucked(upgraded(silkHeroGame(), REFLEXES, 2), ...tucked), SANDMAN, ADVANCE);
  const endTurn = (s: GameState, pick: Picker) =>
    driveEventsPicking(SILK_DEPS, s, pick, { type: "endTurn", playerId: P1 }).state;
  const defendWith =
    (take: boolean): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") return [identityOf(s)];
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.endsWith(REFLEXES_INTERRUPT));
        return hit && take ? [hit.optionId] : [];
      }
      return firstLegal(s);
    };
  const damageOf = (s: GameState): number => inst(s, identityOf(s)).damage;

  it("with nothing tucked: DEF 3 + 0, the attack still deals 1; the interrupt exhausts it; afterwards the boost card (Sandman) is tucked: 1 tucked", () => {
    const after = endTurn(setup(), defendWith(true));
    expect(damageOf(after)).toBe(1);
    expect(inst(after, upgradeOf(after, REFLEXES)).exhausted).toBe(true);
    expect(tuckedCodes(after)).toEqual([SANDMAN]);
    expect(after.encounterDecks[activeEncounterDeckId(after)]!.discard.map((i) => codeOf(after, i))).not.toContain(
      SANDMAN,
    );
  });
  it("1 tucked card of Rhino's set: DEF 3 + 1 = 4, no damage, and the new tuck makes 2", () => {
    const after = endTurn(setup(SHOCKER), defendWith(true));
    expect(damageOf(after)).toBe(0);
    expect(tuckedCodes(after)).toEqual([SHOCKER, SANDMAN]);
  });
  it("2 tucked cards of Rhino's set: no damage either (DEF 5), 3 tucked afterwards", () => {
    const after = endTurn(setup(SHOCKER, MERC), defendWith(true));
    expect(damageOf(after)).toBe(0);
    expect(tuckedCodes(after)).toEqual([SHOCKER, MERC, SANDMAN]);
  });
  it("4 tucked: the new tuck is a fifth and the cap leaves 4", () => {
    const after = endTurn(setup(SHOCKER, MERC, "01104", "01105"), defendWith(true));
    expect(damageOf(after)).toBe(0);
    expect(tuckedOf(after)).toHaveLength(4);
  });
  it("a tucked card of another set gives nothing: Advance tucked, 1 damage as with none", () => {
    const after = endTurn(setup(ADVANCE), defendWith(true));
    expect(damageOf(after)).toBe(1);
    expect(tuckedCodes(after)).toEqual([ADVANCE, SANDMAN]);
  });
  it("declined: 1 damage, Reflexes ready, nothing tucked by it", () => {
    const after = endTurn(setup(SHOCKER), defendWith(false));
    expect(damageOf(after)).toBe(1);
    expect(inst(after, upgradeOf(after, REFLEXES)).exhausted).toBe(false);
    expect(tuckedCodes(after)).toEqual([SHOCKER]);
  });
  it("not offered when Silk does not defend (the attack is undefended)", () => {
    const seen: string[] = [];
    endTurn(setup(SHOCKER), (s) => {
      const choice = s.pendingChoice!;
      seen.push(...choice.options.map((o) => o.optionId as string));
      return choice.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
    });
    expect(seen.some((o) => o.endsWith(REFLEXES_INTERRUPT))).toBe(false);
  });
});
