/**
 * Permanent form upgrades against an encounter discard (docs/phase7-wave4.md §4 Q25, user decision 2026-09-26):
 * Spectrum's energy forms (Gamma, Photon, Pulsar, `mts` 21002–21004) and Vision's mass form (Intangible/Dense, `vision`
 * 26002) are Permanent — "Effects on cards not from this card's set cannot … remove this card from play" (RRG 1.8
 * "Permanent", p. 32) — so Caught Off Guard (Core 01188, "Discard an upgrade or support you control. If no cards were
 * discarded this way, this card gains surge.") cannot choose them, facedown or faceup, and surges instead. Found in a
 * browser campaign game where Caught Off Guard discarded Spectrum's facedown Gamma.
 */
import { cardsInPlay, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { endTurn, instancesOf, P1, stackEncounterDeck } from "../testing/harness.js";
import { driveEvents } from "../testing/staging.js";
import { WAVE4_DEPS } from "./index.js";
import { spectrumScenario } from "./mts/support.js";
import { startWave4Game } from "./testing.js";
import { visionScenario } from "./vision/support.js";

/** Reveal Caught Off Guard as P1's villain-phase encounter card: an Advance filler ahead for the villain's boost draw;
 * the surge draws whatever is next. */
function revealCaughtOffGuard(state: GameState) {
  const staged = stackEncounterDeck(state, "01186", "01188");
  const before = new Set(instancesOf(staged, "01188"));
  const { state: after, events } = driveEvents(WAVE4_DEPS, staged, endTurn(P1));
  const revealed = events.find(
    (e) =>
      e.type === "surgeTriggered" && instancesOf(staged, "01188").includes(e.instanceId) && before.has(e.instanceId),
  );
  return { after, surged: revealed !== undefined };
}

describe("Caught Off Guard against Permanent form upgrades (§4 Q25)", () => {
  it("Spectrum's three facedown energy forms stay in play, and Caught Off Guard surges", () => {
    const state = startWave4Game(spectrumScenario("rhino", { seed: 7 }));
    const forms = ["21002", "21003", "21004"].flatMap((code) => instancesOf(state, code));
    expect(forms).toHaveLength(3);
    for (const id of forms) expect(cardsInPlay(state)).toContain(id);

    const { after, surged } = revealCaughtOffGuard(state);
    for (const id of forms) expect(cardsInPlay(after)).toContain(id);
    expect(surged).toBe(true);
  });

  it("Vision's mass form stays in play, and Caught Off Guard surges", () => {
    const state = startWave4Game(visionScenario("rhino", { seed: 7 }));
    const [mass] = instancesOf(state, "26002");
    expect(cardsInPlay(state)).toContain(mass);

    const { after, surged } = revealCaughtOffGuard(state);
    expect(cardsInPlay(after)).toContain(mass);
    expect(surged).toBe(true);
  });
});
