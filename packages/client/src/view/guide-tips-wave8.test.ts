/**
 * Wave 8 opportunistic tips (Age of Apocalypse, `docs/guided-mode.md` section 3.14): each `situation:`
 * tip fires on its own trigger against the same Core Set fixture `guide-tips.test.ts` uses, with the earlier
 * situations marked seen so only the new trigger is under test. Cards the Core fixture doesn't have are fabricated
 * as bare instances (a tip only reads a printed id, a counter, a threat or an event).
 */
import { beforeEach, describe, expect, test } from "vitest";
import { cardId, cycleId, encounterSetId, setCode, unerrataedText, type MinionCard } from "@mc/content";
import {
  activeVillain,
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

/** Every situation tip that existed before wave 8, so a test isolates the new trigger. */
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

/** A bare instance of a printed card id, put in `playerId`'s play area (or the villain area), optionally attached. */
function withPrintedCard(
  state: GameState,
  printedId: string,
  opts: {
    readonly area?: "player" | "villain";
    readonly patch?: Partial<CardInstance>;
    readonly cardType?: string;
  } = {},
): GameState {
  const cid = cardId(printedId);
  const id = instanceId(`wave8-tip-${printedId}`) as InstanceId;
  const instance: CardInstance = {
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
    name: `Wave 8 fixture ${printedId}`,
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "test",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("wave8-tip-test")],
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
    cardPool: {
      ...state.cardPool,
      [cid]: opts.cardType ? ({ ...minion, type: opts.cardType, icons: [] } as never) : minion,
    },
    instances: { ...state.instances, [id]: instance },
    villainArea: inPlayerArea ? state.villainArea : [...state.villainArea, id],
    players: state.players.map((p) =>
      p.playerId === me && inPlayerArea ? { ...p, playArea: [...p.playArea, id] } : p,
    ),
  };
}

/** `base` with the perspective player's identity swapped for the printed card `printedId`. */
function asIdentity(state: GameState, printedId: string): GameState {
  const identityId = state.players.find((p) => p.playerId === me)!.identity.instanceId;
  return {
    ...state,
    instances: { ...state.instances, [identityId]: { ...state.instances[identityId]!, cardId: cardId(printedId) } },
  } as GameState;
}
const identityOf = (state: GameState): InstanceId => state.players.find((p) => p.playerId === me)!.identity.instanceId;

