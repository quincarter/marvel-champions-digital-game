import type { Command, GameState, InstanceId } from "@mc/engine";
import { WONDER_MAN_CARDS } from "@mc/content";
import { sessionApply, startSession } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  use,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { WAVE6_DEPS } from "../wave6/index.js";
import { engageMinion } from "../wave6/mut_gen/project-wideawake-testing.js";
import { rogueGame } from "../wave6/rogue/rogue/support.js";

/**
 * Chunk 23 audit proofs. Order of authority: RRG 1.8 first (silent here), FFG rulings second.
 */
describe("chunk 23: Energy Transfer (#7, Rogue hero pack) with Touched already on the only target", () => {
  const rogueId = (s: GameState): InstanceId => identityOf(s, P1);

  // FFG ruling 182 (post-RRG 1.5), May 10, 2024, Alex: "Rogue's Energy Transfer, can this target the character that
  // Touched is already attached to? ... No. Energy Transfer's ability cost requires Rogue to attach Touched to a
  // character, and an upgrade can't attach to a character it's already attached to."
  // RRG 1.8 p. 68-69 (erratum: "Find Touched and attach it to a character other than Rogue ...") does not reverse it.
  // Engine: `canAttachTo` (engine/src/resolve/attach.ts) lets "a card already on that host pass", so the cost accepts it.
  it("Energy Transfer cannot name the character Touched is already attached to", () => {
    const base = withForm(rogueGame("rhino", { seed: 1 }), { heroForm: 0 });
    const minion = engageMinion(base, "01101", P1);
    // Skin Contact puts Touched on the minion.
    let session = startSession(minion.state);
    const first = sessionApply(session, use(P1, rogueId(minion.state), "38001a.skin-contact"), WAVE6_DEPS);
    if (!first.ok) throw new Error(first.error.message);
    session = first.session;
    for (let g = 0; session.state.pendingChoice && g < 20; g++) {
      const c = session.state.pendingChoice;
      const hit = c.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === minion.id);
      const next = sessionApply(
        session,
        {
          type: "resolveChoice",
          playerId: c.playerId,
          choiceId: c.choiceId,
          selectedOptionIds: hit ? [hit.optionId] : firstLegal(session.state),
        },
        WAVE6_DEPS,
      );
      if (!next.ok) throw new Error(next.error.message);
      session = next.session;
    }
    const touched = instancesOf(session.state, "38002")[0]!;
    expect(session.state.instances[touched]!.attachedTo).toBe(minion.id); // setup check: it is on the minion
    const given = moveToHand(session.state, P1, "38007");
    const [id] = given.ids as [InstanceId];
    // Rogue is the only other character besides the minion, the villain and the minion: name the minion again.
    const cmd: Command = play(P1, id, payWith(given.state, P1, 2, [id]), { costChoices: { host: [minion.id] } });
    const attempt = sessionApply(startSession(patchInstance(given.state, rogueId(given.state), {})), cmd, WAVE6_DEPS);
    expect(attempt.ok).toBe(false);
  });
});

describe("chunk 23: Ionic Physiology (#2, Wonder Man hero pack) card data", () => {
  // RRG 1.8 Appendix V p. 70 (Wonder Man Hero Pack): "Should read: 'Response: After you play an event with a printed
  // [energy] resource, tuck that event from your discard pile under this card. Then, heal 1 damage from your identity.'
  // (Changed cost arrow to 'Then'.)" The pack is data-only (no ability scripts), but its `text.current` and `errata`
  // block still carry the pre-erratum cost arrow, unlike every other RRG 1.8 erratum in the pool.
  it("text.current carries the RRG 1.8 'Then, heal 1 damage' wording", () => {
    const card = WONDER_MAN_CARDS.find((c) => c.name === "Ionic Physiology")!;
    expect("text" in card ? card.text.current : "").toContain(
      "under this card. Then, heal 1 damage from your identity.",
    );
  });
});
