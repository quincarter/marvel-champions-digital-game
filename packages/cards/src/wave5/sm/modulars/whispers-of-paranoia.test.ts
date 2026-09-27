import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, type GameState, type InstanceId, maxHitPoints, type PlayerId } from "@mc/engine";
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
  threatOn,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
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

describe("Analysis Paralysis (27173)", () => {
  // Ghost-Spider at Sandman, alter-ego form: Sandman schemes and takes one boost card (the Advance filler), then
  // Analysis Paralysis is P1's dealt encounter card (`down-to-earth.test.ts`'s own "Threat or Menace?" staging). Her
  // nemesis side scheme is Regenerative Research (27026, starting threat 5), set aside for her at setup.
  const REGENERATIVE_RESEARCH = "27026";
  const sandmanGame = (seed = 1) =>
    startWave5Game(ghostSpiderScenario("sandman", { seed, modularSetIds: [encounterSetId("whispers_of_paranoia")] }));

  const revealAnalysisParalysis = (state: GameState) => {
    const [paralysis] = instancesOf(state, "27173");
    const { state: after, events } = driveEventsPicking(
      WAVE5_DEPS,
      stackEncounterDeck(state, "01186", "27173"),
      firstLegal,
      endTurn(P1),
    );
    const revealed = events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.instanceId] : []));
    expect(revealed).toContain(paralysis);
    return { state: after, paralysis: paralysis!, revealed };
  };

  /** `research` taken out of P1's set-aside area and put at the end of `to` by surgery. */
  const moveResearch = (state: GameState, research: InstanceId, to: "encounterDiscard" | "victoryDisplay") => {
    const players = state.players.map((p) =>
      p.playerId === P1 ? { ...p, setAside: p.setAside.filter((id) => id !== research) } : p,
    );
    if (to === "victoryDisplay") return { ...state, players, victoryDisplay: [...state.victoryDisplay, research] };
    const deckId = state.encounterDeckOrder[0]!;
    const piles = state.encounterDecks[deckId]!;
    return {
      ...state,
      players,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, discard: [...piles.discard, research] } },
    };
  };

  it("27173.when-revealed: reveals your set-aside nemesis side scheme, then places X = its threat (5) here: 1 + 5", () => {
    const state = sandmanGame();
    const [research] = instancesOf(state, REGENERATIVE_RESEARCH);
    expect(playerOf(state, P1).setAside).toContain(research);
    const { state: after, paralysis, revealed } = revealAnalysisParalysis(state);
    expect(revealed.indexOf(research!)).toBeGreaterThan(revealed.indexOf(paralysis));
    expect(threatOn(after, research!)).toBe(5);
    expect(threatOn(after, paralysis)).toBe(6);
  });

  it("finds it in the encounter discard pile too", () => {
    const state = sandmanGame(2);
    const [research] = instancesOf(state, REGENERATIVE_RESEARCH);
    const {
      state: after,
      paralysis,
      revealed,
    } = revealAnalysisParalysis(moveResearch(state, research!, "encounterDiscard"));
    expect(revealed).toContain(research);
    expect(threatOn(after, research!)).toBe(5);
    expect(threatOn(after, paralysis)).toBe(6);
  });

  it("negative: with no nemesis side scheme in the searched areas, nothing is revealed for it and X is 0", () => {
    const state = sandmanGame(3);
    const [research] = instancesOf(state, REGENERATIVE_RESEARCH);
    const {
      state: after,
      paralysis,
      revealed,
    } = revealAnalysisParalysis(moveResearch(state, research!, "victoryDisplay"));
    expect(revealed).not.toContain(research);
    expect(threatOn(after, paralysis)).toBe(1); // its own starting threat only
  });
});

