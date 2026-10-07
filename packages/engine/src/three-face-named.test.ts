/**
 * docs/phase7-wave7.md §3.62: a three-face identity whose two hero faces print the same traits and differ by title.
 * Synthetic cards only: "Warden" (alter-ego), "Dove" and "Hawk" (hero faces).
 *
 * - `changeForm.heroForm: { named }` picks a hero face by its title. RRG 1.8 "Identity" (p. 23): "If a card refers to
 *   a hero or alter-ego by title, it refers only to the identity with that title, and not to the other side of the
 *   card", so the two hero faces are never one title.
 * - A bare "change form" from a hero face asks among the faces not showing. RRG 1.8 "Flip" (p. 20): "A foldable,
 *   'three-sided' card is considered to have flipped any time the faceup side of the card changes"; "Form, Change
 *   Form" (p. 21): a player changes form "by flipping their identity card", once each round, and a card ability's
 *   change does not count against it. The Ant-Man insert (docs/phase7-wave2.md §1.1) reads hero face to hero face as
 *   a change of form.
 * - Hit points: an identity prints one hit point value (`HeroIdentityCard.hp`), and a change of form keeps the
 *   character's sustained damage (RRG 1.8 "Form, Change Form", p. 21; "Sustained Damage", p. 42).
 * - docs/phase7-wave7.md §4.1 Q42 = A: "After you play an event" on each hero face is answered by the face showing
 *   once the event has resolved. Each face's ability keeps its own limit across the flip (ruling, Jan 26, 2026 (6)
 *   answer 2: "Limits apply to cards. An identity never leaves play when flipping; limits applied to its abilities
 *   persist across flips.").
 */

import { trait, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, currentName, handSize, mustInstance, mustPlayer } from "./query.js";
import { traitsOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubIdentity } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard, newGame } from "./testing/scenario.js";

const p1 = playerId("p1");
const WINGED = trait("Winged");
const you = { kind: "controller" } as const;
const counter = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "identityOf", player: you },
  counterType,
  amount: { kind: "const", value: 1 },
});

/** "Forced Response: After you change form, …" on every face, counting form changes. */
const CHANGED: EventPattern = { on: "formChanged", playerIs: "controller" };
const sawChange = (face: string) =>
  stubAbility(`${face}.changed`, {
    trigger: { kind: "response", forced: true, on: CHANGED },
    effects: [counter("changed")],
  });
const WARDEN_CHANGED = sawChange("warden");
const DOVE_CHANGED = sawChange("dove");
const HAWK_CHANGED = sawChange("hawk");

/** "Response: After you play an event, … (Limit once per phase.)" on each hero face, each with its own limit. */
const YOU_PLAY: EventPattern = { on: "cardPlayed", playerIs: "controller" };
const afterPlay = (face: string) =>
  stubAbility(`${face}.after-play`, {
    trigger: { kind: "response", forced: false, on: YOU_PLAY },
    limit: { count: 1, period: "phase" },
    effects: [counter(face)],
  });
const DOVE_AFTER_PLAY = afterPlay("dove");
const HAWK_AFTER_PLAY = afterPlay("hawk");

