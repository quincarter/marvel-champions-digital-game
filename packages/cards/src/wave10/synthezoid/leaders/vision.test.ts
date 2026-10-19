import {
  applyCommand,
  currentName,
  hasKeyword,
  isPermanent,
  keywordTotal,
  printedKeywordsOf,
  remainingHitPoints,
  statBonus,
  villainStage,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, driveStepwise } from "../../../testing/staging.js";
import { attachToHost } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import {
  attacksBy,
  codeOf,
  heroAttacks,
  heroForm,
  heroThwarts,
  piles,
  schemesBy,
  types,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, stagedInPlay } from "../../testing.js";
import { ungatedStageGame } from "../testing.js";
import { SYNTHEZOID_LEADERS_VISION, SYNTHEZOID_LEADERS_VISION_SKIPPED } from "./vision.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Vision, the Synthezoid Smackdown resistance leader (57040 to 57043) and his set (57046a/b to 57054), docs/
 * phase7-synthezoid.md sections 2.2, 3 M2 to M5 and 7.2. Every test is a real game in the `resistance-vision` scenario
 * (the pack is gated, so `ungatedStageGame` builds it) seated with the Tigra precon, and a second seat of the Core
 * Spider-Man deck where a test names two players. The cards under test are staged by surgery or stacked on the
 * encounter deck.
 *
 * The villain phase flips the mass form attachment after step 1 (every stage), before Vision's step 2 activation and
 * the step 3 deals, so a test that needs a face showing at an activation stages the other one (`faceAtActivation`).
 */
const REFS = [
  "57040.setup",
  "57040.vision-forced-response",
  "57041.when-revealed",
  "57041.vision-forced-response",
  "57042.setup",
  "57042.vision-forced-response",
  "57043.when-revealed",
  "57043.vision-forced-response",
  "57046b.intangible-forced-interrupt",
  "57047.solar-gem-constant",
  "57047.solar-gem-response",
  "57047.boost",
  "57048.visions-cape-constant",
  "57048.visions-cape-response",
  "57048.boost",
  "57049.mass-increase-forced-interrupt",
  "57050.density-control-forced-interrupt",
  "57050.density-control-constant",
  "57051.when-revealed-alter-ego",
  "57051.when-revealed-hero",
  "57052.when-revealed",
  "57053.when-revealed",
  "57054.when-defeated",
];
const SET = [
  "57040",
  "57041",
  "57042",
  "57043",
  "57046a",
  "57047",
  "57048",
  "57049",
  "57050",
  "57051",
  "57052",
  "57053",
  "57054",
];
const MASS = "57046a";
const GEM = "57047";
const CAPE = "57048";
const INCREASE = "57049";
const CONTROL = "57050";
const BEAM = "57051";
const STRIKE = "57052";
const DISRUPTION = "57053";
const PASSING = "57054";
const BLANK = "01186";
const MOON_KNIGHT = "56002";
const YOUNG_AVENGERS = "57059"; // a side scheme: dealt by a stage II/IV reveal, it attaches to nothing
const SHARP_CLAWS = "56005"; // upgrade
const HERO_VISION_INTANGIBLE = "26002";
// Tigra precon cards that print one resource each (events and an upgrade).
const ENERGY = "56015";
const PHYSICAL = "56017";
const MENTAL = "56016";

type Options = { readonly twoPlayers?: boolean; readonly expert?: boolean };
const open = (opts: Options = {}): GameState =>
  ungatedStageGame("resistance-vision", ["57044b", "57045b"], {
    twoPlayers: opts.twoPlayers ?? false,
    ...(opts.expert ? { difficulty: "expert" } : {}),
  } as never);
const heroGame = (opts: Options = {}): GameState => heroForm(open(opts), P1, ...(opts.twoPlayers ? [P2] : []));

const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const attachedCodes = (s: GameState): string[] => inst(s, leaderOf(s)).attachments.map((a) => codeOf(s, a));
const massOf = (s: GameState): InstanceId => inst(s, leaderOf(s)).attachments.find((a) => codeOf(s, a) === MASS)!;
const faceName = (s: GameState): string | undefined => currentName(s, massOf(s));
const discardCodes = (s: GameState): string[] => piles(s).discard.map((i) => codeOf(s, i));
const dataOf = (code: string) =>
  WAVE10_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const showing = (s: GameState, face: "Dense" | "Intangible"): GameState =>
  patchInstance(s, massOf(s), { flipped: face === "Intangible" });
/** The face to stage so that `face` shows at the villain phase's activation and deals (step 1 flips it first). */
const faceAtActivation = (face: "Dense" | "Intangible"): "Dense" | "Intangible" =>
  face === "Dense" ? "Intangible" : "Dense";
const withAttachment = (s: GameState, code: string) => attachToHost(s, code, leaderOf(s));
const atk = (s: GameState): number => statBonus(s, WAVE10_DEPS, leaderOf(s), "atk" as never);
const sch = (s: GameState): number => statBonus(s, WAVE10_DEPS, leaderOf(s), "sch" as never);

const nothingDefends: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the deal). */
const villainPhase = (s: GameState, pick: Picker, ...stack: string[]) =>
  driveEventsPicking(WAVE10_DEPS, stack.length > 0 ? stackEncounterDeck(s, ...stack) : s, pick, endTurn(P1));

