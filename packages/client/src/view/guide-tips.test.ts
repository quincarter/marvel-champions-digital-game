/**
 * Guided mode's opportunistic tips (G10e part 1, `docs/guided-mode.md` §5.3), against a real Core Set game (Rhino,
 * solo Spider-Man) — the same fixture `guide-hints.test.ts` uses, patched per test the same way.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { cardId, encounterSetId, cycleId, setCode, unerrataedText, type MinionCard } from "@mc/content";
import {
  activeVillain,
  cardOf,
  getPlayer,
  instanceId,
  type GameEvent,
  type GameState,
  type PlayerId,
} from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { defaultGuidePrefs, type GuidePrefs } from "../guide/guide-prefs.js";
import type { LessonObservation } from "./lesson-model.js";
import { tipsFor } from "./guide-tips.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let store: SessionStore;
let base: GameState;
let me: PlayerId;

/** Plays past setup (into hero form), the same fixture `guide-hints.test.ts` uses. */
async function intoTurn(): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  base = store.state.game!;
  me = store.state.perspectiveId!;
}

beforeEach(intoTurn);

function observationOf(state: GameState, lastEvents: readonly GameEvent[] = []): LessonObservation {
  return { game: state, lastEvents, perspectiveId: me };
}

/**
 * Every situation ahead of `situation:villainStageAdvanced` (and later) in `SITUATION_TIPS`' own order — used to
 * mark all of them seen first when a test wants to isolate a later trigger, the same way a real player would have
 * already seen the earlier ones by then. `situation:acceleration` itself is no longer guaranteed true on `base`
 * (it now needs *extra* acceleration — a token or icon, not just the main scheme's own printed rate), but marking
 * it seen here is still harmless for tests that don't care about it either way.
 */
const SEEN_THROUGH_ACCELERATION: readonly string[] = [
  "situation:obligation",
  "situation:nemesisSet",
  "situation:mulligan",
  "situation:minionEngaged",
  "situation:sideScheme",
  "situation:crisis",
  "situation:acceleration",
];