const WING: HeroIdentityCard = {
  ...stubIdentity({
    id: "wing",
    name: "Dove",
    hp: 12,
    atk: 1,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroTraits: [WINGED],
    heroAbilities: [DOVE_CHANGED.ref, DOVE_AFTER_PLAY.ref],
    alterEgoAbilities: [WARDEN_CHANGED.ref],
  }),
  additionalHeroForms: [
    {
      faceName: "Hawk",
      atk: 2,
      thw: 0,
      def: 3,
      handSize: 4,
      keywords: [],
      traits: [WINGED],
      text: { printed: "", current: "" },
      abilities: [HAWK_CHANGED.ref, HAWK_AFTER_PLAY.ref],
    },
  ],
};
const THREE_FACED: HeroIdentityCard = {
  ...WING,
  hero: { ...WING.hero, faceName: "Dove" },
  alterEgo: { ...WING.alterEgo, faceName: "Warden" },
};
/** The same identity without its second hero face: the two-face regression. */
const TWO_FACED: HeroIdentityCard = (() => {
  const { additionalHeroForms: _dropped, ...rest } = THREE_FACED;
  return rest;
})();

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
const TO_HAWK = action("to-hawk", [{ kind: "changeForm", player: you, heroForm: { named: "Hawk" } }]);
const TO_DOVE = action("to-dove", [{ kind: "changeForm", player: you, heroForm: { named: "Dove" } }]);
const TO_NOBODY = action("to-nobody", [{ kind: "changeForm", player: you, heroForm: { named: "Warden" } }]);
const MORPH = action("morph", [{ kind: "changeForm", player: you }]);
const PING = action("ping", []);
const LOCK = action("lock", [
  { kind: "applyRuleUntil", rule: { kind: "cannotChangeForm", player: you }, until: "endOfNextTurn" },
]);
const ACTIONS = [TO_HAWK, TO_DOVE, TO_NOBODY, MORPH, PING, LOCK];
const EVENTS = ["to-hawk", "to-dove", "to-nobody", "morph", "ping", "lock"].map((id, index) =>
  stubEvent({ id, cost: 0, abilities: [ACTIONS[index]!.ref] }),
);
const deps: EngineDeps = depsOf(
  WARDEN_CHANGED,
  DOVE_CHANGED,
  HAWK_CHANGED,
  DOVE_AFTER_PLAY,
  HAWK_AFTER_PLAY,
  ...ACTIONS,
);

function game(identity: HeroIdentityCard = THREE_FACED): GameState {
  return newGame({
    identity,
    deps,
    extraCards: EVENTS,
    deck: [...DEFAULT_DECK, ...EVENTS.flatMap((card) => [card.id, card.id])],
  });
}

interface Run {
  readonly state: GameState;
  /** The option ids of each form choice asked, in order. */
  readonly formChoices: readonly (readonly string[])[];
  /** The ability ids of each optional-trigger choice offered, in order. */
  readonly offered: readonly (readonly string[])[];
  readonly formChanges: number;
  readonly log: ReturnType<typeof runCommandsPicking>["session"]["log"];
}

/** Applies commands, answering each form choice with the next of `forms` and accepting every optional trigger. */
function run(state: GameState, commands: readonly Command[], forms: readonly string[] = []): Run {
  const answers = [...forms];
  const formChoices: (readonly string[])[] = [];
  const offered: (readonly string[])[] = [];
  const result = runCommandsPicking(
    state,
    deps,
    (current) => {
      const choice = current.pendingChoice;
      if (!choice) return [];
      const ids = choice.options.map((option) => option.optionId);
      if (choice.prompt.kind === "chooseTriggers") {
        // A trigger option is `<instance id>:<ability id>`.
        offered.push(ids.map((id) => id.slice(id.indexOf(":") + 1)));
        return ids;
      }
      if (choice.prompt.kind === "chooseOption") {
        formChoices.push(ids);
        const answer = answers.shift();
        if (answer === undefined) throw new Error(`no answer for the form choice among ${ids.join(", ")}`);
        return [answer];
      }
      return defaultPick(current);
    },
    ...commands,
  );
  return {
    state: result.state,
    formChoices,
    offered,
    formChanges: result.events.filter((event) => event.type === "formChanged").length,
    log: result.session.log,
  };
}

