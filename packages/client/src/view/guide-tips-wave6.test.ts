/**
 * Wave 6 opportunistic tips (Mutant Genesis and MojoMania, `docs/guided-mode.md` section 3.14): each `situation:`
 * tip fires on its own trigger against the same Core Set fixture `guide-tips.test.ts` uses, with the pre-wave-6
 * situations marked seen so only the new trigger is under test. Cards the Core fixture doesn't have are fabricated
 * as bare instances (a tip only reads a printed id, a counter, a threat or an event).
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

/** Every situation tip that existed before wave 6, so a test isolates the new trigger. */
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
  const id = instanceId(`wave6-tip-${printedId}`) as InstanceId;
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
    name: `Wave 6 fixture ${printedId}`,
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "test",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("wave6-tip-test")],
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

describe("wave 6 tips stay quiet on a Core game", () => {
  test("nothing from wave 6 fires on the Rhino fixture", () => {
    expect(firedId(base)?.startsWith("situation:")).not.toBe(true);
  });
});

describe("event-driven wave 6 tips", () => {
  test("situation:teamwork fires on a teamwork keywordResolved", () => {
    const event = {
      type: "keywordResolved",
      keyword: "teamwork",
      instanceId: instanceId("m"),
      playerId: me,
      trait: "ACOLYTE",
    } as unknown as GameEvent;
    expect(firedId(base, [event])).toBe("situation:teamwork");
  });

  test("situation:massForm fires for the perspective player's mass-form change only", () => {
    const event = (playerId: PlayerId) =>
      ({
        type: "additionalFormChanged",
        playerId,
        formType: "mass",
        formName: "Phased",
        instanceId: instanceId("form"),
      }) as unknown as GameEvent;
    expect(firedId(base, [event(me)])).toBe("situation:massForm");
    expect(firedId(base, [event("other-player" as PlayerId)])).not.toBe("situation:massForm");
  });

  test("situation:counters fires for a wave 6 counter type and not for another", () => {
    const placed = (counterType: string) =>
      ({ type: "counterAdded", instanceId: instanceId("c"), counterType, amount: 1 }) as unknown as GameEvent;
    expect(firedId(base, [placed("charge")])).toBe("situation:counters");
    expect(firedId(base, [placed("web")])).not.toBe("situation:counters");
  });

  test("situation:weatherSwap fires only for a swap that names a WEATHER support", () => {
    const swap = (a: string, b: string) =>
      ({
        type: "cardsSwapped",
        how: "leftAndEntered",
        outgoing: instanceId("a"),
        incoming: instanceId("b"),
        cardIds: [cardId(a), cardId(b)],
      }) as unknown as GameEvent;
    expect(firedId(base, [swap("36002", "36004")])).toBe("situation:weatherSwap");
    expect(firedId(base, [swap("01001", "01002")])).not.toBe("situation:weatherSwap");
  });

  test("situation:phoenixForce fires when Phoenix Force flips, from either face", () => {
    const flip = (from: string) =>
      ({
        type: "cardFlippedToOtherFace",
        instanceId: instanceId("pf"),
        from: cardId(from),
        to: cardId("34002b"),
        typeChanged: false,
      }) as unknown as GameEvent;
    expect(firedId(base, [flip("34002a")])).toBe("situation:phoenixForce");
    expect(firedId(base, [flip("34002b")])).toBe("situation:phoenixForce");
    expect(firedId(base, [flip("32031a")])).not.toBe("situation:phoenixForce");
  });
});