/** A fabricated minion (own `cardPool` entry, mirroring `guide-hints.test.ts`'s own helper). */
function withMinionEngaged(
  state: GameState,
  playerId: PlayerId,
  opts: { readonly keywords?: readonly { readonly name: "guard" }[] } = {},
): GameState {
  const cid = cardId(`guide-tips-test-minion${opts.keywords ? "-guard" : ""}`);
  const minion: MinionCard = {
    id: cid,
    type: "minion",
    name: "Test Minion",
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "test",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("guide-tips-test")],
    boostIcons: 0,
    traits: [],
    keywords: opts.keywords ?? [],
    atk: 1,
    sch: 0,
    hp: 5,
    text: unerrataedText(""),
    abilities: [],
  };
  const id = instanceId(`minion-test-${playerId}`);
  return {
    ...state,
    cardPool: { ...state.cardPool, [cid]: minion },
    players: state.players.map((p) => (p.playerId === playerId ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: {
      ...state.instances,
      [id]: {
        instanceId: id,
        cardId: cid,
        ownerId: null,
        controllerId: playerId,
        home: { kind: "activeEncounterDeck" },
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
        engagedWith: playerId,
        flipped: false,
      },
    },
  };
}

/** A fabricated minion carrying a printed acceleration icon, engaged with `playerId` (own `cardPool` entry). */
function withAccelerationIcon(state: GameState, playerId: PlayerId): GameState {
  const cid = cardId("guide-tips-test-minion-acceleration");
  const minion: MinionCard = {
    id: cid,
    type: "minion",
    name: "Test Minion (acceleration)",
    setCode: setCode("core"),
    cycleId: cycleId("core"),
    collectorNumber: "test",
    quantityInSet: 1,
    unique: false,
    encounterSetIds: [encounterSetId("guide-tips-test")],
    boostIcons: 0,
    traits: [],
    keywords: [],
    schemeIcons: ["acceleration"],
    atk: 1,
    sch: 0,
    hp: 5,
    text: unerrataedText(""),
    abilities: [],
  };
  const id = instanceId(`minion-test-acceleration-${playerId}`);
  return {
    ...state,
    cardPool: { ...state.cardPool, [cid]: minion },
    villainArea: [...state.villainArea, id],
    instances: {
      ...state.instances,
      [id]: {
        instanceId: id,
        cardId: cid,
        ownerId: null,
        controllerId: null,
        home: { kind: "activeEncounterDeck" },
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
      },
    },
  };
}

/** Crowd Control (01108): a real Core side scheme with the crisis icon, dropped straight into the villain area. */
function withCrisisSideScheme(state: GameState): GameState {
  const id = instanceId("crisis-test");
  return {
    ...state,
    villainArea: [...state.villainArea, id],
    instances: {
      ...state.instances,
      [id]: {
        instanceId: id,
        cardId: cardId("01108"),
        ownerId: null,
        controllerId: null,
        home: { kind: "encounterDeck", deckId: activeVillain(state).encounterDeckId },
        faceup: true,
        exhausted: false,
        damage: 0,
        threat: 1,
        statuses: { stunned: 0, confused: 0, tough: 0 },
        counters: {},
        attachedTo: null,
        attachments: [],
        boostCards: [],
        tucked: [],
        facedownAs: null,
        engagedWith: null,
        flipped: false,
      },
    },
  };
}

describe("tipsFor: level gating", () => {
  test("off and hints levels never fire", () => {
    const state = withMinionEngaged(base, me);
    const observation = observationOf(state);
    expect(tipsFor(observation, POOL_DEPS, { ...defaultGuidePrefs, level: "off" })).toEqual([]);
    expect(tipsFor(observation, POOL_DEPS, { ...defaultGuidePrefs, level: "hints" })).toEqual([]);
  });

  test("full level fires", () => {
    const state = withMinionEngaged(base, me);
    const tips = tipsFor(observationOf(state), POOL_DEPS, defaultGuidePrefs);
    expect(tips).toHaveLength(1);
  });

  test("no perspective player: nothing fires", () => {
    const state = withMinionEngaged(base, me);
    const observation: LessonObservation = { game: state, lastEvents: [], perspectiveId: null };
    expect(tipsFor(observation, POOL_DEPS, defaultGuidePrefs)).toEqual([]);
  });
});

describe("situation:minionEngaged", () => {
  test("fires the first time a minion is engaged", () => {
    const state = withMinionEngaged(base, me);
    const tips = tipsFor(observationOf(state), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:minionEngaged");
  });

  test("does not fire with nothing engaged", () => {
    const tips = tipsFor(observationOf(base), POOL_DEPS, defaultGuidePrefs);
    expect(tips.find((t) => t.id === "situation:minionEngaged")).toBeUndefined();
  });

  test("a seen tip does not fire again", () => {
    const state = withMinionEngaged(base, me);
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: SEEN_THROUGH_ACCELERATION };
    expect(
      tipsFor(observationOf(state), POOL_DEPS, prefs).find((t) => t.id === "situation:minionEngaged"),
    ).toBeUndefined();
  });
});

describe("situation:sideScheme and situation:crisis", () => {
  test("a side scheme in play fires situation:sideScheme", () => {
    const state = withCrisisSideScheme(base);
    // Crowd Control also carries the crisis icon, so silence that higher-priority... no, sideScheme comes first.
    const tips = tipsFor(observationOf(state), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:sideScheme");
  });

  test("crisis fires once sideScheme is already seen", () => {
    const state = withCrisisSideScheme(base);
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: ["situation:sideScheme"] };
    const tips = tipsFor(observationOf(state), POOL_DEPS, prefs);
    expect(tips[0]?.id).toBe("situation:crisis");
  });

  test("no side scheme, no crisis: neither fires", () => {
    const tips = tipsFor(observationOf(base), POOL_DEPS, defaultGuidePrefs);
    expect(tips.find((t) => t.id === "situation:sideScheme" || t.id === "situation:crisis")).toBeUndefined();
  });
});

describe("situation:acceleration", () => {
  test("does not fire at game start (only the main scheme's own printed rate, no extra acceleration yet)", () => {
    const tips = tipsFor(observationOf(base), POOL_DEPS, defaultGuidePrefs);
    expect(tips.find((t) => t.id === "situation:acceleration")).toBeUndefined();
  });

  test("fires once an acceleration token is on the main scheme", () => {
    const withToken = { ...base, mainScheme: { ...base.mainScheme, accelerationTokens: 1 } };
    const tips = tipsFor(observationOf(withToken), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:acceleration");
  });

  test("fires once an acceleration icon is in play", () => {
    const state = withAccelerationIcon(base, me);
    const tips = tipsFor(observationOf(state), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:acceleration");
  });
});

describe("event-driven situations", () => {
  test("situation:obligation fires on drawnObligationPlaced for the perspective player", () => {
    const events: GameEvent[] = [{ type: "drawnObligationPlaced", playerId: me, instanceId: instanceId("ob-1") }];
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:obligation");
  });

  test("situation:obligation does not fire for another player's obligation", () => {
    const events: GameEvent[] = [
      {
        type: "drawnObligationPlaced",
        playerId: instanceId("someone-else") as unknown as PlayerId,
        instanceId: instanceId("ob-1"),
      },
    ];
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, defaultGuidePrefs);
    expect(tips.find((t) => t.id === "situation:obligation")).toBeUndefined();
  });

  test("situation:nemesisSet fires when a revealed card matches the identity's own nemesis set", () => {
    const identity = getPlayer(base, me)!.identity;
    const identityCard = cardOf(base, identity.instanceId);
    if (identityCard?.type !== "hero_identity") throw new Error("expected a hero identity");
    const cid = cardId("guide-tips-test-nemesis-card");
    const nemesisCard: MinionCard = {
      id: cid,
      type: "minion",
      name: "Nemesis Test Card",
      setCode: setCode("core"),
      cycleId: cycleId("core"),
      collectorNumber: "test",
      quantityInSet: 1,
      unique: false,
      encounterSetIds: [identityCard.nemesisEncounterSetId],
      boostIcons: 0,
      traits: [],
      keywords: [],
      atk: 1,
      sch: 0,
      hp: 1,
      text: unerrataedText(""),
      abilities: [],
    };
    const id = instanceId("nemesis-test-card-instance");
    const state: GameState = {
      ...base,
      cardPool: { ...base.cardPool, [cid]: nemesisCard },
      instances: {
        ...base.instances,
        [id]: {
          instanceId: id,
          cardId: cid,
          ownerId: null,
          controllerId: null,
          home: { kind: "activeEncounterDeck" },
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
        },
      },
    };
    const events: GameEvent[] = [{ type: "encounterCardRevealed", instanceId: id, cardId: cid, playerId: me }];
    const tips = tipsFor(observationOf(state, events), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:nemesisSet");
  });

  test("situation:mulligan fires on leaving the mulligan step having discarded a card", () => {
    const events: GameEvent[] = [
      { type: "cardDiscardedFromHand", playerId: me, instanceId: instanceId("mull-1") },
      {
        type: "stepChanged",
        from: { phase: "setup", kind: "mulligan", remainingPlayerIds: [] },
        to: { phase: "setup", kind: "playerSetupAbilities" },
      },
    ];
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:mulligan");
  });

  test("situation:mulligan does not fire when nothing was discarded (kept the whole hand)", () => {
    const events: GameEvent[] = [
      {
        type: "stepChanged",
        from: { phase: "setup", kind: "mulligan", remainingPlayerIds: [] },
        to: { phase: "setup", kind: "playerSetupAbilities" },
      },
    ];
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, defaultGuidePrefs);
    expect(tips.find((t) => t.id === "situation:mulligan")).toBeUndefined();
  });

  test("situation:boostFlip fires on boostCardFlipped", () => {
    const events: GameEvent[] = [
      {
        type: "boostCardFlipped",
        enemyInstanceId: activeVillain(base).instanceId,
        instanceId: instanceId("boost-1"),
        boostIcons: 1,
      },
    ];
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: SEEN_THROUGH_ACCELERATION };
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, prefs);
    expect(tips[0]?.id).toBe("situation:boostFlip");
  });

  test("situation:villainStageAdvanced fires on villainStageAdvanced", () => {
    const events: GameEvent[] = [
      { type: "villainStageAdvanced", stageIndex: 1, instanceId: activeVillain(base).instanceId },
    ];
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: SEEN_THROUGH_ACCELERATION };
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, prefs);
    expect(tips[0]?.id).toBe("situation:villainStageAdvanced");
  });

  test("situation:recover fires when the perspective player's own recover power resolved", () => {
    const heroId = getPlayer(base, me)!.identity.instanceId;
    const events: GameEvent[] = [
      {
        type: "triggerEvent",
        event: { kind: "basicPowerUsed", characterInstanceId: heroId, power: "recover", stat: "rec", playerId: me },
        phase: "resolved",
      },
    ];
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: SEEN_THROUGH_ACCELERATION };
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, prefs);
    expect(tips[0]?.id).toBe("situation:recover");
  });

  test("situation:recover does not fire for a different basic power", () => {
    const heroId = getPlayer(base, me)!.identity.instanceId;
    const events: GameEvent[] = [
      {
        type: "triggerEvent",
        event: { kind: "basicPowerUsed", characterInstanceId: heroId, power: "attack", stat: "atk", playerId: me },
        phase: "resolved",
      },
    ];
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: SEEN_THROUGH_ACCELERATION };
    expect(
      tipsFor(observationOf(base, events), POOL_DEPS, prefs).find((t) => t.id === "situation:recover"),
    ).toBeUndefined();
  });

  test("situation:drawOnAttack fires when the same command both attacked the identity and drew a card", () => {
    const heroId = getPlayer(base, me)!.identity.instanceId;
    const events: GameEvent[] = [
      {
        type: "attackResolved",
        enemyInstanceId: activeVillain(base).instanceId,
        targetInstanceId: heroId,
        baseAtk: 2,
        boostIcons: 0,
        defenseReduction: 0,
        damageDealt: 2,
      },
      { type: "cardDrawn", playerId: me, instanceId: instanceId("draw-1") },
    ];
    const prefs: GuidePrefs = {
      ...defaultGuidePrefs,
      seenTips: [...SEEN_THROUGH_ACCELERATION, "situation:handSizeDiffers"],
    };
    const tips = tipsFor(observationOf(base, events), POOL_DEPS, prefs);
    expect(tips[0]?.id).toBe("situation:drawOnAttack");
  });

  test("situation:drawOnAttack does not fire on an attack with no draw", () => {
    const heroId = getPlayer(base, me)!.identity.instanceId;
    const events: GameEvent[] = [
      {
        type: "attackResolved",
        enemyInstanceId: activeVillain(base).instanceId,
        targetInstanceId: heroId,
        baseAtk: 2,
        boostIcons: 0,
        defenseReduction: 0,
        damageDealt: 2,
      },
    ];
    const prefs: GuidePrefs = {
      ...defaultGuidePrefs,
      seenTips: [...SEEN_THROUGH_ACCELERATION, "situation:handSizeDiffers"],
    };
    expect(
      tipsFor(observationOf(base, events), POOL_DEPS, prefs).find((t) => t.id === "situation:drawOnAttack"),
    ).toBeUndefined();
  });
});

