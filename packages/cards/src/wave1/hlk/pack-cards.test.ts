import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, inst, moveToHand, payWith, play, use } from "../../testing/harness.js";
import { withDamage } from "../../testing/staging.js";
import { DEPS, engaged, scripted } from "../../wave9/bp/aspect-basic.testing.js";
import { bpHeroGame } from "../../wave9/bp/testing.js";

vi.setConfig({ testTimeout: 120_000 });

const EMPATHY = "51017";
const SHOCKER = "01103"; // minion: 3 hit points, not Elite
const BEAT_COP = "10029";

// FFG ruling Nov 21, 2025 (Alex): "If you use Beat Cop's first ability to move threat from Show of
// Empathy, then Show of Empathy's Forced Interrupt will trigger and change the destination of the threat token, and
// you'd place the token on a non-Elite minion instead." RRG 1.8 "Move" (p. 30) makes a move a removal from one
// placement and a placement on the other; Show of Empathy replaces where the removed threat goes ("instead"), so the
// moved token must not also land on Beat Cop. Fixed: a move's removal names its placement
// (`removeThreat.movePlacementFrameId`), and Show of Empathy's `placeThreat(..., { ofRemovedThreat: true })` takes the
// tokens out of it (`resolve/apply-effect.ts`).
describe("Beat Cop moving threat off Show of Empathy (FFG ruling Nov 21, 2025)", () => {
  it("the moved threat goes to a non-Elite minion instead; none lands on Beat Cop", () => {
    const hero = bpHeroGame();
    const M = "m-target" as InstanceId;
    const withMinion = withDamage(engaged(hero, SHOCKER, "m-target"), M, 0);
    const given = moveToHand(withMinion, P1, EMPATHY);
    const empathy = given.ids[0]!;
    const played = scripted(given.state, [play(P1, empathy, payWith(given.state, P1, 0, [empathy]), {})]).state;
    // Surgery: Beat Cop (10029) already in P1's play area, ready.
    const cop = "beat-cop" as InstanceId;
    const staged = {
      ...played,
      players: played.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, cop] } : p)),
      instances: {
        ...played.instances,
        [cop]: {
          instanceId: cop,
          cardId: BEAT_COP,
          ownerId: P1,
          controllerId: P1,
          home: { kind: "playArea", playerId: P1 },
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
    } as unknown as GameState;
    const before = inst(staged, empathy).threat;
    const r = scripted(staged, [use(P1, cop, "10029.beat-cop-action")], { deps: DEPS, target: [empathy, M] });
    expect(inst(r.state, empathy).threat).toBe(before - 1);
    expect(inst(r.state, M).threat).toBe(1);
    expect(inst(r.state, cop).threat).toBe(0);
  });
});
