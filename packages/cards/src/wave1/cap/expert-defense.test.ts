import { type CardId, WAVE1_CARDS } from "@mc/content";
import { activeEncounterDeck, type GameState } from "@mc/engine";
import { answer, firstLegal, identityOf, inst, moveToHand, P1, playerOf, settle, stackEncounterDeck, toHero, endTurn } from "../../testing/harness.js";
import { wave1Scenario, wave1StarterDeckSetup } from "../setup.js";
import { runWave1, startWave1Game, WAVE1_DEPS } from "../testing.js";

/**
 * Expert Defense (03033): "Hero Interrupt (defense): When your hero defends against an attack, it gets +3 DEF for that
 * attack." Registered since the `cap` pack landed, but the `defended` event only opened a response window, so this
 * interrupt was never offered. RRG 1.8 "Defend, Defense" (p. 15) and "Interrupt" (p. 25).
 *
 * Captain America (ATK 2, DEF 2) against Rhino (ATK 2), with Crowd Control (01108: 2 boost icons, no boost ability)
 * stacked as the boost card: a basic defense takes 2 + 2 - 2 = 2 damage, and 0 once Expert Defense adds 3 DEF.
 */
const CROWD_CONTROL = "01108";

/**
 * A legal Captain America (Protection) deck: Expert Defense is a Protection card, so it isn't in any precon. His
 * signature cards come from his Leadership precon, the Protection and basic cards from Ms. Marvel's Protection precon,
 * plus one Expert Defense.
 */
function protectionCap() {
  const aspectOf = new Map(WAVE1_CARDS.map((card) => [card.id as string, "aspect" in card ? String(card.aspect) : ""]));
  const cap = wave1StarterDeckSetup("cap-leadership");
  const signature = cap.deck.filter((id) => aspectOf.get(id)?.startsWith("hero:"));
  const protection = wave1StarterDeckSetup("msm-protection").deck.filter((id) => !aspectOf.get(id)?.startsWith("hero:"));
  return { identityCardId: cap.identityCardId, aspects: ["protection"] as const, deck: [...signature, ...protection, "03033" as CardId] };
}

function atDefense(): { readonly state: GameState; readonly expert: string } {
  const start = startWave1Game(wave1Scenario("rhino", { players: [protectionCap()], seed: 11 }));
  const given = moveToHand(runWave1(start, toHero()), P1, "03033");
  const stacked = stackEncounterDeck(given.state, CROWD_CONTROL);
  const reached = settle(runWave1(stacked, endTurn()), firstLegal, (s) => s.pendingChoice?.prompt.kind === "declareDefender", WAVE1_DEPS);
  expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
  return { state: reached, expert: given.ids[0] as string };
}

describe("Expert Defense (03033)", () => {
  it("is offered when Captain America defends, and its +3 DEF reduces that attack's damage", () => {
    const { state, expert } = atDefense();
    const hero = identityOf(state);
    const damageBefore = inst(state, hero).damage;
    const offered = answer(state, [hero], WAVE1_DEPS);
    const option = `${expert}:03033.expert-defense-interrupt`;
    expect(offered.pendingChoice?.prompt).toMatchObject({ kind: "chooseTriggers", timing: "interrupt" });
    expect(offered.pendingChoice?.options.map((o) => o.optionId)).toContain(option);

    const played = answer(offered, [option], WAVE1_DEPS);
    const after = settle(played, firstLegal, (s) => activeEncounterDeck(s).discard.some((id) => inst(s, id).cardId === CROWD_CONTROL), WAVE1_DEPS);
    expect(inst(after, hero).damage).toBe(damageBefore);
    expect(playerOf(after, P1).discard).toContain(expert);
  });

  it("without it, the same basic defense takes 2 damage", () => {
    const { state } = atDefense();
    const hero = identityOf(state);
    const damageBefore = inst(state, hero).damage;
    const offered = answer(state, [hero], WAVE1_DEPS);
    const after = settle(answer(offered, [], WAVE1_DEPS), firstLegal, (s) => activeEncounterDeck(s).discard.some((id) => inst(s, id).cardId === CROWD_CONTROL), WAVE1_DEPS);
    expect(inst(after, hero).damage).toBe(damageBefore + 2);
  });
});