describe("Old Grudge (27172)", () => {
  // Ghost-Spider at Mysterio, alter-ego form: Mysterio schemes and takes one boost card (the Advance filler), then Old
  // Grudge is P1's dealt encounter card. Her nemesis minion is The Lizard (27027, 5 hit points), set aside for her at
  // setup. Mysterio's setup puts Shifting Apparition (27091) into play: a minion any generic "minion" host would have
  // picked before Old Grudge's own search ran.
  const OLD_GRUDGE = "27172";
  const THE_LIZARD = "27027";
  const SHIFTING_APPARITION = "27091";

  const revealOldGrudge = (state: GameState) => {
    const [grudge] = instancesOf(state, OLD_GRUDGE);
    const { state: after, events } = driveEventsPicking(
      WAVE5_DEPS,
      stackEncounterDeck(state, "01186", OLD_GRUDGE),
      firstLegal,
      endTurn(P1),
    );
    const revealed = events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.instanceId] : []));
    expect(revealed).toContain(grudge);
    return { state: after, grudge: grudge!, revealed };
  };

  /** The Lizard taken out of P1's set-aside area and put in `to` by surgery. */
  const moveLizard = (
    state: GameState,
    lizard: InstanceId,
    to: "encounterDeck" | "encounterDiscard" | "encounterSetAside" | "victoryDisplay" | "inPlay",
  ): GameState => {
    const players = state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            setAside: p.setAside.filter((id) => id !== lizard),
            playArea: to === "inPlay" ? [...p.playArea, lizard] : p.playArea,
          }
        : p,
    );
    const moved: GameState = { ...state, players };
    if (to === "victoryDisplay") return { ...moved, victoryDisplay: [...state.victoryDisplay, lizard] };
    if (to === "encounterSetAside") return { ...moved, encounterSetAside: [...state.encounterSetAside, lizard] };
    if (to === "inPlay")
      return {
        ...moved,
        instances: { ...state.instances, [lizard]: { ...state.instances[lizard]!, faceup: true, engagedWith: P1 } },
      };
    const deckId = state.encounterDeckOrder[0]!;
    const piles = state.encounterDecks[deckId]!;
    const pile = to === "encounterDeck" ? "deck" : "discard";
    return {
      ...moved,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, [pile]: [...piles[pile], lizard] } },
    };
  };

  /** Old Grudge ended on The Lizard, in play in P1's area, with its +1 hit point: 5 + 1. */
  const expectAttachedToLizard = (after: GameState, grudge: InstanceId, lizard: InstanceId) => {
    const [apparition] = instancesOf(after, SHIFTING_APPARITION);
    expect(after.pendingChoice).toBeNull();
    expect(inst(after, grudge).attachedTo).toBe(lizard);
    expect(inst(after, lizard).attachments).toEqual([grudge]);
    expect(inst(after, apparition!).attachments).toEqual([]);
    expect(playerOf(after, P1).playArea).toContain(lizard);
    expect(inst(after, lizard).engagedWith).toBe(P1);
    expect(maxHitPoints(after, lizard, WAVE5_DEPS)).toBe(6);
    expect(activeEncounterDeck(after).discard).not.toContain(grudge);
  };

  it("27172.when-revealed: reveals your set-aside nemesis minion, then attaches Old Grudge to it (+1 hit point)", () => {
    const state = mysterioGame();
    const [lizard] = instancesOf(state, THE_LIZARD);
    expect(playerOf(state, P1).setAside).toContain(lizard);
    const { state: after, grudge, revealed } = revealOldGrudge(state);
    expect(revealed.indexOf(lizard!)).toBeGreaterThan(revealed.indexOf(grudge));
    expectAttachedToLizard(after, grudge, lizard!);
  });

  it("finds it in the encounter discard pile", () => {
    const state = mysterioGame(2);
    const [lizard] = instancesOf(state, THE_LIZARD);
    const { state: after, grudge, revealed } = revealOldGrudge(moveLizard(state, lizard!, "encounterDiscard"));
    expect(revealed).toContain(lizard);
    expectAttachedToLizard(after, grudge, lizard!);
  });

  it("finds it in the encounter deck", () => {
    const state = mysterioGame(3);
    const [lizard] = instancesOf(state, THE_LIZARD);
    const { state: after, grudge, revealed } = revealOldGrudge(moveLizard(state, lizard!, "encounterDeck"));
    expect(revealed).toContain(lizard);
    expect(activeEncounterDeck(after).deck).not.toContain(lizard);
    expectAttachedToLizard(after, grudge, lizard!);
  });

  it("finds it in the scenario's set-aside area", () => {
    const state = mysterioGame(4);
    const [lizard] = instancesOf(state, THE_LIZARD);
    const { state: after, grudge, revealed } = revealOldGrudge(moveLizard(state, lizard!, "encounterSetAside"));
    expect(revealed).toContain(lizard);
    expect(after.encounterSetAside).not.toContain(lizard);
    expectAttachedToLizard(after, grudge, lizard!);
  });

  it("negative: a nemesis minion already in play is in no searched area: nothing is revealed and Old Grudge is discarded", () => {
    const state = mysterioGame(5);
    const [lizard] = instancesOf(state, THE_LIZARD);
    const [apparition] = instancesOf(state, SHIFTING_APPARITION);
    const { state: after, grudge, revealed } = revealOldGrudge(moveLizard(state, lizard!, "inPlay"));
    expect(revealed).not.toContain(lizard);
    expect(inst(after, grudge).attachedTo).toBeNull();
    expect(inst(after, lizard!).attachments).toEqual([]);
    expect(inst(after, apparition!).attachments).toEqual([]);
    expect(maxHitPoints(after, lizard!, WAVE5_DEPS)).toBe(5);
    expect(activeEncounterDeck(after).discard).toContain(grudge);
  });

  it("negative: with no nemesis minion anywhere searched (victory display), Old Grudge attaches to nothing and is discarded", () => {
    const state = mysterioGame(6);
    const [lizard] = instancesOf(state, THE_LIZARD);
    const [apparition] = instancesOf(state, SHIFTING_APPARITION);
    const { state: after, grudge, revealed } = revealOldGrudge(moveLizard(state, lizard!, "victoryDisplay"));
    expect(revealed).not.toContain(lizard);
    expect(after.victoryDisplay).toContain(lizard);
    expect(inst(after, grudge).attachedTo).toBeNull();
    expect(inst(after, apparition!).attachments).toEqual([]);
    expect(activeEncounterDeck(after).discard).toContain(grudge);
  });

  it("27172.boost: deals 1 damage to the attacked player's identity and to each ally they control", () => {
    const hero = settle(runWave5(mysterioGame(), toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
    const { state: withAlly, id: ally } = putCardIntoPlay(hero, "27011", P1); // Spider-Man (Miles Morales), 3 hp.
    const identity = identityOf(withAlly, P1);
    // Both runs: no defender declared (`firstLegal` declines), so every attack lands on the identity; the control run
    // stacks the boost-ability-less Advance filler instead of Old Grudge, isolating Old Grudge's own boost.
    const control = settle(
      runWave5(stackEncounterDeck(withAlly, "01186"), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    const withGrudge = settle(
      runWave5(stackEncounterDeck(withAlly, OLD_GRUDGE), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // Control: Mysterio's ATK 1 plus Shifting Apparition's 1. With Old Grudge: its 2 boost icons (+2 ATK on
    // Mysterio's attack, Advance has none) and its [star] Boost's 1 damage on top.
    expect(inst(control, identity).damage).toBe(2);
    expect(inst(withGrudge, identity).damage).toBe(2 + 2 + 1);
    expect(inst(control, ally).damage).toBe(0);
    expect(inst(withGrudge, ally).damage).toBe(1);
  });
});

// Manipulated Mind (27171) is not scripted — see the module docblock in `whispers-of-paranoia.ts` for the exact
// engine/schema gap it is blocked on.
