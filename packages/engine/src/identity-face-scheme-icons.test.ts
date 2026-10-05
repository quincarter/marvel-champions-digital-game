/**
 * docs/phase7-wave7.md §3.63: a scheme icon printed on one identity face (`HeroFace.schemeIcons` /
 * `AlterEgoFace.schemeIcons`). Synthetic identities shaped like Angel (`angel` 42001a/b/c): a three-sided card whose
 * second hero face prints an acceleration icon in its text box and whose other two faces print none.
 *
 * Sources, RRG 1.8:
 * - "Acceleration Icon" (p. 5): "During step one of the villain phase, place X additional threat on the main scheme,
 *   where X is the number of acceleration icons in play." Only the face that is up is in play, so the icon counts
 *   while that face shows and stops counting when the identity changes form.
 * - "Hazard Icon" (p. 21): "for each hazard icon on cards in play, deal one player one additional card (not one card
 *   per player)".
 * - "Text Box" (p. 44): "Icons printed within a card's text box are considered abilities within that text box." A
 *   blanked identity therefore shows no icon, as every other blanked card (`rules.ts` `iconsBlankedOn`).
 */

import type { HeroIdentityCard, SchemeIcon } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { PlayerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { iconsInPlay, iconsOn } from "./rules.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubIdentity, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_DECK, newGame } from "./testing/scenario.js";
import { P1, P2, playerCardIntoPlay } from "./testing/wave3.js";
import { auditVillainPhases } from "./villain/audit.js";

const base = stubIdentity({
  id: "winged",
  hp: 30,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});

/** `icon` on the second hero face only; the first hero face and the alter-ego print none. */
const secondFaceWith = (id: string, icon: SchemeIcon): HeroIdentityCard => ({
  ...stubIdentity({ id, hp: 30, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
  additionalHeroForms: [{ ...base.hero, faceName: `${id} (second hero face)`, schemeIcons: [icon] }],
});
const WINGED = secondFaceWith("winged", "acceleration");
/** A hazard icon on the alter-ego face only: the reader is the showing face's, whichever face and icon. */
const HUNTED: HeroIdentityCard = {
  ...stubIdentity({ id: "hunted", hp: 30, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
  alterEgo: { ...base.alterEgo, faceName: "hunted (alter-ego)", schemeIcons: ["hazard"] },
};

/** An upgrade: "Treat your identity's printed text box as if it were blank." */
const def = (definition: AbilityDefinition) => definition;
const MUZZLE_RULE = stubAbility(
  "muzzle.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "blankTextBox", target: { categories: ["identity"], controller: "you" } }],
    },
    effects: [],
  }),
);
const MUZZLE = stubUpgrade({ id: "muzzle", cost: 0, abilities: [MUZZLE_RULE.ref] });

const deps: EngineDeps = depsOf(MUZZLE_RULE);

const start = (identity: HeroIdentityCard, players = 1): GameState =>
  newGame({ identity, players, extraCards: [MUZZLE], deck: [...DEFAULT_DECK, MUZZLE.id], deps });

const toFace = (playerId: PlayerId, heroForm: number): Command => ({ type: "changeForm", playerId, to: { heroForm } });
const endTurn = (playerId: PlayerId): Command => ({ type: "endTurn", playerId });
const identityOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).identity.instanceId;

/**
 * Plays the commands and returns each villain phase's step-one threat and dealt encounter cards as the villain audit
 * reads them from the log, with the audit's own count agreeing (no violation) and the log replaying to the same state.
 */
function play(state: GameState, commands: readonly Command[]) {
  const { session } = driveSession(startSession(state), deps, commands);
  const audit = auditVillainPhases(session.log, deps);
  expect(audit.violations).toEqual([]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return {
    state: session.state,
    threat: audit.phases.map((phase) => phase.accelerationThreat),
    dealt: audit.phases.map((phase) => phase.dealt.length),
  };
}

describe("§3.63 a scheme icon on one identity face", () => {
  it("the icon-bearing hero face showing: step one places 1 more threat (acceleration 1 + 1 icon)", () => {
    const { state, threat } = play(start(WINGED), [toFace(P1, 1), endTurn(P1)]);
    expect(threat).toEqual([{ placed: 2, expected: 2 }]);
    expect(iconsOn(state, deps, identityOf(state), "acceleration")).toBe(1);
  });

  it("the other hero face showing: none", () => {
    const { state, threat } = play(start(WINGED), [toFace(P1, 0), endTurn(P1)]);
    expect(threat).toEqual([{ placed: 1, expected: 1 }]);
    expect(iconsInPlay(state, deps, "acceleration")).toBe(0);
  });

  it("the alter-ego showing: none", () => {
    const state = start(WINGED);
    expect(mustPlayer(state, P1).identity.form).toBe("alterEgo");
    expect(iconsInPlay(state, deps, "acceleration")).toBe(0);
    expect(play(state, [endTurn(P1)]).threat).toEqual([{ placed: 1, expected: 1 }]);
  });

  it("changing form changes the count at once, and the next villain phase's threat", () => {
    const up = play(start(WINGED), [toFace(P1, 1)]).state;
    expect(iconsInPlay(up, deps, "acceleration")).toBe(1);
    const other = play(up, [endTurn(P1), toFace(P1, 0)]).state;
    expect(iconsInPlay(other, deps, "acceleration")).toBe(0);
    const { threat } = play(start(WINGED), [toFace(P1, 1), endTurn(P1), toFace(P1, 0), endTurn(P1)]);
    expect(threat).toEqual([
      { placed: 2, expected: 2 },
      { placed: 1, expected: 1 },
    ]);
  });

  it("two players each showing such a face add two", () => {
    const { threat } = play(start(WINGED, 2), [toFace(P1, 1), endTurn(P1), toFace(P2, 1), endTurn(P2)]);
    expect(threat).toEqual([{ placed: 3, expected: 3 }]);
  });

  it("two players, one such face showing, add one", () => {
    const { threat } = play(start(WINGED, 2), [toFace(P1, 0), endTurn(P1), toFace(P2, 1), endTurn(P2)]);
    expect(threat).toEqual([{ placed: 2, expected: 2 }]);
  });

  it("a hazard icon on the alter-ego face deals one more encounter card, and none in hero form", () => {
    const hidden = play(start(HUNTED), [endTurn(P1)]);
    expect(hidden.dealt).toEqual([2]);
    expect(hidden.threat).toEqual([{ placed: 1, expected: 1 }]);
    const out = play(start(HUNTED), [toFace(P1, 0), endTurn(P1)]);
    expect(out.dealt).toEqual([1]);
  });

  it("a blanked identity shows no icon (RRG 1.8 'Text Box', p. 44: an icon in the text box is an ability)", () => {
    const up = play(start(WINGED), [toFace(P1, 1)]).state;
    const blanked = playerCardIntoPlay(up, MUZZLE.id).state;
    expect(iconsOn(blanked, deps, identityOf(blanked), "acceleration")).toBe(0);
    expect(iconsInPlay(blanked, deps, "acceleration")).toBe(0);
    expect(play(blanked, [endTurn(P1)]).threat).toEqual([{ placed: 1, expected: 1 }]);
  });
});
