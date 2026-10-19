import { cardId, trait as cardTrait } from "@mc/content";
import {
  characterProfile,
  createGame,
  maxHitPoints,
  traitsOf,
  sessionApply,
  startSession,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../cards.js";
import { WAVE11_DEPS } from "../index.js";
import {
  LUKE_CAGE_OTHER_ASPECTS_BASIC as REGISTRY,
  LUKE_CAGE_OTHER_ASPECTS_BASIC_SKIPPED as SKIPPED,
} from "./other-aspects-basic.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * Wave 11 `luke_cage/other-aspects-basic` (docs/phase7-wave11-hero-packs.md H8.4, H3.20): Hulk 62020, She-Hulk 62021,
 * Dynamic Duo 62022, Power Man and Iron Fist 62023, Unbreakable Bond 62024, Size Advantage 62034, Observe 62035, Toughen
 * Up 62036 and Black Belt 62037, against Core's Rhino (Luke Cage: 10 hit points, ATK 2, alter-ego REC 4; Spider-Man: 10
 * hit points). These are not Luke Cage cards, so each runs in his deck or in Spider-Man's, as its text needs. Energy
 * 62025, Genius 62026 and Strength 62027 print no ability and register nothing.
 */
const HULK_C = "62020.hulk-constant";
const HULK_R = "62020.hulk-response";
const SHE_HULK_R = "62021.she-hulk-response";
const DUO_A = "62022.dynamic-duo-action";
const PMIF_A = "62023.power-man-and-iron-fist-action";
const BOND_A = "62024.unbreakable-bond-action";
const SIZE_A = "62034.size-advantage-action";
const OBSERVE_A = "62035.observe-action";
const TOUGHEN_R = "62036.toughen-up-response";
const BLACK_BELT_C = "62037.black-belt-constant";
const BLACK_BELT_C2 = "62037.black-belt-constant-2";
const HULK = "62020";
const SHE_HULK = "62021";
const DYNAMIC_DUO = "62022";
const PMIF = "62023";
const UNBREAKABLE_BOND = "62024";
const SIZE_ADVANTAGE = "62034";
const OBSERVE = "62035";
const TOUGHEN_UP = "62036";
const BLACK_BELT = "62037";
const IRON_FIST = "62012"; // Danny Rand: a Defender and Martial Artist ally
const MISTY_KNIGHT = "62013";
const SHOCKER = "01103"; // Core minion: ATK 2, 3 hit points
const ADVANCE = "01186";
const FILLER = "01091";
const LUKE = "62001a";
const SPIDER_MAN = "01001a";
const KIT = ["62020", "62021", "62022", "62023", "62034", "62035", "62036", "62037", "62037"];

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const damageOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).damage;
const toughOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).statuses.tough;

/** `identity` with `codes` at the top of the deck and filler under them, in hero form unless `form` says otherwise. */
function game(identity: string, codes: readonly string[], form: "hero" | "alterEgo" = "hero"): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const deck = [...codes, ...Array(40).fill(FILLER)].slice(0, 40);
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [
        {
          identityCardId: cardId(identity),
          aspects: [identity === LUKE ? "leadership" : "justice"],
          deck: deck.map((c) => cardId(c)),
        },
      ],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return form === "hero" ? withForm(opened, { heroForm: 0 }) : opened;
}
const lukeGame = (form: "hero" | "alterEgo" = "hero") =>
  game(LUKE, [...KIT, IRON_FIST, MISTY_KNIGHT, UNBREAKABLE_BOND], form);
const spiderGame = (form: "hero" | "alterEgo" = "hero") => game(SPIDER_MAN, [...KIT, IRON_FIST], form);

/** The first 15 encounter cards turned into Advance (no boost icon), so a boost adds nothing. */
function blanked(state: GameState): GameState {
  const pile = Object.values(state.encounterDecks)[0]!;
  return pile.deck.slice(0, 15).reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), state);
}
const stunnedVillain = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1 } });

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** The option naming `card` when one is offered, else a declined defense, else the first answer. */
const choosing =
  (card: InstanceId): Picker =>
  (s) => {
    const hit = s.pendingChoice?.options.find(
      (o) => (o.ref.kind === "card" || o.ref.kind === "ability") && o.ref.instanceId === card,
    );
    return hit ? [hit.optionId] : declines(s);
  };
