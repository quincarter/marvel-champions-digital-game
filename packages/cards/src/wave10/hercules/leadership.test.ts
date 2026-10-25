import { HERCULES_CARDS } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  characterProfile,
  locateCard,
  playCostOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { WAVE10_CARDS } from "../cards.js";
import { THOR_PACK_CARDS } from "../../wave1/thor/pack-cards.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "../../wave7/next_evol/precon-cable-deck.js";
import { drive } from "../../dsl/wave10-labor.testing.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { codeOf } from "../../wave9/testing.js";
import { WAVE10_DEPS, engageMinion, herculesGame, herculesHeroGame, stagedInPlay } from "../testing.js";
import { HERCULES_LEADERSHIP as REGISTRY, HERCULES_LEADERSHIP_SKIPPED as SKIPPED } from "./leadership.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 10 `hercules/leadership` (docs/phase7-wave10-hero-packs.md H3.10, H8.4 line HS14): the two reprints (59021
 * Teamwork, 59022 Call for Backup) and the five Hercules-pack cards scripted here (59018 Deathcry, 59019 Namora, 59020
 * Thor, 59023 Recruitment Drive, 59024 "Avenge Me!"), in real Hercules games against Core's Rhino. No ruling in
 * docs/rulings/marvel-champions-rulings-post-rrg-1-7.md names these cards. Cards are staged straight into play (`stagedInPlay`) and
 * their abilities used for real.
 */
const TEAMWORK = "59021.teamwork-interrupt";
const CALL_FOR_BACKUP = "59022.when-defeated";
const DEATHCRY_REF = "59018.deathcry-interrupt";
const NAMORA_REF = "59019.namora-constant";
const THOR_REF = "59020.thor-forced-response";
const DRIVE_CONSTANT = "59023.recruitment-drive-constant";
const DRIVE_ACTION = "59023.recruitment-drive-action";
const AVENGE_REF = "59024.avenge-me-interrupt";
const SCRIPTED = [DEATHCRY_REF, NAMORA_REF, THOR_REF, DRIVE_CONSTANT, DRIVE_ACTION, AVENGE_REF];

const DEATHCRY = "59018";
const NAMORA = "59019";
const THOR = "59020";
const DRIVE = "59023";
const AVENGE = "59024";
const CHO = "59008"; // ally, cost 2, 2 hit points
const MODOK = "01184"; // Core minion, 8 hit points, Retaliate 2
const RADIOACTIVE_MAN = "01129"; // Core minion, 7 hit points, no keywords
const ADVANCE = "01186"; // Core treachery
const MINION = "minion" as InstanceId;

const run = (s: GameState, command: Command, pick: Picker = firstLegal) => drive(s, command, pick, WAVE10_DEPS);
const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const offeredIn = (state: GameState): string[] =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? state.pendingChoice.options.flatMap((o) => (o.ref.kind === "ability" ? [o.ref.abilityId as string] : []))
    : [];
/** Takes the listed abilities when offered (recording every offer); otherwise the first legal choice. */
const taking =
  (refs: readonly string[], offered: string[] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      offered.push(...offeredIn(state));
      const wanted = choice.options.filter((o) => o.ref.kind === "ability" && refs.includes(o.ref.abilityId as string));
      if (wanted.length > 0) return wanted.map((o) => o.optionId);
      return choice.minSelections > 0 ? [choice.options[0]!.optionId] : [];
    }
    return firstLegal(state);
  };
const hpOf = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE10_DEPS)!.maxHp;
const minionCode = (s: GameState): string =>
  codeOf(
    s,
    activeEncounterDeck(s).deck.find((i) => s.cardPool[inst(s, i).cardId]?.type === "minion")!,
  );
/** The minions in play engaged with the first player. */
const engagedIds = (s: GameState): InstanceId[] =>
  Object.values(s.instances)
    .filter(
      (i) =>
        i.engagedWith === P1 &&
        s.cardPool[i.cardId]?.type === "minion" &&
        locateCard(s, i.instanceId)?.kind === "playArea",
    )
    .map((i) => i.instanceId);

