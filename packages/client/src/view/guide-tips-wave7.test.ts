/**
 * Wave 7 opportunistic tips (NeXt Evolution, `docs/guided-mode.md` section 3.14): each `situation:`
 * tip fires on its own trigger against the same Core Set fixture `guide-tips.test.ts` uses, with the pre-wave-7
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
  "situation:teamwork",
  "situation:massForm",
  "situation:counters",
  "situation:weatherSwap",
  "situation:phoenixForce",
  "situation:touched",
  "situation:threatOnCharacters",
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
  const id = instanceId(`wave7-tip-${printedId}`) as InstanceId;
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
    name: `Wave 7 fixture ${printedId}`,
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "test",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("wave7-tip-test")],
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

describe("wave 7 tips", () => {
  const onTable: readonly (readonly [string, string, string[]])[] = [
    ["situation:poolAspect", "44038", []],
    ["situation:specialists", "43035", []],
    ["situation:psiBlades", "41002a", []],
    ["situation:hopeSummers", "40130", []],
    ["situation:routed", "40081a", []],
    ["situation:setupAttachments", "40155", []],
  ];
  for (const [tipId, printedId] of onTable) {
    test(`${tipId} fires with ${printedId} on the table, once`, () => {
      const game = withPrintedCard(base, printedId);
      expect(firedId(game)).toBe(tipId);
      expect(firedId(game, [], [tipId])).not.toBe(tipId);
    });
  }

  test("situation:playerSideScheme fires for a player side scheme in the villain area only", () => {
    const scheme = withPrintedCard(base, "40006", { cardType: "player_side_scheme" });
    expect(firedId(scheme)).toBe("situation:playerSideScheme");
    expect(firedId(withPrintedCard(base, "40006", { cardType: "side_scheme" }))).not.toBe("situation:playerSideScheme");
  });

  test("situation:sideSchemeLimit fires on the limit discard", () => {
    const event = { type: "playerSideSchemeLimitDiscard", instanceId: instanceId("x"), chosenBy: me } as never;
    expect(firedId(base, [event])).toBe("situation:sideSchemeLimit");
  });

  test("situation:perPlayerCost fires for a per player card and not another", () => {
    const played = (id: string) =>
      ({ type: "cardPlayed", playerId: me, instanceId: instanceId("p"), cardId: cardId(id) }) as never;
    expect(firedId(base, [played("40053")])).toBe("situation:perPlayerCost");
    expect(firedId(base, [played("44046")])).toBe("situation:perPlayerCost");
    expect(firedId(base, [played("01001")])).not.toBe("situation:perPlayerCost");
  });

  test("situation:threeFaceIdentity needs a form change by an Angel identity", () => {
    const change = { type: "formChanged", playerId: me, to: "hero" } as never;
    expect(firedId(base, [change])).not.toBe("situation:threeFaceIdentity");
    const identityId = base.players.find((p) => p.playerId === me)!.identity.instanceId;
    const angel = {
      ...base,
      instances: { ...base.instances, [identityId]: { ...base.instances[identityId]!, cardId: cardId("42001a") } },
    } as GameState;
    expect(firedId(angel, [change])).toBe("situation:threeFaceIdentity");
  });

  test("every wave 7 tip body links only real glossary terms", () => {
    const attempts: readonly (readonly [GameState, readonly GameEvent[]])[] = [
      [withPrintedCard(base, "44038"), []],
      [withPrintedCard(base, "43035"), []],
      [withPrintedCard(base, "41002a"), []],
      [withPrintedCard(base, "40130"), []],
      [withPrintedCard(base, "40081a"), []],
      [withPrintedCard(base, "40155"), []],
      [withPrintedCard(base, "40006", { cardType: "player_side_scheme" }), []],
      [base, [{ type: "playerSideSchemeLimitDiscard", instanceId: instanceId("x"), chosenBy: me } as never]],
      [base, [{ type: "cardPlayed", playerId: me, instanceId: instanceId("p"), cardId: cardId("40053") } as never]],
    ];
    const fired: string[] = [];
    for (const [game, events] of attempts) {
      const tip = tipsFor(observe(game, events), POOL_DEPS, prefs)[0];
      expect(tip, "an attempt did not fire a tip").toBeDefined();
      fired.push(tip!.id);
      expect(termTextModelOf(tip!.body).unknownIds, tip!.id).toEqual([]);
    }
    expect(new Set(fired).size).toBe(fired.length);
  });
});
