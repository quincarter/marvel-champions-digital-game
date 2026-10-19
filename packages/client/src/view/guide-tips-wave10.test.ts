/**
 * Wave 10 opportunistic tips (Civil War, Tigra, Hulkling, Wonder Man and Hercules, `docs/guided-mode.md` section 3.14):
 * each `situation:` tip fires on its own trigger against the Core Set fixture `guide-tips.test.ts` uses, with the
 * earlier situations marked seen. Cards the Core fixture does not have are fabricated as bare instances.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { cardId, cycleId, encounterSetId, setCode, unerrataedText, type MinionCard } from "@mc/content";
import {
  instanceId,
  type CardInstance,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { defaultGuidePrefs, type GuidePrefs } from "../guide/guide-prefs.js";
import type { LessonObservation } from "./lesson-model.js";
import { tipsFor } from "./guide-tips.js";
import { termTextModelOf } from "./term-text-model.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

/** Every situation tip that existed before wave 10, so a test isolates the new trigger. */
const EARLIER: readonly string[] = [
  "situation:obligation",
  "situation:nemesisSet",
  "situation:mulligan",
  "situation:minionEngaged",
  "situation:sideScheme",
  "situation:crisis",
  "situation:acceleration",
  "situation:boostFlip",
  "situation:villainStageAdvanced",
  "situation:recover",
  "situation:handSizeDiffers",
  "situation:drawOnAttack",
  "situation:teamwork",
  "situation:massForm",
  "situation:counters",
  "situation:weatherSwap",
  "situation:phoenixForce",
  "situation:touched",
  "situation:threatOnCharacters",
  "situation:playerSideScheme",
  "situation:sideSchemeLimit",
  "situation:perPlayerCost",
  "situation:poolAspect",
  "situation:specialists",
  "situation:threeFaceIdentity",
  "situation:psiBlades",
  "situation:hopeSummers",
  "situation:routed",
  "situation:setupAttachments",
  "situation:energyAbsorption",
  "situation:faceupTopCard",
  "situation:wildDeclared",
  "situation:effectDefender",
  "situation:magneticPull",
  "situation:frostbite",
  "situation:grounded",
  "situation:bamf",
  "situation:wrappedInMetal",
  "situation:genePool",
  "situation:prelates",
  "situation:apocalypseDefeat",
  "situation:settingEnvironment",
  "situation:enSabahNur",
  "situation:pursuedByThePast",
  "situation:crazyGang",
  "situation:missionArea",
  "situation:missionAttempt",
  "situation:fourHorsemen",
  "situation:suitForm",
  "situation:preparationAbility",
  "situation:nonScalingVillain",
  "situation:alertLevel",
  "situation:embassyCaptives",
  "situation:holdingCell",
  "situation:citizenV",
  "situation:executiveBoard",
  "situation:reluctantFoe",
  "situation:additionalAllyCost",
  "situation:controlledMinions",
  "situation:encasedInIce",
  "situation:shieldSupports",
  "situation:tuckedCards",
  "situation:encounterTopFaceup",
  "situation:vulnerableDiscarded",
  "situation:minionHeld",
  "situation:surgeDealt",
  "situation:evidenceCards",
  "situation:accusation",
];
const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: EARLIER };

let base: GameState;
let me: PlayerId;

beforeEach(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  base = store.state.game!;
  me = store.state.perspectiveId!;
});

function observe(game: GameState, lastEvents: readonly GameEvent[] = []): LessonObservation {
  return { game, lastEvents, perspectiveId: me };
}

const firedId = (
  game: GameState,
  events: readonly GameEvent[] = [],
  seen: readonly string[] = [],
): string | undefined =>
  tipsFor(observe(game, events), POOL_DEPS, { ...prefs, seenTips: [...EARLIER, ...seen] })[0]?.id;