describe("wave 8 tips", () => {
  const onTable: readonly (readonly [string, string])[] = [
    ["situation:frostbite", "46002"],
    ["situation:grounded", "47023"],
    ["situation:bamf", "48006"],
    ["situation:wrappedInMetal", "49007"],
    ["situation:genePool", "45071"],
    ["situation:prelates", "45104a"],
    ["situation:prelates", "45105a"],
    ["situation:settingEnvironment", "45127"],
    ["situation:settingEnvironment", "45133"],
    ["situation:settingEnvironment", "45139"],
    ["situation:pursuedByThePast", "45075a"],
    ["situation:crazyGang", "48033"],
  ];
  for (const [tipId, printedId] of onTable) {
    test(`${tipId} fires with ${printedId} on the table, once`, () => {
      const game = withPrintedCard(base, printedId);
      expect(firedId(game)).toBe(tipId);
      expect(firedId(game, [], [tipId])).not.toBe(tipId);
    });
  }

  test("a card attached to an enemy counts as on the table (Frostbite on Rhino)", () => {
    const host = activeVillain(base).instanceId;
    const withFrostbite = withPrintedCard(base, "46002", { patch: { attachedTo: host } });
    const hostInstance = withFrostbite.instances[host]!;
    const attached = {
      ...withFrostbite,
      villainArea: withFrostbite.villainArea.filter((id) => id !== instanceId("wave8-tip-46002")),
      instances: {
        ...withFrostbite.instances,
        [host]: { ...hostInstance, attachments: [...hostInstance.attachments, instanceId("wave8-tip-46002")] },
      },
    } as GameState;
    expect(firedId(attached)).toBe("situation:frostbite");
  });

  test("the main scheme stages are on the table: Apocalypse's and En Sabah Nur's", () => {
    const stage = (printedId: string): GameState => ({
      ...base,
      instances: {
        ...base.instances,
        [base.mainScheme.instanceId]: { ...base.instances[base.mainScheme.instanceId]!, cardId: cardId(printedId) },
      },
    });
    expect(firedId(stage("45103a"))).toBe("situation:apocalypseDefeat");
    expect(firedId(stage("45147a"))).toBe("situation:enSabahNur");
    expect(firedId(base)).toBeUndefined();
  });

  test("Energy Absorption and Magnetic Pull fire on their own hero's deck discard, not another's", () => {
    const discard = (by: InstanceId, playerId: PlayerId = me) =>
      ({ type: "cardDiscardedFromDeck", playerId, instanceId: instanceId("d"), by, at: "discard" }) as never;
    const bishop = asIdentity(base, "45001a");
    expect(firedId(bishop, [discard(identityOf(bishop))])).toBe("situation:energyAbsorption");
    expect(firedId(base, [discard(identityOf(base))])).not.toBe("situation:energyAbsorption");
    const magneto = asIdentity(base, "49001a");
    expect(firedId(magneto, [discard(identityOf(magneto))])).toBe("situation:magneticPull");
    expect(firedId(bishop, [discard(identityOf(bishop))])).not.toBe("situation:magneticPull");
    expect(firedId(bishop, [discard(identityOf(bishop), "someone-else" as PlayerId)])).not.toBe(
      "situation:energyAbsorption",
    );
  });

  test("situation:faceupTopCard needs Magik's identity and her top card showing", () => {
    const shown = { type: "deckTopShown", playerId: me, instanceId: instanceId("t"), cardId: cardId("45036") } as never;
    expect(firedId(base, [shown])).not.toBe("situation:faceupTopCard");
    expect(firedId(asIdentity(base, "45030a"), [shown])).toBe("situation:faceupTopCard");
    expect(firedId(asIdentity(base, "45030a"))).not.toBe("situation:faceupTopCard");
  });

  test("situation:wildDeclared fires when a wild was declared, not when the question was skipped", () => {
    const declared = (skipped: boolean) =>
      ({
        type: "wildTypesDeclared",
        playerId: me,
        instanceId: instanceId("w"),
        declared: ["energy"],
        skipped,
      }) as never;
    expect(firedId(base, [declared(false)])).toBe("situation:wildDeclared");
    expect(firedId(base, [declared(true)])).not.toBe("situation:wildDeclared");
  });

  test("situation:effectDefender fires for a defender an effect declared, not an ordinary defense", () => {
    const defender = (byEffect: boolean) =>
      ({
        type: "defenderDeclared",
        attackInstanceId: instanceId("a"),
        defenderInstanceId: instanceId("d"),
        playerId: me,
        ...(byEffect ? { byEffect: true } : {}),
      }) as never;
    expect(firedId(base, [defender(true)])).toBe("situation:effectDefender");
    expect(firedId(base, [defender(false)])).not.toBe("situation:effectDefender");
  });

  test("situation:missionArea needs a card in the mission area, and a mission attempt shows its own tip", () => {
    const ally = withPrintedCard(base, "45002", { area: "player" });
    const inMission = {
      ...ally,
      scenarioPlayAreas: { mission: { cards: [instanceId("wave8-tip-45002")], closed: true } },
    } as GameState;
    expect(firedId(inMission)).toBe("situation:missionArea");
    expect(firedId({ ...base, scenarioPlayAreas: { mission: { cards: [], closed: true } } })).toBeUndefined();
    const pool = {
      type: "damagePoolResolved",
      playerId: me,
      sourceInstanceId: null,
      pool: 2,
      dealt: 2,
      lost: 0,
    } as never;
    expect(firedId(base, [pool])).toBe("situation:missionAttempt");
    expect(firedId(base, [{ type: "cardsPaired", playerId: me, sourceInstanceId: null, pairs: [] } as never])).toBe(
      "situation:missionAttempt",
    );
  });

  test("situation:fourHorsemen needs a row of two or more villains", () => {
    const one = { ...base, villainRow: [base.villainArea[0]!] } as GameState;
    expect(firedId(one)).toBeUndefined();
    const row = { ...base, villainRow: [instanceId("v1"), instanceId("v2")] } as GameState;
    expect(firedId(row)).toBe("situation:fourHorsemen");
  });

  test("every wave 8 tip body links only real glossary terms, and every tip id is distinct", () => {
    const stage = (printedId: string): GameState => ({
      ...base,
      instances: {
        ...base.instances,
        [base.mainScheme.instanceId]: { ...base.instances[base.mainScheme.instanceId]!, cardId: cardId(printedId) },
      },
    });
    const discard = (state: GameState) =>
      ({
        type: "cardDiscardedFromDeck",
        playerId: me,
        instanceId: instanceId("d"),
        by: identityOf(state),
        at: "discard",
      }) as never;
    const bishop = asIdentity(base, "49001a");
    const attempts: readonly (readonly [GameState, readonly GameEvent[]])[] = [
      ...["46002", "47023", "48006", "49007", "45071", "45104a", "45127", "45075a", "48033"].map(
        (id) => [withPrintedCard(base, id), []] as const,
      ),
      [stage("45103a"), []],
      [stage("45147a"), []],
      [bishop, [discard(bishop)]],
      [asIdentity(base, "45001a"), [discard(asIdentity(base, "45001a"))]],
      [
        asIdentity(base, "45030a"),
        [{ type: "deckTopShown", playerId: me, instanceId: instanceId("t"), cardId: cardId("45036") } as never],
      ],
      [
        base,
        [
          {
            type: "wildTypesDeclared",
            playerId: me,
            instanceId: instanceId("w"),
            declared: [],
            skipped: false,
          } as never,
        ],
      ],
      [
        base,
        [
          {
            type: "defenderDeclared",
            attackInstanceId: instanceId("a"),
            defenderInstanceId: instanceId("d"),
            playerId: me,
            byEffect: true,
          } as never,
        ],
      ],
      [{ ...base, scenarioPlayAreas: { mission: { cards: [instanceId("m")], closed: true } } } as GameState, []],
      [base, [{ type: "cardsPaired", playerId: me, sourceInstanceId: null, pairs: [] } as never]],
      [{ ...base, villainRow: [instanceId("v1"), instanceId("v2")] } as GameState, []],
    ];
    const fired: string[] = [];
    for (const [game, events] of attempts) {
      const tip = tipsFor(observe(game, events), POOL_DEPS, prefs)[0];
      expect(tip, "an attempt did not fire a tip").toBeDefined();
      fired.push(tip!.id);
      expect(termTextModelOf(tip!.body).unknownIds, tip!.id).toEqual([]);
      expect(tip!.body, tip!.id).not.toMatch(/colour|behaviour|[–—]/i);
    }
    expect(new Set(fired).size).toBe(fired.length);
    expect(fired.length).toBe(attempts.length);
  });
});
