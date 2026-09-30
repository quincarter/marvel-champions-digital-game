import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import type { GameState } from "@mc/engine";
import { instanceId as toInstanceId, playerId } from "@mc/engine";
import { instanceOfCode, resolveAnchor, type AnchorFrame } from "./guide-anchor.js";
import { boardLayout, REFERENCE_VIEWPORTS, type Rect } from "./layout.js";

const DESKTOP: Rect = { x: 0, y: 0, ...REFERENCE_VIEWPORTS.desktop };
const PHONE: Rect = { x: 0, y: 0, ...REFERENCE_VIEWPORTS.phone };

const EMPTY_FRAME: AnchorFrame = {
  cardRects: new Map(),
  focusRects: new Map(),
  instanceOfCode: () => null,
};

describe("resolveAnchor — zone", () => {
  it("resolves a known zone id straight from boardLayout on a non-tabbed layout", () => {
    const options = { playerCount: 1 };
    const resolved = resolveAnchor({ kind: "zone", id: "mainScheme" }, DESKTOP, options, EMPTY_FRAME);
    expect(resolved).toEqual({ rect: boardLayout(DESKTOP, options).zones.threat, tab: null });
  });

  it("is null for an unknown zone id", () => {
    expect(resolveAnchor({ kind: "zone", id: "nope" }, DESKTOP, { playerCount: 1 }, EMPTY_FRAME)).toBeNull();
  });

  it("is null for a zone this layout never shows at all (team, solo)", () => {
    expect(resolveAnchor({ kind: "zone", id: "team" }, DESKTOP, { playerCount: 1 }, EMPTY_FRAME)).toBeNull();
  });

  it("resolves straight away on phone when the named zone is the active tab", () => {
    const options = { playerCount: 1, activeTab: "threat" as const };
    const resolved = resolveAnchor({ kind: "zone", id: "mainScheme" }, PHONE, options, EMPTY_FRAME);
    expect(resolved?.tab).toBeNull();
    expect(resolved?.rect).toEqual(boardLayout(PHONE, options).zones.threat);
  });

  it("reports the tab that must switch on phone when the zone is behind a different tab", () => {
    const options = { playerCount: 1, activeTab: "me" as const };
    const resolved = resolveAnchor({ kind: "zone", id: "villain" }, PHONE, options, EMPTY_FRAME);
    expect(resolved?.tab).toBe("enemies");
    expect(resolved?.rect).toEqual(boardLayout(PHONE, { ...options, activeTab: "enemies" }).zones.enemies);
  });

  it("two ids can share a zone (mainScheme and sideSchemes both live in threat)", () => {
    const options = { playerCount: 1 };
    const a = resolveAnchor({ kind: "zone", id: "mainScheme" }, DESKTOP, options, EMPTY_FRAME);
    const b = resolveAnchor({ kind: "zone", id: "sideSchemes" }, DESKTOP, options, EMPTY_FRAME);
    expect(a).toEqual(b);
  });
});

describe("resolveAnchor — action", () => {
  const rect: Rect = { x: 10, y: 20, width: 30, height: 40 };
  const frame: AnchorFrame = { ...EMPTY_FRAME, focusRects: new Map([["basic:changeForm", rect]]) };

  it("resolves 'flip' from the action bar's own 'basic:changeForm' focus key", () => {
    expect(resolveAnchor({ kind: "action", id: "flip" }, DESKTOP, { playerCount: 1 }, frame)).toEqual({
      rect,
      tab: null,
    });
  });

  it("is null when the action bar hasn't registered that key this draw", () => {
    expect(resolveAnchor({ kind: "action", id: "thwart" }, DESKTOP, { playerCount: 1 }, frame)).toBeNull();
  });
});

describe("resolveAnchor — card", () => {
  const BLACK_CAT = cardId("01002");
  const cat = toInstanceId("i4");
  const rect: Rect = { x: 1, y: 2, width: 3, height: 4 };

  it("resolves through instanceOfCode, then the frame's card rects", () => {
    const frame: AnchorFrame = {
      ...EMPTY_FRAME,
      cardRects: new Map([[cat, rect]]),
      instanceOfCode: (code) => (code === BLACK_CAT ? cat : null),
    };
    expect(resolveAnchor({ kind: "card", code: BLACK_CAT }, DESKTOP, { playerCount: 1 }, frame)).toEqual({
      rect,
      tab: null,
    });
  });

  it("is null when the code isn't on the perspective player's hand/play right now", () => {
    expect(resolveAnchor({ kind: "card", code: BLACK_CAT }, DESKTOP, { playerCount: 1 }, EMPTY_FRAME)).toBeNull();
  });

  it("is null when the instance resolved but this draw never rendered it (off-tab)", () => {
    const frame: AnchorFrame = { ...EMPTY_FRAME, instanceOfCode: () => cat };
    expect(resolveAnchor({ kind: "card", code: BLACK_CAT }, DESKTOP, { playerCount: 1 }, frame)).toBeNull();
  });
});

describe("resolveAnchor — choice", () => {
  const rect: Rect = { x: 5, y: 6, width: 7, height: 8 };

  it("resolves from the caller's own choiceRects map", () => {
    const frame: AnchorFrame = { ...EMPTY_FRAME, choiceRects: new Map([["defend", rect]]) };
    expect(resolveAnchor({ kind: "choice", id: "defend" }, DESKTOP, { playerCount: 1 }, frame)).toEqual({
      rect,
      tab: null,
    });
  });

  it("is null with no choice open at all", () => {
    expect(resolveAnchor({ kind: "choice", id: "defend" }, DESKTOP, { playerCount: 1 }, EMPTY_FRAME)).toBeNull();
  });
});

describe("instanceOfCode", () => {
  const P1 = playerId("p1");
  const BLACK_CAT = cardId("01002");
  const ENERGY = cardId("01088");
  const cat = toInstanceId("i4");
  const energy = toInstanceId("i38");
  const identity = toInstanceId("i1");

  function fixtureState(hand: readonly (typeof cat)[], playArea: readonly (typeof cat)[]): GameState {
    return {
      players: [
        {
          playerId: P1,
          seatIndex: 0,
          identity: {} as never,
          hand,
          deck: [],
          discard: [],
          playArea,
          dealtEncounter: [],
          resolving: [],
          setAside: [],
          separateDecks: {},
          eliminated: false,
        },
      ],
      instances: {
        [cat]: { cardId: BLACK_CAT } as never,
        [energy]: { cardId: ENERGY } as never,
      },
    } as unknown as GameState;
  }

  it("finds a card in hand", () => {
    expect(instanceOfCode(fixtureState([cat, energy], []), P1, BLACK_CAT)).toBe(cat);
  });

  it("finds a card in play", () => {
    expect(instanceOfCode(fixtureState([energy], [cat]), P1, BLACK_CAT)).toBe(cat);
  });

  it("is null when the code is nowhere the player has it right now", () => {
    expect(instanceOfCode(fixtureState([energy], []), P1, BLACK_CAT)).toBeNull();
  });

  it("is null for an unknown player", () => {
    expect(instanceOfCode(fixtureState([cat], []), playerId("p2"), BLACK_CAT)).toBeNull();
  });

  it("never matches an identity instance not in hand/playArea (e.g. the hero card itself)", () => {
    const state = fixtureState([], []);
    const withIdentity: GameState = {
      ...state,
      instances: { ...state.instances, [identity]: { cardId: cardId("01001a") } as never },
    };
    expect(instanceOfCode(withIdentity, P1, cardId("01001a"))).toBeNull();
  });
});