const refused = (state: GameState, command: Command): boolean =>
  !sessionApply(startSession(state), command, WAVE11_DEPS).ok;
const hand = (state: GameState): string[] =>
  playerOf(state, P1)
    .hand.map((i) => codeOf(state, i))
    .sort();

describe("wave 11 luke_cage/other-aspects-basic registry", () => {
  it("registers only valid definitions, with the printed timing, and skips nothing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        HULK_C,
        HULK_R,
        SHE_HULK_R,
        DUO_A,
        PMIF_A,
        BOND_A,
        SIZE_A,
        OBSERVE_A,
        TOUGHEN_R,
        BLACK_BELT_C,
        BLACK_BELT_C2,
      ].sort(),
    );
    for (const id of [HULK_C, BLACK_BELT_C, BLACK_BELT_C2])
      expect(REGISTRY[id]!.trigger, id).toMatchObject({ kind: "constant" });
    for (const id of [HULK_R, SHE_HULK_R, TOUGHEN_R])
      expect(REGISTRY[id]!.trigger, id).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[DUO_A]!.trigger).toMatchObject({ kind: "action" });
    for (const id of [PMIF_A, SIZE_A, OBSERVE_A])
      expect(REGISTRY[id]!.trigger, id).toMatchObject({ kind: "action", form: "hero" });
  });
});

describe(`${HULK_C}: Hulk gets +1 ATK for each rage counter here`, () => {
  it.each([
    [0, 2],
    [2, 4],
    [5, 7],
  ])("with %i rage counter(s) his ATK is %i (printed 2)", (rage, atk) => {
    const hulk = stagedInPlay(lukeGame(), HULK, { counters: { rage } });
    expect(characterProfile(hulk.state, hulk.id, WAVE11_DEPS)!.atk).toBe(atk);
  });

  it("has no THW (a dash): he cannot make a basic thwart", () => {
    const hulk = stagedInPlay(lukeGame(), HULK);
    const thwart: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hulk.id,
      schemeInstanceId: hulk.state.mainScheme.instanceId,
    };
    expect(refused(hulk.state, thwart)).toBe(true);
  });
});

describe(`${HULK_R}: after the villain attacks you, place 1 rage counter here`, () => {
  it("the villain's attack on Luke Cage lets Hulk gain one rage counter", () => {
    const hulk = stagedInPlay(blanked(lukeGame()), HULK);
    const { state } = driveEventsPicking(WAVE11_DEPS, hulk.state, choosing(hulk.id), endTurn(P1));
    expect(inst(state, hulk.id).counters.rage).toBe(1);
  });

  it("declined: no counter", () => {
    const hulk = stagedInPlay(blanked(lukeGame()), HULK);
    const { state } = driveEventsPicking(WAVE11_DEPS, hulk.state, declines, endTurn(P1));
    expect(inst(state, hulk.id).counters.rage ?? 0).toBe(0);
  });

  it("a minion's attack is not the villain's: no counter and no prompt for it", () => {
    const quiet = stunnedVillain(blanked(lukeGame()));
    const hulk = stagedInPlay(engageMinion(quiet, SHOCKER, "shock"), HULK);
    let offered = false;
    const watching: Picker = (s) => {
      const choice = s.pendingChoice!;
      // Hulk may be offered as a defender; the response is the question.
      if (
        choice.prompt.kind !== "declareDefender" &&
        choice.options.some((o) => o.ref.kind !== "none" && "instanceId" in o.ref && o.ref.instanceId === hulk.id)
      )
        offered = true;
      return declines(s);
    };
    const { state } = driveEventsPicking(WAVE11_DEPS, hulk.state, watching, endTurn(P1));
    expect(damageOf(state)).toBe(2);
    expect(offered).toBe(false);
    expect(inst(state, hulk.id).counters.rage ?? 0).toBe(0);
  });
});