describe("on-the-table wave 6 tips", () => {
  const cases: readonly (readonly [string, string, string[]])[] = [
    ["situation:tacticUpgrades", "33006", []],
    ["situation:robertKelly", "32066", []],
    ["situation:wideawake", "32104", []],
    ["situation:mansionAttack", "32125a", []],
    ["situation:futurePast", "32172a", []],
    ["situation:roleUpgrade", "32181", []],
    ["situation:showDeck", "39060", []],
    ["situation:showDeck", "39015a", []],
    ["situation:wheelOfGenres", "39026a", []],
    ["situation:ratingsCounters", "39004a", []],
    ["situation:longshot", "39071", []],
  ];
  for (const [tipId, printedId] of cases) {
    test(`${tipId} fires with ${printedId} on the table, once`, () => {
      const game = withPrintedCard(base, printedId, { area: printedId === "39071" ? "player" : "villain" });
      expect(firedId(game)).toBe(tipId);
      expect(firedId(game, [], [tipId])).not.toBe(tipId);
    });
  }

  test("situation:touched needs Touched attached to a character, not set aside or loose", () => {
    const loose = withPrintedCard(base, "38002", { area: "player" });
    expect(firedId(loose)).not.toBe("situation:touched");
    const host = base.players.find((p) => p.playerId === me)!.identity.instanceId;
    const attached = withPrintedCard(base, "38002", { area: "player", patch: { attachedTo: host } });
    expect(firedId(attached)).toBe("situation:touched");
  });

  test("situation:threatOnCharacters fires for threat on a non-scheme card but not on a side scheme", () => {
    const onMinion = withPrintedCard(base, "39054", { patch: { threat: 2 } });
    expect(firedId(onMinion)).toBe("situation:threatOnCharacters");
    const onScheme = withPrintedCard(base, "39037", { patch: { threat: 2 }, cardType: "side_scheme" });
    expect(firedId(onScheme)).not.toBe("situation:threatOnCharacters");
  });
});

describe("every wave 6 tip body links only real glossary terms", () => {
  test("termTextModelOf resolves each [[id]] a wave 6 tip uses", () => {
    const fired: string[] = [];
    const attempts: readonly (readonly [GameState, readonly GameEvent[]])[] = [
      [withPrintedCard(base, "33006"), []],
      [withPrintedCard(base, "32066"), []],
      [withPrintedCard(base, "32104"), []],
      [withPrintedCard(base, "32125a"), []],
      [withPrintedCard(base, "32172a"), []],
      [withPrintedCard(base, "32181"), []],
      [withPrintedCard(base, "39060"), []],
      [withPrintedCard(base, "39026a"), []],
      [withPrintedCard(base, "39004a"), []],
      [withPrintedCard(base, "39071"), []],
      [withPrintedCard(base, "39054", { patch: { threat: 1 } }), []],
      [
        base,
        [
          {
            type: "keywordResolved",
            keyword: "teamwork",
            instanceId: instanceId("m"),
            playerId: me,
            trait: "X",
          } as never,
        ],
      ],
      [
        base,
        [
          {
            type: "additionalFormChanged",
            playerId: me,
            formType: "mass",
            formName: "Solid",
            instanceId: instanceId("f"),
          } as never,
        ],
      ],
      [base, [{ type: "counterAdded", instanceId: instanceId("c"), counterType: "power", amount: 1 } as never]],
      [
        base,
        [
          {
            type: "cardsSwapped",
            how: "leftAndEntered",
            outgoing: instanceId("a"),
            incoming: instanceId("b"),
            cardIds: [cardId("36002"), cardId("36003")],
          } as never,
        ],
      ],
      [
        base,
        [
          {
            type: "cardFlippedToOtherFace",
            instanceId: instanceId("p"),
            from: cardId("34002a"),
            to: cardId("34002b"),
            typeChanged: false,
          } as never,
        ],
      ],
    ];
    for (const [game, events] of attempts) {
      const tip = tipsFor(observe(game, events), POOL_DEPS, prefs)[0];
      expect(tip, "an attempt did not fire a tip").toBeDefined();
      fired.push(tip!.id);
      expect(termTextModelOf(tip!.body).unknownIds, tip!.id).toEqual([]);
    }
    expect(new Set(fired).size).toBe(fired.length);
  });
});
