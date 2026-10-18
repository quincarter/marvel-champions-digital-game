import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  characterProfile,
  createGame,
  legalActions,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { validateDefinition } from "../../dsl/validate.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  payWith,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE10_ABILITIES } from "../../wave10/index.js";
import { stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE11_DEPS as DEPS } from "../index.js";
import { LUKE_CAGE_LEADERSHIP as REGISTRY, LUKE_CAGE_LEADERSHIP_SKIPPED as SKIPPED } from "./leadership.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `luke_cage/leadership` (docs/phase7-wave11-hero-packs.md H8.4, HS13): Iron Fist 62012, Misty Knight 62013,
 * Valkyrie 62014, Take a Stand 62015, Defensive Formation 62018 and Righteous Purpose 62019, plus the reprints 62016
 * and 62017. Every card is a Leadership card played in the deck of a Core hero (Captain Marvel, the Core Leadership precon
 * deck), against Core's Rhino with two Advance cards stacked (boost 0), so his villain-phase attack is
 * the plain attack the interrupts and responses answer. No FFG ruling since RRG 1.7 names these cards except August 3,
 * 2026 (2): Valkyrie's interrupt resolves before simultaneous ally defeats (wave 9 engine rule, not re-tested here).
 */
const IRON_FIST_REF = "62012.iron-fist-interrupt";
const MISTY_REF = "62013.misty-knight-constant";
const VALKYRIE_REF = "62014.valkyrie-interrupt";
const TAKE_A_STAND_REF = "62015.take-a-stand-response";
const INNOVATION_REF = "62016.innovation-response";
const POWER_REF = "62017.the-power-of-leadership-constant";
const FORMATION_REF = "62018.defensive-formation-action";
const PURPOSE_REF = "62019.righteous-purpose-constant";

const IRON_FIST = "62012";
const MISTY = "62013";
const VALKYRIE = "62014";
const TAKE_A_STAND = "62015";
const FORMATION = "62018";
const PURPOSE = "62019";
const ADVANCE = "01186"; // Core treachery, boost 0
const ULTRON_TREACHERY = "01154"; // Core: When Revealed, 1 damage to each friendly character
const TAUNT = "42016"; // Angel's Taunt (Protection): the villain attacks you, and only your hero can defend
const ENERGY = "01088"; // Core resource: one energy
const CORE_HERO = "core-captain-marvel-leadership";
const SPIDER_MAN = "core-spider-man-justice";

