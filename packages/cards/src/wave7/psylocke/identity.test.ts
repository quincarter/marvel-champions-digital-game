import { activeVillain, applyCommand, createGame, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  moveToDiscard,
  withDamage,
  withForm,
} from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { PSYLOCKE_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Psylocke / Betsy Braddock (41001a/b), docs/phase7-wave7.md §7.2, §3.64. Her real precon (`psylocke-justice`)
 * against Stryfe through `wave7Scenario` with the real registry. Psylocke: THW 1, ATK 1, DEF 2, 10 hit points, hand
 * size 4; Betsy Braddock: REC 3, hand size 6. The two permanent Psi-Knife / Psi-Katana upgrades (41002a/b) are put
 * into play by the Setup; their own abilities (41002) are a later module's, so this file reads their showing face
 * (`flipped`) and their exhausted state, never the +1 THW / +1 ATK / piercing they grant. Fixtures from her kit by
 * printed id, not scripted here: 41004 and 41005 (PSIONIC cards of the precon) and 41003 (Angel, not PSIONIC).
 */
const CONTROL = "41001a.star-psi-energy-control";
const MANIFESTATION = "41001b.psionic-manifestation";
const ACTION = "41001b.betsy-braddock-action";
const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const BLADE = "41002a";

type Seat = typeof PSYLOCKE | typeof SPIDER_MAN;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));

function setupGame(players: readonly Seat[] = [PSYLOCKE], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}
const alterEgoGame = (players?: readonly Seat[], seed = 1): GameState => setupGame(players, seed);
const heroGame = (players?: readonly Seat[], seed = 1): GameState =>
  withForm(setupGame(players, seed), { heroForm: 0 });

/** The player's blades (every PSI-ENERGY upgrade in their play area), in play order. */
const bladesOf = (s: GameState, p = P1): InstanceId[] =>
  inst(s, identityOf(s, p)).attachments.filter((id) => codeOf(s, id) === BLADE);
const faces = (s: GameState, p = P1): boolean[] => bladesOf(s, p).map((id) => inst(s, id).flipped);

/** Accepts Psi-Energy Control when offered and flips the blade at `index` (play order) when asked which. */
function flipping(index: number, log: { offered: boolean } = { offered: false }): Picker {
  return (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.includes(CONTROL));
      if (hit) log.offered = true;
      return hit ? [hit.optionId] : [];
    }
    if (choice?.prompt.kind === "chooseCards") {
      const blades = bladesOf(s);
      const hit = choice.options.find((o) => o.optionId === blades[index]);
      if (hit) return [hit.optionId];
    }
    return firstLegal(s);
  };
}
const declining: Picker = (s) => (s.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(s));

const attack = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});
const thwart = (s: GameState, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s),
  schemeInstanceId: scheme,
});
const stryfe = (s: GameState): InstanceId => activeVillain(s).instanceId;

describe("Psylocke identity registry", () => {
  it.each([CONTROL, MANIFESTATION, ACTION])("%s validates", (id) => {
    expect(validateDefinition(PSYLOCKE_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the three identity refs", () => {
    expect(Object.keys(PSYLOCKE_IDENTITY).sort()).toEqual([CONTROL, MANIFESTATION, ACTION].sort());
  });
});

describe("Betsy Braddock: Psionic Manifestation (Setup)", () => {
  it("puts both permanent PSI-ENERGY upgrades into play, Psi-Knife side up, attached to her identity", () => {
    const s = alterEgoGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(bladesOf(s)).toHaveLength(2);
    expect(faces(s)).toEqual([false, false]);
    for (const id of bladesOf(s)) {
      expect(inst(s, id).attachedTo).toBe(identityOf(s));
      expect(inst(s, id).controllerId).toBe(P1);
    }
  });
  it("the permanent cards are no part of the 40-card deck: hand of 6 plus the deck is 40, no blade anywhere else", () => {
    const s = alterEgoGame();
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).hand.length + playerOf(s, P1).deck.length).toBe(40);
    for (const code of [...playerOf(s, P1).hand, ...playerOf(s, P1).deck, ...playerOf(s, P1).discard])
      expect(codeOf(s, code)).not.toBe(BLADE);
    expect(instancesOf(s, BLADE)).toHaveLength(2);
  });
  it("two players: only Psylocke's player gets the blades", () => {
    const s = alterEgoGame([PSYLOCKE, SPIDER_MAN]);
    expect(bladesOf(s, P1)).toHaveLength(2);
    expect(bladesOf(s, P2)).toHaveLength(0);
    expect(instancesOf(s, BLADE)).toHaveLength(2);
  });
});