const dataOf = (code: string) =>
  [...WAVE10_CARDS, ...HERCULES_CARDS].find((c) => c.id === code) as unknown as {
    cost?: number;
    resourceIcons?: unknown;
    traits?: unknown;
    abilities: { id: string }[];
  };

describe("registry", () => {
  it("scripts every ability of the seven cards, none skipped, each validating, with the printed timing", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([TEAMWORK, CALL_FOR_BACKUP, ...SCRIPTED].sort());
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(REGISTRY[DEATHCRY_REF]!.trigger).toMatchObject({ kind: "interrupt", form: "hero" });
    expect(REGISTRY[NAMORA_REF]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY[THOR_REF]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[DRIVE_CONSTANT]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY[DRIVE_ACTION]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY[AVENGE_REF]!.trigger).toMatchObject({ kind: "interrupt" });
  });

  it("the printed refs of the five cards are exactly the scripted ones", () => {
    const printed = [DEATHCRY, NAMORA, THOR, DRIVE, AVENGE].flatMap((c) => dataOf(c).abilities.map((a) => a.id));
    expect(printed.sort()).toEqual([...SCRIPTED].sort());
  });
});

describe("reprints", () => {
  it("59021 Teamwork aliases the script of 06032, the same definition object", () => {
    expect(REGISTRY[TEAMWORK]).toBe(THOR_PACK_CARDS["06032.teamwork-constant"]);
    const a = dataOf("59021");
    const b = dataOf("06032");
    expect(a.cost).toBe(b.cost);
    expect(a.resourceIcons).toEqual(b.resourceIcons);
    expect(a.traits).toEqual(b.traits);
    expect(a.abilities.map((r) => r.id)).toEqual([TEAMWORK]);
  });

  it("59022 Call for Backup aliases the script of 40018, the same definition object", () => {
    expect(REGISTRY[CALL_FOR_BACKUP]).toBe(NEXT_EVOL_PRECON_CABLE_DECK["40018.when-defeated"]);
    const a = dataOf("59022");
    const b = dataOf("40018");
    expect(a.traits).toEqual(b.traits);
    expect(a.abilities.map((r) => r.id)).toEqual([CALL_FOR_BACKUP]);
  });
});

describe("59018 Deathcry", () => {
  /** Hero form, Deathcry in play, Radioactive Man (7 hit points, no Retaliate) engaged with the first player. */
  function armed() {
    const ally = stagedInPlay(herculesHeroGame(), DEATHCRY);
    return { state: engageMinion(ally.state, RADIOACTIVE_MAN, MINION, P1), deathcry: ally.id };
  }
  const identity = (s: GameState) => playerOf(s, P1).identity.instanceId;

  it("declined, her basic attack deals 3 and she takes her printed 2 consequential damage; the hero takes none", () => {
    const { state, deathcry } = armed();
    const { state: after } = run(state, basicAttack(deathcry, MINION), taking([]));
    expect(inst(after, MINION).damage).toBe(3);
    expect(inst(after, deathcry).damage).toBe(2);
    expect(inst(after, identity(after)).damage).toBe(0);
  });

  it("taken, the hero takes 1 damage as the cost and she takes 1 consequential damage instead of 2", () => {
    const { state, deathcry } = armed();
    const { state: after } = run(state, basicAttack(deathcry, MINION), taking([DEATHCRY_REF]));
    expect(inst(after, MINION).damage).toBe(3);
    expect(inst(after, deathcry).damage).toBe(1);
    expect(inst(after, identity(after)).damage).toBe(1);
  });

  it("is for this attack only: her next attack takes the printed 2 again", () => {
    const { state, deathcry } = armed();
    const first = run(state, basicAttack(deathcry, MINION), taking([DEATHCRY_REF])).state;
    expect(inst(first, deathcry).damage).toBe(1);
    const readied = patchInstance(first, deathcry, { exhausted: false });
    const second = run(readied, basicAttack(deathcry, MINION), taking([])).state;
    expect(inst(second, deathcry).damage).toBe(3);
  });

  it("is not offered in alter-ego form", () => {
    const ally = stagedInPlay(herculesGame(), DEATHCRY);
    const s = engageMinion(ally.state, RADIOACTIVE_MAN, MINION, P1);
    const offered: string[] = [];
    const { state: after } = run(s, basicAttack(ally.id, MINION), taking([DEATHCRY_REF], offered));
    expect(offered).not.toContain(DEATHCRY_REF);
    expect(inst(after, ally.id).damage).toBe(2);
  });

  it("is not offered for an attack made by another ally", () => {
    const { state } = armed();
    const cho = stagedInPlay(state, CHO);
    const offered: string[] = [];
    run(cho.state, basicAttack(cho.id, MINION), taking([DEATHCRY_REF], offered));
    expect(offered).not.toContain(DEATHCRY_REF);
  });
});

