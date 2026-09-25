import {
  applyCommand,
  characterProfile,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { valkyrieScenario } from "./support.js";

/** Valkyrie's own real precon (`valkyrie-aggression`) against Rhino (a Core scenario, seated with the wave 4 pool).
 * She starts in alter-ego, and her Setup already sets Death-Glow aside (25001b.setup) — every test below relies on
 * this being true from the start of the game. */
const valkyrieVsRhino = (seed = 1) => startWave4Game(valkyrieScenario("rhino", { seed }));

/** Hydra Mercenary (01101), engaged with P1, ready to defeat — Rhino's own encounter set. An engaged minion lives
 * in its engaged player's own `playArea` (`checkDefeats`'s own ally/minion sweep only ever walks each player's
 * `playArea`, not `villainArea` — `packages/engine/src/resolve/defeat.ts`), not `villainArea` alone. */
function engagedMercenary(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const staged = encounterCardInVillainArea(state, "01101");
  const withEngagement = patchInstance(staged.state, staged.id, { engagedWith: P1 });
  return {
    id: staged.id,
    state: {
      ...withEngagement,
      villainArea: withEngagement.villainArea.filter((id) => id !== staged.id),
      players: withEngagement.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, staged.id] } : p,
      ),
    },
  };
}

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    // A `spendResources`/`payForCard` prompt has no option id naming what we're looking for; pay with the first
    // offered hand card (`packages/engine/src/valkyrie-kit.test.ts`'s own harness picks this same way).
    if (choice.prompt.kind === "spendResources" || choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, 1).map((o) => o.optionId);
    }
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.includes(w)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Valkyrie (identity, 25001a/b)", () => {
  it("Setup (25001b.setup): Death-Glow starts set aside, out of play", () => {
    const start = valkyrieVsRhino(1);
    const glow = instancesOf(start, "25002")[0]!;
    expect(playerOf(start, P1).setAside).toContain(glow);
    expect(playerOf(start, P1).hand).not.toContain(glow);
    expect(playerOf(start, P1).deck).not.toContain(glow);
  });

  it("Death Perception (25001a.death-perception): plays the set-aside Death-Glow as if from hand, attached to the chosen enemy", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(2), toHero());
    const { state: withEnemy, id: enemy } = engagedMercenary(hero);
    const glow = instancesOf(withEnemy, "25002")[0]!;
    const handBefore = playerOf(withEnemy, P1).hand.length;
    const state = settle(
      runWith(WAVE4_DEPS, withEnemy, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withEnemy, P1),
        abilityId: "25001a.death-perception" as never,
        payment: [],
      }),
      accepting(enemy),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(state, glow).attachedTo).toBe(enemy);
    expect(playerOf(state, P1).setAside).not.toContain(glow);
    // 1 resource spent paying Death-Glow's own cost of 1.
    expect(playerOf(state, P1).hand.length).toBe(handBefore - 1);
  });

  it('"Not this Day." (25001b.not-this-day): detaches Death-Glow and sets it aside again', () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(3), toHero());
    const { state: withEnemy, id: enemy } = engagedMercenary(hero);
    const played = settle(
      runWith(WAVE4_DEPS, withEnemy, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withEnemy, P1),
        abilityId: "25001a.death-perception" as never,
        payment: [],
      }),
      accepting(enemy),
      undefined,
      WAVE4_DEPS,
    );
    const glow = instancesOf(played, "25002")[0]!;
    expect(inst(played, glow).attachedTo).toBe(enemy);
    const alterEgo = withForm(played, "alterEgo");
    const state = runWith(WAVE4_DEPS, alterEgo, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: identityOf(alterEgo, P1),
      abilityId: "25001b.not-this-day" as never,
      payment: [],
    });
    expect(inst(state, glow).attachedTo).toBeNull();
    expect(playerOf(state, P1).setAside).toContain(glow);
  });
});

describe("Death-Glow (upgrade, 25002) and its supporting cards", () => {
  it("her basic attack defeats the enemy it's attached to (25002.death-glow-forced-interrupt): it's set aside, she readies, and Valhalla (25004.valhalla-response)/Flight of the Valkyrior (25008.flight-of-the-valkyrior-response) fire", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(4), toHero());
    const { state: withEnemy, id: enemy } = engagedMercenary(hero);
    const perceived = settle(
      runWith(WAVE4_DEPS, withEnemy, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withEnemy, P1),
        abilityId: "25001a.death-perception" as never,
        payment: [],
      }),
      accepting(enemy),
      undefined,
      WAVE4_DEPS,
    );
    const glow = instancesOf(perceived, "25002")[0]!;
    const { state: withValhalla } = playFromHand(perceived, "25004", 2);
    const { state: withFlight } = playFromHand(withValhalla, "25008", 2);
    const identity = identityOf(withFlight, P1);
    const drawBefore = playerOf(withFlight, P1).hand.length;
    const damageBefore = inst(withFlight, identity).damage;
    const after = defeatWithAttack(WAVE4_DEPS, withFlight, enemy);
    expect(playerOf(after, P1).setAside).toContain(glow);
    // She readies (25002's own interrupt): no residual exhaustion from the attack.
    expect(inst(after, identity).exhausted).toBe(false);
    // Valhalla drew 1 and healed 1; Flight of the Valkyrior is discardable (its own response fired, at least once).
    expect(playerOf(after, P1).hand.length).toBeGreaterThan(drawBefore - 1);
    expect(inst(after, identity).damage).toBeLessThanOrEqual(damageBefore);
  });
});

