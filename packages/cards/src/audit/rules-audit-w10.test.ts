import { cardId } from "@mc/content";
import { type GameState, type InstanceId, activeEncounterDeck } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, endTurn, firstLegal, identityOf, inst, patchInstance, playerOf, type Picker } from "../testing/harness.js";
import { driveEventsPicking } from "../testing/staging.js";
import { WAVE10_DEPS, stagedInPlay, tigraHeroGame } from "../wave10/testing.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Delta audit of the wave 10 content (the rules audit): proofs only for the clauses the
 * original audit marked N/A because the Civil War, Wonder Man and Hercules cards were not yet in the pool.
 * Order of authority: RRG 1.8 first, then current errata, then FFG rulings (older rulings only where consistent with
 * v1.8). Community answers are not a rules source.
 */

const UNDERWORLD = "56025";
const JIGSAW = "56028";
const SERUM = "56145"; // Super-Soldier Serum: "When he attacks, that attack gains overkill" (+2 ATK), here a source of overkill
const MOON_KNIGHT = "56002"; // ally, 3 hit points
const ADVANCE = "01186";

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const piles = (s: GameState) => activeEncounterDeck(s);
const fromSetAside = (state: GameState, code: string) => {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
    },
  };
};

describe("Jigsaw (56028) with overkill: FFG ruling January 11, 2026 - Ruling 2 (3)", () => {
  // January 11, 2026 - Ruling 2 (3): "Yes, if Jigsaw attacks with overkill and damages both an ally and an identity,
  // his Forced Response triggers twice and places 4 total threat." Jigsaw's text: "After Jigsaw attacks and damages a
  // character, place 2 threat on the Criminal Underworld side scheme." RRG 1.8 "Overkill" p. 31 (excess damage is
  // damage from the attack) and p. 44 (one occurrence with several triggering conditions: one response window, "used
  // in any order"). Same root cause as bug-list `overkill-damaged-characters`: `56028.jigsaw-forced-response` is
  // `after.enemyAttacks("self", { damages: true })`, which fires once per attack.
  function board() {
    let s = tigraHeroGame();
    // The Serum comes off the top of the encounter deck and onto Jigsaw (surgery), then every other top card is Advance.
    const [serum] = piles(s).deck;
    const deckId = Object.keys(s.encounterDecks)[0]!;
    s = { ...s, encounterDecks: { ...s.encounterDecks, [deckId]: { ...piles(s), deck: piles(s).deck.slice(1) } } };
    s = piles(s)
      .deck.slice(0, 14)
      .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), s);
    const scheme = fromSetAside(s, UNDERWORLD);
    s = {
      ...scheme.state,
      villainArea: [...scheme.state.villainArea, scheme.id],
      instances: {
        ...scheme.state.instances,
        [scheme.id]: { ...scheme.state.instances[scheme.id]!, faceup: true, threat: 4 },
      },
    };
    const jig = fromSetAside(s, JIGSAW);
    s = {
      ...jig.state,
      players: jig.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, jig.id] } : p)),
    };
    s = patchInstance(s, jig.id, { faceup: true, controllerId: null, engagedWith: P1 });
    s = patchInstance(s, serum!, { cardId: cardId(SERUM), faceup: true, attachedTo: jig.id });
    s = patchInstance(s, jig.id, { attachments: [serum!] });
    const ally = stagedInPlay(s, MOON_KNIGHT);
    s = patchInstance(ally.state, s.activeVillainId!, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    return { s, scheme: scheme.id, jig: jig.id, ally: ally.id };
  }
  const defendWith =
    (ally: InstanceId): Picker =>
    (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") return [ally];
      if (c.prompt.kind === "orderEnemies") return c.options.map((o) => o.optionId);
      return firstLegal(s);
    };

  it("places 2 threat for the ally it damages and 2 for the identity the overkill damages: 4 in all", () => {
    const t = board();
    const run = driveEventsPicking(WAVE10_DEPS, t.s, defendWith(t.ally), endTurn(P1));
    expect(playerOf(run.state, P1).discard).toContain(t.ally);
    // Staging check: the ally (3 hit points) is defeated by Jigsaw's 4 ATK and the 1 excess reaches Tigra.
    expect(inst(run.state, identityOf(run.state)).damage).toBe(1);
    expect(inst(run.state, t.scheme).threat).toBe(8);
  });
});