describe("59019 Namora", () => {
  it("has 4 hit points alone and +1 for each other ally you control, never counting herself", () => {
    const namora = stagedInPlay(herculesGame(), NAMORA);
    expect(hpOf(namora.state, namora.id)).toBe(4);
    const one = stagedInPlay(namora.state, CHO);
    expect(hpOf(one.state, namora.id)).toBe(5);
    const two = stagedInPlay(one.state, DEATHCRY);
    expect(hpOf(two.state, namora.id)).toBe(6);
  });

  it("drops again when an ally leaves play", () => {
    const namora = stagedInPlay(herculesGame(), NAMORA);
    const cho = stagedInPlay(namora.state, CHO);
    const gone: GameState = {
      ...cho.state,
      players: cho.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((i) => i !== cho.id), discard: [...p.discard, cho.id] }
          : p,
      ),
    };
    expect(hpOf(gone, namora.id)).toBe(4);
  });
});

describe("59020 Thor", () => {
  /** Alter-ego game, Thor in play, the encounter deck stacked: a treachery, then a minion. */
  function stacked() {
    const base = herculesGame();
    const code = minionCode(base);
    return { thor: stagedInPlay(stackEncounterDeck(base, ADVANCE, code), THOR), code };
  }
  const thwart = (s: GameState, thor: InstanceId) => {
    const scheme = s.mainScheme.instanceId;
    return run(patchInstance(s, scheme, { threat: 6 }), basicThwart(thor, scheme));
  };

  it("after his basic thwart, discards until a minion and puts it into play engaged with his controller, unrevealed", () => {
    const { thor, code } = stacked();
    const before = activeEncounterDeck(thor.state);
    const result = thwart(thor.state, thor.id);
    const after = result.state;
    expect(activeEncounterDeck(after).discard.map((i) => codeOf(after, i))).toContain(ADVANCE);
    const entered = engagedIds(after).find((i) => codeOf(after, i) === code);
    expect(entered).toBeDefined();
    expect(inst(after, entered!).engagedWith).toBe(P1);
    expect(activeEncounterDeck(after).deck.length).toBeLessThan(before.deck.length);
    expect(result.events.some((e: GameEvent) => e.type === "encounterCardRevealed")).toBe(false);
    expect(inst(after, thor.id).exhausted).toBe(true);
  });

  it("is forced, and a thwart by another ally does not trigger it", () => {
    const { thor } = stacked();
    const cho = stagedInPlay(thor.state, CHO);
    const result = thwart(cho.state, cho.id);
    expect(activeEncounterDeck(result.state).discard.map((i) => codeOf(result.state, i))).not.toContain(ADVANCE);
    expect(engagedIds(result.state)).toEqual([]);
  });
});

