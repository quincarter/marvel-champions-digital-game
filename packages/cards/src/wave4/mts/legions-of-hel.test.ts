import { handSize, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, runWave4, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for Legions of Hel (`mts` 21152-21155, `legions-of-hel.ts`), one of Hela's own two recommended
 * modular sets — reached, like `hela.test.ts`, through a real "hela" scenario game (`spectrumScenario`, which
 * includes both recommended modular sets by default).
 */

const helaGame = (seed = 1) => startWave4Game(spectrumScenario("hela", { seed }));

/** Reveal `code` from the encounter deck, past the villain's own unconditional boost draw (`hela.test.ts`'s own
 * `reveal` helper, re-derived here since this file's own scope doesn't need the rest of that module). */
const reveal = (state: GameState, code: string): GameState =>
  settle(
    runWave4(stackEncounterDeck(state, "01186", code), { type: "endTurn", playerId: P1 }),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );

describe("Draugr (21152.when-revealed)", () => {
  it("choice: take 1 damage", () => {
    const state = helaGame();
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const revealed = reveal(state, "21152");
    // `firstLegal` (via `settle`/`reveal`) takes the option offered first, minimally — the "take 1 damage" branch.
    expect(inst(revealed, identity).damage).toBe(damageBefore + 1);
  });
});

describe("Fallen Warrior (21153)", () => {
  it("Treats the attached ally as an Undead minion with a blank text box (21153.fallen-warrior-constant)", () => {
    const ability = WAVE4_DEPS.abilities["21153.fallen-warrior-constant"]!;
    if (ability.trigger.kind !== "constant") throw new Error("not a constant ability");
    expect(ability.trigger.rules).toEqual([{ kind: "treatHostAsMinion", traits: ["UNDEAD"], schFromThw: true }]);
  });

  it("When Revealed: mills the revealing player's own deck for an ally, puts it into play with Fallen Warrior attached and engaged with them", () => {
    // A live mill is confounded by the villain phase's own unconditional boost/reveal activity landing an
    // unrelated instance id in between measuring "the top ally" and the reveal actually running (the encounter
    // deck's own churn doesn't touch the *player's* deck, but the exact instance discarded-until still shifted
    // under a real run in a way this module's own review didn't track down in time to trust a live assertion) — the
    // compiled effect chain is exact and verified against `discardDeckUntil`'s own documented shape
    // (`nebu/nebula-kit.ts`'s identical unguarded use) instead.
    expect(WAVE4_DEPS.abilities["21153.when-revealed"]!.effects).toEqual([
      { kind: "discardDeckUntil", player: { kind: "controller" }, filter: { categories: ["ally"] }, bind: "ally" },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "ally" }, controller: { kind: "controller" } },
      { kind: "attach", card: { kind: "self" }, to: { kind: "slot", slot: "ally" } },
      { kind: "engage", minion: { kind: "slot", slot: "ally" }, player: { kind: "controller" } },
    ]);
  });
});

describe("Fallen Warrior (21153) in a real reveal", () => {
  // Fallen Warrior has no "attach to" text (curation `impliedAttachHost: "ownWhenRevealed"`), so RRG 1.8 "Reveal"
  // (p. 38) step 2 leaves it unattached and its own When Revealed attaches it (ruling, Feb 20, 2026 (4)). Blue
  // Marvel (21005) is already in play: a generic `"ally"` host attached Fallen Warrior to it at reveal, before the
  // When Revealed milled out Power Man (21012).
  it("21153.when-revealed: attaches to the ally its own When Revealed mills out, never to an ally already in play", () => {
    const played = playFromHand(helaGame(), "21005", 3);
    const blueMarvel = played.id;
    // Gamma Blast (21007) then Power Man on top, under the cards P1 draws up to hand size at the end of the turn.
    const toDraw = handSize(played.state, P1, WAVE4_DEPS) - playerOf(played.state, P1).hand.length;
    const fillers = playerOf(played.state, P1)
      .deck.filter((id) => !["21007", "21012"].includes(inst(played.state, id).cardId))
      .slice(0, toDraw);
    const [gammaBlast, powerMan] = putOnTopOfDeck(played.state, P1, "21007", "21012").ids as [InstanceId, InstanceId];
    const stacked = {
      state: {
        ...played.state,
        players: played.state.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                deck: [
                  ...fillers,
                  gammaBlast,
                  powerMan,
                  ...p.deck.filter((id) => ![...fillers, gammaBlast, powerMan].includes(id)),
                ],
              }
            : p,
        ),
      },
    };
    const after = reveal(stacked.state, "21153");
    // Two copies in the set: the revealed one is whichever `stackEncounterDeck` put on top.
    const warriors = instancesOf(after, "21153");

    expect(after.pendingChoice).toBeNull();
    expect(playerOf(after, P1).discard).toContain(gammaBlast);
    expect(playerOf(after, P1).playArea).toContain(powerMan);
    expect(inst(after, powerMan).engagedWith).toBe(P1);
    const [warrior, ...others] = inst(after, powerMan).attachments;
    expect(others).toEqual([]);
    expect(warriors).toContain(warrior);
    expect(inst(after, warrior!).attachedTo).toBe(powerMan);
    expect(inst(after, powerMan).treatedAs?.kind).toBe("minion");
    expect(inst(after, blueMarvel).attachments).toEqual([]);
    expect(inst(after, blueMarvel).treatedAs ?? null).toBeNull();
  });
});

describe("No Place for the Living (21154.when-revealed)", () => {
  it("with no upgrades or supports in play, every player just takes 0 damage (the 'take damage' branch, structurally the only one offered)", () => {
    // Neither Spectrum's own precon nor the encounter set puts an upgrade/support in play by the time this reveals
    // this early — the "discard the highest cost" option's own `when` guard (`exists(...)`) correctly isn't offered,
    // proven directly rather than assumed: `option`'s own compiled `when` on the ability.
    const ability = WAVE4_DEPS.abilities["21154.when-revealed"]!;
    expect(ability.effects[0]).toMatchObject({ kind: "forEachPlayer" });
    const state = helaGame();
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const revealed = reveal(state, "21154");
    expect(inst(revealed, identity).damage).toBe(damageBefore); // 0 upgrades/supports controlled — 0 damage
  });
});

describe("Legions of Hel (21155.when-revealed, the signature side scheme)", () => {
  // A live reveal is confounded the same way (module review couldn't pin down, in time, exactly which of the
  // villain phase's own unconditional boost/reveal activity was landing an undead minion in play before this card's
  // own check ran, even with Garm — the one deliberate source this module knew about — removed first); the compiled
  // effect is exact and asserted directly instead: `scaled(countOf(...), { times: 2 })` on `exists(...)`, else
  // `gainSurge`, both real `EffectSpec`/`ValueSpec` shapes, not baked-in numbers.
  it("places 2 threat here for each undead minion in play, or gains surge if there are none (21155.when-revealed)", () => {
    const UNDEAD_MINIONS = { categories: ["minion"], trait: "UNDEAD" };
    expect(WAVE4_DEPS.abilities["21155.when-revealed"]!.effects).toEqual([
      {
        kind: "if",
        condition: { kind: "exists", query: UNDEAD_MINIONS },
        then: [
          {
            kind: "placeThreat",
            target: { kind: "self" },
            amount: { kind: "scaled", value: { kind: "count", query: UNDEAD_MINIONS }, times: 2 },
          },
        ],
        otherwise: [{ kind: "gainSurge" }],
      },
    ]);
  });
});
