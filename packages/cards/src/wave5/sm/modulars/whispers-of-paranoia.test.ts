import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/**
 * Whispers of Paranoia (`sm` 27170–27173, `whispers-of-paranoia.ts`), exercised in Mysterio — the scenario this
 * modular set is recommended for (MC27 p. 20) — so "you" inside a [star] Boost ability's own effects reads as the
 * attacked player against a real attack (`resolve/enemy-activation.ts stepBoostCard`'s `frame.attackedPlayerId`),
 * and `activateEnemy`'s own `player.identity.form === "hero" ? "attack" : "scheme"` makes Mysterio's activation
 * deterministic off `toHero(P1)` rather than left to AI choice.
 */
const mysterioGame = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("mysterio", { seed, modularSetIds: [encounterSetId("whispers_of_paranoia")] }));

/** Puts `code` (already in the player's hand/deck/discard) directly into their play area, bypassing its cost — the
 * `../../wave4/mts/thanos.test.ts` `putAllyIntoPlay` shape, generalized to any player card (ally, support). */
function putCardIntoPlay(
  state: GameState,
  code: string,
  player: PlayerId,
  opts: { readonly damage?: number; readonly exhausted?: boolean } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const withHand = given.state;
  return {
    id,
    state: {
      ...withHand,
      players: withHand.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: {
        ...withHand.instances,
        [id]: {
          ...withHand.instances[id]!,
          faceup: true,
          controllerId: player,
          damage: opts.damage ?? 0,
          exhausted: opts.exhausted ?? false,
        },
      },
    },
  };
}

/** Attaches `attachmentId` to `hostId` by surgery — `../../wave4/mts/frost-giants.test.ts`'s own `21158` shape. */
function attachTo(state: GameState, attachmentId: InstanceId, hostId: InstanceId): GameState {
  return {
    ...state,
    instances: {
      ...state.instances,
      [attachmentId]: { ...state.instances[attachmentId]!, attachedTo: hostId, faceup: true },
      [hostId]: {
        ...state.instances[hostId]!,
        attachments: [...state.instances[hostId]!.attachments, attachmentId],
      },
    },
  };
}

