/**
 * Spectrum's own energy forms and Vision's own mass form (docs/phase7-wave4.md §5, §3.1): the display gaps a real
 * game against these two exposed.
 *
 * Spectrum's own three energy form upgrades (`mts` 21002 Gamma, 21003 Photon, 21004 Pulsar) go into play facedown
 * and unattached at setup (21001b's own "Setup: Put all 3 energy form upgrades into play, facedown"), each with
 * `facedownAs: { kind: "blank", traits: [] }` — deliberately no title while facedown (RRG: nothing reads a blank
 * card's name), but `displayName` used to render that as an empty string (`traits.join(" ")` on an empty array),
 * which reads as a display bug rather than the intentional "no title" the rules mean. Vision's own mass form
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
import { characterPanel, faceOf } from "./board-model.js";

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

  test("all three energy form upgrades sit facedown, unattached, in Spectrum's own play area", () => {
    const player = state.players.find((seat) => seat.playerId === viewer)!;
    const forms = player.playArea.filter((id) => getInstance(state, id)?.facedownAs?.kind === "blank");
    expect(forms).toHaveLength(3);
    for (const id of forms) {
      expect(getInstance(state, id)?.faceup).toBe(false);
      expect(faceOf(state, id)).toEqual({ kind: "back", back: "player" });
    }
  });

  test("a blank facedown card with no printed traits still shows something legible, not an empty name", () => {
    const player = state.players.find((seat) => seat.playerId === viewer)!;
    const forms = player.playArea.filter((id) => getInstance(state, id)?.facedownAs?.kind === "blank");
    for (const id of forms) {
      const panel = characterPanel(state, id, POOL_DEPS);
      expect(panel.name, id).toBe("Facedown card");
    }
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