/** A Core hero (hero form) with a copy of `code` in hand, against Rhino with Advance stacked. */
function coreGame(code: string, twoPlayers = false): { readonly state: GameState; readonly id: InstanceId } {
  const config = coreScenario("rhino", {
    players: twoPlayers
      ? [
          buildCrossHeroDeck(PLAYABLE_CARDS, CORE_HERO, code),
          coreScenario("rhino", { players: [{ starterDeckId: SPIDER_MAN }], seed: 1 }).players[0]!,
        ]
      : [buildCrossHeroDeck(PLAYABLE_CARDS, CORE_HERO, code)],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(`${code}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const given = moveToHand(withForm(opened, { heroForm: 0 }), P1, code);
  return { state: stackEncounterDeck(given.state, ADVANCE, ADVANCE), id: given.ids[0]! };
}
const baseGame = (twoPlayers = false): GameState => coreGame(ENERGY, twoPlayers).state;

function playCommand(state: GameState, id: InstanceId, player: PlayerId = P1): Command | null {
  const actions = legalActions(state, player, DEPS);
  if (actions.kind !== "turn") return null;
  return actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id)?.example ?? null;
}

interface Plan {
  readonly take?: readonly string[];
  readonly keep?: readonly InstanceId[];
  /** Hand cards that pay for a card played in a response. */
  readonly pay?: readonly InstanceId[];
  readonly windows?: string[][];
}
/** Answers a prompt: `take` where offered (by id or id suffix), never discarding `keep`, else the first legal choice. */
const planned =
  (plan: Plan = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers") plan.windows?.push(ids);
    if (choice.prompt.kind === "discardDownToHandSize") {
      return ids.filter((i) => !(plan.keep ?? []).includes(i as InstanceId)).slice(0, choice.minSelections);
    }
    if (choice.prompt.kind === "payForCard") {
      const named = ids.filter((i) => (plan.pay ?? []).includes(i.replace("hand:", "") as InstanceId));
      return (named.length > 0 ? named : ids.slice(0, 1)).slice(0, choice.maxSelections);
    }
    const hit = (plan.take ?? []).find((t) => ids.some((i) => i === t || i.endsWith(t)));
    if (hit !== undefined) return [ids.find((i) => i === hit || i.endsWith(hit))!];
    return firstLegal(s);
  };
const drive = (s: GameState, plan?: Plan, ...commands: Command[]): GameState =>
  settle(runWith(DEPS, s, ...commands), planned(plan), undefined, DEPS);
const villainPhase = (s: GameState, plan?: Plan): GameState =>
  s.players.reduce((state, p) => drive(state, plan, endTurn(p.playerId)), s);
/** Surgery: a card in P1's play area passes to P2's control and play area. */
const giveToP2 = (s: GameState, id: InstanceId): GameState => {
  const moved: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1
        ? { ...p, playArea: p.playArea.filter((i) => i !== id) }
        : p.playerId === P2
          ? { ...p, playArea: [...p.playArea, id] }
          : p,
    ),
  };
  return patchInstance(moved, id, { controllerId: P2 });
};

const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
/** Surgery: a deck card retagged as `code` (the deck keeps its size), put into the play area, holding `counters`. */
const inPlay = (s: GameState, code: string, counters: Readonly<Record<string, number>> = {}) => {
  const spare = playerOf(s, P1).deck.filter((i) => (inst(s, i).cardId as string) !== code);
  return stagedInPlay(patchInstance(s, spare[spare.length - 1]!, { cardId: cardId(code) }), code, { counters });
};
const withTough = (s: GameState, id: InstanceId) =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 1 } });

describe("registry", () => {
  it("registers every ref of the module, skips none, and each validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        IRON_FIST_REF,
        MISTY_REF,
        VALKYRIE_REF,
        TAKE_A_STAND_REF,
        INNOVATION_REF,
        POWER_REF,
        FORMATION_REF,
        PURPOSE_REF,
      ].sort(),
    );
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY[IRON_FIST_REF]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY[VALKYRIE_REF]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY[TAKE_A_STAND_REF]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[FORMATION_REF]!.trigger).toMatchObject({ kind: "action" });
  });

  it("aliases each reprint to its original's script, and the printed text is the original's", () => {
    const ALIASES: readonly (readonly [string, string])[] = [
      [INNOVATION_REF, "21058.innovation-response"],
      [POWER_REF, "01072.the-power-of-leadership-constant"],
    ];
    const text = (code: string): string => {
      const card = PLAYABLE_CARDS.find((c) => (c.id as string) === code) as unknown as { text?: { current: string } };
      return (card.text?.current ?? "").replace(/\s+/g, " ").trim();
    };
    for (const [ref, source] of ALIASES) {
      expect(REGISTRY[ref], ref).toBe(WAVE10_ABILITIES[source]);
      expect(text(ref.split(".")[0]!), ref).not.toBe("");
      expect(text(ref.split(".")[0]!), ref).toBe(text(source.split(".")[0]!));
    }
  });
});

describe(`${IRON_FIST_REF}: Interrupt: when Iron Fist defends, prevent damage equal to his ATK`, () => {
  /**
   * Rhino attacks once the turn ends; Iron Fist is declared the defender; the interrupt is taken when `respond`. The
   * boost card is Sandman (2 boost icons), so the attack is 2 + 2 = 4, more than his ATK of 2: preventing exactly his
   * ATK leaves 2, not 0 (declined, 4 damage defeats his 3 hit points).
   */
  const defended = (respond: boolean) => {
    const fist = inPlay(baseGame(), IRON_FIST);
    const windows: string[][] = [];
    const take = [fist.id as string, ...(respond ? [IRON_FIST_REF] : [])];
    const stacked = stackEncounterDeck(fist.state, "01102");
    return { id: fist.id, windows, state: villainPhase(stacked, { take, windows }) };
  };

  it("declined, Iron Fist takes the whole attack (4) and is defeated", () => {
    const { state, id } = defended(false);
    expect(playerOf(state, P1).discard).toContain(id);
  });

  it("taken, he prevents exactly his ATK (2) of the 4 damage: he takes 2 and survives", () => {
    const { state, id, windows } = defended(true);
    expect(windows.flat().some((o) => o.endsWith(IRON_FIST_REF))).toBe(true);
    expect(profile(state, id).atk).toBe(2);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).damage).toBe(2);
  });
});

describe(`${MISTY_REF}: +2 ATK and +2 THW while she has a tough status card`, () => {
  it("1 ATK and 1 THW without a tough status card", () => {
    const misty = inPlay(baseGame(), MISTY);
    expect(profile(misty.state, misty.id)).toMatchObject({ atk: 1, thw: 1 });
  });

  it("3 ATK and 3 THW with one, and back to 1 when it is gone", () => {
    const misty = inPlay(baseGame(), MISTY);
    const tough = withTough(misty.state, misty.id);
    expect(profile(tough, misty.id)).toMatchObject({ atk: 3, thw: 3 });
    const gone = patchInstance(tough, misty.id, { statuses: { ...inst(tough, misty.id).statuses, tough: 0 } });
    expect(profile(gone, misty.id)).toMatchObject({ atk: 1, thw: 1 });
  });

  it("played from a Core hero's deck, Toughness gives her the status card and so the bonus", () => {
    const { state, id } = coreGame(MISTY);
    const cmd = playCommand(state, id)!;
    expect(cmd).not.toBeNull();
    const after = drive(state, undefined, cmd);
    expect(inst(after, id).statuses.tough).toBe(1);
    expect(profile(after, id)).toMatchObject({ atk: 3, thw: 3 });
  });
});

describe(`${VALKYRIE_REF}: Interrupt: when another ally would be defeated, discard Valkyrie: heal it to 1 hit point`, () => {
  /** Valkyrie and Misty Knight (2 hit points) in play; Misty defends Rhino's 2 damage; the interrupt is taken if `respond`. */
  const setup = (respond: boolean, mistyDamage = 0) => {
    const valkyrie = inPlay(baseGame(), VALKYRIE);
    const misty = inPlay(valkyrie.state, MISTY);
    const hurt = patchInstance(misty.state, misty.id, { damage: mistyDamage });
    const windows: string[][] = [];
    const take = [misty.id as string, ...(respond ? [VALKYRIE_REF] : [])];
    return { valkyrie: valkyrie.id, misty: misty.id, windows, state: villainPhase(hurt, { take, windows }) };
  };

  it("declined, the ally is defeated", () => {
    const { state, misty } = setup(false);
    expect(playerOf(state, P1).discard).toContain(misty);
  });

  it("taken, Valkyrie is discarded and the ally is left with exactly 1 hit point remaining", () => {
    const { state, misty, valkyrie, windows } = setup(true);
    expect(windows.flat().some((o) => o.endsWith(VALKYRIE_REF))).toBe(true);
    expect(playerOf(state, P1).discard).toContain(valkyrie);
    expect(playerOf(state, P1).playArea).toContain(misty);
    expect(profile(state, misty).maxHp - inst(state, misty).damage).toBe(1);
  });

  it("heals only the excess: an ally already hurt ends at 1 hit point remaining, not at full", () => {
    // Misty (2 hit points) has 1 damage; Rhino's 2 makes 3, one beyond defeat; healing 2 leaves 1 remaining.
    const { state, misty } = setup(true, 1);
    expect(profile(state, misty).maxHp - inst(state, misty).damage).toBe(1);
  });

  it("August 3, 2026 ruling 2: resolves before simultaneous defeats, her own included: the ally is saved, she is discarded", () => {
    // The top encounter card is made a copy of 01154, which deals 1 damage to each friendly character at once. Valkyrie
    // (3 hit points, 2 damage) and Misty Knight (2 hit points, 1 damage) would both be defeated by it. The villain is
    // stunned so his attack does not intrude.
    const valkyrie = inPlay(baseGame(), VALKYRIE);
    const misty = inPlay(valkyrie.state, MISTY);
    const villain = misty.state.activeVillainId!;
    const top = activeEncounterDeck(misty.state).deck[0]!;
    let s = patchInstance(misty.state, top, { cardId: cardId(ULTRON_TREACHERY) });
    s = patchInstance(s, villain, { statuses: { ...inst(s, villain).statuses, stunned: 1 } });
    s = patchInstance(s, valkyrie.id, { damage: 2 });
    s = patchInstance(s, misty.id, { damage: 1 });
    const windows: string[][] = [];
    const after = villainPhase(s, { take: [VALKYRIE_REF], windows });
    expect(windows.flat().some((o) => o.endsWith(VALKYRIE_REF))).toBe(true);
    expect(playerOf(after, P1).discard).toContain(valkyrie.id);
    expect(playerOf(after, P1).playArea).toContain(misty.id);
    expect(profile(after, misty.id).maxHp - inst(after, misty.id).damage).toBe(1);
  });

  it("is not offered for Valkyrie herself (another ally only)", () => {
    const valkyrie = inPlay(baseGame(), VALKYRIE);
    const hurt = patchInstance(valkyrie.state, valkyrie.id, { damage: 1 });
    const windows: string[][] = [];
    const after = villainPhase(hurt, { take: [valkyrie.id as string, VALKYRIE_REF], windows });
    expect(windows.flat().some((o) => o.endsWith(VALKYRIE_REF))).toBe(false);
    expect(playerOf(after, P1).discard).toContain(valkyrie.id);
  });
});

describe(`${TAKE_A_STAND_REF}: Hero Response: after your hero defends, each ally you control gets +1 THW and +1 ATK`, () => {
  /**
   * Owner question Q104 = B (the owner, 2026-10-18): RRG 1.8 "Lasting Effects" (p. 26), "A lasting effect that expires at
   * the end of a specified time period can only be initiated during that time period", is read strictly. "Until the end
   * of the player phase" is created only during a player phase; after a villain-phase defense the card gives nothing.
   *
   * Misty Knight in play and Take a Stand and an energy resource in hand.
   */
  const setup = () => {
    const { state, id } = coreGame(TAKE_A_STAND);
    const misty = inPlay(state, MISTY);
    const energy = moveToHand(misty.state, P1, ENERGY);
    return { event: id, misty: misty.id, energy: energy.ids[0]!, state: energy.state };
  };

  it("used after a villain-phase defense it gives nothing (Q104 = B)", () => {
    const { state, event, misty, energy } = setup();
    const hero = identityOf(state, P1) as string;
    const after = villainPhase(state, { take: [hero, TAKE_A_STAND_REF], keep: [event, energy], pay: [energy] });
    expect(profile(after, misty)).toMatchObject({ atk: 1, thw: 1 });
  });

  it("used in the player phase (Taunt makes the villain attack you) it lasts to the end of that phase, no further", () => {
    const { state, event, misty, energy } = setup();
    const spare = playerOf(state, P1).deck.filter((i) => (inst(state, i).cardId as string) !== TAUNT);
    const retagged = patchInstance(state, spare[spare.length - 1]!, { cardId: cardId(TAUNT) });
    const taunt = moveToHand(retagged, P1, TAUNT);
    const tauntId = taunt.ids[0]!;
    const hero = identityOf(state, P1) as string;
    const windows: string[][] = [];
    const plan: Plan = { take: [hero, TAKE_A_STAND_REF], keep: [event, energy], pay: [energy], windows };
    const cast = play(P1, tauntId, payWith(taunt.state, P1, 1, [tauntId, event, energy]));
    const during = drive(taunt.state, plan, cast);
    expect(during.step.phase).toBe("player");
    expect(windows.flat().some((o) => o.endsWith(TAKE_A_STAND_REF))).toBe(true);
    expect(playerOf(during, P1).discard).toContain(event);
    expect(profile(during, misty)).toMatchObject({ atk: 2, thw: 2 });
    const later = villainPhase(during, { keep: [event, energy] });
    expect(profile(later, misty)).toMatchObject({ atk: 1, thw: 1 });
  });

  it("is not offered when an ally, not the hero, defends", () => {
    const { state, event, misty, energy } = setup();
    const windows: string[][] = [];
    const after = villainPhase(state, { take: [misty as string, TAKE_A_STAND_REF], keep: [event, energy], windows });
    expect(windows.flat().some((o) => o.endsWith(TAKE_A_STAND_REF))).toBe(false);
    expect(profile(after, misty)).toMatchObject({ atk: 1, thw: 1 });
  });
});

describe(`${FORMATION_REF}: Action: exhaust, remove 1 block counter: give a Defender ally a tough status card`, () => {
  it("exhausts it, removes a block counter and gives the chosen Defender ally a tough status card", () => {
    const formation = inPlay(baseGame(), FORMATION, { block: 3 });
    const iron = inPlay(formation.state, IRON_FIST);
    const after = drive(iron.state, { take: [iron.id as string] }, use(P1, formation.id, FORMATION_REF));
    expect(inst(after, formation.id).exhausted).toBe(true);
    expect(inst(after, formation.id).counters.block).toBe(2);
    expect(inst(after, iron.id).statuses.tough).toBe(1);
  });

  it("targets another player's Defender ally", () => {
    const formation = inPlay(baseGame(true), FORMATION, { block: 3 });
    const iron = inPlay(formation.state, IRON_FIST);
    const theirs = giveToP2(iron.state, iron.id);
    const after = drive(theirs, { take: [iron.id as string] }, use(P1, formation.id, FORMATION_REF));
    expect(inst(after, iron.id).statuses.tough).toBe(1);
    expect(inst(after, formation.id).counters.block).toBe(2);
  });

  it("is not offered while no Defender ally is in play", () => {
    const formation = inPlay(baseGame(), FORMATION, { block: 3 });
    const misty = inPlay(formation.state, MISTY);
    const offered = (st: GameState) => {
      const actions = legalActions(st, P1, DEPS);
      return (
        actions.kind === "turn" &&
        actions.legal.some((a) => a.action.kind === "useAbility" && (a.action.abilityId as string) === FORMATION_REF)
      );
    };
    // Misty Knight is a Defender, so it is offered; once she leaves play there is none.
    expect(offered(misty.state)).toBe(true);
    const gone: GameState = {
      ...misty.state,
      players: misty.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: p.playArea.filter((i) => i !== misty.id) } : p,
      ),
    };
    expect(offered(gone)).toBe(false);
  });

  it("played from a Core hero's deck it enters with 3 block counters", () => {
    const { state, id } = coreGame(FORMATION);
    const after = drive(state, undefined, playCommand(state, id)!);
    expect(inst(after, id).counters.block).toBe(3);
  });
});

describe(`${PURPOSE_REF}: each character you control with exactly 1 hit point remaining gets +2 THW and +2 ATK`, () => {
  it("applies to an ally and to your identity at exactly 1 remaining, and to nothing at 2", () => {
    const purpose = inPlay(baseGame(), PURPOSE);
    const iron = inPlay(purpose.state, IRON_FIST);
    const hero = identityOf(iron.state, P1);
    const heroBase = profile(iron.state, hero);
    const ironBase = profile(iron.state, iron.id);
    const atTwo = patchInstance(iron.state, iron.id, { damage: ironBase.maxHp - 2 });
    expect(profile(atTwo, iron.id)).toMatchObject({ atk: ironBase.atk, thw: ironBase.thw });
    const atOne = patchInstance(atTwo, iron.id, { damage: ironBase.maxHp - 1 });
    expect(profile(atOne, iron.id)).toMatchObject({ atk: ironBase.atk + 2, thw: ironBase.thw + 2 });
    const heroOne = patchInstance(atOne, hero, { damage: heroBase.maxHp - 1 });
    expect(profile(heroOne, hero)).toMatchObject({ atk: heroBase.atk + 2, thw: heroBase.thw + 2 });
  });

  it("under another player's control it buffs that player's characters, not the first player's", () => {
    const purpose = inPlay(baseGame(true), PURPOSE);
    const iron = inPlay(purpose.state, IRON_FIST);
    const theirs = giveToP2(iron.state, purpose.id);
    const hero1 = identityOf(theirs, P1);
    const hero2 = identityOf(theirs, P2);
    const base1 = profile(theirs, hero1);
    const base2 = profile(theirs, hero2);
    const ironBase = profile(theirs, iron.id);
    let s = patchInstance(theirs, iron.id, { damage: ironBase.maxHp - 1 });
    s = patchInstance(s, hero1, { damage: base1.maxHp - 1 });
    s = patchInstance(s, hero2, { damage: base2.maxHp - 1 });
    expect(profile(s, iron.id).atk).toBe(ironBase.atk);
    expect(profile(s, hero1).atk).toBe(base1.atk);
    expect(profile(s, hero2).atk).toBe(base2.atk + 2);
    expect(profile(s, hero2).thw).toBe(base2.thw + 2);
  });

  it("played from a Core hero's deck, it needs a character at 1 hit point to matter", () => {
    const { state, id } = coreGame(PURPOSE);
    const hero = identityOf(state, P1);
    const base = profile(state, hero);
    const after = drive(state, undefined, playCommand(state, id)!);
    expect(profile(after, hero).atk).toBe(base.atk);
    const hurt = patchInstance(after, hero, { damage: base.maxHp - 1 });
    expect(profile(hurt, hero).atk).toBe(base.atk + 2);
  });
});
