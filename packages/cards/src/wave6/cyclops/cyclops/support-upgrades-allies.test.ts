import { cardId, trait } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  allyLimitFor,
  createGame,
  characterProfile,
  legalActions,
  traitsOf,
  type GameState,
  type InstanceId,
  type Payment,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  P3,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  type Picker,
  use,
} from "../../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { CYCLOPS_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { cyclopsGame } from "./support.js";

const REFS = [
  "33002.phoenix-response",
  "33003.ruby-quartz-visor-resource",
  "33004.field-commander-constant",
  "33004.field-commander-constant-2",
  "33005.exploit-weakness-constant",
  "33006.practiced-defense-constant",
  "33007.priority-target-interrupt",
  "33011.beast-response",
  "33012.dust-interrupt",
  "33014.blindfold-response",
  "33015.danger-room-training-constant",
  "33019.angel-constant",
  "33020.utopia-constant",
  "33020.utopia-response",
  "33021.danger-room-response",
  "33032.marked-constant",
  "33033.befuddle-interrupt",
  "33034.pinned-down-constant",
  "33035.honorary-x-men-constant",
];

const X_MEN = trait("X-MEN");
const alterEgo = (scenario = "rhino"): GameState => stocked(cyclopsGame(scenario));
const hero = (scenario = "rhino"): GameState => withForm(alterEgo(scenario), { heroForm: 0 });
const heroId = (state: GameState) => identityOf(state, P1);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const villainId = (state: GameState) => activeVillain(state).instanceId;
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;

/** Takes the card out of whichever zone holds it and attaches it to `host` by surgery (no play, no cost). */
function attachFromHand(
  state: GameState,
  code: string,
  host: InstanceId,
  player = P1,
): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, player, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

/** Makes the last card of P1's deck another card, so a card outside his precon (Marked, say) can be had. */
const withCard = (state: GameState, code: string): GameState => {
  const last = playerOf(state, P1).deck.at(-1)!;
  return swapCard(state, last, code);
};

/** Makes an instance another card by surgery (a non-X-MEN ally, say), keeping its zone. */
const swapCard = (state: GameState, id: InstanceId, code: string): GameState => {
  if (!state.cardPool[cardId(code)]) throw new Error(`${code} is not in the card pool`);
  return patchInstance(state, id, { cardId: cardId(code) });
};

/** Hero-form Cyclops with a Hydra Mercenary (a minion, 01101) engaged with him. */
function withMinion(base: GameState = hero()): { state: GameState; minion: InstanceId } {
  const { state, id } = engageMinion(base, "01101", P1);
  return { state, minion: id };
}

/**
 * Picks the offered options that match one of `wanted`: an ability id (contains a dot) by substring, a card code by the
 * card's code, anything else (an instance id) exactly; declines or defaults the rest. Records each pick in `log`.
 */
const picks =
  (log: string[], ...wanted: readonly string[]): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    const hits = options
      .filter((o) =>
        wanted.some((w) =>
          w.includes(".") ? o.optionId.includes(w) : o.optionId === w || state.instances[o.optionId]?.cardId === w,
        ),
      )
      .map((o) => o.optionId);
    if (hits.length > 0) {
      log.push(...hits);
      return hits.slice(0, state.pendingChoice?.maxSelections ?? 1);
    }
    return firstLegal(state);
  };

/** The option ids of every prompt shown while a picker drives (to assert what was, and was not, offered). */
const recording =
  (seen: string[][], inner: Picker): Picker =>
  (state) => {
    if (state.pendingChoice?.prompt.kind !== "chooseTriggers")
      seen.push(state.pendingChoice?.options.map((o) => o.optionId) ?? []);
    return inner(state);
  };

/** Gives P1's hand `n` more cards from the deck so cards of any cost can be paid for. */
function stocked(state: GameState, n = 6): GameState {
  const owner = playerOf(state, P1);
  const take = owner.deck.slice(0, n);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(n) } : p,
    ),
  };
}

