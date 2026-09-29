/**
 * `BoardController`'s guided-mode interception (G9b, docs/guided-mode.md §4): `hintsFor` fires the "Hold on!"
 * overlay before End turn, Flip or a payment confirm actually goes out, and only when guided mode says to.
 *
 * A real Core Set game (Rhino, solo Spider-Man) drives every fixture, the same fixture `guide-hints.test.ts` and
 * `end-turn-confirm.test.ts` use — with `appSession().store` swapped for a stub over that game's own state
 * (`state` is a plain field here, not `SessionStore`'s private one) so the controller's `appSession()` reads land
 * on exactly the state each test wants, while `dispatch` stays spyable.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { legalActions, type Command, type GameState, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../../content/pool.js";
import { LocalEngineHost } from "../../engine/local-host.js";
import { SessionStore } from "../../store/session-store.js";
import type { SessionConfig } from "../../engine/host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, silenceWarning, withLevel, type GuidePrefs } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { schemePanel } from "../../view/board-model.js";
import type { Hint } from "../../view/guide-hints.js";
import type { BoardModel } from "../../view/board-model.js";
import type { Highlights } from "../../view/highlights.js";
import { BoardController, type BoardControllerHost } from "./controller.js";

// `appSession()` lazily builds a `WorkerEngineHost` on first use (`session.ts`), which needs a real `Worker` —
// unavailable under Vitest. Every test here swaps `appSession().store` for a stub right away and never touches
// `.host`, so a no-op stand-in is enough to get past that one construction call.
class NoopWorker {
  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}
(globalThis as unknown as { Worker: unknown }).Worker = NoopWorker;

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let realStore: SessionStore;
let base: GameState;
let me: PlayerId;

/** Plays past setup and flips to hero — the same fixture `guide-hints.test.ts` uses. */
async function intoTurn(): Promise<void> {
  realStore = new SessionStore(new LocalEngineHost());
  await realStore.start(RHINO_SOLO);
  for (let step = 0; step < 12 && realStore.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = realStore.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await realStore.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = realStore.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flipEntry = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flipEntry) await realStore.dispatch(flipEntry.example);
  }
  base = realStore.state.game!;
  me = realStore.state.perspectiveId!;
}

/** Patches the main scheme so it's one thwart away from its target, and next villain phase would add more than
 * enough threat to reach it — `schemeFinishHint`'s own trigger condition (`guide-hints.ts` §5.2). */
function withSchemeAboutToFinish(state: GameState): GameState {
  const id = state.mainScheme.instanceId;
  const panel = schemePanel(state, id, POOL_DEPS, true);
  const target = panel.target ?? 999;
  return {
    ...state,
    mainScheme: { ...state.mainScheme, accelerationTokens: state.mainScheme.accelerationTokens + 5 },
    instances: { ...state.instances, [id]: { ...state.instances[id]!, threat: Math.max(0, target - 1) } },
  };
}

/** A stub standing in for `SessionStore`: a mutable `state` field the tests patch directly, plus a spyable
 * `dispatch`. `BoardController` only ever reads `appSession().store.state` and calls `.dispatch(command)`. */
class StubStore {
  state: SessionStore["state"];
  readonly dispatch = vi.fn(async (_command: Command) => {});

  constructor(state: SessionStore["state"]) {
    this.state = state;
  }
}

/** Installs a stub over `appSession().store`, with `legal` re-derived for `game` (never reused from whatever
 * state it was last computed against) — a direct state patch like `withSchemeAboutToFinish` can change which
 * basics are legal (round 1's 0 threat makes Thwart illegal; a positive threat makes it legal again). */
function installStubStore(game: GameState, playerId: PlayerId): StubStore {
  const actions = legalActions(game, playerId, POOL_DEPS);
  const stub = new StubStore({ ...realStore.state, game, perspectiveId: playerId, legal: { playerId, actions } });
  (appSession() as unknown as { store: StubStore }).store = stub;
  return stub;
}

function stubHost(): BoardControllerHost & {
  readonly holdOn: ReturnType<typeof vi.fn<BoardControllerHost["holdOn"]>>;
  readonly confirmEndTurn: ReturnType<typeof vi.fn<BoardControllerHost["confirmEndTurn"]>>;
} {
  return {
    model: (): BoardModel | null => null,
    marks: (): Highlights | null => null,
    tabbed: (): boolean => false,
    redraw: (): void => {},
    inspect: (): void => {},
    confirmEndTurn: vi.fn((_sentence: string, onConfirm: () => void) => onConfirm()),
    holdOn: vi.fn(),
  };
}