const play = (state: GameState, card: string, forms: readonly string[] = []): Run => {
  const given = giveCard(state, p1, card);
  return run(
    given.state,
    [{ type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    forms,
  );
};
const toHero = (heroForm: number): Command => ({ type: "changeForm", playerId: p1, to: { heroForm } });
const toAlterEgo: Command = { type: "changeForm", playerId: p1, to: "alterEgo" };
const identityOf = (state: GameState) => mustPlayer(state, p1).identity;
const identityId = (state: GameState): InstanceId => identityOf(state).instanceId;
const counters = (state: GameState) => mustInstance(state, identityId(state)).counters;
const showing = (state: GameState) => currentName(state, identityId(state));
const formActions = (state: GameState) => {
  const actions = legalActions(state, p1, deps);
  if (actions.kind !== "turn") throw new Error("not a turn");
  return actions.legal.filter((entry) => entry.action.kind === "changeForm");
};
/** In hero form on the given face, with the once-per-round change still unused. */
const onFace = (heroFormIndex: number, identity: HeroIdentityCard = THREE_FACED): GameState => {
  const start = game(identity);
  return {
    ...start,
    players: start.players.map((player) =>
      player.playerId === p1 ? { ...player, identity: { ...player.identity, form: "hero", heroFormIndex } } : player,
    ),
  };
};

describe("changeForm to a hero face by title (docs/phase7-wave7.md §3.62)", () => {
  it("from alter-ego: changes to the named face without asking and without using the voluntary change", () => {
    const hawk = play(game(), "to-hawk");
    expect(hawk.formChoices).toEqual([]);
    expect(identityOf(hawk.state)).toMatchObject({ form: "hero", heroFormIndex: 1, changedFormThisRound: false });
    expect(showing(hawk.state)).toBe("Hawk");
    // One change of form; the event that made it is then answered by the face it left showing (Q42 = A, below).
    expect(counters(hawk.state)).toEqual({ changed: 1, hawk: 1 });

    const dove = play(game(), "to-dove");
    expect(identityOf(dove.state)).toMatchObject({ form: "hero", heroFormIndex: 0 });
    expect(showing(dove.state)).toBe("Dove");
  });

  it("from the other hero face: a change of form straight from one hero face to the other", () => {
    const hawk = play(onFace(0), "to-hawk");
    expect(identityOf(hawk.state)).toMatchObject({ form: "hero", heroFormIndex: 1, changedFormThisRound: false });
    expect(hawk.formChanges).toBe(1);
    expect(counters(hawk.state)).toMatchObject({ changed: 1 });

    const dove = play(hawk.state, "to-dove");
    expect(identityOf(dove.state)).toMatchObject({ form: "hero", heroFormIndex: 0 });
    expect(counters(dove.state)).toMatchObject({ changed: 2 });
  });

  it("already showing the named face: nothing happens, and it is not a change of form", () => {
    const same = play(onFace(1), "to-hawk");
    expect(identityOf(same.state)).toMatchObject({ form: "hero", heroFormIndex: 1 });
    expect(same.formChanges).toBe(0);
    expect(counters(same.state).changed).toBeUndefined();
  });

  it("a title names one face: the other hero face's title, the alter-ego's title and the card's name match nothing", () => {
    // `named` reads hero faces only; "Warden" is this identity's alter-ego title.
    for (const start of [game(), onFace(0), onFace(1)]) {
      const before = identityOf(start);
      const after = play(start, "to-nobody");
      expect(identityOf(after.state)).toMatchObject({ form: before.form, heroFormIndex: before.heroFormIndex });
      expect(after.formChanges).toBe(0);
    }
  });

  it("each face reads its own title, stats and hand size; printed hit points and damage stay with the card", () => {
    const start = game();
    const id = identityId(start);
    const hurt = (state: GameState): GameState => ({
      ...state,
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage: 5 } },
    });
    const warden = hurt(start);
    expect(showing(warden)).toBe("Warden");
    expect(characterProfile(warden, id, deps)).toMatchObject({ rec: 3, maxHp: 12 });
    expect(handSize(warden, p1, deps)).toBe(6);

    const dove = play(warden, "to-dove").state;
    expect(characterProfile(dove, id, deps)).toMatchObject({ atk: 1, thw: 2, def: 2, maxHp: 12 });
    expect(handSize(dove, p1, deps)).toBe(5);
    expect(traitsOf(dove, id, deps)).toEqual([WINGED]);
    expect(mustInstance(dove, id).damage).toBe(5);

    const hawk = play(dove, "to-hawk").state;
    expect(characterProfile(hawk, id, deps)).toMatchObject({ atk: 2, thw: 0, def: 3, maxHp: 12 });
    expect(handSize(hawk, p1, deps)).toBe(4);
    expect(traitsOf(hawk, id, deps)).toEqual([WINGED]);
    // Sustained damage is retained (RRG 1.8 "Form, Change Form", p. 21): 12 printed, 5 sustained, 7 remaining.
    expect(mustInstance(hawk, id).damage).toBe(5);
  });

  it.todo(
    "hero faces printing different hit point values: HeroIdentityCard has one hp for the card, so no face can differ",
  );
});