/** Takes the response whose id ends with `ref` when offered, pays with `pay`, and answers anything else by default. */
const responding =
  (ref: string, pay: readonly InstanceId[], offered: string[] = []): Picker =>
  (s) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "chooseTriggers") {
      offered.push(...c.options.map((o) => o.optionId as string));
      const take = c.options.find((o) => (o.optionId as string).endsWith(ref));
      return take ? [take.optionId] : firstLegal(s);
    }
    if (c.prompt.kind === "payForAbility") return pay.map((id) => `hand:${id}`);
    return firstLegal(s);
  };

/** Answers a card choice with `id` when it is offered, anything else by default. */
const picks =
  (id: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    return choice.options.some((o) => (o.optionId as string) === id) ? [id] : firstLegal(s);
  };

/** Leaves exactly these cards (moved from the deck) in the player's hand: the only resources they can spend. */
const handOf = (s: GameState, player: PlayerId, ...codes: string[]) => {
  const moved = moveToHand(s, player, ...codes);
  return {
    state: {
      ...moved.state,
      players: moved.state.players.map((p) => (p.playerId === player ? { ...p, hand: [...moved.ids] } : p)),
    },
    ids: moved.ids,
  };
};

const eventIndex = (events: readonly GameEvent[], type: GameEvent["type"], at = 0): number =>
  events.flatMap((e, i) => (e.type === type ? [i] : []))[at] ?? -1;