/** A bare minion-typed instance of a printed card id, in the villain area or `me`'s play area. */
function withPrintedCard(
  state: GameState,
  printedId: string,
  opts: { readonly area?: "player" | "villain"; readonly patch?: Partial<CardInstance> } = {},
): GameState {
  const cid = cardId(printedId);
  const id = instanceId(`wave10-tip-${printedId}`) as InstanceId;
  const instance = {
    instanceId: id,
    cardId: cid,
    ownerId: null,
    controllerId: me,
    home: { kind: "villainArea" },
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
    ...opts.patch,
  } as CardInstance;
  const minion: MinionCard = {
    id: cid,
    type: "minion",
    name: `Wave 10 fixture ${printedId}`,
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "test",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("wave10-tip-test")],
    boostIcons: 0,
    traits: [],
    keywords: [],
    atk: 1,
    sch: 0,
    hp: 5,
    text: unerrataedText(""),
    abilities: [],
  };
  const inPlayerArea = (opts.area ?? "villain") === "player";
  return {
    ...state,
    cardPool: { ...state.cardPool, [cid]: minion },
    instances: { ...state.instances, [id]: instance },
    villainArea: inPlayerArea ? state.villainArea : [...state.villainArea, id],
    players: state.players.map((p) =>
      p.playerId === me && inPlayerArea ? { ...p, playArea: [...p.playArea, id] } : p,
    ),
  };
}

const identityOf = (state: GameState): InstanceId => state.players.find((p) => p.playerId === me)!.identity.instanceId;

/** The perspective player's hero carries the Unregistered trait (a facedown stand-in is the simplest way to set one). */
function withUnregisteredHero(state: GameState): GameState {
  const id = identityOf(state);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...state.instances[id]!, facedownAs: { traits: ["UNREGISTERED"] } } },
  } as unknown as GameState;
}

const LEADER_TEXT_ID = "wave10-tip-leader-text";

/** A pool card whose text mentions "your leader", so the tip can read it. */
function withLeaderText(state: GameState): GameState {
  const card = {
    id: cardId(LEADER_TEXT_ID),
    type: "event",
    name: "Leader text fixture",
    text: unerrataedText("Stun your leader. Otherwise, you are stunned."),
  };
  return { ...state, cardPool: { ...state.cardPool, [cardId(LEADER_TEXT_ID)]: card as never } };
}

const played = (cid: string) =>
  ({ type: "cardPlayed", playerId: me, instanceId: instanceId("p"), cardId: cardId(cid) }) as never;
const dealtAsBoost = (instance: string, outside: boolean) =>
  ({
    type: "boostCardDealt",
    enemyInstanceId: instanceId("v"),
    instanceId: instanceId(instance),
    ...(outside ? { outsideActivation: true } : {}),
  }) as never;
const preventedBecause = (reason: string) =>
  ({ type: "damagePrevented", targetInstanceId: instanceId("t"), amount: 1, reason }) as never;
const discardedFromPlay = (cid: string) =>
  ({ type: "cardDiscardedFromPlay", instanceId: instanceId("s"), cardId: cardId(cid) }) as never;

