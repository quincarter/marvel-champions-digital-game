/**
 * docs/phase7-wave2.md §3.2: three-sided identities (Ant-Man, Wasp). The face that is up drives stats, traits, keywords,
 * abilities and hand size; the command and the effect can name a hero face; a card-caused change doesn't use the
 * voluntary change; damage, statuses and ability limits stay on the card. Synthetic cards only.
 *
 * Sources: the Ant-Man Hero Pack insert, "Foldable Cards" and "Rules Clarifications"; RRG 1.8 "Flip" (p. 20) and "Form,
 * Change Form" (p. 21); ruling, Jan 26, 2026 (6) answer 2 ("Limits apply to cards. An identity never leaves play when
 * flipping.").
 */

import { trait, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, handSize, mustInstance, mustPlayer } from "./query.js";
import { traitsOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubIdentity } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard, newGame, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const TINY = trait("Tiny");
const GIANT = trait("Giant");
const counter = (counterType: string): EffectSpec => ({ kind: "addCounters", target: { kind: "identityOf", player: { kind: "controller" } }, counterType, amount: { kind: "const", value: 1 } });

/** "Response: After you change to this form, …" on each hero face; only the face that is up can trigger. */
const TINY_RESPONSE = stubAbility("tri.tiny", { trigger: { kind: "response", forced: true, on: { on: "formChanged", playerIs: "controller" } }, effects: [counter("tiny")] });
const GIANT_RESPONSE = stubAbility("tri.giant", { trigger: { kind: "response", forced: true, on: { on: "formChanged", playerIs: "controller" } }, effects: [counter("giant")] });
const ANT: HeroIdentityCard = {
  ...stubIdentity({ id: "ant", name: "Ant", hp: 12, atk: 1, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6, heroTraits: [TINY], heroAbilities: [TINY_RESPONSE.ref] }),
  additionalHeroForms: [
    { faceName: "Giant Ant", atk: 3, thw: 1, def: 3, handSize: 4, keywords: [{ name: "toughness" }], traits: [GIANT], text: { printed: "", current: "" }, abilities: [GIANT_RESPONSE.ref] },
  ],
};

/** Card-caused changes: "change to your [Giant] hero form" (Rapid Growth), "change to your other hero form" (Resize). */
const action = (id: string, effects: readonly EffectSpec[]) => stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
const GROW = action("grow", [{ kind: "changeForm", player: { kind: "controller" }, heroForm: { withTrait: GIANT } }]);
const RESIZE = action("resize", [{ kind: "changeForm", player: { kind: "controller" }, heroForm: "other" }]);
const SUIT_UP = action("suit-up", [{ kind: "changeForm", player: { kind: "controller" }, to: "hero" }]);
const GROW_CARD = stubEvent({ id: "grow", cost: 0, abilities: [GROW.ref] });
const RESIZE_CARD = stubEvent({ id: "resize", cost: 0, abilities: [RESIZE.ref] });
const SUIT_UP_CARD = stubEvent({ id: "suit-up", cost: 0, abilities: [SUIT_UP.ref] });
const deps: EngineDeps = depsOf(TINY_RESPONSE, GIANT_RESPONSE, GROW, RESIZE, SUIT_UP);

function game(): GameState {
  return newGame({
    identity: ANT,
    deps,
    extraCards: [GROW_CARD, RESIZE_CARD, SUIT_UP_CARD],
    deck: [...DEFAULT_DECK, GROW_CARD.id, RESIZE_CARD.id, SUIT_UP_CARD.id],
  });
}
const apply = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return settle(result.state, defaultPick, deps);
};
const identityId = (state: GameState): InstanceId => mustPlayer(state, p1).identity.instanceId;
const counters = (state: GameState) => mustInstance(state, identityId(state)).counters;
const toHero = (heroForm: number): Command => ({ type: "changeForm", playerId: p1, to: { heroForm } });
const endRound = (state: GameState): GameState => {
  let current = apply(state, { type: "endTurn", playerId: p1 });
  let guard = 0;
  while (!(current.step.phase === "player" && current.step.kind === "turn") && guard++ < 50) current = settle(current, defaultPick, deps);
  return current;
};
const playEvent = (state: GameState, card: string): GameState => {
  const given = giveCard(state, p1, card);
  return apply(given.state, { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null });
};

