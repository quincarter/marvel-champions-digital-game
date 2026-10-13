/**
 * Wave 10 engine-rules QA, change 5 (commit 274c3ed6, owner answer 54B): a Find searches and shuffles a special deck (a
 * separate deck, a scenario deck) only when the deck could hold the card (`select.ts` `decksSearchedByFind`), proved on
 * the one older Find that runs inside games WITH special decks: Rogue's "Find Touched" (wave 6, `38001a.skin-contact`),
 * in a two-player game with Hercules (his Labor and Gift separate decks) in every older scenario that has a scenario
 * deck (Crossbones' Experimental Weapons, Red Skull's side-scheme deck, the Infinity Stones, Future Past, the show deck,
 * the Holding Cell).
 *
 * Sources:
 * - RRG 1.8 "Find" (p. 19): a Find looks in "each game area where that card could be found"; "Players should not
 *   unnecessarily search game areas if they know where the card they are looking for can be found".
 * - RRG 1.8 "Shuffle" (p. 40) and "Search" (p. 39): a deck that is searched is shuffled afterward, whether or not the card
 *   was found.
 * - owner answer 54B (docs/phase7-wave10.md §4.0): a special deck is searched, and shuffled, only when it could hold the
 *   card, which is Rogue's own card here (Touched, owned by Rogue, in her player deck).
 */
import { createGame, getPlayer, type GameState, type ZoneId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS } from "./playable/index.js";
import { firstLegal, identityOf, inst, instancesOf, P1, settle, use } from "./testing/harness.js";
import { MODULAR_SETS, PLAYABLE_SCENARIOS, buildPairing, pairingFor } from "./testing/modular-matrix.js";
import { withForm } from "./testing/staging.js";
import { driveWith } from "./testing/wave10-engine-qa-bench.js";

function rogueAndHercules(scenarioId: string): GameState {
  const scenario = PLAYABLE_SCENARIOS.find((s) => s.id === scenarioId)!;
  const set = MODULAR_SETS.find((s) => pairingFor(s.id, scenario).kind === "build")!;
  const built = buildPairing(set.id, scenario, {
    seed: 3,
    players: [{ starterDeckId: "rogue-protection" }, { starterDeckId: "hercules-leadership" }],
  });
  const created = createGame(built.config!, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return withForm(
    settle(created.state, firstLegal, (x) => x.step.phase === "player", PLAYABLE_DEPS),
    { heroForm: 0 },
    P1,
  );
}

describe("Rogue's Find Touched (38001a Skin Contact) with Hercules seated: only the decks that could hold Touched are shuffled (54B)", () => {
  for (const id of ["rhino", "crossbones", "red-skull", "thanos", "loki", "sabretooth", "spiral", "modok"]) {
    it(`${id}: Touched is found in Rogue's deck and attached; only Rogue's deck is shuffled`, () => {
      let state = rogueAndHercules(id);
      const touched = instancesOf(state, "38002")[0]!;
      // Touched starts set aside (an open area): put it on top of Rogue's deck so the Find has to search a deck.
      state = {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                setAside: p.setAside.filter((i) => i !== touched),
                deck: [touched, ...p.deck.filter((i) => i !== touched)],
              }
            : p,
        ),
      };
      expect(getPlayer(state, P1)!.deck[0]).toBe(touched);
      const villain = state.activeVillainId!;
      const done = driveWith(
        state,
        use(P1, identityOf(state), "38001a.skin-contact"),
        (s) => {
          const choice = s.pendingChoice!;
          return [(choice.options.find((o) => o.optionId === villain) ?? choice.options[0]!).optionId];
        },
        PLAYABLE_DEPS,
      );
      expect(done.accepted, done.refusal).toBe(true);
      expect(inst(done.state, touched).attachedTo).toBe(villain);
      const shuffled = done.events.flatMap((e) => (e.type === "deckShuffled" ? [e.zone as ZoneId] : []));
      expect(shuffled).toEqual([{ kind: "deck", playerId: P1 }]);
    });
  }
});