describe(`${SHE_HULK_R}: after She-Hulk enters play, give your identity a tough status card`, () => {
  const played = (pick: (id: InstanceId) => Picker) => {
    const base = spiderGame();
    const given = moveToHand(base, P1, SHE_HULK);
    const id = given.ids[0]!;
    const run = driveEventsPicking(WAVE11_DEPS, given.state, pick(id), play(P1, id, payWith(given.state, P1, 4, [id])));
    return { ...run, id };
  };

  it("in Spider-Man's deck: Toughness gives her a tough card and the response gives Spider-Man one", () => {
    const run = played(choosing);
    expect(toughOf(run.state, run.id)).toBe(1);
    expect(toughOf(run.state)).toBe(1);
  });

  it("declined: only her own Toughness card", () => {
    const run = played(() => firstLegal);
    expect(toughOf(run.state, run.id)).toBe(1);
    expect(toughOf(run.state)).toBe(0);
  });
});

describe(`${DUO_A}: search for a Team-Up card and an ally named by it, add both to your hand`, () => {
  /** Power Man and Iron Fist and Unbreakable Bond in the discard pile, Iron Fist and Misty Knight in the deck. */
  function duoGame(teamUps = true) {
    const state = lukeGame();
    const find = (code: string) => Object.values(state.instances).find((i) => i.cardId === cardId(code))!.instanceId;
    const toDiscard = teamUps ? [PMIF, UNBREAKABLE_BOND].map(find) : [];
    const toDeck = [IRON_FIST, MISTY_KNIGHT].map(find);
    // Without Team-Up cards the two are taken out of the hand and deck altogether.
    const gone = teamUps ? [] : [PMIF, UNBREAKABLE_BOND].map(find);
    const moved = [...toDiscard, ...toDeck, ...gone];
    return {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((i) => !moved.includes(i)),
        discard: [...p.discard.filter((i) => !moved.includes(i)), ...toDiscard],
        deck: [...toDeck, ...p.deck.filter((i) => !moved.includes(i))],
      })),
    };
  }
  const cast = (pick: Picker, teamUps = true) => {
    const given = moveToHand(duoGame(teamUps), P1, DYNAMIC_DUO);
    const duo = given.ids[0]!;
    // Before: the hand with Dynamic Duo in it; the card and the two cards paid with leave it.
    const before = hand(given.state);
    const run = driveEventsPicking(WAVE11_DEPS, given.state, pick, play(P1, duo, payWith(given.state, P1, 2, [duo])));
    return { ...run, before };
  };
  const offers: string[][] = [];
  /** Takes `teamUp` from the first search, then the first ally offered; records what each search offered. */
  const taking =
    (teamUp: string): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseCards") return declines(s);
      const ids = choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as string] : []));
      offers.push(ids.map((id) => codeOf(s, id as InstanceId)).sort());
      const wanted = offers.length % 2 === 1 ? ids.find((id) => codeOf(s, id as InstanceId) === teamUp) : ids[0];
      const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === wanted);
      return option ? [option.optionId] : [];
    };

  it("Power Man and Iron Fist from the discard pile, then Iron Fist (not Misty Knight) from the deck", () => {
    offers.length = 0;
    const run = cast(taking(PMIF));
    expect(offers).toEqual([[PMIF, UNBREAKABLE_BOND], [IRON_FIST]]);
    expect(hand(run.state)).toEqual(expect.arrayContaining([PMIF, IRON_FIST]));
    expect(hand(run.state)).not.toContain(MISTY_KNIGHT);
    expect(hand(run.state).length).toBe(run.before.length - 3 + 2);
  });

  it("Unbreakable Bond names no ally in the deck, so only it is found", () => {
    offers.length = 0;
    const run = cast(taking(UNBREAKABLE_BOND));
    expect(offers[0]).toEqual([PMIF, UNBREAKABLE_BOND]);
    expect(hand(run.state)).toContain(UNBREAKABLE_BOND);
    expect(hand(run.state)).not.toContain(IRON_FIST);
    expect(hand(run.state).length).toBe(run.before.length - 3 + 1);
  });

  it("must take one when one exists: taking none is refused", () => {
    expect(() => cast(() => [])).toThrow(/invalid_choice|rejected/);
  });

  it("with no Team-Up card in the deck or discard pile nothing is asked and nothing is found", () => {
    offers.length = 0;
    const run = cast(taking(PMIF), false);
    expect(offers).toEqual([]);
    expect(hand(run.state).length).toBe(run.before.length - 3);
  });
});