describe("59023 Recruitment Drive", () => {
  const pay = (s: GameState, id: InstanceId, n: number) =>
    playerOf(s, P1)
      .hand.filter((c) => c !== id)
      .slice(0, n);

  it("can be played in alter-ego form, paying 3", () => {
    const given = moveToHand(herculesGame(), P1, DRIVE);
    const id = given.ids[0]!;
    const result = applyCommand(given.state, play(P1, id, pay(given.state, id, 3)), WAVE10_DEPS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(playerOf(result.state, P1).playArea).toContain(id);
  });

  it("cannot be played in hero form", () => {
    const given = moveToHand(herculesHeroGame(), P1, DRIVE);
    const id = given.ids[0]!;
    const result = applyCommand(given.state, play(P1, id, pay(given.state, id, 3)), WAVE10_DEPS);
    expect(result.ok).toBe(false);
  });

  it("its Action discards it and the chosen player's next ally costs 0: Thor (4), then Namora at her full 4", () => {
    const staged = stagedInPlay(herculesGame(), DRIVE);
    const used = drive(staged.state, use(P1, staged.id, DRIVE_ACTION), firstLegal, WAVE10_DEPS);
    expect(playerOf(used.state, P1).discard).toContain(staged.id);
    const thor = moveToHand(used.state, P1, THOR);
    expect(playCostOf(thor.state, P1, thor.ids[0]!, WAVE10_DEPS)).toMatchObject({ printed: 4, current: 0 });
    const played = applyCommand(thor.state, play(P1, thor.ids[0]!, []), WAVE10_DEPS);
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const namora = moveToHand(played.state, P1, NAMORA);
    expect(playCostOf(namora.state, P1, namora.ids[0]!, WAVE10_DEPS)).toMatchObject({ printed: 4, current: 4 });
  });

  it("an unused reduction is gone next round", () => {
    const staged = stagedInPlay(herculesGame(), DRIVE);
    const used = drive(staged.state, use(P1, staged.id, DRIVE_ACTION), firstLegal, WAVE10_DEPS);
    const ending = applyCommand(used.state, endTurn(P1), WAVE10_DEPS);
    if (!ending.ok) throw new Error(ending.error.message);
    const next = settle(ending.state, firstLegal, (s) => s.step.phase === "player" && !s.pendingChoice, WAVE10_DEPS);
    const thor = moveToHand(next, P1, THOR);
    expect(playCostOf(thor.state, P1, thor.ids[0]!, WAVE10_DEPS)).toMatchObject({ printed: 4, current: 4 });
  });
});

describe('59024 "Avenge Me!"', () => {
  /** Alter-ego game, Cho (2 hit points) in play with the upgrade attached to him. */
  function avenged() {
    const cho = stagedInPlay(herculesGame(), CHO);
    const up = stagedInPlay(cho.state, AVENGE);
    const attached = patchInstance(patchInstance(up.state, up.id, { attachedTo: cho.id }), cho.id, {
      attachments: [up.id],
    });
    const state: GameState = {
      ...attached,
      players: attached.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: p.playArea.filter((i) => i !== up.id) } : p,
      ),
    };
    return { state, cho: cho.id, up: up.id };
  }

  it("draws 2 when the attached ally is defeated (here by consequential damage), and is discarded with him", () => {
    const { state, cho, up } = avenged();
    const handBefore = playerOf(state, P1).hand.length;
    const engaged = engageMinion(patchInstance(state, cho, { damage: 1 }), MODOK, MINION, P1);
    const { state: after } = run(engaged, basicAttack(cho, MINION), taking([AVENGE_REF]));
    expect(locateCard(after, cho)?.kind).not.toBe("playArea");
    expect(playerOf(after, P1).discard).toContain(up);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 2);
  });

  it("is optional: declined, nothing is drawn", () => {
    const { state, cho } = avenged();
    const handBefore = playerOf(state, P1).hand.length;
    const engaged = engageMinion(patchInstance(state, cho, { damage: 1 }), MODOK, MINION, P1);
    const { state: after } = run(engaged, basicAttack(cho, MINION), taking([]));
    expect(locateCard(after, cho)?.kind).not.toBe("playArea");
    expect(playerOf(after, P1).hand.length).toBe(handBefore);
  });

  it("does nothing while the ally survives", () => {
    const { state, cho } = avenged();
    const handBefore = playerOf(state, P1).hand.length;
    const scheme = state.mainScheme.instanceId;
    const { state: after } = run(
      patchInstance(state, scheme, { threat: 6 }),
      basicThwart(cho, scheme),
      taking([AVENGE_REF]),
    );
    expect(locateCard(after, cho)?.kind).toBe("playArea");
    expect(playerOf(after, P1).hand.length).toBe(handBefore);
  });

  it("its play restrictions are data: one per ally", () => {
    expect(dataOf(AVENGE)).toMatchObject({ playRestrictions: { maxPerHost: 1 } });
  });
});
