import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  createGame,
  iconsOn,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { buildCrossHeroDeck } from "../../../testing/cross-hero.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";
import { WAVE11_DEPS as DEPS } from "../../index.js";
import { FNE_ASPECT_BASIC_JUSTICE as REGISTRY, FNE_ASPECT_BASIC_JUSTICE_SKIPPED as SKIPPED } from "./justice.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `fne/aspect-basic/justice` (docs/phase7-wave11.md section 8.4 line 10), 60019 to 60028. Every card is played
 * from the deck of a Core hero (Spider-Man, the Justice precon, with the card added to his deck; definition of done
 * 4b) against Core's Rhino, so a script that assumes Daredevil fails. Cards are staged into play by surgery; every
 * ability is then used through the engine's own commands.
 */
const BLINDSPOT = "60019";
const CLOAK = "60020";
const DAGGER = "60021";
const GHOST_RIDER = "60022";
const DE_ESCALATION = "60024";
const KNOW_YOUR_ENEMY = "60023";
const LEGAL_TROUBLE = "60026";
const MOVE_IN_SHADOW = "60027";
const STEALTH_TRAINING = "60028";

/** Every ref this module registers (the reprint alias included). */
const REFS = [
  "60019.blindspot-response",
  "60020.cloak-action",
  "60021.dagger-constant",
  "60021.dagger-constant-2",
  "60022.ghost-rider-interrupt",
  "60023.know-your-enemy-action",
  "60024.when-defeated",
  "60025.chance-encounter-interrupt",
  "60026.legal-trouble-constant",
  "60027.move-in-shadow-response",
  "60028.stealth-training-response",
];

const KEY_CODES = [
  BLINDSPOT,
  CLOAK,
  DAGGER,
  GHOST_RIDER,
  DE_ESCALATION,
  KNOW_YOUR_ENEMY,
  LEGAL_TROUBLE,
  MOVE_IN_SHADOW,
  STEALTH_TRAINING,
];
const SHOCKER = "01103"; // Core minion: 3 hit points
const SANDMAN = "01102"; // Core minion: SCH 2
const ONE_ENERGY = MOVE_IN_SHADOW; // an upgrade whose only resource icon is one [energy], to pay exact amounts
const BREAKIN = "01107"; // Core side scheme (Rhino): 2 threat at setup, hazard
const MINION = "m-shocker" as InstanceId;