describe(`${PMIF_A}: Hero Action (attack), deal 2 damage to an enemy and give a tough status card to a character`, () => {
  const cast = (toughOn: InstanceId | null) => {
    const base = engageMinion(blanked(stagedInPlay(lukeGame(), IRON_FIST).state), SHOCKER, "shock");
    const given = moveToHand(base, P1, PMIF);
    const id = given.ids[0]!;
    const target = toughOn ?? identityOf(given.state);
    const pick: Picker = (s) => {
      const options = s.pendingChoice!.options;
      const prompt = s.pendingChoice!.prompt;
      if (prompt.kind === "declareDefender") return ["decline"];
      const enemy = options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ("shock" as InstanceId));
      const wanted = options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
      return enemy && !wanted ? [enemy.optionId] : wanted ? [wanted.optionId] : firstLegal(s);
    };
    return driveEventsPicking(WAVE11_DEPS, given.state, pick, play(P1, id, []));
  };

  it("2 damage to Shocker and a tough card on Luke Cage", () => {
    const { state } = cast(null);
    expect(damageOf(state, "shock" as InstanceId)).toBe(2);
    expect(toughOf(state)).toBe(1);
    expect(toughOf(state, "shock" as InstanceId)).toBe(0);
  });

  it("a character is any character: the tough card may go to the enemy", () => {
    const { state } = cast("shock" as InstanceId);
    expect(damageOf(state, "shock" as InstanceId)).toBe(2);
    expect(toughOf(state, "shock" as InstanceId)).toBe(1);
    expect(toughOf(state)).toBe(0);
  });
});

describe(`${BOND_A}: Team-Up and Max 1 per deck are data; the script is 61027's`, () => {
  it("is the reprint of 61027's script, the same definition", async () => {
    const { JJ_BASIC } = await import("../jj/basic.js");
    expect(REGISTRY[BOND_A]).toBe(JJ_BASIC["61027.unbreakable-bond-action"]);
    expect(REGISTRY[BOND_A]!.trigger).toMatchObject({ kind: "action", form: "hero" });
  });
});

describe(`${SIZE_A}: Hero Action (attack), deal 3 damage to an enemy (6 if you have the Giant trait or more remaining hit points)`, () => {
  /** Spider-Man (10 remaining) attacks Rhino whose remaining hit points are `rhinoRemaining`. */
  const cast = (rhinoRemaining: number) => {
    const base = spiderGame();
    const rhino = villainOf(base);
    const hurt = patchInstance(base, rhino, { damage: maxHitPoints(base, rhino, WAVE11_DEPS)! - rhinoRemaining });
    const given = moveToHand(hurt, P1, SIZE_ADVANTAGE);
    const id = given.ids[0]!;
    const { state } = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      choosing(rhino),
      play(P1, id, payWith(given.state, P1, 2, [id])),
    );
    return maxHitPoints(state, rhino, WAVE11_DEPS)! - damageOf(state, rhino);
  };

  it("more remaining hit points than the enemy: 6 damage", () => {
    expect(cast(9)).toBe(3);
  });

  it("equal remaining hit points is not more: 3 damage", () => {
    expect(cast(10)).toBe(7);
  });

  it("fewer remaining hit points: 3 damage", () => {
    expect(cast(14)).toBe(11);
  });
});

describe(`${OBSERVE_A}: Hero Action, the villain schemes; give your hero a tough status card`, () => {
  it("Rhino schemes (1 threat on the main scheme) and Luke Cage gets a tough card", () => {
    const base = blanked(lukeGame());
    const given = moveToHand(base, P1, OBSERVE);
    const id = given.ids[0]!;
    const { state } = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      declines,
      play(P1, id, payWith(given.state, P1, 1, [id])),
    );
    expect(mainThreat(state) - mainThreat(given.state)).toBe(1);
    expect(toughOf(state)).toBe(1);
  });
});