describe("Delusion of Collusion (27170)", () => {
  it("27170.delusion-of-collusion-constant: while attached, an ally you control and a Persona support you control never ready, even at the end of the round", () => {
    const state = mysterioGame();
    const identity = identityOf(state, P1);
    const [delusion] = instancesOf(state, "27170");
    const withAlly = putCardIntoPlay(state, "27011", P1, { exhausted: true }); // Spider-Man (Miles Morales), ally.
    const withPersona = putCardIntoPlay(withAlly.state, "27007", P1, { exhausted: true }); // George Stacy, Persona.
    const attached = attachTo(withPersona.state, delusion!, identity);
    const afterRound = settle(runWave5(attached, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(afterRound, withAlly.id).exhausted).toBe(true);
    expect(inst(afterRound, withPersona.id).exhausted).toBe(true);
  });

  it("negative: a non-Persona support you control still readies normally while Delusion of Collusion is attached", () => {
    const state = mysterioGame();
    const identity = identityOf(state, P1);
    const [delusion] = instancesOf(state, "27170");
    const withSupport = putCardIntoPlay(state, "27023", P1, { exhausted: true }); // Web of Life and Destiny, no Persona trait.
    const attached = attachTo(withSupport.state, delusion!, identity);
    const afterRound = settle(runWave5(attached, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(afterRound, withSupport.id).exhausted).toBe(false);
  });

  it("27170.delusion-of-collusion-action: Alter-Ego Action discards an ally you control and this card with it", () => {
    const state = mysterioGame(); // still in alter-ego form at game start.
    const identity = identityOf(state, P1);
    const [delusion] = instancesOf(state, "27170");
    const withAlly = putCardIntoPlay(state, "27011", P1);
    const attached = attachTo(withAlly.state, delusion!, identity);
    const after = settle(
      runWith(
        WAVE5_DEPS,
        attached,
        use(P1, delusion!, "27170.delusion-of-collusion-action", [], { discarded: [withAlly.id] }, { branch: 0 }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(withAlly.id);
    // Delusion of Collusion is an encounter card: "discard this card" sends it to the active encounter deck's own
    // discard pile, not the player's (`resolve/apply-effect.ts`'s `discardFromPlay`, home read off `ownerId`).
    expect(activeEncounterDeck(after).discard).toContain(delusion!);
  });

  /** Declares `ally` as the defender the first time (and only the first time) `declareDefender` offers it —
   * Mysterio's own engaged minion (Shifting Apparition, already in play at setup) activates right after the
   * villain in the same villain phase and offers its own `declareDefender`, where `ally` is no longer a legal
   * option once already defeated/exhausted; every other prompt (Web Binding's own optional Interrupt window,
   * included) declines via `firstLegal`. */
  const declareOnce =
    (ally: InstanceId): Picker =>
    (s: GameState) => {
      if (
        s.pendingChoice?.prompt.kind === "declareDefender" &&
        s.pendingChoice.options.some((o) => o.optionId === ally)
      )
        return [ally];
      return firstLegal(s);
    };

  it("27170.boost: an ally defeated by this attack deals indirect damage to the attacked player equal to its printed cost", () => {
    const hero = settle(runWave5(mysterioGame(), toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Spider-Man (Miles Morales), printed cost 4, hp 3 — damaged to 1 remaining hit point so Mysterio (I)'s own
    // ATK (1) defeats him when declared as the defender.
    const { state: withAlly, id: ally } = putCardIntoPlay(hero, "27011", P1, { damage: 2 });
    const identity = identityOf(withAlly, P1);
    const damageBefore = inst(withAlly, identity).damage;
    const staged = stackEncounterDeck(withAlly, "27170"); // eaten as Mysterio's own unconditional boost draw.
    const after = settle(runWave5(staged, endTurn(P1)), declareOnce(ally), undefined, WAVE5_DEPS);
    expect(instancesOf(after, "27011").some((id) => playerOf(after, P1).playArea.includes(id))).toBe(false); // defeated
    // Mysterio's own ATK went to the ally (defended, then defeated); the identity's only damage is the indirect 4
    // (the ally's printed cost) plus Shifting Apparition's own separate, undefended attack (1) right after.
    expect(inst(after, identity).damage).toBe(damageBefore + 4 + 1);
  });

  it("negative: an ally that survives this attack deals no indirect damage", () => {
    const hero = settle(runWave5(mysterioGame(), toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    // Full 3 hit points: Mysterio's own ATK (1) doesn't defeat him.
    const { state: withAlly, id: ally } = putCardIntoPlay(hero, "27011", P1);
    const identity = identityOf(withAlly, P1);
    // A control run stacking a boost-ability-less filler (Advance, 01186) instead of Delusion of Collusion,
    // otherwise identical: the marginal effect of this card's own boost, isolated from Shifting Apparition's own
    // separate attack right after (`sinister-six/guerrilla-tactics.ts` module docblock's own diffing shape).
    const control = settle(
      runWave5(stackEncounterDeck(withAlly, "01186"), endTurn(P1)),
      declareOnce(ally),
      undefined,
      WAVE5_DEPS,
    );
    const withDelusion = settle(
      runWave5(stackEncounterDeck(withAlly, "27170"), endTurn(P1)),
      declareOnce(ally),
      undefined,
      WAVE5_DEPS,
    );
    expect(instancesOf(withDelusion, "27011").some((id) => playerOf(withDelusion, P1).playArea.includes(id))).toBe(
      true,
    ); // survived
    expect(inst(withDelusion, identity).damage).toBe(inst(control, identity).damage); // no marginal indirect damage.
  });
});

// Old Grudge (27172), Manipulated Mind (27171) and Analysis Paralysis (27173) are not scripted — see the module
// docblock in `whispers-of-paranoia.ts` for the exact engine/schema gap each is blocked on.