function setPrefs(prefs: GuidePrefs): void {
  resetGuidePrefsCacheForTests();
  setGuidePrefs(prefs);
}

beforeEach(async () => {
  await intoTurn();
  appSession().settings = defaultSettings();
  setPrefs(defaultGuidePrefs);
});

describe("End turn's schemeFinish hint", () => {
  test("fires: Hold on! shows instead of dispatching, with a Thwart-first safe action", async () => {
    const stub = installStubStore(withSchemeAboutToFinish(base), me);
    const host = stubHost();
    const controller = new BoardController(host);

    await controller.dispatchExample("endTurn");

    expect(host.holdOn).toHaveBeenCalledTimes(1);
    const [hint] = host.holdOn.mock.calls[0] as [Hint, unknown];
    expect(hint.key).toBe("schemeFinish");
    expect(stub.dispatch).not.toHaveBeenCalled();
    expect(host.confirmEndTurn).not.toHaveBeenCalled();
  });

  test("doesn't fire: an ordinary scheme threat ends the turn as usual (into the existing confirm)", async () => {
    const stub = installStubStore(base, me);
    const host = stubHost();
    const controller = new BoardController(host);

    await controller.dispatchExample("endTurn");

    expect(host.holdOn).not.toHaveBeenCalled();
    // Settings ▸ "Confirm before ending turn" defaults on, and there's still a legal Attack/Thwart right after
    // the flip — so the existing confirm fires and (per the stub) immediately confirms.
    expect(host.confirmEndTurn).toHaveBeenCalledTimes(1);
    expect(stub.dispatch).toHaveBeenCalledTimes(1);
  });

  test("silenced: a silenced schemeFinish warning lets the turn end without the overlay", async () => {
    setPrefs(silenceWarning(defaultGuidePrefs, "schemeFinish"));
    const stub = installStubStore(withSchemeAboutToFinish(base), me);
    const host = stubHost();
    const controller = new BoardController(host);

    await controller.dispatchExample("endTurn");

    expect(host.holdOn).not.toHaveBeenCalled();
    expect(stub.dispatch).toHaveBeenCalledTimes(1);
  });

  test("guide level off: no hint at all, even with the scheme about to complete", async () => {
    setPrefs(withLevel(defaultGuidePrefs, "off"));
    const stub = installStubStore(withSchemeAboutToFinish(base), me);
    const host = stubHost();
    const controller = new BoardController(host);

    await controller.dispatchExample("endTurn");

    expect(host.holdOn).not.toHaveBeenCalled();
    expect(stub.dispatch).toHaveBeenCalledTimes(1);
  });

  test("the safe action (Thwart first) dispatches a thwart, not End turn", async () => {
    const stub = installStubStore(withSchemeAboutToFinish(base), me);
    const host = stubHost();
    const controller = new BoardController(host);

    await controller.dispatchExample("endTurn");
    const [hint, actions] = host.holdOn.mock.calls[0] as [Hint, { onSafe: () => void; onAnyway: () => void }];
    expect(hint.safeAction).not.toBeNull();
    actions.onSafe();

    expect(stub.dispatch).toHaveBeenCalledTimes(1);
    const command = stub.dispatch.mock.calls[0]?.[0] as Command;
    expect(command.type).toBe("basicThwart");
  });

  test('"end turn anyway" continues into the existing End-turn confirm — both show in sequence', async () => {
    const stub = installStubStore(withSchemeAboutToFinish(base), me);
    const host = stubHost();
    const controller = new BoardController(host);

    await controller.dispatchExample("endTurn");
    const [, actions] = host.holdOn.mock.calls[0] as [Hint, { onSafe: () => void; onAnyway: () => void }];
    actions.onAnyway();
    await Promise.resolve();

    expect(host.confirmEndTurn).toHaveBeenCalledTimes(1);
    expect(stub.dispatch).toHaveBeenCalledTimes(1);
    const command = stub.dispatch.mock.calls[0]?.[0] as Command;
    expect(command.type).toBe("endTurn");
  });

  test("dismissing the overlay (Escape/outside click) sends nothing — neither action ever runs", async () => {
    const stub = installStubStore(withSchemeAboutToFinish(base), me);
    const host = stubHost();
    const controller = new BoardController(host);

    await controller.dispatchExample("endTurn");
    // `scenes/hold-on.ts` never calls `onSafe`/`onAnyway` on Escape or an outside click (its own `#close(null)`)
    // — simulated here by simply not calling either captured callback.

    expect(stub.dispatch).not.toHaveBeenCalled();
    expect(host.confirmEndTurn).not.toHaveBeenCalled();
  });
});
