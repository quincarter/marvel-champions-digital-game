import { describe, expect, it } from "vitest";
import { cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  hasKeyword,
  paymentFor,
  type CardInstance,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, stageNemesisCardForReveal } from "../../testing/staging.js";
import { MSM_PACK_CARDS } from "../../wave1/msm/pack-cards.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenario, spdrScenarioWithExtras } from "./support.js";
import { SPDR_SUPPORT_UPGRADES } from "./support-upgrades.js";

// Real Core data: the Rhino villain phase always attacks a lone player — `identity.test.ts`'s own precedent.
const spdrVsRhino = (seed = 1) => startWave5Game(spdrScenario("rhino", { seed }));
const spdrVsRhinoWithExtras = (extraCodes: readonly string[], seed = 1) =>
  startWave5Game(spdrScenarioWithExtras("rhino", { seed, extraCodes }));

const RHINO_NO_BOOST = "01186"; // "Advance": 0 boost icons, the deterministic Rhino-attack fixture (`spiderham` precedent).
const HYDRA_MERCENARY = "01101"; // Rhino's own encounter set, a minion (not a treachery).

/** Accepts the named optional response/interrupt (by ability id); declines everything else.
 * `spiderham/support-upgrades.test.ts`'s own `accepting()` precedent. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Declares `player`'s own identity as the defender at a `declareDefender` prompt, accepting everything named
 * otherwise — the inverse of `spiderham/support-upgrades.test.ts`'s own `undefended`, needed here because
 * Speed-Metal Alloy's own trigger requires SP//dr Suit actually defending. */
const declaringIdentityDefender =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return [identityOf(state, P1)];
    return accepting(...wanted)(state);
  };

const refused = (state: GameState, command: Command): string => {
  const result = applyCommand(state, command, WAVE5_DEPS);
  if (result.ok) throw new Error("expected the play to be refused");
  return result.error.code;
};

/** A synthetic minion in `player`'s own play area, engaged with them — `spiderham/support-upgrades.test.ts`'s own
 * `engagedMinion` precedent, copied locally for the same reason it isn't exported (test-only surgery). */
function engagedMinion(state: GameState, code: string, slot: string, player = P1): GameState {
  const id = slot as InstanceId;
  const instance: CardInstance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as never;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: instance },
  };
}

/** Reads which `lastingEffectAdded` events fired, unwrapped to their own `effect` payload — Warrior of the Great
 * Web's own precedent (`spiderham/support-upgrades.test.ts`) for asserting an exact stat-modifier shape rather than
 * only an observed damage delta. */
type GameEventLike = { readonly type: string; readonly [key: string]: unknown };
const lastingEffectsAdded = (events: readonly GameEventLike[]) =>
  events.flatMap((e) => (e.type === "lastingEffectAdded" ? [e["effect"]] : []));

/** Sums `damageDealt.amount` from `source`'s own instance — `obligation-nemesis.test.ts`'s own `dealtBy`
 * precedent, needed here too since the same villain phase also runs Rhino's own undefended attack. */
const dealtBy = (events: readonly GameEventLike[], source: InstanceId): number =>
  events
    .filter((e) => e.type === "damageDealt" && e["sourceInstanceId"] === source)
    .reduce((sum, e) => sum + (e["amount"] as number), 0);

/** Plays `code` from hand, attaching it directly to `hostId` (`attachToInstanceId`) — `spiderham/
 * support-upgrades.test.ts`'s own `playAttachedTo` precedent, needed for a card whose `attachesTo` names its host
 * at play time rather than via a follow-up "choose a target" prompt. */
function playAttachedTo(
  state: GameState,
  code: string,
  cost: number,
  hostId: InstanceId,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(
    runWave5(given.state, play(P1, id, payWith(given.state, P1, cost, [id]), { attachToInstanceId: hostId })),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: played, id };
}