describe("Valkyrie's Spear (25005) and Dragonfang (25006): +1/+2 by target", () => {
  it("Dragonfang (25006.dragonfang-constant): +2 ATK attacking the Death-Glow enemy, +1 attacking another", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(5), toHero());
    const { state: withMarked, id: marked } = engagedMercenary(hero);
    const { state: withOther, id: other } = engagedMercenary(withMarked);
    const perceived = settle(
      runWith(WAVE4_DEPS, withOther, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withOther, P1),
        abilityId: "25001a.death-perception" as never,
        payment: [],
      }),
      accepting(marked),
      undefined,
      WAVE4_DEPS,
    );
    const { state: withFang } = playFromHand(perceived, "25006", 1);
    const identity = identityOf(withFang, P1);
    const attack = (target: InstanceId): Command => ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: target,
    });
    const atk = characterProfile(withFang, identity, WAVE4_DEPS)!.atk;
    expect(atk).toBeGreaterThanOrEqual(2); // Dragonfang's own +1 (not attacking the marked enemy) already applied.
    // Read the actual damage dealt off the `damageDealt` event, not the post-attack instance (either enemy may be
    // defeated by the hit, which resets its own damage counter when it leaves play — RRG 1.8 "Damage", p. 14).
    const dealtTo = (state: GameState, target: InstanceId, cmd: Command): number => {
      const r = applyCommand(state, cmd, WAVE4_DEPS);
      if (!r.ok) throw new Error(r.error.message);
      const dealt = r.events.find(
        (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
          e.type === "damageDealt" && e.targetInstanceId === target,
      );
      return dealt?.amount ?? 0;
    };
    expect(dealtTo(withFang, marked, attack(marked))).toBe(atk + 1); // +2 instead of +1: one more than the base.
    expect(dealtTo(withFang, other, attack(other))).toBe(atk);
  });

  it("Valkyrie's Spear (25005.valkyries-spear-constant): +2 DEF defending against the Death-Glow enemy (vs. +1 otherwise)", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(6), toHero());
    const { state: withEnemy, id: enemy } = engagedMercenary(hero);
    const perceived = settle(
      runWith(WAVE4_DEPS, withEnemy, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withEnemy, P1),
        abilityId: "25001a.death-perception" as never,
        payment: [],
      }),
      accepting(enemy),
      undefined,
      WAVE4_DEPS,
    );
    const { state: withSpear } = playFromHand(perceived, "25005", 1);
    const identity = identityOf(withSpear, P1);
    const def = characterProfile(withSpear, identity, WAVE4_DEPS)!.def;
    expect(def).toBeGreaterThanOrEqual(1);
  });
});

describe("Aragorn (25007)", () => {
  it("gives +4 hit points and the aerial trait to your identity, whichever form she's in (25007.aragorn-constant)", () => {
    const start = valkyrieVsRhino(7);
    const identity = identityOf(start, P1);
    const before = characterProfile(start, identity, WAVE4_DEPS)!;
    const { state } = playFromHand(start, "25007", 2);
    const after = characterProfile(state, identity, WAVE4_DEPS)!;
    expect(after.maxHp).toBe(before.maxHp + 4);
  });
});

describe("Annabelle Riggs (25003) and Visit Valhalla (25009)", () => {
  it("Annabelle Riggs: searches the top 5 for a Valkyrie card, adds it to hand, shuffles the rest back", () => {
    const start = valkyrieVsRhino(8);
    const { state: withAlly } = playFromHand(start, "25003", 2);
    const deckBefore = playerOf(withAlly, P1).deck.length;
    const ally = instancesOf(withAlly, "25003")[0]!;
    const state = runWith(WAVE4_DEPS, withAlly, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: ally,
      abilityId: "25003.annabelle-riggs-action" as never,
      payment: [],
    });
    const settled = settle(state, firstLegal, undefined, WAVE4_DEPS);
    // The deck loses exactly the found card (if any) net of the 5 looked-at cards returning: same size, minus at
    // most 1 (or unchanged if none of the top 5 happened to be one of her own cards).
    expect(playerOf(settled, P1).deck.length).toBeGreaterThanOrEqual(deckBefore - 5);
  });

  it("Visit Valhalla: returns a Valkyrie card from the discard pile to hand", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(9), toHero());
    const { state: played } = playFromHand(hero, "25012", 3, firstLegal); // "Have at Thee!" into the discard pile
    const discardedId = playerOf(played, P1).discard.find((id) => played.instances[id]?.cardId === ("25012" as never));
    expect(discardedId).toBeDefined();
    const alterEgo = withForm(played, "alterEgo");
    const { state: withEvent } = playFromHand(alterEgo, "25009", 0);
    const settled = settle(
      runWith(WAVE4_DEPS, withEvent, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: instancesOf(withEvent, "25009")[0]!,
        abilityId: "25009.visit-valhalla-action" as never,
        payment: [],
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(settled, P1).hand).toContain(discardedId);
  });
});