/** Whether playing `card` attached to `host` is a legal target of a legal play (`targets`; the payment is ignored). */
const canAttach = (state: GameState, card: InstanceId, host: InstanceId, player = P1): boolean => {
  const actions = legalActions(state, player, WAVE6_DEPS);
  if (actions.kind !== "turn") return false;
  return actions.legal.some(
    (a) => a.action.kind === "playCard" && a.action.instanceId === card && (a.targets ?? []).includes(host),
  );
};

describe("Cyclops supports, upgrades and allies", () => {
  it("registers exactly the refs the card data names for them, all valid", () => {
    expect(Object.keys(CYCLOPS_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(CYCLOPS_SUPPORT_UPGRADES_ALLIES)) {
      expect(validateDefinition(definition)).toEqual([]);
    }
  });

  describe("Exploit Weakness (33005)", () => {
    it("adds 1 to the damage an attack deals the attached minion, and only that minion", () => {
      const { state: base, minion } = withMinion();
      const { state: other, id: second } = engageMinion(base, "01101", P1);
      const { state: armed } = attachFromHand(other, "33005", minion);
      const attackOn = (target: InstanceId) =>
        runWith(WAVE6_DEPS, armed, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: heroId(armed),
          targetInstanceId: target,
        });
      const atk = profile(armed, heroId(armed)).atk;
      expect(inst(settle(attackOn(minion), firstLegal, undefined, WAVE6_DEPS), minion).damage).toBe(atk + 1);
      expect(inst(settle(attackOn(second), firstLegal, undefined, WAVE6_DEPS), second).damage).toBe(atk);
    });

    it("is attached on play to an enemy, at most 1 per enemy, and discarded as the round ends (Temporary)", () => {
      const { state: base, minion } = withMinion();
      const { state: staged, ids } = moveToHand(base, P1, "33005", "33005");
      const [first, second] = ids as [InstanceId, InstanceId];
      const paid = payWith(staged, P1, 1, [first, second]);
      const afterFirst = settle(
        runWith(WAVE6_DEPS, staged, play(P1, first, paid, { attachToInstanceId: minion })),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(afterFirst, first).attachedTo).toBe(minion);
      // Max 1 per enemy: the second copy is no longer offered for this minion.
      expect(canAttach(staged, second, minion)).toBe(true);
      expect(canAttach(afterFirst, second, minion)).toBe(false);
      // Temporary: round's end.
      const ended = settle(
        runWith(WAVE6_DEPS, afterFirst, endTurn(P1)),
        firstLegal,
        (s) => s.round === 2 && s.step.phase === "player",
        WAVE6_DEPS,
      );
      expect(playerOf(ended, P1).discard).toContain(first);
      expect(inst(ended, minion).attachments).not.toContain(first);
    });
  });

  describe("Practiced Defense (33006)", () => {
    it("the attached enemy gets -1 ATK, and no other enemy does", () => {
      const { state: base, minion } = withMinion();
      const { state: both, id: second } = engageMinion(base, "01101", P1);
      const { state: armed } = attachFromHand(both, "33006", minion);
      expect(profile(armed, minion).atk).toBe(profile(both, minion).atk - 1);
      expect(profile(armed, second).atk).toBe(profile(both, second).atk);
      const { state: onVillain } = attachFromHand(both, "33006", villainId(both));
      expect(profile(onVillain, villainId(both)).atk).toBe(profile(both, villainId(both)).atk - 1);
    });
  });

  describe("Priority Target (33007)", () => {
    /** A basic attack on a minion that already holds 99 damage, so any hit defeats it. */
    const killShot = (state: GameState, target: InstanceId, attacker = P1) =>
      ({
        type: "basicAttack",
        playerId: attacker,
        attackerInstanceId: identityOf(state, attacker),
        targetInstanceId: target,
      }) as const;

    it("the player who defeated the attached enemy draws 2 cards", () => {
      const { state: base, minion } = withMinion();
      const { state: armed } = attachFromHand(base, "33007", minion);
      const log: string[] = [];
      const before = playerOf(armed, P1).hand.length;
      const hit = patchInstance(armed, minion, { damage: 99 });
      const { state: after } = driveEventsPicking(
        WAVE6_DEPS,
        hit,
        picks(log, "33007.priority-target-interrupt"),
        killShot(hit, minion),
      );
      expect(log.filter((id) => id.includes("33007.priority-target-interrupt"))).toHaveLength(1);
      expect(playerOf(after, P1).hand.length).toBe(before + 2);
      // Priority Target left play with its host.
      expect(playerOf(after, P1).discard.some((id) => codeOf(after, id) === "33007")).toBe(true);
    });

    it("a different player who defeats it draws instead of its controller", () => {
      const two = withForm(
        settle(createTwoPlayer(), firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS),
        { heroForm: 0 },
        P2,
      );
      const { state: engaged, id: minion } = engageMinion(two, "01101", P2);
      const { state: armed } = attachFromHand(engaged, "33007", minion);
      const hit = patchInstance(armed, minion, { damage: 99 });
      const log: string[] = [];
      const p1Before = playerOf(hit, P1).hand.length;
      const p2Before = playerOf(hit, P2).hand.length;
      const { state: after } = driveEventsPicking(
        WAVE6_DEPS,
        hit,
        picks(log, "33007.priority-target-interrupt"),
        endTurn(P1),
        killShot(hit, minion, P2),
      );
      expect(log.filter((id) => id.includes("33007.priority-target-interrupt"))).toHaveLength(1);
      expect(playerOf(after, P2).hand.length).toBe(p2Before + 2);
      expect(playerOf(after, P1).hand.length).toBe(p1Before);
    });
  });

  describe("Ruby Quartz Visor (33003)", () => {
    const VISOR = "33003.ruby-quartz-visor-resource";
    /** Hero Cyclops wearing the Visor, the villain tough and carrying Practiced Defense (an upgrade, so Optic Blast can
     * target it, and no damage bonus). */
    function armed(): { state: GameState; visor: InstanceId; villain: InstanceId } {
      const base = hero();
      const villain = villainId(base);
      const { state: worn, id: visor } = attachFromHand(base, "33003", heroId(base));
      const { state: marked } = attachFromHand(worn, "33006", villain);
      return {
        state: patchInstance(marked, villain, { statuses: { ...inst(marked, villain).statuses, tough: 1 } }),
        visor,
        villain,
      };
    }
    const viaVisor = (visor: InstanceId): Payment[] => [{ ability: { instanceId: visor, abilityId: VISOR as never } }];

    it("pays for Optic Blast, which gains piercing (the tough card is discarded and the 3 damage dealt)", () => {
      const { state, visor, villain } = armed();
      const after = settle(
        runWith(WAVE6_DEPS, state, use(P1, heroId(state), "33001a.cyclops-constant", viaVisor(visor))),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, visor).exhausted).toBe(true);
      expect(inst(after, villain).statuses.tough).toBe(0);
      expect(inst(after, villain).damage).toBe(3);
    });

    it("touches only that attack: a basic attack later that turn is stopped by a tough card", () => {
      const { state, visor, villain } = armed();
      const blasted = settle(
        runWith(WAVE6_DEPS, state, use(P1, heroId(state), "33001a.cyclops-constant", viaVisor(visor))),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const toughAgain = patchInstance(blasted, villain, {
        statuses: { ...inst(blasted, villain).statuses, tough: 1 },
      });
      const after = settle(
        runWith(WAVE6_DEPS, toughAgain, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: heroId(toughAgain),
          targetInstanceId: villain,
        }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, villain).statuses.tough).toBe(0);
      expect(inst(after, villain).damage).toBe(3);
    });

    it("generates for nothing but Cyclops's ability: it cannot pay for a card", () => {
      const { state, visor, villain } = armed();
      const { state: staged, ids } = moveToHand(state, P1, "33005");
      expect(() =>
        runWith(WAVE6_DEPS, staged, {
          type: "playCard",
          playerId: P1,
          cardInstanceId: ids[0]!,
          payment: viaVisor(visor),
          attachToInstanceId: villain,
        }),
      ).toThrow(/rejected/);
    });
  });

  describe("Dust (33012)", () => {
    /** Dust in play under P1 (hero form), two Hydra Mercenaries engaged with him. */
    function dustOut(): { state: GameState; dust: InstanceId; first: InstanceId; second: InstanceId } {
      const { state: played, id: dust } = playFromHand(WAVE6_DEPS, hero(), "33012", 3);
      const { state: one, id: first } = engageMinion(played, "01101", P1);
      const { state, id: second } = engageMinion(one, "01101", P1);
      return { state, dust, first, second };
    }
    const dustAttacks = (state: GameState, dust: InstanceId, target: InstanceId, pick: Picker) =>
      settle(
        runWith(WAVE6_DEPS, state, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: dust,
          targetInstanceId: target,
        }),
        pick,
        undefined,
        WAVE6_DEPS,
      );

    it("when Dust attacks a minion, she attacks each minion in play and takes +1 consequential damage after this attack", () => {
      const { state, dust, first, second } = dustOut();
      const log: string[] = [];
      const after = dustAttacks(state, dust, first, picks(log, "33012.dust-interrupt"));
      expect(log.filter((id) => id.includes("33012.dust-interrupt"))).toHaveLength(1);
      expect(inst(after, first).damage).toBe(1);
      expect(inst(after, second).damage).toBe(1);
      // One attack: its printed 1 consequential damage, +1.
      expect(inst(after, dust).damage).toBe(2);
    });

    it("declined, she attacks only the minion she chose and takes her printed 1 consequential damage", () => {
      const { state, dust, first, second } = dustOut();
      const after = dustAttacks(state, dust, first, () => []);
      expect(inst(after, first).damage).toBe(1);
      expect(inst(after, second).damage).toBe(0);
      expect(inst(after, dust).damage).toBe(1);
    });

    it("is not offered when she attacks the villain, nor does it change her consequential damage after", () => {
      const base = playFromHand(WAVE6_DEPS, hero(), "33012", 3);
      const offered: string[] = [];
      const after = dustAttacks(base.state, base.id, villainId(base.state), (s) => {
        offered.push(...(s.pendingChoice?.options ?? []).map((o) => o.optionId));
        return picks([], "33012.dust-interrupt")(s);
      });
      expect(offered.some((id) => id.includes("33012.dust-interrupt"))).toBe(false);
      expect(inst(after, villainId(after)).damage).toBe(1);
      expect(inst(after, base.id).damage).toBe(1);
    });
  });

  describe("Field Commander (33004)", () => {
    it("its player takes the first turn of the next player phase (Q16): player 3 goes before 2, then 1", () => {
      const created = createGame(
        wave6Scenario("rhino", {
          seed: 1,
          players: [
            { starterDeckId: "colossus-protection" },
            { starterDeckId: "core-captain-marvel-leadership" },
            { starterDeckId: "cyclops-leadership" },
          ],
        }),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const start = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      const nextRound = (state: GameState) =>
        settle(
          runWith(WAVE6_DEPS, state, endTurn(P1), endTurn(P2), endTurn(P3)),
          firstLegal,
          (s) => s.round === 2 && s.step.phase === "player",
          WAVE6_DEPS,
        );
      // Without it round 2 starts with the new first player, p2.
      expect(nextRound(start).step).toMatchObject({ activePlayerId: P2, remainingPlayerIds: [P3, P1] });
      const { state: armed } = attachFromHand(start, "33004", identityOf(start, P3), P3);
      expect(nextRound(armed).step).toMatchObject({ activePlayerId: P3, remainingPlayerIds: [P2, P1] });
    });

    it("each Cyclops upgrade attached to a minion loses temporary, one attached to the villain does not", () => {
      const { state: base, minion } = withMinion();
      const { state: onMinion, id: weakness } = attachFromHand(base, "33005", minion);
      const { state: both, id: defense } = attachFromHand(onMinion, "33006", villainId(base));
      const { state: armed } = attachFromHand(both, "33004", heroId(both));
      const ended = settle(
        runWith(WAVE6_DEPS, armed, endTurn(P1)),
        firstLegal,
        (s) => s.round === 2 && s.step.phase === "player",
        WAVE6_DEPS,
      );
      // The villain's Temporary upgrade is discarded as the round ends; the minion's stays.
      expect(inst(ended, minion).attachments).toContain(weakness);
      expect(inst(ended, villainId(base)).attachments).not.toContain(defense);
      expect(playerOf(ended, P1).discard).toContain(defense);
      // Control: with no Field Commander the minion's Temporary upgrade goes too.
      const control = settle(
        runWith(WAVE6_DEPS, both, endTurn(P1)),
        firstLegal,
        (s) => s.round === 2 && s.step.phase === "player",
        WAVE6_DEPS,
      );
      expect(inst(control, minion).attachments).not.toContain(weakness);
      expect(playerOf(control, P1).discard).toContain(weakness);
    });
  });

  describe("Phoenix (33002)", () => {
    it("Response: after she enters play, a Cyclops card from the discard pile goes to hand (other cards are not offered)", () => {
      const base = hero();
      const { state: a, id: blast } = moveToDiscard(base, P1, "33008");
      const { state: b, id: teamwork } = moveToDiscard(a, P1, "33017");
      const seen: string[][] = [];
      const log: string[] = [];
      const { state: after, id: phoenix } = playFromHand(
        WAVE6_DEPS,
        b,
        "33002",
        3,
        recording(seen, picks(log, "33002.phoenix-response", blast)),
      );
      expect(playerOf(after, P1).playArea).toContain(phoenix);
      expect(playerOf(after, P1).hand).toContain(blast);
      expect(playerOf(after, P1).discard).not.toContain(blast);
      expect(playerOf(after, P1).discard).toContain(teamwork);
      // Teamwork (a Leadership card) was never a choice; Full Blast (a Cyclops card) was.
      expect(seen.flat()).toContain(blast);
      expect(seen.flat()).not.toContain(teamwork);
    });
  });

  describe("Beast (33011)", () => {
    it("Response: after he enters play, a resource card from the deck or discard pile goes to hand and the deck is shuffled", () => {
      const base = hero();
      const { state: staged, id: strength } = moveToDiscard(base, P1, "33026");
      const seen: string[][] = [];
      const log: string[] = [];
      const deckBefore = playerOf(staged, P1).deck;
      const { state: after } = playFromHand(
        WAVE6_DEPS,
        staged,
        "33011",
        4,
        recording(seen, picks(log, "33011.beast-response", strength)),
      );
      expect(playerOf(after, P1).hand).toContain(strength);
      expect(playerOf(after, P1).discard).not.toContain(strength);
      // Only resource cards were choices (the deck and the discard pile are both searched).
      for (const option of seen.flat())
        expect(staged.cardPool[staged.instances[option]!.cardId]!.type).toBe("resource");
      expect(seen.flat().length).toBeGreaterThan(1);
      expect(playerOf(after, P1).deck.length).toBe(deckBefore.length - 1 + 0);
    });
  });

  describe("Blindfold (33014)", () => {
    it("Response: of the top 5 encounter cards, 1 chosen is discarded and the other 4 go back in the same order", () => {
      const base = hero();
      const before = activeEncounterDeck(base).deck;
      const [c1, c2, c3, c4, c5, ...rest] = before;
      const seen: string[][] = [];
      const log: string[] = [];
      const { state: after } = playFromHand(
        WAVE6_DEPS,
        base,
        "33014",
        3,
        recording(seen, picks(log, "33014.blindfold-response", c3!)),
      );
      const encounter = activeEncounterDeck(after);
      expect(encounter.deck).toEqual([c1, c2, c4, c5, ...rest]);
      expect(encounter.discard).toContain(c3);
      // Exactly the top 5 were shown.
      expect(seen.flat().filter((id) => [c1, c2, c3, c4, c5].includes(id as InstanceId))).toHaveLength(5);
      expect(seen.flat().includes(rest[0]!)).toBe(false);
    });
  });

  describe("Danger Room Training (33015)", () => {
    it("the attached X-MEN ally gets +1 THW, +1 ATK and +1 hit point; a second TRAINING upgrade cannot be attached to it", () => {
      const { state: withAlly, id: rockslide } = playFromHand(WAVE6_DEPS, hero(), "33013", 4);
      const before = profile(withAlly, rockslide);
      const { state: staged, ids } = moveToHand(withAlly, P1, "33015", "33015");
      const [first, second] = ids as [InstanceId, InstanceId];
      expect(canAttach(staged, first, rockslide)).toBe(true);
      const after = settle(
        runWith(
          WAVE6_DEPS,
          staged,
          play(P1, first, payWith(staged, P1, 1, [first, second]), { attachToInstanceId: rockslide }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const now = profile(after, rockslide);
      expect([now.thw, now.atk, now.maxHp]).toEqual([before.thw + 1, before.atk + 1, before.maxHp + 1]);
      expect(profile(after, heroId(after)).thw).toBe(profile(withAlly, heroId(withAlly)).thw);
      // Max 1 TRAINING upgrade per ally (RRG 1.8 p. 28): not this ally again, but another X-MEN ally.
      expect(canAttach(after, second, rockslide)).toBe(false);
      const { state: another, id: dust } = playFromHand(WAVE6_DEPS, after, "33012", 3);
      expect(canAttach(another, second, dust)).toBe(true);
    });
  });

  describe("Angel (33019)", () => {
    it("costs 1 less for an identity with MUTANT or X-MEN (Scott Summers and Cyclops), so 2 resources play him", () => {
      for (const state of [alterEgo(), hero()]) {
        const { state: after, id } = playFromHand(WAVE6_DEPS, state, "33019", 2);
        expect(playerOf(after, P1).playArea).toContain(id);
      }
    });

    it("is not discounted below that: paying 1 does not play him", () => {
      expect(() => playFromHand(WAVE6_DEPS, hero(), "33019", 1)).toThrow();
    });
  });

  describe("Rockslide (33013)", () => {
    it("has no ability of its own: Retaliate 1 is printed card data", () => {
      const card = hero().cardPool[cardId("33013")]!;
      expect(card).toMatchObject({ keywords: [{ name: "retaliate", value: 1 }], abilities: [] });
    });
  });

  describe("Utopia (33020)", () => {
    it("increases the ally limit by 1 while each of your allies is X-MEN, not otherwise", () => {
      const { state: withUtopia } = playFromHand(WAVE6_DEPS, hero(), "33020", 2);
      expect(allyLimitFor(hero(), WAVE6_DEPS, P1)).toBe(3);
      expect(allyLimitFor(withUtopia, WAVE6_DEPS, P1)).toBe(4);
      const { state: withAlly } = playFromHand(WAVE6_DEPS, withUtopia, "33013", 4);
      expect(allyLimitFor(withAlly, WAVE6_DEPS, P1)).toBe(4);
      // An ally without the X-MEN trait (Nick Fury's card in Angel's place) turns it off.
      const nonXMen = swapCard(
        withAlly,
        playerOf(withAlly, P1).playArea.find((id) => codeOf(withAlly, id) === "33013")!,
        "01084",
      );
      expect(allyLimitFor(nonXMen, WAVE6_DEPS, P1)).toBe(3);
    });

    it("Response: after an X-MEN ally enters play, exhaust Utopia to ready an X-MEN character", () => {
      const { state: withUtopia, id: utopia } = playFromHand(WAVE6_DEPS, hero(), "33020", 2);
      const tired = patchInstance(withUtopia, heroId(withUtopia), { exhausted: true });
      const log: string[] = [];
      const { state: after } = playFromHand(
        WAVE6_DEPS,
        tired,
        "33013",
        4,
        picks(log, "33020.utopia-response", heroId(tired)),
      );
      expect(log.some((id) => id.includes("33020.utopia-response"))).toBe(true);
      expect(inst(after, utopia).exhausted).toBe(true);
      expect(inst(after, heroId(after)).exhausted).toBe(false);
    });
  });

  describe("Danger Room (33021)", () => {
    it("Alter-Ego Response: after an X-MEN ally enters play, exhaust it to attach a TRAINING upgrade from the deck or discard pile", () => {
      const { state: withRoom, id: room } = playFromHand(WAVE6_DEPS, alterEgo(), "33021", 2);
      const log: string[] = [];
      const { state: after, id: rockslide } = playFromHand(
        WAVE6_DEPS,
        withRoom,
        "33013",
        4,
        picks(log, "33021.danger-room-response", "33015"),
      );
      expect(inst(after, room).exhausted).toBe(true);
      const attached = inst(after, rockslide).attachments.map((id) => codeOf(after, id));
      expect(attached).toEqual(["33015"]);
      // Danger Room Training's own +1 ATK on Rockslide's printed 3.
      expect(profile(after, rockslide).atk).toBe(4);
    });

    it("is an Alter-Ego Response: not offered to its controller in hero form", () => {
      const { state: withRoom, id: room } = playFromHand(WAVE6_DEPS, alterEgo(), "33021", 2);
      const log: string[] = [];
      const { state: after, id: rockslide } = playFromHand(
        WAVE6_DEPS,
        withForm(withRoom, { heroForm: 0 }),
        "33013",
        4,
        picks(log, "33021.danger-room-response", "33015"),
      );
      expect(log).toEqual([]);
      expect(inst(after, room).exhausted).toBe(false);
      expect(inst(after, rockslide).attachments).toEqual([]);
    });

    it.each([
      ["colossus-protection", true],
      ["core-captain-marvel-leadership", false],
    ])("any player whose alter-ego is MUTANT may trigger it: %s -> %s", (starterDeckId, offeredToThem) => {
      const created = createGame(
        wave6Scenario("rhino", {
          seed: 1,
          players: [{ starterDeckId: "cyclops-leadership" }, { starterDeckId }],
        }),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const start = stocked(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
      // Cyclops (P1) is in hero form, so only the other player's alter-ego could use Danger Room.
      const { state: withRoom, id: room } = playFromHand(WAVE6_DEPS, withForm(start, { heroForm: 0 }), "33021", 2);
      const log: string[] = [];
      const { state: after } = playFromHand(WAVE6_DEPS, withRoom, "33013", 4, picks(log, "33021.danger-room-response"));
      expect(log.length > 0).toBe(offeredToThem);
      expect(inst(after, room).exhausted).toBe(offeredToThem);
    });
  });

  describe("Marked (33032)", () => {
    const killWithOverkill = (marked: boolean) => {
      const { state: base, minion } = withMinion();
      const { state: both, id: other } = engageMinion(base, "01101", P1);
      const { state: a } = attachFromHand(both, "33005", minion);
      const { state: b } = attachFromHand(a, "33005", other);
      const { state: armed } = marked ? attachFromHand(withCard(b, "33032"), "33032", minion) : { state: b };
      const target = marked ? minion : other;
      const hp = profile(armed, target).maxHp;
      const staged = patchInstance(armed, target, { damage: hp - 1 });
      const villain = villainId(staged);
      const after = settle(
        runWith(WAVE6_DEPS, staged, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: heroId(staged),
          targetInstanceId: target,
        }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      return { villainDamage: inst(after, villain).damage };
    };

    it("an attack against the attached minion gains overkill: the excess goes to the villain", () => {
      expect(killWithOverkill(true).villainDamage).toBe(1);
    });

    it("an attack against another minion (same excess) does not", () => {
      expect(killWithOverkill(false).villainDamage).toBe(0);
    });
  });

  describe("Befuddle (33033)", () => {
    const attackBy = (state: GameState, target: InstanceId, log: string[]) =>
      driveEventsPicking(WAVE6_DEPS, state, picks(log, "33033.befuddle-interrupt"), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: heroId(state),
        targetInstanceId: target,
      });

    it("a basic attack against the attached minion deals the attacker's THW instead of its ATK", () => {
      const { state: base, minion } = withMinion();
      const { state: armed } = attachFromHand(withCard(base, "33033"), "33033", minion);
      const p = profile(armed, heroId(armed));
      expect(p.thw).not.toBe(p.atk);
      const log: string[] = [];
      const { state: after } = attackBy(armed, minion, log);
      expect(log.length).toBe(1);
      expect(inst(after, minion).damage).toBe(p.thw);
    });

    it("an attack on another minion is unchanged", () => {
      const { state: base, minion } = withMinion();
      const { state: both, id: other } = engageMinion(base, "01101", P1);
      const { state: armed } = attachFromHand(withCard(both, "33033"), "33033", minion);
      const log: string[] = [];
      const { state: after } = attackBy(armed, other, log);
      expect(log).toEqual([]);
      expect(inst(after, other).damage).toBe(profile(armed, heroId(armed)).atk);
    });
  });

  describe("Pinned Down (33034)", () => {
    it("the attached minion gets -2 ATK, and no other enemy does", () => {
      const { state: base, minion } = withMinion();
      const { state: both, id: second } = engageMinion(base, "01101", P1);
      const { state: armed } = attachFromHand(withCard(both, "33034"), "33034", minion);
      expect(profile(armed, minion).atk).toBe(Math.max(0, profile(both, minion).atk - 2));
      expect(profile(armed, second).atk).toBe(profile(both, second).atk);
    });
  });

  describe("Honorary X-Men (33035)", () => {
    it("the attached character gets +1 hit point and gains the X-MEN trait (an ally without it, here)", () => {
      const { state: withAlly, id: ally } = playFromHand(WAVE6_DEPS, hero(), "33019", 2);
      const plain = swapCard(withAlly, ally, "01084");
      expect(traitsOf(plain, ally, WAVE6_DEPS)).not.toContain(X_MEN);
      const { state: armed } = attachFromHand(withCard(plain, "33035"), "33035", ally);
      expect(traitsOf(armed, ally, WAVE6_DEPS)).toContain(X_MEN);
      expect(profile(armed, ally).maxHp).toBe(profile(plain, ally).maxHp + 1);
    });

    it("can only be played if your identity has X-MEN: Cyclops yes, Scott Summers no", () => {
      const playable = (state: GameState) => {
        const { state: staged, ids } = moveToHand(withCard(state, "33035"), P1, "33035");
        return canAttach(staged, ids[0]!, heroId(staged));
      };
      expect(playable(hero())).toBe(true);
      expect(playable(alterEgo())).toBe(false);
    });
  });
});

/** Cyclops (P1) and Captain Marvel (P2), at their first player turn. */
function createTwoPlayer(): GameState {
  const created = createGame(
    wave6Scenario("rhino", {
      seed: 1,
      players: [{ starterDeckId: "cyclops-leadership" }, { starterDeckId: "core-captain-marvel-leadership" }],
    }),
    WAVE6_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}