describe("wave 10 tips", () => {
  test("a leader on the table fires the leader tip, for each of the four leaders, once", () => {
    for (const id of ["56059", "56092", "56137", "56168"]) {
      const game = withPrintedCard(base, id);
      expect(firedId(game), id).toBe("situation:leaderCard");
      expect(firedId(game, [], ["situation:leaderCard"]), id).not.toBe("situation:leaderCard");
    }
    expect(firedId(base)).toBeUndefined();
  });

  test("the enemy team tip fires on a pending choice with that authority only", () => {
    const enemy = { ...base, pendingChoice: { authority: "enemyTeam" } } as unknown as GameState;
    const own = { ...base, pendingChoice: { authority: "player" } } as unknown as GameState;
    expect(firedId(enemy)).toBe("situation:enemyTeamChoice");
    expect(firedId(own)).toBeUndefined();
    expect(firedId(enemy, [], ["situation:enemyTeamChoice"])).toBeUndefined();
  });

  test("the your-leader tip fires when a card that mentions your leader is played or revealed", () => {
    const game = withLeaderText(base);
    const revealed = {
      type: "encounterCardRevealed",
      instanceId: instanceId("r"),
      cardId: cardId(LEADER_TEXT_ID),
      playerId: me,
    } as never;
    expect(firedId(game, [played(LEADER_TEXT_ID)])).toBe("situation:yourLeader");
    expect(firedId(game, [revealed])).toBe("situation:yourLeader");
    expect(firedId(game, [played(LEADER_TEXT_ID)], ["situation:yourLeader"])).toBeUndefined();
    expect(firedId(game)).toBeUndefined();
    expect(firedId(base, [played("01001a")])).toBeUndefined();
  });

  test("the given-as-boost tip needs a minion dealt outside an activation", () => {
    const game = withPrintedCard(base, "56150", { area: "player" });
    expect(firedId(game, [dealtAsBoost("wave10-tip-56150", true)])).toBe("situation:givenAsBoost");
    expect(firedId(game, [dealtAsBoost("wave10-tip-56150", false)])).toBeUndefined();
    expect(firedId(game, [dealtAsBoost("wave10-tip-56150", true)], ["situation:givenAsBoost"])).toBeUndefined();
  });

  test("the unregistered tip fires when a hero has the trait", () => {
    expect(firedId(withUnregisteredHero(base))).toBe("situation:unregistered");
    expect(firedId(base)).toBeUndefined();
  });

  test("the cannot-take-damage tip fires on that prevention reason only", () => {
    expect(firedId(base, [preventedBecause("cannotTakeDamage")])).toBe("situation:cannotTakeDamage");
    expect(firedId(base, [preventedBecause("tough")])).toBeUndefined();
  });

  test("the cannot-take-damage tip fires when damage could not be dealt at all (`damageNotDealt`)", () => {
    const notDealt = {
      type: "damageNotDealt",
      targetInstanceId: instanceId("t"),
      amount: 1,
      sourceInstanceId: null,
    } as never;
    expect(firedId(base, [notDealt])).toBe("situation:cannotTakeDamage");
  });

  test("the Shapeshift tip fires when one of Hulkling's four shapes leaves play", () => {
    for (const id of ["56032", "56033", "56034", "56035"]) {
      expect(firedId(base, [discardedFromPlay(id)]), id).toBe("situation:shapeshift");
    }
    expect(firedId(base, [discardedFromPlay("56036")])).toBeUndefined();
  });

  test("the Ionic Physiology tip needs a tucked card under it", () => {
    expect(firedId(withPrintedCard(base, "58002", { area: "player" }))).toBeUndefined();
    const tucked = withPrintedCard(base, "58002", { area: "player", patch: { tucked: [instanceId("e1")] } });
    expect(firedId(tucked)).toBe("situation:ionicPhysiology");
  });

  test("a Labor card in play fires the Labor tip", () => {
    for (const id of ["59002", "59003", "59004"]) {
      expect(firedId(withPrintedCard(base, id)), id).toBe("situation:laborCard");
    }
  });

  test("every wave 10 tip body links only real glossary terms and avoids dashes, and the ids are distinct", () => {
    const attempts: readonly (readonly [GameState, readonly GameEvent[]])[] = [
      [withPrintedCard(base, "56059"), []],
      [{ ...base, pendingChoice: { authority: "enemyTeam" } } as unknown as GameState, []],
      [withLeaderText(base), [played(LEADER_TEXT_ID)]],
      [withPrintedCard(base, "56150", { area: "player" }), [dealtAsBoost("wave10-tip-56150", true)]],
      [withUnregisteredHero(base), []],
      [base, [preventedBecause("cannotTakeDamage")]],
      [base, [discardedFromPlay("56032")]],
      [withPrintedCard(base, "58002", { area: "player", patch: { tucked: [instanceId("e1")] } }), []],
      [withPrintedCard(base, "59002"), []],
    ];
    const fired: string[] = [];
    for (const [game, events] of attempts) {
      const tip = tipsFor(observe(game, events), POOL_DEPS, prefs)[0];
      expect(tip, "an attempt did not fire a tip").toBeDefined();
      fired.push(tip!.id);
      expect(termTextModelOf(tip!.body).unknownIds, tip!.id).toEqual([]);
      expect(tip!.body, tip!.id).not.toMatch(/colour|behaviour|[–—]/i);
    }
    expect(new Set(fired).size).toBe(attempts.length);
  });
});