describe("a bare 'change form' on a three-face identity (docs/phase7-wave7.md §3.62)", () => {
  it("from alter-ego: asks among the hero faces", () => {
    const hawk = play(game(), "morph", ["1"]);
    expect(hawk.formChoices).toEqual([["0", "1"]]);
    expect(showing(hawk.state)).toBe("Hawk");
    expect(identityOf(hawk.state).changedFormThisRound).toBe(false);
  });

  it("from a hero face: asks among the alter-ego face and the other hero face", () => {
    const hawk = play(onFace(0), "morph", ["1"]);
    expect(hawk.formChoices).toEqual([["alterEgo", "1"]]);
    expect(identityOf(hawk.state)).toMatchObject({ form: "hero", heroFormIndex: 1, changedFormThisRound: false });
    expect(hawk.formChanges).toBe(1);

    const warden = play(onFace(1), "morph", ["alterEgo"]);
    expect(warden.formChoices).toEqual([["alterEgo", "0"]]);
    expect(identityOf(warden.state)).toMatchObject({ form: "alterEgo", heroFormIndex: null });
    expect(warden.formChanges).toBe(1);
    expect(counters(warden.state)).toMatchObject({ changed: 1 });
  });

  it("the form choice replays deep-equal", () => {
    const warden = play(onFace(1), "morph", ["alterEgo"]);
    const replayed = replay(warden.log, deps);
    expect(replayed.ok && replayed.state).toEqual(warden.state);
  });
});

describe("the once-per-round change on a three-face identity (RRG 1.8 'Form, Change Form', p. 21)", () => {
  const targets = (state: GameState) => formActions(state).map((entry) => entry.action);

  it("offers every face not showing, from each face", () => {
    expect(targets(game())).toEqual([
      { kind: "changeForm", to: { heroForm: 0 } },
      { kind: "changeForm", to: { heroForm: 1 } },
    ]);
    expect(targets(onFace(0))).toEqual([
      { kind: "changeForm", to: "alterEgo" },
      { kind: "changeForm", to: { heroForm: 1 } },
    ]);
    expect(targets(onFace(1))).toEqual([
      { kind: "changeForm", to: "alterEgo" },
      { kind: "changeForm", to: { heroForm: 0 } },
    ]);
  });

  it("hero face to hero face directly is that round's one voluntary change", () => {
    const hawk = run(onFace(0), [toHero(1)]);
    expect(identityOf(hawk.state)).toMatchObject({ form: "hero", heroFormIndex: 1, changedFormThisRound: true });
    expect(hawk.formChanges).toBe(1);
    const again = applyCommand(hawk.state, toAlterEgo, deps);
    expect(again.ok ? null : again.error.code).toBe("already_changed_form");
    // A card's change afterwards is still allowed: it is not the voluntary one.
    expect(showing(play(hawk.state, "to-dove").state)).toBe("Dove");
  });

  it("the face already showing is refused", () => {
    const same = applyCommand(onFace(1), toHero(1), deps);
    expect(same.ok ? null : same.error.code).toBe("no_valid_target");
  });
});