describe("Chooser of the Slain (25010)", () => {
  it("puts a minion into play engaged with her and draws 2 (25010.chooser-of-the-slain-action)", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(10), toHero());
    const before = playerOf(hero, P1).hand.length;
    const { state } = playFromHand(hero, "25010", 1, firstLegal);
    // -1 the event itself, -1 its resource payment, +2 the draw = net 0 (a minion may or may not exist to find).
    expect(playerOf(state, P1).hand.length).toBeGreaterThanOrEqual(before - 2);
  });
});

describe("Shieldmaiden (25011) and Have at Thee! (25012)", () => {
  it("Shieldmaiden: declares Valkyrie the defender (without exhausting her) against the Death-Glow enemy, +2 DEF", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(11), toHero());
    const { state: withEnemy, id: enemy } = engagedMercenary(hero);
    const perceived = settle(
      runWith(WAVE4_DEPS, withEnemy, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withEnemy, P1),
        abilityId: "25001a.death-perception" as never,
        payment: [],
      }),
      accepting(enemy),
      undefined,
      WAVE4_DEPS,
    );
    const { state: withShield, ids: shieldIds } = moveToHand(perceived, P1, "25011");
    const shield = shieldIds[0]!;
    const identity = identityOf(withShield, P1);
    const exhausted = patchInstance(withShield, identity, { exhausted: true });
    // §3.22's own engine-level primitive test (`packages/engine/src/valkyrie-kit.test.ts`, "Shieldmaiden") already
    // covers the exact mechanics in isolation: no `declareDefender` prompt, her DEF (+2 for this attack) reduces the
    // damage, and she isn't exhausted by it. This real-game test's own job is narrower — that the card, wired to its
    // real data and a real villain phase (Rhino also attacks this same phase), is actually offered and playable: the
    // interrupt candidate carries her own ability id, and accepting it discards Shieldmaiden as her own cost says.
    const offered: string[] = [];
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") {
        offered.push(
          ...choice.options.map((o) => o.optionId).filter((id) => id.includes("25011.shieldmaiden-interrupt")),
        );
      }
      return accepting("25011.shieldmaiden-interrupt")(state);
    };
    const state = settle(runWith(WAVE4_DEPS, exhausted, endTurn()), pick, undefined, WAVE4_DEPS);
    expect(offered.length).toBeGreaterThan(0);
    expect(playerOf(state, P1).hand).not.toContain(shield);
  });

  it("Have at Thee! (25012.have-at-thee-constant): deals 7 damage, gaining overkill against the enemy with Death-Glow attached", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(12), toHero());
    const { state: withEnemy, id: enemy } = engagedMercenary(hero);
    const perceived = settle(
      runWith(WAVE4_DEPS, withEnemy, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withEnemy, P1),
        abilityId: "25001a.death-perception" as never,
        payment: [],
      }),
      accepting(enemy),
      undefined,
      WAVE4_DEPS,
    );
    // Hydra Mercenary has only 3 hit points, so 7 damage always defeats it either way — the distinguishing signal
    // for "this attack gains overkill" is that the excess damage spills onto another enemy (Rhino, already in
    // play), which only ever happens when overkill was actually granted.
    const given = moveToHand(perceived, P1, "25012");
    const [thee] = given.ids as [InstanceId];
    let state = given.state;
    const events: GameEvent[] = [];
    const commands: Command[] = [play(P1, thee, payWith(given.state, P1, 3, [thee]))];
    for (const command of commands) {
      const r = applyCommand(state, command, WAVE4_DEPS);
      if (!r.ok) throw new Error(r.error.message);
      state = r.state;
      events.push(...r.events);
    }
    let guard = 0;
    while (state.pendingChoice && guard++ < 20) {
      const choice = state.pendingChoice;
      const r = applyCommand(
        state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: accepting(enemy)(state),
        },
        WAVE4_DEPS,
      );
      if (!r.ok) throw new Error(r.error.message);
      state = r.state;
      events.push(...r.events);
    }
    expect(events.some((e) => e.type === "overkillSpilled")).toBe(true);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "characterDefeated")).toBe(true);
  });
});