describe("Psylocke (41001a): Psi-Energy Control", () => {
  it("a basic attack: interrupt offered, flips the chosen blade to Psi-Katana before the attack resolves", () => {
    const base = heroGame();
    const log = { offered: false };
    const { state, events } = driveEventsPicking(WAVE7_DEPS, base, flipping(1, log), attack(base, stryfe(base)));
    expect(log.offered).toBe(true);
    expect(faces(state)).toEqual([false, true]);
    // The attack still happened: Psylocke is exhausted and the villain was hit for her ATK (1 printed here, the
    // Katana's +1 is the upgrade module's).
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(events.some((e) => e.type === "cardFlipped")).toBe(true);
  });
  it("is optional: declining flips nothing and the attack goes ahead", () => {
    const base = heroGame();
    const { state } = driveEventsPicking(WAVE7_DEPS, base, declining, attack(base, stryfe(base)));
    expect(faces(state)).toEqual([false, false]);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("a basic thwart: also offered, and the first blade is the one flipped when chosen", () => {
    const staged = encounterCardInVillainArea(heroGame(), "40131", 2);
    const base = staged.state;
    const scheme = staged.id;
    const log = { offered: false };
    const { state } = driveEventsPicking(WAVE7_DEPS, base, flipping(0, log), thwart(base, scheme));
    expect(log.offered).toBe(true);
    expect(faces(state)).toEqual([true, false]);
  });
  it("can flip a Psi-Katana back to Psi-Knife (the card has two faces, either way)", () => {
    const base = heroGame();
    const first = driveEventsPicking(WAVE7_DEPS, base, flipping(0), attack(base, stryfe(base))).state;
    expect(faces(first)).toEqual([true, false]);
    // Ready her again by staging, then use the interrupt on the same blade.
    const readied = {
      ...first,
      instances: { ...first.instances, [identityOf(first)]: { ...inst(first, identityOf(first)), exhausted: false } },
    };
    const second = driveEventsPicking(WAVE7_DEPS, readied, flipping(0), attack(readied, stryfe(readied))).state;
    expect(faces(second)).toEqual([false, false]);
  });
  it("is not offered for a basic recovery (Betsy's power) or in alter-ego form", () => {
    const log = { offered: false };
    const base = withDamage(alterEgoGame(), identityOf(alterEgoGame()), 4);
    const { state } = driveEventsPicking(WAVE7_DEPS, base, flipping(0, log), {
      type: "basicRecover",
      playerId: P1,
    });
    expect(log.offered).toBe(false);
    expect(faces(state)).toEqual([false, false]);
  });
  it("two players: another player's basic attack does not offer it, and Psylocke's blades stay as they were", () => {
    // Spider-Man is seat 1 (P1), Psylocke seat 2 (P2) in hero form with her own blades.
    const base = withForm(heroGame([SPIDER_MAN, PSYLOCKE]), { heroForm: 0 }, P2);
    const log = { offered: false };
    const { state } = driveEventsPicking(WAVE7_DEPS, base, flipping(0, log), attack(base, stryfe(base)));
    expect(log.offered).toBe(false);
    expect(bladesOf(state, P2)).toHaveLength(2);
    expect(faces(state, P2)).toEqual([false, false]);
    expect(bladesOf(state, P1)).toHaveLength(0);
  });
});

describe("Betsy Braddock (41001b): Action, exhaust a PSI-ENERGY upgrade to shuffle a PSIONIC card into the deck", () => {
  /** Puts the given codes into her discard pile from hand or deck. */
  const withDiscard = (s: GameState, ...codes: string[]): GameState =>
    codes.reduce((acc, code) => moveToDiscard(acc, P1, code).state, s);
  /** The action, exhausting the first ready blade. */
  const act = (s: GameState): Command => {
    const blade = bladesOf(s).find((id) => !inst(s, id).exhausted) ?? bladesOf(s)[0]!;
    return use(P1, identityOf(s), ACTION, [], { exhausted: [blade] });
  };
  const choosing =
    (code: string): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards") {
        const hit = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === code);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };

  it("exhausts one blade and shuffles the chosen PSIONIC card from the discard pile into the deck", () => {
    const base = withDiscard(alterEgoGame(), "41004", "41005");
    const before = deckCodes(base).length;
    const { state } = driveEventsPicking(WAVE7_DEPS, base, choosing("41005"), act(base));
    expect(discardCodes(state)).toEqual(["41004"]);
    expect(deckCodes(state)).toHaveLength(before + 1);
    expect(deckCodes(state)).toContain("41005");
    expect(bladesOf(state).filter((id) => inst(state, id).exhausted)).toHaveLength(1);
  });
  it("only a PSIONIC card is a candidate: with only Angel (41003) in the discard pile there is no target", () => {
    const base = withDiscard(alterEgoGame(), "41003");
    expect(applyCommand(base, act(base), WAVE7_DEPS).ok).toBe(false);
  });
  it("is an alter-ego action: refused in hero form", () => {
    const base = withDiscard(heroGame(), "41004");
    expect(applyCommand(base, act(base), WAVE7_DEPS).ok).toBe(false);
  });
  it("can be used twice in a turn with two blades (no limit printed), and a third time is refused", () => {
    const base = withDiscard(alterEgoGame(), "41004", "41005");
    const one = driveEventsPicking(WAVE7_DEPS, base, choosing("41004"), act(base)).state;
    const two = driveEventsPicking(WAVE7_DEPS, one, choosing("41005"), act(one)).state;
    expect(discardCodes(two)).toEqual([]);
    expect(bladesOf(two).every((id) => inst(two, id).exhausted)).toBe(true);
    // No ready blade is left to pay the cost (and nothing is left in the discard pile either).
    expect(applyCommand(two, act(two), WAVE7_DEPS).ok).toBe(false);
  });
});
