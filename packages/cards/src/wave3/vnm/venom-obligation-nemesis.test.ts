import { activeEncounterDeck, threatCannotBeRemoved, type InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { stackSetAside } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { revealFromEncounterDeck, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { venomScenario } from "./support.js";

const venomVsRhino = (seed = 1) => startWave3Game(venomScenario("rhino", { seed }));

/** Picks the first offered option whose label starts with `prefix`. Mirrors `../gmw/groot-obligation-nemesis.test.ts`. */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** Like `pickingLabelStartingWith`, but a `chooseCards`/`chooseTarget` prompt picks up to its maximum rather than
 * declining to the minimum — for "put 1 set-aside copy into play" (optional to *offer*, min 0, but its own search
 * should actually find one when it can). Mirrors `../gam/gamora-kit.test.ts`'s `acceptingAndChoosingMax`. */
const pickingLabelAndChoosingMax =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseCards" || choice.prompt.kind === "chooseTarget") {
      return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
    }
    return pickingLabelStartingWith(prefix)(state);
  };

describe("Venom's obligation and nemesis (Struggle for Control, Klyntar Frenzy, Enraged Symbiote)", () => {
  it("Struggle for Control: exhaust Flash Thompson and take 2 damage, then discard this obligation (20023.obligation)", () => {
    const staged = stackEncounterDeck(venomVsRhino(), "01186", "20023");
    const identity = identityOf(staged);
    const before = inst(staged, identity).damage;
    const revealed = settle(
      runWave3(staged, endTurn()),
      pickingLabelStartingWith("Exhaust Flash Thompson"),
      undefined,
      WAVE3_DEPS,
    );
    const [struggle] = instancesOf(revealed, "20023");
    expect(activeEncounterDeck(revealed).discard).toContain(struggle); // discarded, not removed from the game
    expect(inst(revealed, identity).damage).toBe(before + 2);
    expect(inst(revealed, identity).exhausted).toBe(true);
  });

  it("Struggle for Control: puts a set-aside copy of Enraged Symbiote into play engaged with the first player, then discards this obligation (20023.obligation)", () => {
    const staged = stackEncounterDeck(venomVsRhino(), "01186", "20023");
    // The 4 printed Enraged Symbiote copies already sit in P1's own `setAside` from ordinary nemesis-set setup
    // (module docblock) — nothing needs staging beyond the obligation reveal itself.
    const beforeSetAside = playerOf(staged, P1).setAside.filter(
      (id) => staged.instances[id]?.cardId === ("20025" as never),
    ).length;
    expect(beforeSetAside).toBe(4);
    const revealed = settle(
      runWave3(staged, endTurn()),
      pickingLabelAndChoosingMax("Put 1 set-aside copy"),
      undefined,
      WAVE3_DEPS,
    );
    const [struggle] = instancesOf(revealed, "20023");
    expect(activeEncounterDeck(revealed).discard).toContain(struggle);
    const engaged = instancesOf(revealed, "20025").filter((id) => inst(revealed, id).engagedWith === P1);
    expect(engaged).toHaveLength(1);
    const afterSetAside = playerOf(revealed, P1).setAside.filter(
      (id) => revealed.instances[id]?.cardId === ("20025" as never),
    ).length;
    expect(afterSetAside).toBe(3);
  });

  it("Struggle for Control: gains surge and discards itself when no Enraged Symbiote copies are set aside (20023.obligation)", () => {
    const staged = stackEncounterDeck(venomVsRhino(), "01186", "20023");
    // Empty P1's own set-aside pool of every Enraged Symbiote first, so "If you cannot" is true.
    const symbiotes = playerOf(staged, P1).setAside.filter((id) => staged.instances[id]?.cardId === ("20025" as never));
    const emptied = {
      ...staged,
      players: staged.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((id) => !symbiotes.includes(id)) } : p,
      ),
    };
    const discardBefore = staged.encounterDecks[Object.keys(staged.encounterDecks)[0]!]!.discard.length;
    const revealed = settle(
      runWave3(emptied, endTurn()),
      pickingLabelStartingWith("Put 1 set-aside copy"),
      undefined,
      WAVE3_DEPS,
    );
    const [struggle] = instancesOf(revealed, "20023");
    expect(activeEncounterDeck(revealed).discard).toContain(struggle);
    // Surge draws and reveals a further encounter card, so the discard pile grows by more than the obligation's
    // own reveal + Rhino's own boost draw (docs/card-scripting-process.md's `stackSetAsideBehindBoost` lesson).
    const deckId = Object.keys(revealed.encounterDecks)[0]!;
    expect(revealed.encounterDecks[deckId]!.discard.length).toBeGreaterThan(discardBefore + 2);
  });

  it("Klyntar Frenzy: threat cannot be removed from it while a Symbiote enemy is in play (20024.klyntar-frenzy-constant)", () => {
    const start = venomVsRhino(2);
    const { state: revealed, id: klyntar } = revealFromEncounterDeck(start, "20024", firstLegal);
    expect(threatCannotBeRemoved(revealed, WAVE3_DEPS, klyntar)).toBe(false);
    // Put a Symbiote-trait enemy (Enraged Symbiote) into play via its own real boost ability.
    const staged = stackSetAside(revealed, "20025");
    const withSymbiote = settle(runWave3(staged, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    const [symbiote] = instancesOf(withSymbiote, "20025").filter((id) => inst(withSymbiote, id).engagedWith !== null);
    expect(symbiote).toBeDefined();
    expect(threatCannotBeRemoved(withSymbiote, WAVE3_DEPS, klyntar)).toBe(true);
  });

  it("Enraged Symbiote: [star] Boost puts it into play engaged with the player it boosts (20025.boost)", () => {
    const state = venomVsRhino(3);
    const staged = stackSetAside(state, "20025");
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    const after = settle(runWave3(staged, endTurn()), firstLegal, undefined, deps);
    expect(trace.resolved()).toContain("20025.boost");
    const [symbiote] = instancesOf(after, "20025").filter((id) => inst(after, id).engagedWith !== null) as [InstanceId];
    expect(symbiote).toBeDefined();
    expect(inst(after, symbiote).engagedWith).toBe(P1);
  });
});