describe(`${TOUGHEN_R}: after you recover, if your remaining hit points are at least your base hit points, exhaust to give your identity a tough card`, () => {
  const recover: Command = { type: "basicRecover", playerId: P1 };
  const recovering = (game_: () => GameState, damage: number) => {
    const base = game_();
    const upgrade = stagedInPlay(base, TOUGHEN_UP);
    const hurt = patchInstance(upgrade.state, identityOf(base), { damage });
    return { ...upgrade, state: hurt };
  };

  it.each([
    ["Luke Cage", () => lukeGame("alterEgo")],
    ["Peter Parker", () => spiderGame("alterEgo")],
  ])("%s recovers to full: Toughen Up exhausts and gives a tough card", (_name, make) => {
    const s = recovering(make, 1);
    const { state } = driveEventsPicking(WAVE11_DEPS, s.state, choosing(s.id), recover);
    expect(damageOf(state)).toBe(0);
    expect(toughOf(state)).toBe(1);
    expect(inst(state, s.id).exhausted).toBe(true);
  });

  it("still short of full after the recovery: not offered, nothing happens", () => {
    const base = lukeGame("alterEgo");
    const rec = characterProfile(base, identityOf(base), WAVE11_DEPS)!.rec;
    const s = recovering(() => base, rec + 1);
    let offered = false;
    const watching: Picker = (st) => {
      if (
        (st.pendingChoice?.options ?? []).some(
          (o) => o.ref.kind !== "none" && "instanceId" in o.ref && o.ref.instanceId === s.id,
        )
      )
        offered = true;
      return firstLegal(st);
    };
    const { state } = driveEventsPicking(WAVE11_DEPS, s.state, watching, recover);
    expect(damageOf(state)).toBe(1);
    expect(offered).toBe(false);
    expect(toughOf(state)).toBe(0);
    expect(inst(state, s.id).exhausted).toBe(false);
  });

  it("reads base hit points, not the maximum: with Black Belt (+1) 10 remaining is offered, 9 is not", () => {
    const run = (extraDamage: number) => {
      const base = lukeGame("alterEgo");
      const rec = characterProfile(base, identityOf(base), WAVE11_DEPS)!.rec;
      const belt = stagedInPlay(base, BLACK_BELT, { attach: true });
      // Black Belt makes the maximum 11; after the recovery heals `rec` the remaining hit points are 11 - extraDamage.
      const upgrade = stagedInPlay(belt.state, TOUGHEN_UP);
      const hurt = patchInstance(upgrade.state, identityOf(base), { damage: rec + extraDamage });
      return driveEventsPicking(WAVE11_DEPS, hurt, choosing(upgrade.id), recover).state;
    };
    expect(toughOf(run(1))).toBe(1); // remaining 10, base 10
    expect(toughOf(run(2))).toBe(0); // remaining 9
  });

  it("declined: no tough card and the upgrade stays ready", () => {
    const s = recovering(() => lukeGame("alterEgo"), 1);
    const { state } = driveEventsPicking(WAVE11_DEPS, s.state, firstLegal, recover);
    expect(toughOf(state)).toBe(0);
    expect(inst(state, s.id).exhausted).toBe(false);
  });
});

describe(`${BLACK_BELT_C}: play only if any player controls a Martial Artist card`, () => {
  const playBelt = (state: GameState) => {
    const given = moveToHand(state, P1, BLACK_BELT);
    const id = given.ids[0]!;
    return { ...given, id, command: play(P1, id, [], { attachToInstanceId: identityOf(given.state) }) };
  };

  it("is refused with no Martial Artist card controlled", () => {
    const s = playBelt(spiderGame());
    expect(refused(s.state, s.command)).toBe(true);
  });

  it("is allowed once any player controls one (Iron Fist, a Martial Artist ally)", () => {
    const withAlly = stagedInPlay(spiderGame(), IRON_FIST);
    const s = playBelt(withAlly.state);
    expect(refused(s.state, s.command)).toBe(false);
  });
});

describe(`${BLACK_BELT_C2}: the attached character gets +1 hit point and gains the Martial Artist trait`, () => {
  it("Spider-Man goes from 10 to 11 hit points and counts as a Martial Artist", () => {
    const base = spiderGame();
    expect(maxHitPoints(base, identityOf(base), WAVE11_DEPS)).toBe(10);
    const belt = stagedInPlay(base, BLACK_BELT, { attach: true });
    expect(maxHitPoints(belt.state, identityOf(belt.state), WAVE11_DEPS)).toBe(11);
    expect(traitsOf(base, identityOf(base), WAVE11_DEPS)).not.toContain(cardTrait("MARTIAL ARTIST"));
    expect(traitsOf(belt.state, identityOf(belt.state), WAVE11_DEPS)).toContain(cardTrait("MARTIAL ARTIST"));
  });
});
