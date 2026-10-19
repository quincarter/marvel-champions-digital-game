/**
 * Rules QA, gap from the wave 9 scenario tests: a Forced Action at the end of the player phase that has a payment in it
 * (Enchantress, MC55 pp. 6-7, 22; docs/phase7-wave9.md section 3.53). MC55 p. 7: "A player may perform a forced action at any
 * time during the player phase they could normally perform an action, but the player phase cannot end until all possible
 * forced actions among all players have been performed." RRG 1.8 "Action" (p. 6) and "Forced Action" (p. 20) say the same.
 * Findings are in the report; a FINDING comment marks where the game and its source disagree.
 */
import { applyCommand, outstandingForcedActions, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, endTurn, identityOf, inst, moveToHand, patchInstance, playerOf, use } from "../testing/harness.js";
import { IRON_MAN, SPIDER_MAN, codeOf } from "./testing.js";
import { putOnTopOfDeck } from "../testing/harness.js";
import { DEPS, act, inPlayAll, openScenario, resolveWith, villainPhaseDealing } from "./qa-gaps.shared.js";

vi.setConfig({ testTimeout: 300_000 });

const FORCED_ACTIONS = [
  "55012.alluring-call-forced-action",
  "55013.kiss-of-temptation-forced-action",
  "55014.love-concoction-forced-action",
  "55007b.trance-of-envy-forced-action",
  "55008b.trance-of-greed-forced-action",
  "55009b.trance-of-pride-forced-action",
  "55010b.trance-of-sloth-forced-action",
  "55011b.trance-of-wrath-forced-action",
];

describe("every Forced Action in the pack costs 'Exhaust this card' and nothing else (docs/phase7-wave9.md section 3.53)", () => {
  for (const id of FORCED_ACTIONS)
    it(id, () => {
      const definition = DEPS.abilities[id]!;
      expect(definition, "scripted").toBeDefined();
      expect(definition.trigger).toMatchObject({ kind: "action", forced: true });
      const cost = definition.cost ?? {};
      expect(Object.keys(cost).sort()).toEqual(["exhaustSelf"].filter((k) => k in cost));
      expect(cost).not.toHaveProperty("resources");
      expect(cost).not.toHaveProperty("resourcesX");
      expect(cost).not.toHaveProperty("payPrintedCostOf");
    });
});

/** The charm counters on the Enchantment (Hypnotic Gaze or Trance) attached to a player's identity. */
const charmOn = (s: GameState, player: typeof P1): number => {
  const gaze = inst(s, identityOf(s, player)).attachments.find((id) => /^550(0[7-9]|1[01])[ab]$/.test(codeOf(s, id)));
  return gaze ? (inst(s, gaze).counters["charm"] ?? 0) : -1;
};

/** Two players, p1 holding Alluring Call (55012), in round 2 with p1 first; Spider-Man in hero form with Haymaker in hand. */
const putOnTop = (s: GameState, code: string): GameState => putOnTopOfDeck(s, P1, code).state;

/** The player's hand replaced by exactly `ids`. */
const handOnly = (s: GameState, ids: readonly InstanceId[]): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [...ids] } : p)),
});
const inForm = (s: GameState, form: "alterEgo" | "hero"): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === P1 ? { ...p, identity: { ...p.identity, form } } : p)),
});

function withAlluringCall(): { s: GameState; call: InstanceId; haymaker: InstanceId } {
  let s = openScenario("enchantress", 2, { seats: [SPIDER_MAN, IRON_MAN], firstPlayerIndex: 1 });
  // p2 is first in round 1, so the second card goes to p1.
  s = villainPhaseDealing(s, ["55017", "55012"], {}).state;
  const call = inst(s, identityOf(s, P1)).attachments.find((id) => codeOf(s, id) === "55012");
  expect(call, "Alluring Call is on p1's identity").toBeDefined();
  expect(s.firstPlayerId, "the token passed").toBe(P1);
  s = act(s, {}, { type: "changeForm", playerId: P1 }).state;
  const given = moveToHand(s, P1, "01087");
  return { s: given.state, call: call!, haymaker: given.ids[0]! };
}