describe("registry", () => {
  it("scripts the twenty-three refs the data names, each valid, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_LEADERS_VISION).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_LEADERS_VISION)) expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_LEADERS_VISION_SKIPPED).toEqual({});
    const refs = WAVE10_CARDS.filter((c) => SET.includes(c.id as string)).flatMap(abilityRefIds);
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

describe("M2: 'Mass form.' on Dense / Intangible is a label, not the form keyword", () => {
  it("57046a and 57046b emit no form keyword, and the hero Vision's Intangible 26002 keeps his", () => {
    const dense = dataOf(MASS) as { keywords: { name: string }[]; flipSide: { keywords: { name: string }[] } };
    expect(dense.keywords.map((k) => k.name)).toEqual(["permanent"]);
    expect(dense.flipSide.keywords.map((k) => k.name)).toEqual(["permanent"]);
    // The printed text is kept: it is the label other cards refer to.
    expect((dataOf(MASS).text as { printed: string }).printed).toContain("Mass form.");
    const upgrade = dataOf(HERO_VISION_INTANGIBLE) as { keywords: { name: string; formType?: string }[] };
    expect(upgrade.keywords).toContainEqual({ name: "form", formType: "mass" });
  });

  it("an attached Dense (either face) shows no keyword but permanent, so no identity gains a form from it", () => {
    const s = open();
    expect(printedKeywordsOf(s, massOf(s)).map((k) => k.name)).toEqual(["permanent"]);
    const flipped = showing(s, "Intangible");
    expect(printedKeywordsOf(flipped, massOf(flipped)).map((k) => k.name)).toEqual(["permanent"]);
  });
});

describe("Setup (stages I and III): the enemy team finds Vision's mass form attachment and attaches it, Dense up", () => {
  it.each([
    ["standard", false],
    ["expert", true],
  ] as const)("%s: it is attached with no question, faceup on its Dense side, and out of the deck", (_mode, expert) => {
    const s = open({ expert });
    expect(s.pendingChoice).toBeNull();
    // The game starts on stage I (standard) or III (expert), and that stage's Setup attached the card.
    expect(villainStage(s).stageNumber).toBe(expert ? 3 : 1);
    expect(attachedCodes(s)).toEqual([MASS]);
    expect(inst(s, massOf(s)).faceup).toBe(true);
    expect(inst(s, massOf(s)).flipped).toBeFalsy();
    expect(faceName(s)).toBe("Dense");
    expect(piles(s).deck.map((i) => codeOf(s, i))).not.toContain(MASS);
    expect(piles(s).deck.map((i) => codeOf(s, i))).toContain(GEM);
  });
});

describe("Dense and Intangible are one permanent card (M3)", () => {
  it("Dense adds +1 ATK to Vision and no SCH", () => {
    const s = open();
    expect([atk(s), sch(s)]).toEqual([1, 0]);
  });

  it("Intangible adds +1 SCH to Vision and no ATK (the new face's modifier applies)", () => {
    const flipped = showing(open(), "Intangible");
    expect([atk(flipped), sch(flipped)]).toEqual([0, 1]);
  });
});

describe("Forced Response (every stage): after resolving step 1 of the villain phase, flip the mass form attachment", () => {
  it("flips it in place after the threat is placed and before Vision activates; it keeps host and permanence", () => {
    const start = heroGame();
    const mass = massOf(start);
    const run = villainPhase(start, nothingDefends, BLANK, YOUNG_AVENGERS);
    const s = run.state;
    expect(faceName(s)).toBe("Intangible");
    expect(inst(s, mass).attachedTo).toBe(leaderOf(s));
    expect(attachedCodes(s)).toEqual([MASS]);
    expect(inst(s, mass).faceup).toBe(true);
    expect(inst(s, mass).facedownAs).toBeFalsy();
    expect(isPermanent(s, mass)).toBe(true);
    expect(discardCodes(s)).not.toContain(MASS);
    const flips = types(run.events, "cardFlipped").filter((e) => e.instanceId === mass);
    expect(flips).toHaveLength(1);
    expect(eventIndex(run.events, "threatPlaced")).toBeLessThan(eventIndex(run.events, "cardFlipped"));
    expect(eventIndex(run.events, "cardFlipped")).toBeLessThan(eventIndex(run.events, "attackResolved"));
  });

  it("flips back the next round (Dense, Intangible, Dense: the flip alternates)", () => {
    const first = villainPhase(heroGame(), nothingDefends, BLANK, GEM).state;
    expect(faceName(first)).toBe("Intangible");
    const second = villainPhase(first, nothingDefends, BLANK, CAPE).state;
    expect(faceName(second)).toBe("Dense");
  });

  it("the Forced Response is on stages II to IV as well: it flips on a game that starts on stage III", () => {
    const expert = villainPhase(heroGame({ expert: true }), nothingDefends, BLANK, GEM).state;
    expect(villainStage(expert).stageNumber).toBe(3);
    expect(faceName(expert)).toBe("Intangible");
  });

  it("with no mass form attachment in play nothing happens (control)", () => {
    const start = heroGame();
    const bare = patchInstance(start, leaderOf(start), { attachments: [] });
    const run = villainPhase(bare, nothingDefends, BLANK, GEM);
    expect(types(run.events, "cardFlipped")).toEqual([]);
  });
});

describe("Stages II and IV: When Revealed", () => {
  it.each([
    ["standard", 2, false, 1],
    ["standard", 2, true, 2],
    ["expert", 4, false, 1],
    ["expert", 4, true, 2],
  ] as const)(
    "%s, stage %i, %s two players: each player is dealt an encounter card",
    (_mode, stage, twoPlayers, dealtCount) => {
      const start = heroGame({ expert: stage === 4, twoPlayers });
      const defeated = defeatWithAttack(WAVE10_DEPS, stackEncounterDeck(start, GEM, BLANK), leaderOf(start));
      expect(villainStage(defeated).stageNumber).toBe(stage);
      const dealtTo = defeated.players.filter((p) => p.dealtEncounter.length === 1);
      expect(dealtTo).toHaveLength(dealtCount);
      expect(defeated.players[0]!.dealtEncounter.map((i) => codeOf(defeated, i))).toEqual([GEM]);
    },
  );

  it.each([
    ["standard", 2],
    ["expert", 4],
  ] as const)(
    "%s, stage %i: the attachment stays on him, and he cannot take damage this phase, but can in the next",
    (mode, stage) => {
      const start = heroGame({ expert: mode === "expert" });
      const v = leaderOf(start);
      const mass = massOf(start);
      const defeated = defeatWithAttack(WAVE10_DEPS, stackEncounterDeck(start, YOUNG_AVENGERS), v);
      expect(villainStage(defeated).stageNumber).toBe(stage);
      // The permanent attachment stays through the stage change (docs/phase7-synthezoid.md section 2.2).
      expect(inst(defeated, mass).attachedTo).toBe(leaderOf(defeated));
      expect(attachedCodes(defeated)).toEqual([MASS]);
      const again = patchInstance(defeated, hero(defeated), { exhausted: false });
      const refused = applyCommand(
        again,
        { type: "basicAttack", playerId: P1, attackerInstanceId: hero(again), targetInstanceId: leaderOf(again) },
        WAVE10_DEPS,
      );
      expect(refused).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
      const next = villainPhase(again, nothingDefends, BLANK, GEM);
      const bare = (x: GameState) =>
        patchInstance(x, leaderOf(x), { statuses: { ...inst(x, leaderOf(x)).statuses, tough: 0 } });
      const full = remainingHitPoints(next.state, leaderOf(next.state))!;
      // Expert Vision enters each stage with a tough status card, which would stop this attack on its own.
      const ready = patchInstance(bare(next.state), hero(next.state), { exhausted: false });
      const hit = heroAttacks(WAVE10_DEPS, ready, leaderOf(next.state));
      expect(remainingHitPoints(hit.state, leaderOf(hit.state))).toBeLessThan(full);
    },
  );
});

describe("Intangible (57046b): Forced Interrupt, damage Vision would take is reduced by 1", () => {
  const damageFrom = (s: GameState): number => {
    const hit = heroAttacks(WAVE10_DEPS, s, leaderOf(s));
    return inst(hit.state, leaderOf(hit.state)).damage;
  };

  it("an attack deals 1 less on the Intangible face than on the Dense face", () => {
    const dense = damageFrom(heroGame());
    const intangible = damageFrom(showing(heroGame(), "Intangible"));
    expect(dense).toBeGreaterThan(1);
    expect(intangible).toBe(dense - 1);
  });

  it("is a forced interrupt, so a tough status card is used up before it reduces anything", () => {
    expect(SYNTHEZOID_LEADERS_VISION["57046b.intangible-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    const s = showing(heroGame(), "Intangible");
    const toughened = patchInstance(s, leaderOf(s), { statuses: { ...inst(s, leaderOf(s)).statuses, tough: 1 } });
    const hit = heroAttacks(WAVE10_DEPS, toughened, leaderOf(s));
    expect(inst(hit.state, leaderOf(s)).damage).toBe(0);
    expect(inst(hit.state, leaderOf(s)).statuses.tough).toBe(0);
  });
});

describe("Solar Gem (57047)", () => {
  it("is data: unique, +1 SCH, a boost star, attaches to the villain", () => {
    const card = dataOf(GEM);
    expect([card.unique, card.statModifiers, card.starIcon, card.attachesTo]).toEqual([
      true,
      { sch: 1 },
      true,
      { kind: "villain" },
    ]);
  });

  it("Vision gains stalwart while it is attached, and not before", () => {
    const start = heroGame();
    const { state } = withAttachment(start, GEM);
    expect([start, state].map((s) => hasKeyword(s, leaderOf(s), "stalwart" as never, WAVE10_DEPS))).toEqual([
      false,
      true,
    ]);
  });

  /** Tigra with an [energy] event and a [physical] event (and a [mental] one) in hand, and the Gem on Vision. */
  const armed = (face: "Dense" | "Intangible" = "Dense") => {
    const { state: gem, id } = withAttachment(heroGame(), GEM);
    const { state, ids } = moveToHand(showing(gem, face), P1, ENERGY, PHYSICAL, MENTAL);
    return { state, gem: id, energy: ids[0]!, physical: ids[1]!, mental: ids[2]! };
  };
  const attack = (s: GameState, pick: Picker) => heroAttacks(WAVE10_DEPS, s, leaderOf(s), { pick });
  const GEM_RESPONSE = "57047.solar-gem-response";

  it("after a basic attack, spending [energy] [physical] discards the Gem and flips the attachment to Intangible", () => {
    const { state, gem, energy, physical } = armed();
    const run = attack(state, responding(GEM_RESPONSE, [energy, physical]));
    expect(discardCodes(run.state)).toContain(GEM);
    expect(inst(run.state, gem).attachedTo).toBeNull();
    expect(faceName(run.state)).toBe("Intangible");
    expect(inst(run.state, massOf(run.state)).attachedTo).toBe(leaderOf(run.state));
    const paid = run.state.players[0]!.discard.map((i) => codeOf(run.state, i));
    expect(paid).toEqual(expect.arrayContaining([ENERGY, PHYSICAL]));
  });

  it("flips an Intangible attachment back to Dense", () => {
    const { state, energy, physical } = armed("Intangible");
    const run = attack(state, responding(GEM_RESPONSE, [energy, physical]));
    expect(faceName(run.state)).toBe("Dense");
  });

  it("declining leaves the Gem on Vision and the attachment as it was (control)", () => {
    const { state } = armed();
    const run = attack(state, firstLegal);
    expect(attachedCodes(run.state)).toEqual([MASS, GEM]);
    expect(faceName(run.state)).toBe("Dense");
  });

  it("is not offered to a player who cannot pay [energy] [physical]: [energy] and [mental] do not pay for it", () => {
    const { state: gem } = withAttachment(heroGame(), GEM);
    const wrong = handOf(gem, P1, ENERGY, MENTAL);
    const offered: string[] = [];
    attack(wrong.state, responding(GEM_RESPONSE, wrong.ids, offered));
    expect(offered.filter((o) => o.endsWith(GEM_RESPONSE))).toEqual([]);
    // Control: [energy] and [physical] in hand is offered it.
    const right = handOf(gem, P1, ENERGY, PHYSICAL);
    const offeredWith: string[] = [];
    attack(right.state, responding(GEM_RESPONSE, right.ids, offeredWith));
    expect(offeredWith.filter((o) => o.endsWith(GEM_RESPONSE))).toHaveLength(1);
  });

  it("is any player's: the second player's basic attack offers it to them, and they pay from their own hand", () => {
    const { state: gem } = withAttachment(heroGame({ twoPlayers: true }), GEM);
    const p2 = gem.players.find((p) => p.playerId === P2)!;
    const code = (type: string, taken: readonly string[] = []) =>
      [...p2.deck, ...p2.hand]
        .map((i) => codeOf(gem, i))
        .find((c) => ((dataOf(c).resourceIcons ?? {}) as Record<string, number>)[type] && !taken.includes(c));
    const energyCode = code("energy");
    const physicalCode = code("physical");
    expect(energyCode && physicalCode).toBeTruthy();
    const { state: hands, ids } = moveToHand(gem, P2, energyCode!, physicalCode!);
    // P2 takes their turn after P1 ends theirs.
    const state = driveEventsPicking(WAVE10_DEPS, hands, firstLegal, endTurn(P1)).state;
    const offered: string[] = [];
    const run = heroAttacks(WAVE10_DEPS, state, leaderOf(state), {
      player: P2,
      pick: responding(GEM_RESPONSE, ids, offered),
    });
    expect(offered.filter((o) => o.endsWith(GEM_RESPONSE))).toHaveLength(1);
    expect(faceName(run.state)).toBe("Intangible");
    expect(discardCodes(run.state)).toContain(GEM);
    expect(run.state.players.find((p) => p.playerId === P2)!.discard.length).toBeGreaterThanOrEqual(2);
  });

  it("[star] Boost: revealed from the boost card it attaches to Vision", () => {
    const run = villainPhase(heroGame(), nothingDefends, GEM, BLANK);
    expect(attachedCodes(run.state)).toContain(GEM);
  });
});

describe("Vision's Cape (57048)", () => {
  it("is data: unique, +1 ATK, a boost star", () => {
    const card = dataOf(CAPE);
    expect([card.unique, card.statModifiers, card.starIcon]).toEqual([true, { atk: 1 }, true]);
  });

  it("Vision gains retaliate 1 while it is attached, and not before", () => {
    const start = heroGame();
    const { state } = withAttachment(start, CAPE);
    expect([start, state].map((s) => keywordTotal(s, leaderOf(s), "retaliate" as never, WAVE10_DEPS))).toEqual([0, 1]);
  });

  it("after a basic attack, spending [energy] [mental] discards the Cape and flips the attachment", () => {
    const { state: cape, id } = withAttachment(heroGame(), CAPE);
    const { state, ids } = moveToHand(cape, P1, ENERGY, MENTAL);
    const run = heroAttacks(WAVE10_DEPS, state, leaderOf(state), {
      pick: responding("57048.visions-cape-response", ids),
    });
    expect(inst(run.state, id).attachedTo).toBeNull();
    expect(discardCodes(run.state)).toContain(CAPE);
    expect(faceName(run.state)).toBe("Intangible");
  });

  it("[energy] [physical] does not pay for the Cape: it asks for [mental] (control for the two named types)", () => {
    const { state: cape } = withAttachment(heroGame(), CAPE);
    const wrong = handOf(cape, P1, ENERGY, PHYSICAL);
    const offered: string[] = [];
    heroAttacks(WAVE10_DEPS, wrong.state, leaderOf(wrong.state), {
      pick: responding("57048.visions-cape-response", wrong.ids, offered),
    });
    expect(offered.filter((o) => o.endsWith("57048.visions-cape-response"))).toEqual([]);
  });
});

describe("Mass Increase (57049)", () => {
  /** The attack on Vision by `attacker` (default the hero): the run, and the damage it dealt to Vision. */
  const attackWith = (s: GameState, attacker: InstanceId = hero(s)) => {
    const before = inst(s, leaderOf(s)).damage;
    const run = driveEventsPicking(WAVE10_DEPS, s, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: leaderOf(s),
    });
    return { run, dealt: inst(run.state, leaderOf(run.state)).damage - before };
  };

  it("with Dense up, an attack on Vision deals no damage, stuns the attacker, and discards the card", () => {
    const { state, id } = withAttachment(heroGame(), INCREASE);
    const { run, dealt } = attackWith(state);
    expect(dealt).toBe(0);
    expect(inst(run.state, hero(run.state)).statuses.stunned).toBe(1);
    expect(discardCodes(run.state)).toContain(INCREASE);
    expect(inst(run.state, id).attachedTo).toBeNull();
  });

  it("the prevented damage uses no tough status card (nothing was dealt to him)", () => {
    const { state } = withAttachment(heroGame(), INCREASE);
    const toughened = patchInstance(state, leaderOf(state), {
      statuses: { ...inst(state, leaderOf(state)).statuses, tough: 1 },
    });
    const { run } = attackWith(toughened);
    expect(inst(run.state, leaderOf(run.state)).statuses.tough).toBe(1);
  });

  it("any character: an ally attacking Vision deals no damage and is the one stunned", () => {
    const { state: staged } = withAttachment(heroGame(), INCREASE);
    const ally = stagedInPlay(staged, MOON_KNIGHT);
    const { run, dealt } = attackWith(ally.state, ally.id);
    expect(dealt).toBe(0);
    expect(inst(run.state, ally.id).statuses.stunned).toBe(1);
    expect(inst(run.state, hero(run.state)).statuses.stunned).toBe(0);
  });

  it("with Intangible up it does nothing: the attack deals damage and the card stays (control)", () => {
    const { state } = withAttachment(showing(heroGame(), "Intangible"), INCREASE);
    const { run, dealt } = attackWith(state);
    expect(dealt).toBeGreaterThan(0);
    expect(inst(run.state, hero(run.state)).statuses.stunned).toBe(0);
    expect(attachedCodes(run.state)).toEqual([MASS, INCREASE]);
  });

  it("without the card the same attack deals damage (control)", () => {
    const { dealt } = attackWith(heroGame());
    expect(dealt).toBeGreaterThan(0);
  });
});

describe("Density Control (57050): when Vision activates, a scheme flips to Intangible and an attack to Dense", () => {
  const withControl = (face: "Dense" | "Intangible", hero = true) => {
    const base = hero ? heroGame() : open();
    return withAttachment(showing(base, faceAtActivation(face)), CONTROL).state;
  };
  // Staged so that `face` is showing at the activation (the step 1 flip has run).

  it("a hero-form attack from Intangible flips it to Dense, then the card is discarded", () => {
    const s = withControl("Intangible");
    const run = villainPhase(s, nothingDefends, BLANK, GEM);
    expect(faceName(run.state)).toBe("Dense");
    expect(discardCodes(run.state)).toContain(CONTROL);
    // Flipped twice: after step 1, then by the card at the activation.
    expect(types(run.events, "cardFlipped")).toHaveLength(2);
  });

  it("an attack with Dense already showing flips nothing, and the card stays for the next activation", () => {
    const s = withControl("Dense");
    const run = villainPhase(s, nothingDefends, BLANK, GEM);
    expect(types(run.events, "cardFlipped")).toHaveLength(1); // the Forced Response only
    expect(faceName(run.state)).toBe("Dense");
    expect(discardCodes(run.state)).not.toContain(CONTROL);
    expect(attachedCodes(run.state)).toContain(CONTROL);
  });

  it("an alter-ego scheme from Dense flips it to Intangible, then the card is discarded", () => {
    const s = withControl("Dense", false);
    const run = villainPhase(s, firstLegal, BLANK, GEM);
    expect(schemesBy(run.state, run.events, "57040")).toHaveLength(1);
    expect(faceName(run.state)).toBe("Intangible");
    expect(discardCodes(run.state)).toContain(CONTROL);
  });

  it("a scheme with Intangible already showing flips nothing, and the card stays", () => {
    const s = withControl("Intangible", false);
    const run = villainPhase(s, firstLegal, BLANK, GEM);
    expect(types(run.events, "cardFlipped")).toHaveLength(1);
    expect(faceName(run.state)).toBe("Intangible");
    expect(attachedCodes(run.state)).toContain(CONTROL);
  });

  it("the flip happens before the attack is worked out (the flip is an interrupt to the activation)", () => {
    const s = withControl("Intangible");
    const run = villainPhase(s, nothingDefends, BLANK, GEM);
    expect(eventIndex(run.events, "cardFlipped", 1)).toBeLessThan(eventIndex(run.events, "attackResolved"));
  });

  it("it has surge (data)", () => {
    expect((dataOf(CONTROL).keywords as { name: string }[]).map((k) => k.name)).toEqual(["surge"]);
  });
});

describe("Solar Beam (57051)", () => {
  it("alter-ego: Vision schemes, with +1 SCH for this scheme while the Intangible attachment is in play", () => {
    const s = showing(open(), faceAtActivation("Intangible"));
    const run = villainPhase(s, firstLegal, BLANK, BEAM, BLANK);
    const [activation, beam] = schemesBy(run.state, run.events, "57040");
    expect(beam!.baseSch).toBe(activation!.baseSch + 1);
  });

  it("alter-ego: no bonus while the Dense attachment is in play (control)", () => {
    const s = showing(open(), faceAtActivation("Dense"));
    const run = villainPhase(s, firstLegal, BLANK, BEAM, BLANK);
    const [activation, beam] = schemesBy(run.state, run.events, "57040");
    expect(beam!.baseSch).toBe(activation!.baseSch);
  });

  it("hero: Vision attacks you, with +1 ATK for this attack while the Dense attachment is in play", () => {
    const s = showing(heroGame(), faceAtActivation("Dense"));
    const run = villainPhase(s, nothingDefends, BLANK, BEAM, BLANK);
    const [activation, beam] = attacksBy(run.state, run.events, "57040");
    expect(beam!.baseAtk).toBe(activation!.baseAtk + 1);
  });

  it("hero: no bonus while the Intangible attachment is in play (control)", () => {
    const s = showing(heroGame(), faceAtActivation("Intangible"));
    const run = villainPhase(s, nothingDefends, BLANK, BEAM, BLANK);
    const [activation, beam] = attacksBy(run.state, run.events, "57040");
    expect(beam!.baseAtk).toBe(activation!.baseAtk);
  });
});

describe("Solar Beam (57051): the face is read after the activation's interrupts", () => {
  // Vision's activation (step 2) comes first, with Intangible showing and no Density Control yet; the dealt Density
  // Control (surge) attaches, then Solar Beam attacks and Density Control flips Intangible to Dense before it resolves.
  const beam = (withControl: boolean) => {
    const s = showing(heroGame(), faceAtActivation("Intangible"));
    const run = withControl
      ? villainPhase(s, nothingDefends, BLANK, CONTROL, BEAM, BLANK)
      : villainPhase(s, nothingDefends, BLANK, BEAM, BLANK);
    const [activation, last] = attacksBy(run.state, run.events, "57040");
    return { run, activation: activation!, beam: last! };
  };

  it("a Density Control flip to Dense counts: +1 ATK for the attack, plus Dense's own +1", () => {
    const { run, activation, beam: b } = beam(true);
    expect(faceName(run.state)).toBe("Dense");
    expect(b.baseAtk).toBe(activation.baseAtk + 2);
  });

  it("without Density Control the Intangible face gives no bonus (control)", () => {
    const { activation, beam: b } = beam(false);
    expect(b.baseAtk).toBe(activation.baseAtk);
  });

  it("the scheme side: a Density Control flip to Intangible counts: +1 SCH, plus Intangible's own +1", () => {
    const s = showing(open(), faceAtActivation("Dense"));
    const run = villainPhase(s, firstLegal, BLANK, CONTROL, BEAM, BLANK);
    const [activation, last] = schemesBy(run.state, run.events, "57040");
    expect(faceName(run.state)).toBe("Intangible");
    expect(last!.baseSch).toBe(activation!.baseSch + 2);
  });

  it("the scheme side without Density Control: the Dense face gives no bonus (control)", () => {
    const s = showing(open(), faceAtActivation("Dense"));
    const run = villainPhase(s, firstLegal, BLANK, BEAM, BLANK);
    const [activation, last] = schemesBy(run.state, run.events, "57040");
    expect(last!.baseSch).toBe(activation!.baseSch);
  });
});

describe("Superdense Strike (57052)", () => {
  const strike = (face: "Dense" | "Intangible") => {
    const staged = stagedInPlay(showing(heroGame(), faceAtActivation(face)), MOON_KNIGHT);
    const run = villainPhase(staged.state, picks(staged.id), BLANK, STRIKE, BLANK);
    return { ally: staged.id, run };
  };

  it("exhausts a character you control (the first player's choice); with Dense in play it takes 2 damage", () => {
    const { ally, run } = strike("Dense");
    expect(inst(run.state, ally).exhausted).toBe(true);
    expect(inst(run.state, ally).damage).toBe(2);
    expect(faceName(run.state)).toBe("Dense");
  });

  it("with Intangible in play it takes no damage, and the attachment is flipped (to Dense)", () => {
    const { ally, run } = strike("Intangible");
    expect(inst(run.state, ally).exhausted).toBe(true);
    expect(inst(run.state, ally).damage).toBe(0);
    expect(faceName(run.state)).toBe("Dense");
    expect(types(run.events, "cardFlipped")).toHaveLength(2);
  });

  it("with Dense in play the attachment is not flipped by the card (control: only the Forced Response flipped)", () => {
    const { run } = strike("Dense");
    expect(types(run.events, "cardFlipped")).toHaveLength(1);
  });

  /**
   * The villain phase with the Vision attack defended by the hero (so the hero is exhausted when the card chooses) and
   * the ally exhausted too when `tired`: the end-of-turn ready step has run by the first defender prompt, so that is
   * where the surgery goes. Returns the options the card's choice offered.
   */
  const struckWith = (face: "Dense" | "Intangible", tired: boolean) => {
    const staged = stagedInPlay(showing(heroGame(), faceAtActivation(face)), MOON_KNIGHT);
    const offered: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") return [hero(s)];
      if (c.prompt.kind === "chooseTarget") {
        offered.push(...c.options.map((o) => o.optionId as string));
        if (offered.includes(staged.id)) return [staged.id];
      }
      return firstLegal(s);
    };
    const before = (s: GameState): GameState =>
      tired && s.pendingChoice?.prompt.kind === "declareDefender"
        ? patchInstance(s, staged.id, { exhausted: true })
        : s;
    const started = applyOk(stackEncounterDeck(staged.state, BLANK, STRIKE, BLANK), endTurn(P1), WAVE10_DEPS);
    const run = driveStepwise(WAVE10_DEPS, started.state, pick, before);
    return { ally: staged.id, state: run.state, offered };
  };

  it("Intangible up: exhaust is the only effect, so only a ready character is offered (the hero defended)", () => {
    const { ally, state, offered } = struckWith("Intangible", false);
    expect(offered).toEqual([ally]);
    expect(inst(state, ally).exhausted).toBe(true);
    expect(inst(state, ally).damage).toBe(0);
  });

  it("Intangible up with no ready character left: nothing is offered or struck, and the attachment still flips", () => {
    const { ally, state, offered } = struckWith("Intangible", true);
    expect(offered).toEqual([]);
    expect(inst(state, ally).damage).toBe(0);
    expect(faceName(state)).toBe("Dense");
  });

  it("Dense up: damage can still affect an exhausted character (RRG Target p. 43), so it is offered and takes 2", () => {
    const { ally, state, offered } = struckWith("Dense", true);
    expect(offered).toContain(ally);
    expect(inst(state, ally).damage).toBe(2);
  });

  it("Dense up with a ready ally: both the exhausted hero and the ally are offered", () => {
    const { ally, state, offered } = struckWith("Dense", false);
    expect(offered).toHaveLength(2);
    expect(inst(state, ally).damage).toBe(2);
  });
});

describe("Phase Disruption (57053)", () => {
  const disrupt = (face: "Dense" | "Intangible") => {
    const staged = stagedInPlay(showing(heroGame(), faceAtActivation(face)), SHARP_CLAWS, { attach: true });
    const run = villainPhase(staged.state, nothingDefends, BLANK, DISRUPTION, BLANK);
    return { upgrade: staged.id, run };
  };

  it("with Dense in play: the enemy team exhausts an upgrade you control, and the attachment is flipped", () => {
    const { upgrade, run } = disrupt("Dense");
    expect(inst(run.state, upgrade).exhausted).toBe(true);
    expect(inst(run.state, upgrade).attachedTo).toBe(hero(run.state));
    expect(faceName(run.state)).toBe("Intangible");
    expect(types(run.events, "cardFlipped")).toHaveLength(2);
  });

  it("with Intangible in play: the upgrade is discarded instead, and the attachment is not flipped", () => {
    const { upgrade, run } = disrupt("Intangible");
    expect(inst(run.state, upgrade).attachedTo).toBeNull();
    expect(run.state.players[0]!.discard).toContain(upgrade);
    // Only the step 1 Forced Response flipped it (Dense to Intangible); the card did not.
    expect(faceName(run.state)).toBe("Intangible");
    expect(types(run.events, "cardFlipped")).toHaveLength(1);
  });

  it("with no upgrade to choose, nothing is exhausted or discarded (control), and Dense still flips", () => {
    const start = showing(heroGame(), faceAtActivation("Dense"));
    const run = villainPhase(start, nothingDefends, BLANK, DISRUPTION, BLANK);
    expect(faceName(run.state)).toBe("Intangible");
  });

  /** The ready step has run by the first defender prompt, so that is where the upgrade is exhausted. */
  const disruptedWith = (face: "Dense" | "Intangible", tired: boolean) => {
    const staged = stagedInPlay(showing(heroGame(), faceAtActivation(face)), SHARP_CLAWS, { attach: true });
    const before = (s: GameState): GameState =>
      tired && s.pendingChoice?.prompt.kind === "declareDefender"
        ? patchInstance(s, staged.id, { exhausted: true })
        : s;
    const started = applyOk(stackEncounterDeck(staged.state, BLANK, DISRUPTION, BLANK), endTurn(P1), WAVE10_DEPS);
    const run = driveStepwise(WAVE10_DEPS, started.state, nothingDefends, before);
    return { upgrade: staged.id, state: run.state };
  };

  it("with Intangible in play a ready upgrade is discarded", () => {
    const { upgrade, state } = disruptedWith("Intangible", false);
    expect(inst(state, upgrade).attachedTo).toBeNull();
  });

  it("with Intangible in play an exhausted upgrade is a valid choice too: discard can affect it", () => {
    const { upgrade, state } = disruptedWith("Intangible", true);
    expect(inst(state, upgrade).attachedTo).toBeNull();
  });

  it("with Dense in play only a ready upgrade can be exhausted: an exhausted one is left alone", () => {
    const { upgrade, state } = disruptedWith("Dense", true);
    expect(inst(state, upgrade).attachedTo).toBe(hero(state));
  });
});

describe("Just Passing Through (57054)", () => {
  /** The side scheme the leader's setup put into play, down to 1 threat, and `defeater` (hero form) to thwart it. */
  const stage = (opts: { readonly defeater?: PlayerId; readonly status?: "confused" | "stunned" } = {}) => {
    const base = heroGame({ twoPlayers: opts.defeater === P2 });
    const who = opts.defeater ?? P1;
    const scheme = base.villainArea.find((i) => codeOf(base, i) === PASSING)!;
    const turn = who === P2 ? driveEventsPicking(WAVE10_DEPS, base, firstLegal, endTurn(P1)).state : base;
    const threatened = patchInstance(turn, scheme, { threat: 1 });
    return { scheme, who, state: threatened };
  };
  const thwart = (s: GameState, scheme: InstanceId, who: PlayerId) =>
    heroThwarts(WAVE10_DEPS, s, scheme, { player: who });
  const statuses = (s: GameState, who: PlayerId) => inst(s, hero(s, who)).statuses;

  it("is data: 3 threat per player, a hazard icon", () => {
    const card = dataOf(PASSING);
    expect([card.startingThreat, card.icons]).toEqual([{ base: 0, perPlayer: 3 }, ["hazard"]]);
  });

  it("is in play from the start (the leader's side scheme)", () => {
    expect(open().villainArea.map((i) => codeOf(open(), i))).toContain(PASSING);
  });

  it("the player who defeated it confuses their identity", () => {
    const { state, scheme, who } = stage();
    const after = thwart(state, scheme, who).state;
    expect(inst(after, scheme).threat).toBe(0);
    expect(statuses(after, who)).toMatchObject({ confused: 1, stunned: 0 });
  });

  it("otherwise (the confusion could not be given: already confused) they stun their identity", () => {
    const { state, scheme, who } = stage();
    // A confused hero's own thwart is cancelled by the status, so their ally defeats it: the ally's controller is the
    // player who defeated the scheme.
    const ally = stagedInPlay(state, MOON_KNIGHT);
    const confused = patchInstance(ally.state, hero(state, who), {
      statuses: { ...statuses(state, who), confused: 1 },
    });
    const run = driveEventsPicking(WAVE10_DEPS, confused, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally.id,
      schemeInstanceId: scheme,
    });
    expect(inst(run.state, scheme).threat).toBe(0);
    expect(statuses(run.state, who)).toMatchObject({ confused: 1, stunned: 1 });
  });

  it("an ally defeating it with the hero not confused gives the confusion and no stun (control)", () => {
    const { state, scheme, who } = stage();
    const ally = stagedInPlay(state, MOON_KNIGHT);
    const run = driveEventsPicking(WAVE10_DEPS, ally.state, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally.id,
      schemeInstanceId: scheme,
    });
    expect(statuses(run.state, who)).toMatchObject({ confused: 1, stunned: 0 });
  });

  it("the second player who defeats it is the one confused (not the first player)", () => {
    const { state, scheme, who } = stage({ defeater: P2 });
    const after = thwart(state, scheme, who).state;
    expect(statuses(after, P2).confused).toBe(1);
    expect(statuses(after, P1).confused).toBe(0);
  });
});

describe("the toHero command is unaffected by the set (control for the helpers)", () => {
  it("changing to hero form works with the mass form attachment on Vision", () => {
    const run = driveEventsPicking(WAVE10_DEPS, open(), firstLegal, toHero(P1));
    expect(run.state.players[0]!.identity).toBeDefined();
    expect(attachedCodes(run.state)).toEqual([MASS]);
  });
});