function coreGame(code: string): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...config, players: [buildCrossHeroDeck(PLAYABLE_CARDS, "core-spider-man-justice", code)] },
    DEPS,
  );
  if (!created.ok) throw new Error(`${code}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(opened, { heroForm: 0 });
}

const handOf = (s: GameState): InstanceId[] => [...playerOf(s, P1).hand];
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;

/**
 * Accepts every optional trigger, takes the wanted options (card ids or labels) among the pending ones, else the first
 * legal answer.
 */
const choosing =
  (...wanted: readonly (InstanceId | string)[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    const hits = choice.options.filter((o) =>
      wanted.some((w) => (o.ref.kind === "card" && o.ref.instanceId === w) || o.optionId.endsWith(w)),
    );
    return hits.length > 0 ? hits.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(s);
  };

const drive = (s: GameState, command: Command, pick: Picker = firstLegal): GameState =>
  settle(runWith(DEPS, s, command), pick, undefined, DEPS);
const rejected = (s: GameState, command: Command): boolean => !applyCommand(s, command, DEPS).ok;
const basicThwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** Surgery: turns `n` hand cards (not `keep`) into cards that each pay exactly one [energy]; returns their ids. */
function withEnergyInHand(
  state: GameState,
  n: number,
  keep: readonly InstanceId[] = [],
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const ids = handOf(state)
    .filter((i) => !keep.includes(i))
    .slice(0, n);
  const patched = ids.reduce((s, id) => patchInstance(s, id, { cardId: cardId(ONE_ENERGY) as never }), state);
  return { state: patched, ids };
}

/** Surgery: a copy of `code` attached to `host`, controlled by P1. */
function withAttached(state: GameState, host: InstanceId, code: string, id: string): GameState {
  const upgrade = {
    instanceId: id as InstanceId,
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
    attachedTo: host,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  } as never;
  const withInstance = { ...state, instances: { ...state.instances, [id]: upgrade } };
  return patchInstance(withInstance, host, {
    attachments: [...inst(withInstance, host).attachments, id as InstanceId],
  });
}

/** Surgery: turns one deck card of P1's into a copy of `code` and returns it in hand (so it can be found/played). */
function convertDeckCard(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const id = playerOf(state, P1).deck.find((i) => !KEY_CODES.includes(codeOf(state, i)))!;
  return { state: patchInstance(state, id, { cardId: cardId(code) as never }), id };
}

/** Surgery: `threat` on the main scheme. */
const withMainThreat = (s: GameState, threat: number): GameState =>
  patchInstance(s, s.mainScheme.instanceId, { threat });
/** Surgery: a deck card of P1's turned into `code` and put into play. */
const copyInPlay = (s: GameState, code: string) => stagedInPlay(convertDeckCard(s, code).state, code);

const confusedOf = (s: GameState, id: InstanceId): number => inst(s, id).statuses.confused;
const stunnedOf = (s: GameState, id: InstanceId): number => inst(s, id).statuses.stunned;

describe("wave 11 fne/aspect-basic/justice", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts every ref of 60019 to 60028, so nothing is skipped", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(SKIPPED).toEqual({});
  });

  it("aliases the reprint to its original's script, and the printed text is the original's", () => {
    const text = (code: string): string => {
      const card = PLAYABLE_CARDS.find((c) => (c.id as string) === code) as unknown as { text?: { current: string } };
      return (card.text?.current ?? "").replace(/\s+/g, " ").trim();
    };
    expect(REGISTRY["60025.chance-encounter-interrupt"]).toBe(WAVE10_ABILITIES["26034.chance-encounter-interrupt"]);
    expect(text("60025")).not.toBe("");
    expect(text("60025")).toBe(text("26034"));
  });

  describe("60019.blindspot-response", () => {
    it("after Blindspot thwarts, confuses an enemy with an upgrade attached (not one without)", () => {
      const staged = stagedInPlay(engageMinion(coreGame(BLINDSPOT), SHOCKER, MINION), BLINDSPOT);
      const other = withMainThreat(engageMinion(staged.state, SHOCKER, "m-plain"), 9);
      const withUpgrade = withAttached(other, MINION, LEGAL_TROUBLE, "u1");
      const after = drive(withUpgrade, basicThwart(staged.id, withUpgrade.mainScheme.instanceId), choosing(MINION));
      expect(confusedOf(after, MINION)).toBe(1);
      expect(confusedOf(after, "m-plain" as InstanceId)).toBe(0);
    });

    it("has no target, so nothing is confused, when no enemy has an upgrade", () => {
      const staged = stagedInPlay(engageMinion(coreGame(BLINDSPOT), SHOCKER, MINION), BLINDSPOT);
      const start = withMainThreat(staged.state, 9);
      const after = drive(start, basicThwart(staged.id, start.mainScheme.instanceId), choosing());
      expect(mainThreat(after)).toBe(7);
      expect(confusedOf(after, MINION)).toBe(0);
    });
  });

  describe("60020.cloak-action", () => {
    it("exhausts Cloak, spends 2 energy and puts Dagger into play", () => {
      const cloak = stagedInPlay(coreGame(CLOAK), CLOAK);
      const dagger = convertDeckCard(cloak.state, DAGGER);
      const paid = withEnergyInHand(dagger.state, 2);
      const after = drive(
        paid.state,
        use(P1, cloak.id, "60020.cloak-action", [{ fromHand: paid.ids[0]! }, { fromHand: paid.ids[1]! }]),
        choosing(dagger.id),
      );
      expect(inst(after, cloak.id).exhausted).toBe(true);
      expect(playerOf(after, P1).playArea).toContain(dagger.id);
      expect(handOf(after)).not.toContain(paid.ids[0]);
    });

    it("cannot be used with less than 2 energy", () => {
      const cloak = stagedInPlay(coreGame(CLOAK), CLOAK);
      const dagger = convertDeckCard(cloak.state, DAGGER);
      const paid = withEnergyInHand(dagger.state, 1);
      expect(rejected(paid.state, use(P1, cloak.id, "60020.cloak-action", [{ fromHand: paid.ids[0]! }]))).toBe(true);
    });
  });

  describe("60021.dagger-constant", () => {
    it("Cloak loses her acceleration icon while Dagger is in play", () => {
      const cloak = copyInPlay(coreGame(DAGGER), CLOAK);
      expect(iconsOn(cloak.state, DEPS, cloak.id, "acceleration")).toBe(1);
      const both = stagedInPlay(cloak.state, DAGGER);
      expect(iconsOn(both.state, DEPS, cloak.id, "acceleration")).toBe(0);
    });
  });

  describe("60021.dagger-constant-2", () => {
    it("Dagger takes -1 consequential damage while Cloak is in play, and 2 without her", () => {
      const lone = stagedInPlay(engageMinion(coreGame(DAGGER), SHOCKER, MINION), DAGGER);
      const afterLone = drive(lone.state, basicAttack(lone.id, MINION));
      expect(inst(afterLone, lone.id).damage).toBe(2);

      const withCloak = copyInPlay(lone.state, CLOAK);
      const afterBoth = drive(withCloak.state, basicAttack(lone.id, MINION));
      expect(inst(afterBoth, lone.id).damage).toBe(1);
    });
  });

  describe("60022.ghost-rider-interrupt", () => {
    const attackPaying = (state: GameState, rider: InstanceId, target: InstanceId, energy: number) => {
      const paid = withEnergyInHand(state, energy);
      const after = drive(paid.state, basicAttack(rider, target), (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
        const ids = paid.ids.map((i) => choice.options.find((o) => o.optionId.endsWith(i))?.optionId).filter(Boolean);
        return ids.length > 0 ? (ids as string[]).slice(0, choice.maxSelections) : firstLegal(s);
      });
      return { state: after, ids: paid.ids };
    };

    it("spends 1 energy to confuse an attacked minion", () => {
      const staged = stagedInPlay(engageMinion(coreGame(GHOST_RIDER), SHOCKER, MINION), GHOST_RIDER);
      const { state: after, ids } = attackPaying(staged.state, staged.id, MINION, 1);
      expect(handOf(after)).not.toContain(ids[0]);
      expect(confusedOf(after, MINION)).toBe(1);
    });

    it("costs 2 energy against the villain: 1 does not confuse it, 2 does", () => {
      const staged = stagedInPlay(coreGame(GHOST_RIDER), GHOST_RIDER);
      const villain = staged.state.activeVillainId!;
      const short = attackPaying(staged.state, staged.id, villain, 1);
      expect(confusedOf(short.state, villain)).toBe(0);
      expect(handOf(short.state)).toContain(short.ids[0]);
      const full = attackPaying(staged.state, staged.id, villain, 2);
      expect(confusedOf(full.state, villain)).toBe(1);
      expect(handOf(full.state)).not.toContain(full.ids[0]);
    });
  });

  describe("60023.know-your-enemy-action", () => {
    /** Know Your Enemy in hand with 1 paying card, main scheme at `threat`; returns the play command's parts. */
    function ready(threat: number, base: GameState = coreGame(KNOW_YOUR_ENEMY)) {
      const given = moveToHand(base, P1, KNOW_YOUR_ENEMY);
      const id = given.ids[0]!;
      const start = withMainThreat(given.state, threat);
      return { start, id, pay: handOf(start).find((i) => i !== id)! };
    }
    /** Answers each target prompt with the next wanted id that is offered (triggers all accepted). */
    const inOrder = (...wanted: readonly InstanceId[]): Picker => {
      let next = 0;
      return (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
        const hit = choice.options.find((o) => o.optionId.endsWith(wanted[next] ?? " "));
        if (!hit) return firstLegal(s);
        next += 1;
        return [hit.optionId];
      };
    };

    it("removes 1 threat twice from schemes (a thwart), for 1 resource", () => {
      const { start, id, pay } = ready(9);
      const after = drive(start, play(P1, id, [pay]), choosing());
      expect(mainThreat(after)).toBe(7);
    });

    it("splits its two removals across two schemes", () => {
      const first = ready(9);
      const side = encounterCardInVillainArea(first.start, BREAKIN, 3);
      const after = drive(
        side.state,
        play(P1, first.id, [first.pay]),
        inOrder(side.state.mainScheme.instanceId, side.id),
      );
      expect(mainThreat(after)).toBe(8);
      expect(inst(after, side.id).threat).toBe(2);
    });

    it("a confused hero cancels the whole ability: no threat removed, the confused card discarded once", () => {
      const { start, id, pay } = ready(9);
      const hero = identityOf(start);
      const confused = patchInstance(start, hero, { statuses: { ...inst(start, hero).statuses, confused: 1 } });
      const after = drive(confused, play(P1, id, [pay]), choosing());
      expect(mainThreat(after)).toBe(9);
      expect(confusedOf(after, hero)).toBe(0);
    });

    it("its second removal can exactly defeat a side scheme, and Stealth Training responds", () => {
      const training = stagedInPlay(
        convertDeckCard(coreGame(KNOW_YOUR_ENEMY), STEALTH_TRAINING).state,
        STEALTH_TRAINING,
        {
          attach: true,
        },
      );
      const { start, id, pay } = ready(9, training.state);
      const side = encounterCardInVillainArea(engageMinion(start, SHOCKER, MINION), BREAKIN, 2);
      const after = drive(side.state, play(P1, id, [pay]), choosing(side.id, MINION));
      expect(inst(after, side.id).threat).toBe(0);
      expect(stunnedOf(after, MINION)).toBe(1);
      expect(inst(after, training.id).exhausted).toBe(true);
    });
  });

  describe("60024.when-defeated", () => {
    /** De-escalation (a player side scheme in the villain area) at 1 threat, ready for P1's basic thwart. */
    function staged(base: GameState): { readonly state: GameState; readonly id: InstanceId } {
      const given = moveToHand(base, P1, DE_ESCALATION);
      const id = given.ids[0]!;
      const placed: GameState = {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p,
        ),
        villainArea: [...given.state.villainArea, id],
      };
      return { id, state: patchInstance(placed, id, { controllerId: P1, faceup: true, threat: 1 }) };
    }
    const withMainTokens = (s: GameState, tokens: number): GameState =>
      ({ ...s, mainScheme: { ...s.mainScheme, accelerationTokens: tokens } }) as GameState;
    const defeat = (s: GameState, id: InstanceId, pick: Picker): GameState =>
      drive(s, basicThwart(identityOf(s), id), pick);

    it("removes the main scheme's token (1 to 0): Golden Rules (p. 4) over 'Acceleration Token' (p. 5)", () => {
      const scheme = staged(withMainTokens(coreGame(DE_ESCALATION), 1));
      const after = defeat(scheme.state, scheme.id, choosing());
      expect(after.mainScheme.accelerationTokens).toBe(0);
    });

    it("removes one token from a stage holding several", () => {
      const scheme = staged(withMainTokens(coreGame(DE_ESCALATION), 2));
      expect(defeat(scheme.state, scheme.id, choosing()).mainScheme.accelerationTokens).toBe(1);
    });

    it("lets the player pick between the main scheme and a card holding a token", () => {
      const base = withMainTokens(engageMinion(coreGame(DE_ESCALATION), SHOCKER, MINION), 1);
      const scheme = staged(patchInstance(base, MINION, { counters: { acceleration: 2 } }));
      const onCard = defeat(scheme.state, scheme.id, choosing(MINION));
      expect(inst(onCard, MINION).counters["acceleration"]).toBe(1);
      expect(onCard.mainScheme.accelerationTokens).toBe(1);
      const onScheme = defeat(scheme.state, scheme.id, choosing(scheme.state.mainScheme.instanceId));
      expect(inst(onScheme, MINION).counters["acceleration"]).toBe(2);
      expect(onScheme.mainScheme.accelerationTokens).toBe(0);
    });

    it("does nothing when no acceleration token is in play", () => {
      const scheme = staged(coreGame(DE_ESCALATION));
      const after = defeat(scheme.state, scheme.id, choosing());
      expect(after.mainScheme.accelerationTokens).toBe(0);
      expect(inst(after, scheme.id).threat).toBe(0);
    });
  });

  describe("60026.legal-trouble-constant", () => {
    it("the attached minion gets -2 SCH", () => {
      const base = engageMinion(coreGame(LEGAL_TROUBLE), SANDMAN, MINION);
      const before = characterProfile(base, MINION, DEPS)!.sch;
      const after = characterProfile(withAttached(base, MINION, LEGAL_TROUBLE, "lt"), MINION, DEPS)!.sch;
      expect(after).toBe(before - 2);
    });
  });

  describe("60027.move-in-shadow-response", () => {
    it("after you play a card, this one included, removes 1 threat from a scheme", () => {
      const given = moveToHand(coreGame(MOVE_IN_SHADOW), P1, MOVE_IN_SHADOW);
      const id = given.ids[0]!;
      const start = patchInstance(given.state, given.state.mainScheme.instanceId, { threat: 9 });
      const pay = handOf(start)
        .filter((i) => i !== id)
        .slice(0, 2);
      const after = drive(start, play(P1, id, pay), choosing());
      expect(mainThreat(after)).toBe(8);
    });
  });

  describe("60028.stealth-training-response", () => {
    /** Stealth Training on the hero, a side scheme with `threat`, and a Shocker to be stunned. */
    function setup(threat: number) {
      const training = stagedInPlay(coreGame(STEALTH_TRAINING), STEALTH_TRAINING, { attach: true });
      const scheme = encounterCardInVillainArea(training.state, BREAKIN, threat);
      return { state: engageMinion(scheme.state, SHOCKER, MINION), training: training.id, scheme: scheme.id };
    }
    const stunnedByThwart = (threat: number): { state: GameState; training: InstanceId } => {
      const first = setup(threat);
      const after = drive(first.state, basicThwart(identityOf(first.state), first.scheme), choosing(MINION));
      return { state: after, training: first.training };
    };

    it("stuns an enemy and exhausts itself after you thwart and exactly defeat a side scheme", () => {
      const { state, training } = stunnedByThwart(1);
      expect(stunnedOf(state, MINION)).toBe(1);
      expect(inst(state, training).exhausted).toBe(true);
    });

    it("an event thwart attempting more than the scheme's threat is not exact; exactly its amount is", () => {
      for (const [threat, stunned] of [
        [3, 1],
        [2, 0],
      ] as const) {
        const first = setup(threat);
        const justice = convertDeckCard(first.state, "01060");
        const paid = withEnergyInHand(justice.state, 3, [justice.id]);
        const moved = {
          ...paid.state,
          players: paid.state.players.map((p) =>
            p.playerId === P1
              ? { ...p, deck: p.deck.filter((i) => i !== justice.id), hand: [...p.hand, justice.id] }
              : p,
          ),
        } as GameState;
        const after = drive(moved, play(P1, justice.id, paid.ids), choosing(first.scheme, MINION));
        expect(inst(after, first.scheme).threat, `threat ${threat}`).toBe(0);
        expect(stunnedOf(after, MINION), `threat ${threat}`).toBe(stunned);
      }
    });

    it("an ally's thwart is not 'you thwart': no response, even when exact", () => {
      const first = setup(2);
      const blindspot = copyInPlay(first.state, BLINDSPOT);
      const after = drive(blindspot.state, basicThwart(blindspot.id, first.scheme), choosing(MINION));
      expect(inst(after, first.scheme).threat).toBe(0);
      expect(stunnedOf(after, MINION)).toBe(0);
      expect(inst(after, first.training).exhausted).toBe(false);
    });
  });
});