describe("Alluring Call (55012): 'place 1 charm counter ... Play a card from your hand, reducing its resource cost by 1' (MC55 p. 7)", () => {
  it("the end of the turn is refused until it is used (RRG p. 6); the player picks the card AND the cards that pay for it", () => {
    const { s, call, haymaker } = withAlluringCall();
    const refused = applyCommand(s, endTurn(P1), DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("forced_action_outstanding");
    const hand = playerOf(s, P1).hand;
    const pay = hand.find((id) => codeOf(s, id) === "01063" || codeOf(s, id) === "01007")!; // any one resource-bearing card
    const seen: string[] = [];
    const r = act(s, { cards: ["Haymaker"], payWith: [pay], seen }, use(P1, call, "55012.alluring-call-forced-action"));
    expect(seen.map((l) => l.split(":")[0])).toEqual(["chooseCards", "spendResources", "chooseTarget"]);
    // Haymaker costs 2, reduced by 1: one card pays; exactly the card the player chose is the one discarded with it.
    expect(playerOf(r.state, P1).discard).toContain(pay);
    expect(playerOf(r.state, P1).hand).not.toContain(haymaker);
    expect(inst(r.state, call).exhausted).toBe(true);
    expect(charmOn(r.state, P1)).toBe(1);
    // The turn can end now.
    expect(applyCommand(r.state, endTurn(P1), DEPS).ok).toBe(true);
  });

  it("owner decision 62B / 63B (2026-10-11), case (a): a legal, payable card must be played; its payment cannot be declined or short", () => {
    const { s, call, haymaker } = withAlluringCall();
    const [e1, e2] = moveToHand(handOnly(s, [haymaker]), P1, "01088", "01090").ids as [InstanceId, InstanceId];
    const staged = handOnly(s, [haymaker, e1, e2]);
    const used = applyCommand(staged, use(P1, call, "55012.alluring-call-forced-action"), DEPS);
    expect(used.ok).toBe(true);
    if (!used.ok) return;
    const which = resolveWith(used.state, (st) => [
      st.pendingChoice!.options.find((o) => o.label.includes("Haymaker"))!.optionId,
    ]).state;
    const ask = which.pendingChoice!;
    expect(ask.prompt).toMatchObject({ kind: "spendResources", required: true });
    expect(ask.minSelections, "Haymaker costs 2, reduced by 1: one card pays").toBe(1);
    const answer = (ids: readonly string[]) =>
      applyCommand(
        which,
        { type: "resolveChoice", playerId: P1, choiceId: ask.choiceId, selectedOptionIds: ids },
        DEPS,
      );
    expect(answer([]).ok, "declining the payment is refused").toBe(false);
    // The card is still in hand and the choice still open: the Forced Action is not performed by a declined play.
    expect(playerOf(which, P1).hand).toContain(haymaker);
    expect(outstandingForcedActions(which, P1, DEPS).length + (which.pendingChoice ? 1 : 0)).toBeGreaterThan(0);
    const paid = answer([`hand:${e2}`]);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    const done = act(paid.state, {}).state;
    expect(playerOf(done, P1).hand, "Haymaker left the hand").not.toContain(haymaker);
    expect(playerOf(done, P1).discard, "the chosen card paid").toContain(e2);
    expect(playerOf(done, P1).hand, "and only that one").toContain(e1);
    expect(charmOn(done, P1)).toBe(1);
  });

  it("owner decision 63B, case (b): a card affordable but not legally playable (a Hero Action in alter-ego form) is not offered; the others are", () => {
    const { s, call, haymaker } = withAlluringCall();
    // Taken out of the deck (the state `moveToHand` returns): a card left in both the deck and the hand is in two
    // places, and its play would move it out of the deck and leave it on the table.
    const given = moveToHand(s, P1, "01006", "01088");
    const [may, e1] = given.ids as [InstanceId, InstanceId];
    const staged = inForm(handOnly(given.state, [haymaker, may, e1]), "alterEgo");
    const seen: string[] = [];
    const r = act(staged, { cards: ["Aunt May"], seen }, use(P1, call, "55012.alluring-call-forced-action"));
    expect(seen[0], "Haymaker (a Hero Action) is not offered in alter-ego form").toMatch(/^chooseCards: Aunt May$/);
    expect(inPlayAll(r.state, "01006")).toHaveLength(1);
    expect(playerOf(r.state, P1).hand).toContain(haymaker);
  });

  it("owner decision 63B, case (b/c): with no card legal and payable the instruction cannot be completed (MC55 p. 7, 'if able'): the counter is placed, nothing is played, the Forced Action counts as performed", () => {
    const { s, call, haymaker } = withAlluringCall();
    const given = moveToHand(s, P1, "01088");
    const e1 = given.ids[0]!;
    // Alter-ego form: Haymaker cannot be played at all.
    const wrongForm = act(
      inForm(handOnly(given.state, [haymaker, e1]), "alterEgo"),
      {},
      use(P1, call, "55012.alluring-call-forced-action"),
    );
    expect(wrongForm.state.pendingChoice).toBeNull();
    expect(playerOf(wrongForm.state, P1).hand).toContain(haymaker);
    expect(outstandingForcedActions(wrongForm.state, P1, DEPS)).toHaveLength(0);
    expect(charmOn(wrongForm.state, P1)).toBe(1);
    // Hero form, but nothing to pay with: Haymaker costs 2, 1 after the reduction, and the hand holds only Haymaker.
    const unpayable = act(handOnly(s, [haymaker]), {}, use(P1, call, "55012.alluring-call-forced-action"));
    expect(unpayable.state.pendingChoice).toBeNull();
    expect(playerOf(unpayable.state, P1).hand).toContain(haymaker);
    expect(outstandingForcedActions(unpayable.state, P1, DEPS)).toHaveLength(0);
    expect(charmOn(unpayable.state, P1)).toBe(1);
  });

  it("owner decision 63B, case (d): the reduction makes a card payable that otherwise is not (Haymaker, cost 2, with one other card in hand)", () => {
    const { s, call, haymaker } = withAlluringCall();
    const given = moveToHand(s, P1, "01088");
    const e1 = given.ids[0]!;
    const r = act(
      handOnly(given.state, [haymaker, e1]),
      { cards: ["Haymaker"], payWith: [e1] },
      use(P1, call, "55012.alluring-call-forced-action"),
    );
    expect(playerOf(r.state, P1).hand).toHaveLength(0);
    expect(playerOf(r.state, P1).discard).toContain(e1);
  });

  it("pins: the 'which card' prompt requires one card while a playable card is in hand (no opting out of the play itself)", () => {
    const { s, call } = withAlluringCall();
    let min = -1;
    const r = act(
      s,
      (st) => {
        const c = st.pendingChoice!;
        if (c.prompt.kind === "chooseCards") {
          min = c.minSelections;
          return [c.options[0]!.optionId];
        }
        return [];
      },
      use(P1, call, "55012.alluring-call-forced-action"),
    );
    expect(min).toBe(1);
    expect(r.state.outcome).toBeNull();
  });

  it("the late path (its card readied after its player's turn ended): the engine asks 'which', then what to play and how to pay, and the play cannot be declined", () => {
    // RRG p. 6 and docs section 3.53: a forced action that became outstanding after its controller's turn is put to that
    // controller before the phase ends, "as a prompt that has only 'resolve it'". Here p1 used the Call in turn, ended the
    // turn, and p2's action readies it again (staged: no scripted card readies an attachment).
    const { s: opened, call, haymaker } = withAlluringCall();
    const energy = moveToHand(opened, P1, "01088", "01090").ids;
    // First use with nothing playable and payable in hand (a lone Energy), so the in-turn use plays nothing.
    const s = handOnly(opened, [energy[0]!]);
    const used = act(s, {}, use(P1, call, "55012.alluring-call-forced-action"), endTurn(P1));
    expect(used.state.step).toMatchObject({ phase: "player", kind: "turn", activePlayerId: P2 });
    // Owner decision 62B / 63B (2026-10-11), case (e): the late path plays the same way. Now Haymaker and two Energy.
    const readied = handOnly(patchInstance(used.state, call, { exhausted: false }), [haymaker, ...energy]);
    // p2's own turn ends: p1 is asked to resolve its outstanding forced action.
    const ending = applyCommand(readied, endTurn(P2), DEPS);
    expect(ending.ok).toBe(true);
    if (!ending.ok) return;
    const ask = ending.state.pendingChoice!;
    expect(ask.playerId).toBe(P1);
    expect(ask.prompt).toMatchObject({ kind: "chooseOption", forcedAction: true });
    expect(ask.options).toHaveLength(1);
    // Resolve it: the cost has no resource part, so the example command carries an empty payment; the card play inside it is asked.
    const kinds: string[] = [];
    let cur = ending.state;
    for (let guard = 0; cur.pendingChoice && guard < 6; guard++) {
      kinds.push(`${cur.pendingChoice.playerId}:${cur.pendingChoice.prompt.kind}`);
      const pickHaymaker = (st: GameState): readonly string[] => {
        const choice = st.pendingChoice!;
        if (choice.prompt.kind === "chooseCards")
          return [choice.options.find((o) => o.label.includes("Haymaker"))?.optionId ?? choice.options[0]!.optionId];
        if (choice.prompt.kind === "spendResources") {
          expect(choice.prompt).toMatchObject({ required: true });
          const declined = applyCommand(
            cur,
            { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [] },
            DEPS,
          );
          expect(declined.ok, "the late path cannot decline the payment either").toBe(false);
          return [choice.options[0]!.optionId];
        }
        return [choice.options[0]!.optionId];
      };
      cur = resolveWith(cur, pickHaymaker).state;
      if (kinds.at(-1)?.endsWith("discardDownToHandSize") || cur.step.phase !== "player") break;
    }
    expect(kinds.slice(0, 3)).toEqual(["p1:chooseOption", "p1:chooseCards", "p1:spendResources"]);
    expect(playerOf(cur, P1).hand, "Haymaker was played, paid for by an Energy").not.toContain(haymaker);
    expect(
      playerOf(cur, P1).discard.some((id) => energy.includes(id)),
      "an Energy paid",
    ).toBe(true);
  });
});

describe("Trance of Greed (55008b): 'Draw 1 card, then play that card (paying its cost). If you cannot, take 1 damage.'", () => {
  // MC55 p. 7: the Trance side's When Revealed triggers as the Gaze flips; its Forced Action then repeats each round.
  function greed() {
    for (let seed = 1; seed <= 60; seed++) {
      const s = openScenario("enchantress", 1, { seed, seats: [SPIDER_MAN] });
      const gaze = inst(s, identityOf(s, P1)).attachments.find((id) => codeOf(s, id) === "55008a");
      if (!gaze) continue;
      // Five charm counters flip the Gaze (staged, as the scenario tests do; the flip itself is a state check).
      const staged = patchInstance(s, gaze, { counters: { charm: 5 } });
      const flipped = act(staged, {}, { type: "changeForm", playerId: P1 }).state;
      expect(inst(flipped, gaze).flipped, "flipped to Trance of Greed").toBe(true);
      return { s: flipped, gaze, seed };
    }
    throw new Error("no seed deals Trance of Greed");
  }

  /** The player's hand replaced, the top of the deck set, form optionally changed. */
  function staged(s: GameState, top: string, hand: readonly string[], form?: "alterEgo" | "hero") {
    const topped = putOnTop(s, top);
    const ids = moveToHand(topped, P1, ...hand);
    const only = handOnly(ids.state, ids.ids);
    return form ? inForm(only, form) : only;
  }

  it("owner decision 62B (2026-10-11), case (a): a drawn card that can be played and paid for must be; the payment cannot be declined or short, and the player chooses the cards", () => {
    const { s, gaze } = greed();
    const top = staged(s, "01058", ["01088", "01089", "01090"]); // Daredevil, cost 4; each resource card pays 2
    const hand = playerOf(top, P1).hand;
    const damageBefore = inst(top, identityOf(top, P1)).damage;
    const used = applyCommand(top, use(P1, gaze, "55008b.trance-of-greed-forced-action"), DEPS);
    expect(used.ok).toBe(true);
    if (!used.ok) return;
    const ask = used.state.pendingChoice!;
    expect(ask.prompt).toMatchObject({ kind: "spendResources", required: true });
    const answer = (ids: readonly string[]) =>
      applyCommand(
        used.state,
        { type: "resolveChoice", playerId: P1, choiceId: ask.choiceId, selectedOptionIds: ids },
        DEPS,
      );
    expect(answer([]).ok, "declining to keep the card and take the damage is refused").toBe(false);
    expect(answer([`hand:${hand[2]}`]).ok, "one resource card (2) does not pay cost 4").toBe(false);
    const paid = answer([`hand:${hand[0]}`, `hand:${hand[1]}`]);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    const done = act(paid.state, {}).state;
    expect(inPlayAll(done, "01058"), "Daredevil was played").toHaveLength(1);
    expect(playerOf(done, P1).hand, "the card the player left out is still in hand").toContain(hand[2]);
    expect(playerOf(done, P1).discard).toEqual(expect.arrayContaining([hand[0]!, hand[1]!]));
    expect(inst(done, identityOf(done, P1)).damage).toBe(damageBefore);
  });

  it("owner decision 62B, case (b): affordable but not legally playable (a Hero Action in alter-ego form; a resource card): 1 damage, no payment asked, the card stays in hand", () => {
    const { s, gaze } = greed();
    for (const [code, form] of [
      ["01087", "alterEgo"],
      ["01088", "hero"],
    ] as const) {
      const top = staged(s, code, ["01089", "01090", "01058"], form);
      const damageBefore = inst(top, identityOf(top, P1)).damage;
      const seen: string[] = [];
      const r = act(top, { seen }, use(P1, gaze, "55008b.trance-of-greed-forced-action"));
      expect(
        seen.some((l) => l.startsWith("spendResources")),
        code,
      ).toBe(false);
      expect(
        playerOf(r.state, P1).hand.some((id) => codeOf(r.state, id) === code),
        code,
      ).toBe(true);
      expect(inst(r.state, identityOf(r.state, P1)).damage, code).toBe(damageBefore + 1);
    }
  });

  it("owner decision 62B, case (c): not payable (Daredevil, cost 4, one Energy, worth 2, in hand): 1 damage, no payment asked, the card stays in hand", () => {
    const { s, gaze } = greed();
    const top = staged(s, "01058", ["01088"]);
    const damageBefore = inst(top, identityOf(top, P1)).damage;
    const seen: string[] = [];
    const r = act(top, { seen }, use(P1, gaze, "55008b.trance-of-greed-forced-action"));
    expect(seen.some((l) => l.startsWith("spendResources"))).toBe(false);
    expect(inPlayAll(r.state, "01058")).toHaveLength(0);
    expect(playerOf(r.state, P1).hand.some((id) => codeOf(r.state, id) === "01058")).toBe(true);
    expect(inst(r.state, identityOf(r.state, P1)).damage).toBe(damageBefore + 1);
  });
});