describe("situation:handSizeDiffers", () => {
  test("fires when the identity's two faces print different hand sizes (the Core default)", () => {
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: SEEN_THROUGH_ACCELERATION };
    const tips = tipsFor(observationOf(base), POOL_DEPS, prefs);
    expect(tips[0]?.id).toBe("situation:handSizeDiffers");
  });

  test("does not fire when both forms print the same hand size", () => {
    const identity = getPlayer(base, me)!.identity;
    const identityCard = cardOf(base, identity.instanceId);
    if (identityCard?.type !== "hero_identity") throw new Error("expected a hero identity");
    const patched = {
      ...identityCard,
      alterEgo: { ...identityCard.alterEgo, handSize: identityCard.hero.handSize },
    };
    const state = { ...base, cardPool: { ...base.cardPool, [identityCard.id]: patched } };
    const prefs: GuidePrefs = { ...defaultGuidePrefs, seenTips: SEEN_THROUGH_ACCELERATION };
    const tips = tipsFor(observationOf(state), POOL_DEPS, prefs);
    expect(tips.find((t) => t.id === "situation:handSizeDiffers")).toBeUndefined();
  });
});

describe("keyword and status tips (from the glossary)", () => {
  test("a printed keyword on the table fires a keyword: tip once every situation ahead of it is seen", () => {
    const state = withMinionEngaged(base, me, { keywords: [{ name: "guard" }] });
    const prefs: GuidePrefs = {
      ...defaultGuidePrefs,
      seenTips: [...SEEN_THROUGH_ACCELERATION, "situation:handSizeDiffers"],
    };
    const tips = tipsFor(observationOf(state), POOL_DEPS, prefs);
    expect(tips[0]?.id).toBe("keyword:guard");
    expect(tips[0]?.body).toContain("[[guard|Guard]]");
  });

  test("exhausted, ready and facedown boost card never fire (always present, excluded)", () => {
    const prefs: GuidePrefs = {
      ...defaultGuidePrefs,
      seenTips: [...SEEN_THROUGH_ACCELERATION, "situation:handSizeDiffers"],
    };
    const tips = tipsFor(observationOf(base), POOL_DEPS, prefs);
    for (const tip of tips) {
      expect(tip.id).not.toBe("keyword:exhausted");
      expect(tip.id).not.toBe("keyword:ready");
      expect(tip.id).not.toBe("keyword:facedownBoostCard");
    }
  });
});

describe("priority order and suppress", () => {
  test("an earlier-priority situation wins over a later one when both are true", () => {
    const withMinion = withMinionEngaged(base, me);
    const state = withCrisisSideScheme(withMinion);
    const tips = tipsFor(observationOf(state), POOL_DEPS, defaultGuidePrefs);
    expect(tips[0]?.id).toBe("situation:minionEngaged"); // ahead of sideScheme/crisis in SITUATION_TIPS order.
  });

  test("suppress skips a tip id for just this call, without marking it seen", () => {
    const state = withMinionEngaged(base, me);
    const tips = tipsFor(observationOf(state), POOL_DEPS, defaultGuidePrefs, ["situation:minionEngaged"]);
    expect(tips.find((t) => t.id === "situation:minionEngaged")).toBeUndefined();
  });

  test("at most one tip per observation", () => {
    const withMinion = withMinionEngaged(base, me);
    const state = withCrisisSideScheme(withMinion);
    const tips = tipsFor(observationOf(state), POOL_DEPS, defaultGuidePrefs);
    expect(tips.length).toBeLessThanOrEqual(1);
  });
});
