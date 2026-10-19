import { describe, expect, test } from "vitest";
import { playableScenarioOffer } from "@mc/cards";
import {
  CW_CARDS,
  CW_ENCOUNTER_SETS,
  CW_SCENARIOS,
  SYNTHEZOID_CARDS,
  SYNTHEZOID_SCENARIOS,
  type AnyCard,
} from "@mc/content";
import { POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import {
  cardsBySet,
  centeredCard,
  fanRects,
  fitCard,
  isLandscapeCard,
  orderedSetCards,
  rectsNearViewport,
  setFacesOf,
  setSheetOf,
} from "./civil-war-builder-art.js";
import { builderViewOf, openBuilderOn, setSheetFor, type BuilderContext } from "./civil-war-builder-model.js";
import { initialSetupDraft, setCivilWarBlind, setScenario } from "./setup-draft.js";

// Synthezoid Smackdown's two main scheme cards hold the fifth stage of each number a leader is offered
// (docs/phase7-synthezoid.md §3 M1).
const CARDS = new Map<string, AnyCard>([...CW_CARDS, ...SYNTHEZOID_CARDS].map((c) => [c.id as string, c]));
const CTX: BuilderContext = {
  cards: CARDS,
  scenarios: [...CW_SCENARIOS, ...SYNTHEZOID_SCENARIOS],
  encounterSets: [...POOL_ENCOUNTER_SETS, ...CW_ENCOUNTER_SETS],
};
const IRON = "registration-iron-man";
const draft = (id = IRON) => openBuilderOn(initialSetupDraft({ scenarioId: id, seatDeckId: "x", seed: 1 }), id).draft;
const view = (d = draft(), ctx: Partial<BuilderContext> = {}) => builderViewOf(d, { ...CTX, ...ctx })!;
const recommendedSets = () => playableScenarioOffer(IRON).modularSets!.filter((s) => s.recommended);

describe("card shapes", () => {
  test("main schemes and side schemes are landscape; leaders and the rest portrait", () => {
    const byType = (type: string) => CW_CARDS.find((c) => c.type === type);
    for (const type of ["main_scheme", "side_scheme"]) {
      expect(isLandscapeCard(byType(type)!)).toBe(true);
    }
    expect(isLandscapeCard(byType("villain")!)).toBe(false);
    for (const type of ["minion", "attachment", "treachery"]) {
      const card = byType(type);
      if (card) expect(isLandscapeCard(card)).toBe(false);
    }
  });

  test("fitCard keeps 5:7 and 7:5 inside the box", () => {
    expect(fitCard({ width: 100, height: 100 }, false)).toEqual({ width: 71, height: 100 });
    expect(fitCard({ width: 100, height: 100 }, true)).toEqual({ width: 100, height: 71 });
    expect(fitCard({ width: 40, height: 400 }, false)).toEqual({ width: 40, height: 56 });
  });

  test("centeredCard sits in the middle of its box", () => {
    const r = centeredCard({ x: 10, y: 10, width: 100, height: 100 }, true);
    expect(r).toEqual({ x: 10, y: 10 + Math.round((100 - r.height) / 2), width: 100, height: 71 });
  });
});

describe("which faces stand for a set", () => {
  const sets = cardsBySet(CARDS);
  const withMinions = [...sets.entries()].filter(([, cards]) => cards.some((c) => c.type === "minion"));

  test("a set with minions leads with a minion, and never offers a leader or main scheme", () => {
    expect(withMinions.length).toBeGreaterThan(0);
    for (const [, cards] of withMinions) {
      const faces = setFacesOf(cards);
      expect(faces.length).toBeGreaterThan(0);
      expect(faces.length).toBeLessThanOrEqual(3);
      expect(CARDS.get(faces[0]!.cardId)!.type).toBe("minion");
      for (const face of faces) expect(["villain", "main_scheme"]).not.toContain(CARDS.get(face.cardId)!.type);
    }
  });

  test("order: minion, side scheme, attachment, treachery, then name; unique first within a type", () => {
    const make = (id: string, name: string, type: string, unique: boolean, quantityInSet = 1): AnyCard =>
      ({ id, name, unique, type, quantityInSet }) as unknown as AnyCard;
    const side = make("s", "A side", "side_scheme", false);
    const attach = make("t", "Gear", "attachment", false, 2);
    const ordered = orderedSetCards([
      attach,
      side,
      make("b", "Beta", "minion", false),
      make("a", "Alpha", "minion", false),
      make("u", "Zed", "minion", true),
    ]);
    expect(ordered.map((c) => c.name)).toEqual(["Zed", "Alpha", "Beta", "A side", "Gear"]);
    const sheet = setSheetOf("x", "X set", [attach, side, make("a", "Alpha", "minion", false)]);
    expect(sheet.totalCards).toBe(4);
    expect(sheet.cards.map((c) => [c.face.name, c.copies, c.typeWord])).toEqual([
      ["Alpha", 1, "Minion"],
      ["A side", 1, "Side scheme"],
      ["Gear", 2, "Attachment"],
    ]);
  });

  test("a fan is overlapped from the left and stays inside its box", () => {
    const faces = setFacesOf(withMinions[0]![1]);
    const box = { x: 8, y: 18, width: 134, height: 64 };
    const rects = fanRects(box, faces);
    expect(rects).toHaveLength(faces.length);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(box.x);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width);
      expect(r.y).toBeGreaterThanOrEqual(box.y);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height);
    }
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.x).toBeGreaterThan(rects[i - 1]!.x);
  });

  test("rectsNearViewport picks only what is near the scrolled view", () => {
    const rects = Array.from({ length: 10 }, (_, i) => ({ x: 0, y: i * 100, width: 50, height: 90 }));
    expect(rectsNearViewport(rects, { top: 300, height: 200 }, 0)).toEqual([3, 4, 5]);
    expect(rectsNearViewport(rects, { top: 300, height: 200 }, 150)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("the builder view carries the pictures", () => {
  test("side step: both leaders of each side, with the card to fall back on", () => {
    const v = view();
    expect(v.sideChoices).toHaveLength(2);
    for (const side of v.sideChoices) {
      expect(side.leaders).toHaveLength(2);
      expect(side.leaders.map((l) => l.name)).toEqual(side.leaderNames);
      for (const leader of side.leaders) expect(CARDS.get(leader.cardId)?.type).toBe("villain");
    }
  });

  test("leader step: each stage is the leader's own stage card, a portrait face with a scan", () => {
    const v = view();
    for (const leader of v.leaderChoices) {
      expect(leader.stages).toHaveLength(2);
      for (const stage of leader.stages) {
        expect(stage.face).not.toBeNull();
        expect(stage.face!.landscape).toBe(false);
        expect(stage.face!.face.kind).toBe("villainStage");
        expect(artFor(CARDS.get(stage.face!.cardId), stage.face!.face)).not.toBeNull();
      }
    }
    // Expert plays stages III and IV: the faces follow.
    const stageIndexes = (x: ReturnType<typeof view>) =>
      x.leaderChoices[0]!.stages.map((s) => (s.face!.face as { stageIndex: number }).stageIndex);
    expect(stageIndexes(view({ ...draft(), difficulty: "expert" }))).not.toEqual(stageIndexes(view()));
  });

  test("main scheme step: every stage option is its own printed card, B side, with a scan", () => {
    const v = view();
    for (const row of v.stageRows) {
      expect(row.options.length).toBeGreaterThan(0);
      for (const option of row.options) {
        expect(option.face).not.toBeNull();
        expect(option.face!.face).toMatchObject({ kind: "mainSchemeStage", side: "B" });
        expect(option.face!.landscape).toBe(true);
        // Synthezoid Smackdown's main scheme scans are not in the data yet (docs/phase7-synthezoid.md §8.1 D8).
        if (!option.printedCardId.startsWith("57"))
          expect(artFor(CARDS.get(option.face!.cardId), option.face!.face)).not.toBeNull();
      }
      // Two options never share a face (a stage index is read on its own printed card).
      expect(new Set(row.options.map((o) => JSON.stringify([o.face!.cardId, o.face!.face]))).size).toBe(
        row.options.length,
      );
    }
  });

  test("modular tiles carry up to three faces; the sheet lists every distinct card of the set", () => {
    const tiles = view().modular.sections.flatMap((s) => s.tiles);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) expect(tile.faces.length).toBeLessThanOrEqual(3);
    const withCards = tiles.find((t) => t.faces.length > 0)!;
    const sheet = setSheetFor(CTX, withCards.id);
    expect(sheet.name).toBeTruthy();
    expect(sheet.cards.length).toBeGreaterThanOrEqual(withCards.faces.length);
    expect(sheet.cards[0]!.face.cardId).toBe(withCards.faces[0]!.cardId);
  });

  test("summary art: the leader, two stage faces and the chosen sets; none hidden by default", () => {
    const art = view().summaryArt;
    expect(art.leader.scenarioId).toBe(IRON);
    expect(art.stages).toHaveLength(2);
    for (const stage of art.stages) {
      expect(stage.hidden).toBe(false);
      expect(stage.face).not.toBeNull();
    }
    expect(art.setsHidden).toBe(false);
    expect(art.sets.map((s) => s.id)).toEqual(recommendedSets().map((s) => s.id));
    expect(art.setCount).toBe(4);
  });

  test("blind: stage 2 and the sets have no face and no name anywhere in the summary art", () => {
    const v = view(setCivilWarBlind(draft(), true));
    const art = v.summaryArt;
    expect(art.stages[0]!.hidden).toBe(false);
    expect(art.stages[1]).toMatchObject({ hidden: true, face: null, name: "Hidden" });
    expect(art.setsHidden).toBe(true);
    expect(art.sets).toEqual([]);
    expect(art.setCount).toBe(4);
    expect(v.stageRows[1]!.hidden).toBe(true);
    expect(v.stageRows[1]!.options).toEqual([]);
    expect(v.modular.sections).toEqual([]);
    const text = JSON.stringify(art);
    for (const set of recommendedSets()) expect(text).not.toContain(set.name);
    expect(JSON.stringify(art.stages[1])).not.toContain("Negative Zone");
  });

  test("changing leader changes the summary picture", () => {
    const other = setScenario(draft(), undefined, "registration-captain-marvel");
    expect(view(other).summaryArt.leader.scenarioId).toBe("registration-captain-marvel");
  });
});