describe("SP//dr's supports, upgrades and resources (31007-31013, 31018-31020, 31024, 31029)", () => {
  describe("31007.aunt-may-and-uncle-ben-action", () => {
    const AUNT_MAY = "31007.aunt-may-and-uncle-ben-action";
    /** Aunt May & Uncle Ben in play; `top` on top of the deck, in order. */
    const withAuntMay = (state: GameState, ...top: readonly string[]) => {
      const { state: played, id } = playFromHand(state, "31007", 1);
      const stacked = putOnTopOfDeck(played, P1, ...top);
      return { state: stacked.state, id, top: stacked.ids };
    };
    /** Only `keep` cards left in p1's deck; the rest go to the discard pile (surgery). */
    const trimDeck = (state: GameState, keep: number): GameState => ({
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.slice(0, keep), discard: [...p.deck.slice(keep), ...p.discard] } : p,
      ),
    });

    it("in hero form discards exactly the top 2; the SP//dr card goes to hand, the other stays in the discard pile", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state, id, top } = withAuntMay(hero, "31023", "31010", "31011");
      const [stamina, hostSpider, psychicLink] = top as [InstanceId, InstanceId, InstanceId];
      const after = settle(runWave5(state, use(P1, id, AUNT_MAY)), firstLegal, undefined, WAVE5_DEPS);
      expect(inst(after, id).exhausted).toBe(true);
      expect(playerOf(after, P1).hand).toContain(hostSpider);
      expect(playerOf(after, P1).hand).not.toContain(stamina);
      expect(playerOf(after, P1).discard).toContain(stamina);
      expect(playerOf(after, P1).discard).not.toContain(hostSpider);
      // Only 2 were discarded: Psychic Link, the third, is still the top of the deck.
      expect(playerOf(after, P1).deck[0]).toBe(psychicLink);
      expect(playerOf(after, P1).hand).not.toContain(psychicLink);
    });

    it("in alter-ego form discards exactly the top 3, adding each SP//dr card among them to hand", () => {
      const alterEgo = spdrVsRhino(); // Peni Parker, alter-ego, at setup.
      const { state, id, top } = withAuntMay(alterEgo, "31010", "31023", "31011", "31012");
      const [hostSpider, stamina, psychicLink, alloy] = top as [InstanceId, InstanceId, InstanceId, InstanceId];
      const after = settle(runWave5(state, use(P1, id, AUNT_MAY)), firstLegal, undefined, WAVE5_DEPS);
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      expect(playerOf(after, P1).hand).toEqual(expect.arrayContaining([hostSpider, psychicLink]));
      expect(playerOf(after, P1).discard).toContain(stamina);
      expect(playerOf(after, P1).hand).not.toContain(stamina);
      expect(playerOf(after, P1).deck[0]).toBe(alloy);
    });

    it("cannot be used when the deck holds fewer cards than the cost discards (2 in hero form, 3 in alter-ego)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: heroState, id: heroId } = withAuntMay(hero, "31010");
      expect(refused(trimDeck(heroState, 1), use(P1, heroId, AUNT_MAY))).toBeTruthy();
      // Two cards pay the hero-form cost.
      const paid = settle(
        runWave5(trimDeck(heroState, 2), use(P1, heroId, AUNT_MAY)),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(paid, heroId).exhausted).toBe(true);

      const { state: aeState, id: aeId } = withAuntMay(spdrVsRhino(), "31010");
      expect(refused(trimDeck(aeState, 2), use(P1, aeId, AUNT_MAY))).toBeTruthy();
      expect(inst(trimDeck(aeState, 2), aeId).exhausted).toBe(false);
    });
  });

  describe("31008.ejection-protocol-action", () => {
    it("discards itself, exhausts each Interface upgrade, sets the HP dial to 6, gives tough, and flips to alter-ego", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withHost, id: hostSpider } = playFromHand(hero, "31010", 3);
      const { state: withEjection, id: ejection } = playFromHand(withHost, "31008", 0);
      const damaged = patchInstance(withEjection, identity, { damage: 2 });
      const after = settle(
        runWave5(damaged, use(P1, ejection, "31008.ejection-protocol-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, hostSpider).exhausted).toBe(true);
      expect(inst(after, identity).damage).toBe(8); // printed 14 HP - the dial's own 6.
      expect(inst(after, identity).statuses.tough).toBe(1);
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      expect(cardsInPlay(after)).not.toContain(ejection);
      expect(playerOf(after, P1).discard).toContain(ejection);
    });

    it("is not offered while in alter-ego form", () => {
      const state = spdrVsRhino(); // Peni Parker, alter-ego, at setup.
      const { state: withEjection, id: ejection } = playFromHand(state, "31008", 0);
      expect(refused(withEjection, use(P1, ejection, "31008.ejection-protocol-action"))).toBeTruthy();
    });
  });

  describe("31009.sp-dr-command", () => {
    it("31009.sp-dr-command-action: exhausts Command and an Interface upgrade, draws 1 card", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      // Padded with extra hand cards purely as payment fuel — Host Spider (cost 3) then Command (cost 1) together
      // need more resources than the opening hand alone provides.
      const padded = moveToHand(hero, P1, "31023", "31023", "31023").state;
      const { state: withHost, id: hostSpider } = playFromHand(padded, "31010", 3);
      const { state: withCommand, id: command } = playFromHand(withHost, "31009", 1);
      const before = playerOf(withCommand, P1).hand.length;
      // Two Interface upgrades are in play (Host Spider and SP//dr's own attached upgrade side), so the cost's
      // pick needs an explicit choice rather than the single-candidate auto-pick shortcut.
      const after = settle(
        runWave5(withCommand, use(P1, command, "31009.sp-dr-command-action", [], { exhausted: [hostSpider] })),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, command).exhausted).toBe(true);
      expect(inst(after, hostSpider).exhausted).toBe(true);
      expect(playerOf(after, P1).hand.length).toBe(before + 1);
    });

    it("31009.sp-dr-command-action: cannot pay when every Interface upgrade (including SP//dr itself) is exhausted", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withCommand, id: command } = playFromHand(hero, "31009", 1);
      // In hero form, SP//dr itself (the identity's own attached upgrade side) is an Interface upgrade too
      // (`identity.ts`'s own Sync Ratio docblock) — with no other Interface upgrade in play, exhausting it closes
      // off the only candidate.
      const spdrUpgrade = playerOf(withCommand, P1).identity.separatedCardInstanceId!;
      const tired = patchInstance(withCommand, spdrUpgrade, { exhausted: true });
      expect(refused(tired, use(P1, command, "31009.sp-dr-command-action"))).toBeTruthy();
    });

    it("31009.sp-dr-command-hero-action: exhausts Command, discards a chosen hand card, readies a chosen Interface upgrade", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const padded = moveToHand(hero, P1, "31023", "31023", "31023").state;
      const { state: withHost, id: hostSpider } = playFromHand(padded, "31010", 3);
      const exhaustedHost = patchInstance(withHost, hostSpider, { exhausted: true });
      const { state: withCommand, id: command } = playFromHand(exhaustedHost, "31009", 1);
      const filler = playerOf(withCommand, P1).hand[0]!;
      const handBefore = playerOf(withCommand, P1).hand.length;
      const after = settle(
        runWave5(withCommand, use(P1, command, "31009.sp-dr-command-hero-action", [], { discard: [filler] })),
        (state) => {
          const choice = state.pendingChoice;
          if (choice?.prompt.kind === "chooseTarget") return [hostSpider];
          return firstLegal(state);
        },
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, command).exhausted).toBe(true);
      expect(playerOf(after, P1).discard).toContain(filler);
      expect(playerOf(after, P1).hand.length).toBe(handBefore - 1);
      expect(inst(after, hostSpider).exhausted).toBe(false);
    });

    it("31009.sp-dr-command-hero-action: an already-exhausted Command cannot pay", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withCommand, id: command } = playFromHand(hero, "31009", 1);
      const exhausted = patchInstance(withCommand, command, { exhausted: true });
      const filler = playerOf(exhausted, P1).hand[0]!;
      expect(
        refused(exhausted, use(P1, command, "31009.sp-dr-command-hero-action", [], { discard: [filler] })),
      ).toBeTruthy();
    });
  });

  describe("31010.host-spider-action", () => {
    it("exhausts and readies SP//dr Suit (the identity)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withHost, id: hostSpider } = playFromHand(hero, "31010", 3);
      const exhaustedIdentity = patchInstance(withHost, identity, { exhausted: true });
      const after = settle(
        runWave5(exhaustedIdentity, use(P1, hostSpider, "31010.host-spider-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, hostSpider).exhausted).toBe(true);
      expect(inst(after, identity).exhausted).toBe(false);
    });

    it("an already-exhausted Host Spider cannot pay", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withHost, id: hostSpider } = playFromHand(hero, "31010", 3);
      const exhausted = patchInstance(withHost, hostSpider, { exhausted: true });
      expect(refused(exhausted, use(P1, hostSpider, "31010.host-spider-action"))).toBeTruthy();
    });

    it("Sync Ratio: exhausting Host Spider for it generates its own printed [wild] resource", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withHost, id: hostSpider } = playFromHand(hero, "31010", 3);
      const given = moveToHand(withHost, P1, "31023"); // Limitless Stamina, cost 1 — any hand card serves as the probe.
      const [stamina] = given.ids as [InstanceId];
      const sources = (
        paymentFor(given.state, P1, { kind: "playCard", instanceId: stamina }, {}, WAVE5_DEPS)?.sources ?? []
      ).filter(
        (s) =>
          s.kind === "resourceAbility" &&
          s.optionId.includes("31001a.sync-ratio") &&
          s.costChoices?.exhausted?.[0] === hostSpider,
      );
      expect(sources).toHaveLength(1);
      expect(sources[0]!.pool).toEqual({ energy: 0, mental: 0, physical: 0, wild: 1 });
    });
  });

  describe("31011.psychic-link-interrupt", () => {
    it("accepted: exhausts, and SP//dr Suit gets +2 THW for that thwart (4 total against printed 2)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withCard, id: link } = playFromHand(hero, "31011", 2);
      const { state: withScheme, id: scheme } = encounterCardInVillainArea(withCard, "01107", 5); // Breakin' & Takin'.
      const { state: after } = driveEventsPicking(WAVE5_DEPS, withScheme, accepting("31011.psychic-link-interrupt"), {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      });
      expect(inst(after, link).exhausted).toBe(true);
      expect(inst(after, scheme).threat).toBe(1); // 5 - (2 printed THW + 2).
    });

    it("declining leaves only the printed THW removed", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withCard, id: link } = playFromHand(hero, "31011", 2);
      const { state: withScheme, id: scheme } = encounterCardInVillainArea(withCard, "01107", 5);
      const { state: after } = driveEventsPicking(WAVE5_DEPS, withScheme, firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      });
      expect(inst(after, link).exhausted).toBe(false);
      expect(inst(after, scheme).threat).toBe(3); // 5 - printed THW 2.
    });

    it("an already-exhausted Psychic Link is not offered (the printed THW alone still removes threat)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withCard, id: link } = playFromHand(hero, "31011", 2);
      const exhausted = patchInstance(withCard, link, { exhausted: true });
      const { state: withScheme, id: scheme } = encounterCardInVillainArea(exhausted, "01107", 5);
      const { state: after } = driveEventsPicking(WAVE5_DEPS, withScheme, firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      });
      expect(inst(after, scheme).threat).toBe(3); // unaffected — proves it was never on offer.
    });
  });

  describe("31012.speed-metal-alloy-interrupt", () => {
    it("accepted: exhausts, and SP//dr Suit gets +2 DEF for that defense (a lasting stat modifier until end of attack)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withAlloy, id: alloy } = playFromHand(hero, "31012", 1);
      const stacked = stackEncounterDeck(withAlloy, RHINO_NO_BOOST);
      const { state: after, events } = driveEventsPicking(
        WAVE5_DEPS,
        stacked,
        declaringIdentityDefender("31012.speed-metal-alloy-interrupt"),
        endTurn(P1),
      );
      expect(inst(after, alloy).exhausted).toBe(true);
      expect(lastingEffectsAdded(events)).toContainEqual(
        expect.objectContaining({
          kind: "statModifier",
          stat: "def",
          amount: { kind: "const", value: 2 },
          targets: [identity],
          duration: expect.objectContaining({ kind: "endOfEvent" }),
        }),
      );
    });

    it("declining: no lasting DEF boost, and Speed-Metal Alloy stays in play unexhausted", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withAlloy, id: alloy } = playFromHand(hero, "31012", 1);
      const stacked = stackEncounterDeck(withAlloy, RHINO_NO_BOOST);
      const { state: after, events } = driveEventsPicking(
        WAVE5_DEPS,
        stacked,
        declaringIdentityDefender(),
        endTurn(P1),
      );
      expect(inst(after, alloy).exhausted).toBe(false);
      expect(lastingEffectsAdded(events).some((e) => (e as { stat?: string }).stat === "def")).toBe(false);
    });
  });

  describe("31013.web-fluid-compressor-interrupt", () => {
    it("accepted: exhausts, and SP//dr Suit gets +2 ATK for that attack (a lasting stat modifier until end of attack)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withCompressor, id: compressor } = playFromHand(hero, "31013", 2);
      const withMinion = engagedMinion(withCompressor, HYDRA_MERCENARY, "compressor-target");
      const { state: after, events } = driveEventsPicking(
        WAVE5_DEPS,
        withMinion,
        accepting("31013.web-fluid-compressor-interrupt"),
        {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identity,
          targetInstanceId: "compressor-target" as InstanceId,
        },
      );
      expect(inst(after, compressor).exhausted).toBe(true);
      expect(lastingEffectsAdded(events)).toContainEqual(
        expect.objectContaining({
          kind: "statModifier",
          stat: "atk",
          amount: { kind: "const", value: 2 },
          targets: [identity],
          duration: expect.objectContaining({ kind: "endOfEvent" }),
        }),
      );
    });

    it("declining: no lasting ATK boost, and Web-Fluid Compressor stays in play unexhausted", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withCompressor, id: compressor } = playFromHand(hero, "31013", 2);
      const withMinion = engagedMinion(withCompressor, HYDRA_MERCENARY, "compressor-target-2");
      const { state: after, events } = driveEventsPicking(WAVE5_DEPS, withMinion, firstLegal, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: "compressor-target-2" as InstanceId,
      });
      expect(inst(after, compressor).exhausted).toBe(false);
      expect(lastingEffectsAdded(events).some((e) => (e as { stat?: string }).stat === "atk")).toBe(false);
    });

    it("Sync Ratio: exhausting Web-Fluid Compressor for it generates its own printed [energy] resource", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withCompressor, id: compressor } = playFromHand(hero, "31013", 2);
      const given = moveToHand(withCompressor, P1, "31023");
      const [stamina] = given.ids as [InstanceId];
      const sources = (
        paymentFor(given.state, P1, { kind: "playCard", instanceId: stamina }, {}, WAVE5_DEPS)?.sources ?? []
      ).filter(
        (s) =>
          s.kind === "resourceAbility" &&
          s.optionId.includes("31001a.sync-ratio") &&
          s.costChoices?.exhausted?.[0] === compressor,
      );
      expect(sources).toHaveLength(1);
      expect(sources[0]!.pool).toEqual({ energy: 1, mental: 0, physical: 0, wild: 0 });
    });
  });

  describe("31018.energy-barrier-interrupt", () => {
    it("is aliased to `msm` 05017 verbatim", () => {
      expect(SPDR_SUPPORT_UPGRADES["31018.energy-barrier-interrupt"]).toBe(
        MSM_PACK_CARDS["05017.energy-barrier-interrupt"],
      );
    });

    it("prevents 1 damage and deals 1 to the villain, consuming a reflection counter", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withBarrier, id: barrier } = playFromHand(hero, "31018", 2);
      expect(inst(withBarrier, barrier).counters.reflection).toBe(3);
      const stacked = stackEncounterDeck(withBarrier, RHINO_NO_BOOST);
      const villain = stacked.villains[0]!.instanceId;
      const villainDamageBefore = inst(stacked, villain).damage;
      const damageBefore = inst(stacked, identity).damage;
      const after = settle(
        runWave5(stacked, endTurn(P1)),
        accepting("31018.energy-barrier-interrupt"),
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, identity).damage).toBe(damageBefore + 1); // Rhino's undefended ATK 2 - 1 prevented.
      expect(inst(after, villain).damage).toBe(villainDamageBefore + 1);
      expect(inst(after, barrier).counters.reflection).toBe(2);
    });
  });

  describe("31019.forcefield-generator-forced-interrupt", () => {
    it("forced: removes energy counters equal to the incoming damage (well under 6), preventing it entirely", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withGen, id: gen } = playFromHand(hero, "31019", 3);
      expect(inst(withGen, gen).counters.energy).toBe(6);
      const stacked = stackEncounterDeck(withGen, RHINO_NO_BOOST);
      const damageBefore = inst(stacked, identity).damage;
      const after = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      expect(inst(after, identity).damage).toBe(damageBefore); // fully prevented — Rhino's undefended ATK (2) < 6.
      expect(inst(after, gen).counters.energy).toBe(4); // 6 - 2.
    });

    it("with fewer counters than the incoming damage, only that many are removed and only that much prevented", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withGen, id: gen } = playFromHand(hero, "31019", 3);
      const low = patchInstance(withGen, gen, { counters: { energy: 1 } });
      const stacked = stackEncounterDeck(low, RHINO_NO_BOOST);
      const damageBefore = inst(stacked, identity).damage;
      const after = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      expect(inst(after, gen).counters.energy ?? 0).toBe(0);
      expect(inst(after, identity).damage).toBe(damageBefore + 1); // Rhino ATK 2 - 1 prevented = 1 taken.
    });
  });

  describe("31020.spider-tingle-interrupt", () => {
    it("accepted on a treachery reveal: costs 1 damage to a Web-Warrior character, cancels the When Revealed, and discards itself", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withCard, id: tingle } = playFromHand(hero, "31020", 1);
      // SP//dr Suit's own hero face carries the Web-Warrior trait (`identity.ts`'s own card data), so it alone pays
      // Spider-Tingle's cost with no separate target choice. Energy Drain (31028) is SP//dr's own nemesis
      // treachery, staged the same way `obligation-nemesis.test.ts` already reveals it. The same villain phase
      // also runs Rhino's own undefended attack first (it always engages the lone player), so — like
      // `obligation-nemesis.test.ts`'s own Energy Drain tests — this reads the damage *this card's own instance
      // dealt* off `damageDealt.sourceInstanceId`, not a raw before/after total, which Rhino's attack would also move.
      const staged = stageNemesisCardForReveal(withCard, "31028", P1);
      const { state: after, events } = driveEventsPicking(
        WAVE5_DEPS,
        staged,
        accepting("31020.spider-tingle-interrupt"),
        endTurn(P1),
      );
      // Only Spider-Tingle's own cost damage landed — Energy Drain's own "When Revealed (Hero)" (spend [E][E] or
      // take 3 damage) never fired, cancelled before it could ask.
      expect(dealtBy(events, tingle)).toBe(1);
      expect(events).toContainEqual(expect.objectContaining({ type: "revealCancelled", scope: "whenRevealed" }));
      expect(cardsInPlay(after)).not.toContain(tingle);
      expect(playerOf(after, P1).discard).toContain(tingle);
    });

    it("declining: Spider-Tingle is never paid, and stays in play", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withCard, id: tingle } = playFromHand(hero, "31020", 1);
      const staged = stageNemesisCardForReveal(withCard, "31028", P1);
      const { state: after, events } = driveEventsPicking(WAVE5_DEPS, staged, firstLegal, endTurn(P1));
      expect(dealtBy(events, tingle)).toBe(0);
      expect(events.some((e) => e.type === "revealCancelled")).toBe(false);
      expect(cardsInPlay(after)).toContain(tingle);
      expect(playerOf(after, P1).discard).not.toContain(tingle);
    });

    it("accepted on a non-treachery reveal: costs the damage but doesn't cancel anything or discard itself", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: withCard, id: tingle } = playFromHand(hero, "31020", 1);
      // RHINO_NO_BOOST goes first — Rhino's own attack draws its own boost card *before* the villain phase's
      // main "reveal encounter card" step (`obligation-nemesis.test.ts`'s own `ADVANCE`/`stackEncounterDeck`
      // precedent), so it has to be soaked up first for the minion to be what's actually revealed.
      const stacked = stackEncounterDeck(withCard, RHINO_NO_BOOST, HYDRA_MERCENARY); // a minion, not a treachery.
      const { state: after, events } = driveEventsPicking(
        WAVE5_DEPS,
        stacked,
        accepting("31020.spider-tingle-interrupt"),
        endTurn(P1),
      );
      expect(dealtBy(events, tingle)).toBe(1);
      expect(events.some((e) => e.type === "revealCancelled")).toBe(false);
      expect(cardsInPlay(after)).toContain(tingle);
      expect(playerOf(after, P1).discard).not.toContain(tingle);
    });
  });

  describe("31024.unshakable", () => {
    it("31024.unshakable-constant-2: your identity gains steady", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state } = playFromHand(hero, "31024", 1);
      const identity = identityOf(state, P1);
      expect(hasKeyword(state, identity, "steady", WAVE5_DEPS)).toBe(true);
    });

    // SP//dr Suit's own printed hit points (14, `identity.ts`'s own card data) always satisfy "at least 14" — the
    // false branch (a different, lower-HP identity) is out of scope for this card's own test file; playing it
    // successfully here already proves the true branch doesn't block it.
    it("31024.unshakable-constant: is playable, since SP//dr Suit's printed 14 HP meets the restriction", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state, id: unshakable } = playFromHand(hero, "31024", 1);
      expect(cardsInPlay(state)).toContain(unshakable);
    });
  });

  describe("31029.clarity-of-purpose-resource", () => {
    // Not in SP//dr's own precon (`spdr-protection`) — `spdrScenarioWithExtras` adds it and drops deck-legality
    // checking, `spiderham/support-upgrades.test.ts`'s own Warrior of the Great Web precedent.
    const spdrWithClarityInDeck = (seed = 1) => spdrVsRhinoWithExtras(["31029"], seed);

    it("exhausts, deals 1 damage to the attached character, and generates a [wild] resource", () => {
      const hero = runWave5(spdrWithClarityInDeck(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withClarity, id: clarity } = playAttachedTo(hero, "31029", 1, identity);
      expect(inst(withClarity, clarity).attachedTo).toBe(identity);
      const damageBefore = inst(withClarity, identity).damage;
      // Limitless Stamina (31023, cost 1): "Hero Action: Ready your hero" — an *event*, so paying for it with
      // Clarity's own generated resource (rather than checking `cardsInPlay`, which never holds a resolved event)
      // is proven by its own effect landing: the identity, pre-exhausted here, ready again once it resolves.
      const exhaustedIdentity = patchInstance(withClarity, identity, { exhausted: true });
      const given = moveToHand(exhaustedIdentity, P1, "31023");
      const [stamina] = given.ids as [InstanceId];
      const after = settle(
        runWave5(
          given.state,
          play(P1, stamina, [], { abilities: [resourceAbility(clarity, "31029.clarity-of-purpose-resource")] }),
        ),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(playerOf(after, P1).discard).toContain(stamina);
      expect(inst(after, identity).exhausted).toBe(false);
      expect(inst(after, clarity).exhausted).toBe(true);
      expect(inst(after, identity).damage).toBe(damageBefore + 1);
    });

    it("an already-exhausted Clarity of Purpose cannot pay", () => {
      const hero = runWave5(spdrWithClarityInDeck(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withClarity, id: clarity } = playAttachedTo(hero, "31029", 1, identity);
      const exhausted = patchInstance(withClarity, clarity, { exhausted: true });
      const given = moveToHand(exhausted, P1, "31023");
      const [stamina] = given.ids as [InstanceId];
      expect(
        refused(
          given.state,
          play(P1, stamina, [], { abilities: [resourceAbility(clarity, "31029.clarity-of-purpose-resource")] }),
        ),
      ).toBeTruthy();
    });
  });
});