describe("'You cannot change form' on a three-face identity (RRG 1.8 \"'Cannot'\", p. 11)", () => {
  it("blocks the voluntary change, the named change and the bare change, which then asks nothing", () => {
    const locked = play(onFace(0), "lock").state;
    for (const command of [toHero(1), toAlterEgo]) {
      const refused = applyCommand(locked, command, deps);
      expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
    }
    expect(formActions(locked)).toEqual([]);

    const named = play(locked, "to-hawk");
    expect(identityOf(named.state)).toMatchObject({ form: "hero", heroFormIndex: 0 });
    expect(named.formChanges).toBe(0);

    const bare = play(locked, "morph");
    expect(bare.formChoices).toEqual([]);
    expect(identityOf(bare.state)).toMatchObject({ form: "hero", heroFormIndex: 0 });
    expect(bare.formChanges).toBe(0);
    expect(counters(bare.state).changed).toBeUndefined();
  });
});

describe("Q42 = A: 'after you play an event' on two hero faces, when the event changed the face", () => {
  it("the face showing once the event has resolved answers; the face it was played from is not offered", () => {
    const hawk = play(onFace(0), "morph", ["1"]);
    expect(hawk.offered).toEqual([["hawk.after-play"]]);
    expect(counters(hawk.state)).toMatchObject({ hawk: 1 });
    expect(counters(hawk.state).dove).toBeUndefined();
  });

  it("each face's once-per-phase limit is its own, and stays used across a flip", () => {
    const hawk = play(onFace(0), "morph", ["1"]);
    // Hawk's response is used this phase: another event as Hawk offers nothing.
    const again = play(hawk.state, "ping");
    expect(again.offered).toEqual([]);
    // Back to Dove by an event: Dove's own limit is unused, so Dove answers it.
    const dove = play(again.state, "to-dove");
    expect(dove.offered).toEqual([["dove.after-play"]]);
    expect(counters(dove.state)).toMatchObject({ hawk: 1, dove: 1 });
    // And to Hawk again in the same phase: its limit persisted across both flips.
    const back = play(dove.state, "to-hawk");
    expect(back.offered).toEqual([]);
    expect(counters(back.state)).toMatchObject({ hawk: 1, dove: 1 });
  });

  it("an event that changes to alter-ego offers neither hero face's response", () => {
    const warden = play(onFace(0), "morph", ["alterEgo"]);
    expect(warden.offered).toEqual([]);
    expect(counters(warden.state)).toEqual({ changed: 1 });
  });
});

describe("a two-face identity is unchanged", () => {
  it("a bare 'change form' goes to the other face without asking, both ways", () => {
    const hero = play(game(TWO_FACED), "morph");
    expect(hero.formChoices).toEqual([]);
    expect(identityOf(hero.state)).toMatchObject({ form: "hero", heroFormIndex: 0, changedFormThisRound: false });
    const back = play(hero.state, "morph");
    expect(back.formChoices).toEqual([]);
    expect(identityOf(back.state)).toMatchObject({ form: "alterEgo", heroFormIndex: null });
  });

  it("one change form action; a named change reads its one hero face's title", () => {
    expect(formActions(game(TWO_FACED)).map((entry) => entry.action)).toEqual([{ kind: "changeForm" }]);
    const dove = play(game(TWO_FACED), "to-dove");
    expect(identityOf(dove.state)).toMatchObject({ form: "hero", heroFormIndex: 0 });
    // No hero face is titled "Hawk": unaffected, from alter-ego and from its hero face.
    expect(identityOf(play(game(TWO_FACED), "to-hawk").state).form).toBe("alterEgo");
    const stays = play(dove.state, "to-hawk");
    expect(identityOf(stays.state)).toMatchObject({ form: "hero", heroFormIndex: 0 });
    expect(stays.formChanges).toBe(0);
  });
});