describe("three-sided identities (docs/phase7-wave2.md §3.2)", () => {
  it("alter-ego to either hero form; each face reads its own stats, traits, keywords and hand size", () => {
    const start = game();
    expect(mustPlayer(start, p1).identity.heroFormIndex).toBeNull();
    const tiny = apply(start, toHero(0));
    expect(mustPlayer(tiny, p1).identity).toMatchObject({ form: "hero", heroFormIndex: 0 });
    expect(characterProfile(tiny, identityId(tiny), deps)).toMatchObject({ atk: 1, thw: 2, def: 2 });
    expect(traitsOf(tiny, identityId(tiny), deps)).toEqual([TINY]);
    expect(handSize(tiny, p1, deps)).toBe(5);

    const giant = apply(start, toHero(1));
    expect(mustPlayer(giant, p1).identity).toMatchObject({ form: "hero", heroFormIndex: 1 });
    expect(characterProfile(giant, identityId(giant), deps)).toMatchObject({ atk: 3, thw: 1, def: 3 });
    expect(traitsOf(giant, identityId(giant), deps)).toEqual([GIANT]);
    expect(handSize(giant, p1, deps)).toBe(4);
  });

  it("from alter-ego the command must name a hero form, and legal actions offer each one", () => {
    const start = game();
    const result = applyCommand(start, { type: "changeForm", playerId: p1 }, deps);
    expect(result.ok ? null : result.error.code).toBe("no_valid_target");
    const actions = legalActions(start, p1, deps);
    const forms = actions.kind === "turn" ? actions.legal.filter((a) => a.action.kind === "changeForm").map((a) => a.action) : [];
    expect(forms).toEqual([
      { kind: "changeForm", to: { heroForm: 0 } },
      { kind: "changeForm", to: { heroForm: 1 } },
    ]);
  });

  it("only the face that is up triggers 'after you change to this form'", () => {
    const giant = apply(game(), toHero(1));
    expect(counters(giant)).toEqual({ giant: 1 });
    const tiny = apply(game(), toHero(0));
    expect(counters(tiny)).toEqual({ tiny: 1 });
  });

  it("a voluntary hero-to-hero change uses the once-per-round change (docs/phase7-wave2.md §4.6)", () => {
    const tiny = apply(game(), toHero(0));
    const again = applyCommand(tiny, toHero(1), deps);
    expect(again.ok ? null : again.error.code).toBe("already_changed_form");
    const nextRound = endRound(tiny);
    const giant = apply(nextRound, toHero(1));
    expect(mustPlayer(giant, p1).identity.heroFormIndex).toBe(1);
  });

  it("damage and statuses stay across a change between hero forms (RRG 1.8 'Form, Change Form', p. 21)", () => {
    const tiny = apply(game(), toHero(0));
    const id = identityId(tiny);
    const hurt: GameState = { ...tiny, instances: { ...tiny.instances, [id]: { ...mustInstance(tiny, id), damage: 3, statuses: { stunned: 1, confused: 0, tough: 0 } } } };
    const giant = playEvent(hurt, "grow");
    expect(mustPlayer(giant, p1).identity.heroFormIndex).toBe(1);
    expect(mustInstance(giant, id)).toMatchObject({ damage: 3, statuses: { stunned: 1, confused: 0, tough: 0 } });
  });

  it("card effects: to the Giant form by trait, to the other hero form, and to hero form with a choice, none using the voluntary change", () => {
    const tiny = apply(game(), toHero(0));
    const grown = playEvent(tiny, "grow");
    expect(mustPlayer(grown, p1).identity).toMatchObject({ heroFormIndex: 1, changedFormThisRound: true });
    const resized = playEvent(grown, "resize");
    expect(mustPlayer(resized, p1).identity.heroFormIndex).toBe(0);

    // From alter-ego, an effect to hero form asks which hero form.
    const given = giveCard(game(), p1, "suit-up");
    const asked = applyCommand(given.state, { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }, deps);
    if (!asked.ok) throw new Error(asked.error.message);
    const choice = asked.state.pendingChoice;
    expect(choice?.prompt.kind).toBe("chooseOption");
    expect(choice?.options.map((o) => o.optionId)).toEqual(["0", "1"]);
    const answered = apply(asked.state, { type: "resolveChoice", playerId: p1, choiceId: choice!.choiceId, selectedOptionIds: ["1"] });
    expect(mustPlayer(answered, p1).identity).toMatchObject({ form: "hero", heroFormIndex: 1, changedFormThisRound: false });
    expect(counters(answered)).toEqual({ giant: 1 });
  });

  it("'your other hero form' does nothing in alter-ego form", () => {
    const start = game();
    const resized = playEvent(start, "resize");
    expect(mustPlayer(resized, p1).identity).toMatchObject({ form: "alterEgo", heroFormIndex: null });
  });

  it("the log names the faces, and a session replays deep-equal", () => {
    let session = startSession(game());
    for (const command of [toHero(1)]) {
      const result = sessionApply(session, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.events).toContainEqual({ type: "formChanged", playerId: p1, to: "hero", fromHeroFormIndex: null, heroFormIndex: 1 });
      session = result.session;
    }
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
