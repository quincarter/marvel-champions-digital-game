/**
 * Spectrum's own energy forms and Vision's own mass form (docs/phase7-wave4.md §5, §3.1): the display gaps a real
 * game against these two exposed.
 *
 * Spectrum's own three energy form upgrades (`mts` 21002 Gamma, 21003 Photon, 21004 Pulsar) go into play facedown
 * and unattached at setup (21001b's own "Setup: Put all 3 energy form upgrades into play, facedown"), each with
 * `facedownAs: { kind: "blank", traits: [] }`. They are her own cards, placed knowing their faces, so the table shows
 * them faceup in a column of their own and marks the one she is in (issue #308). Vision's own mass form
 * upgrade (`vision` 26002/26002b) is a double-sided flip card (Intangible/Dense) attached to his identity; the
 * attachment chip used to read the printed front name even once Density Manipulation flipped it to the back.
 */
import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { getInstance } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel, characterPanel, faceOf } from "./board-model.js";

const SPECTRUM_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "spectrum-leadership" }],
  seed: 5,
};

const VISION_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "vision-protection" }],
  seed: 5,
};

/** Resolves setup's own choices (mulligan, etc.) so the pool's own Setup abilities — including "put into play
 * facedown" — have actually run. */
async function afterSetup(config: SessionConfig, maxSteps = 10): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let step = 0; step < maxSteps; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      continue;
    }
    break;
  }
  return store;
}

describe("Spectrum's own energy forms at setup", () => {
  let state: GameState;
  let viewer: PlayerId;

  beforeAll(async () => {
    const store = await afterSetup(SPECTRUM_SOLO);
    state = store.state.game!;
    viewer = store.state.perspectiveId!;
  });

  test("all three energy form upgrades sit facedown, unattached, in Spectrum's own play area, their faces open to her (#308)", () => {
    const player = state.players.find((seat) => seat.playerId === viewer)!;
    const forms = player.playArea.filter((id) => getInstance(state, id)?.facedownAs?.kind === "blank");
    expect(forms).toHaveLength(3);
    for (const id of forms) {
      expect(getInstance(state, id)?.faceup).toBe(false);
      // Her own cards, placed knowing their faces: the table draws them faceup (`faceVisible`'s `playArea` arm).
      expect(faceOf(state, id)).toEqual({ kind: "front" });
    }
  });

  test("they sit in an Energy forms column beside the play area, not in the play row, none active in alter-ego form (#308)", () => {
    const model = boardModel(state, viewer, POOL_DEPS);
    expect(model.formCards).toHaveLength(1);
    const [group] = model.formCards;
    expect(group!.title).toBe("Energy forms");
    expect(group!.cards.map((card) => card.name).sort()).toEqual(["Gamma", "Photon", "Pulsar"]);
    expect(group!.cards.every((card) => !card.active && card.art !== null)).toBe(true);
    const inRow = new Set(model.myPlayArea.map((panel) => panel.instanceId));
    for (const card of group!.cards) expect(inRow.has(card.instanceId)).toBe(false);
  });

  test("after Energy Transformation turns one faceup, that one is the active form (#308)", () => {
    const player = state.players.find((seat) => seat.playerId === viewer)!;
    const gamma = player.playArea.find((id) => getInstance(state, id)?.cardId === "21002")!;
    const hero: GameState = {
      ...state,
      instances: { ...state.instances, [gamma]: { ...getInstance(state, gamma)!, faceup: true, facedownAs: null } },
    };
    const cards = boardModel(hero, viewer, POOL_DEPS).formCards[0]!.cards;
    expect(cards.filter((card) => card.active).map((card) => card.name)).toEqual(["Gamma"]);
  });
});

describe("Vision's own mass form upgrade", () => {
  let state: GameState;
  let viewer: PlayerId;

  beforeAll(async () => {
    const store = await afterSetup(VISION_SOLO);
    state = store.state.game!;
    viewer = store.state.perspectiveId!;
  });

  test("attached to Vision, faceup, showing its printed front name (Intangible)", () => {
    const player = state.players.find((seat) => seat.playerId === viewer)!;
    const panel = characterPanel(state, player.identity.instanceId, POOL_DEPS);
    const massForm = panel.attachments.find((chip) => chip.name === "Intangible" || chip.name === "Dense");
    expect(massForm).toBeDefined();
    expect(massForm?.faceup).toBe(true);
    expect(massForm?.name).toBe("Intangible");
  });
});

describe("every hero's double-sided form card sits in the form column too (#308)", () => {
  const cases = [
    { deck: "vision-protection", title: "Mass form", name: "Intangible", other: "Dense" },
    { deck: "shadowcat-aggression", title: "Mass form", name: "Solid", other: "Phased" },
    { deck: "nick-fury-justice", title: "Suit form", name: "Assault", other: "Stealth" },
  ];
  for (const { deck, title, name, other } of cases) {
    test(`${deck}: ${name}, flipping to ${other}, beside the play area and out of the play row`, async () => {
      const store = await afterSetup({
        scenarioId: "rhino",
        difficulty: "standard",
        players: [{ starterDeckId: deck }],
        seed: 5,
      });
      const model = boardModel(store.state.game!, store.state.perspectiveId!, POOL_DEPS);
      expect(model.formCards.map((group) => group.title)).toEqual([title]);
      const [card] = model.formCards[0]!.cards;
      expect(card).toMatchObject({ name, otherFace: other, active: true });
      expect(model.myPlayArea.some((panel) => panel.instanceId === card!.instanceId)).toBe(false);
    });
  }
});
