/**
 * "You" on an encounter card that sits in a player's play area (docs/phase7-wave6.md §7.4, the MojoMania Sitcom set).
 * Synthetic cards shaped like Mojo in the Middle (`mojo` 39060: "After a player discards an obligation, that player
 * draws 1 card"), Family Matters (39061: "Treat the printed text box of each support you control as if it were blank")
 * and The Odd Couple (39063: "Reduce your ally limit by 2").
 *
 * Sources: RRG 1.8 "Obligation" (p. 30): "Abilities on obligations that use the words 'you' or 'your' apply only to the
 * player whose play area the obligation is in"; "Attachment" (p. 8): an attachment's "you" on a player card is that
 * card's controller; "Ownership and Control" (p. 31): no player controls an encounter card; "Ally Limit" (p. 7): a
 * player over their ally limit "must immediately choose and discard" down to it.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { allyLimitFor } from "./rules.js";
import { blankedByConstantRules } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubEnvironment,
  stubMinion,
  stubObligation,
  stubSupport,
  stubUpgrade,
} from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const DRAW_1 = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } } as const;

/** "Response: After a player discards an obligation / an attachment / a minion, that player draws 1 card." */
const afterLeaving = (id: string, category: "obligation" | "attachment" | "minion") =>
  stubAbility(
    id,
    def({
      trigger: {
        kind: "response",
        forced: false,
        on: { on: "cardLeavesPlay", targetIs: { categories: [category] } },
        triggerableBy: { kind: "eventPlayer" },
      },
      effects: [DRAW_1],
    }),
  );
const SHOW_OBLIGATION = afterLeaving("show.obligation", "obligation");
const SHOW_ATTACHMENT = afterLeaving("show.attachment", "attachment");
const SHOW_MINION = afterLeaving("show.minion", "minion");
const SHOW = stubEnvironment({
  id: "show",
  abilities: [SHOW_OBLIGATION.ref, SHOW_ATTACHMENT.ref, SHOW_MINION.ref],
});

/** An obligation with "Action: Discard this obligation." */
const DUTY_ACTION = stubAbility("duty.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
});
const DUTY = stubObligation({ id: "duty", abilities: [DUTY_ACTION.ref] });
/** An obligation: "Treat the printed text box of each support you control as if it were blank." */
const BLANKING_RULE = stubAbility(
  "blanking.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "blankTextBox", target: { categories: ["support"], controller: "you" } }],
    },
    effects: [],
  }),
);
const BLANKING = stubObligation({ id: "blanking", abilities: [BLANKING_RULE.ref] });
/** An obligation: "Reduce your ally limit by 2." */
const LONELY_RULE = stubAbility(
  "lonely.constant",
  def({ trigger: { kind: "constant", rules: [{ kind: "allyLimit", amount: -2 }] }, effects: [] }),
);
const LONELY = stubObligation({ id: "lonely", abilities: [LONELY_RULE.ref] });

/** An encounter attachment and a minion, to be discarded by the sweep below. */
const SNARE = stubAttachment({ id: "snare" });
const GOON = stubMinion({ id: "goon", hp: 3, atk: 1, sch: 1 });

/** A support with "Action: Draw 1 card." */
const DESK_ACTION = stubAbility("desk.action", { trigger: { kind: "action" }, effects: [DRAW_1] });
const DESK = stubSupport({ id: "desk", cost: 0, abilities: [DESK_ACTION.ref] });
/** A player upgrade: "Increase your ally limit by 1." */
const BARRACKS_RULE = stubAbility(
  "barracks.constant",
  def({ trigger: { kind: "constant", rules: [{ kind: "allyLimit", amount: 1 }] }, effects: [] }),
);
const BARRACKS = stubUpgrade({ id: "barracks", cost: 0, abilities: [BARRACKS_RULE.ref] });
/** A player upgrade: "Treat the printed text box of each support you control as if it were blank." */
const GAG_RULE = stubAbility("gag.constant", BLANKING_RULE.definition);
const GAG = stubUpgrade({ id: "gag", cost: 0, abilities: [GAG_RULE.ref] });
/** A player upgrade with "Action: Discard each obligation, encounter attachment and minion." */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "discardFromPlay",
      target: { kind: "each", query: { categories: ["obligation", "attachment", "minion"] } },
    },
  ],
});
const SWEEP = stubUpgrade({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
/** A player upgrade with "Action: Draw 1 card." (a command for the flow to run under). */
const PING_ACTION = stubAbility("ping.action", { trigger: { kind: "action" }, effects: [DRAW_1] });
const PING = stubUpgrade({ id: "ping", cost: 0, abilities: [PING_ACTION.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });

const deps: EngineDeps = depsOf(
  SHOW_OBLIGATION,
  SHOW_ATTACHMENT,
  SHOW_MINION,
  DUTY_ACTION,
  BLANKING_RULE,
  LONELY_RULE,
  DESK_ACTION,
  BARRACKS_RULE,
  GAG_RULE,
  SWEEP_ACTION,
  PING_ACTION,
);

const start = (): GameState =>
  gameAtFirstTurn({
    players: 2,
    cards: [SHOW, DUTY, BLANKING, LONELY, SNARE, GOON, DESK, BARRACKS, GAG, SWEEP, PING, BUDDY],
    deps,
    deck: [DESK.id, BARRACKS.id, GAG.id, SWEEP.id, PING.id, BUDDY.id, BUDDY.id, BUDDY.id, BUDDY.id],
    encounter: [SHOW.id, DUTY.id, DUTY.id, BLANKING.id, LONELY.id, SNARE.id, SNARE.id, GOON.id],
  });

/** Surgery: an obligation in `player`'s play area, controlled by no one. */
function oblige(state: GameState, card: CardId, player: PlayerId): { state: GameState; id: InstanceId } {
  const taken = encounterCardInVillainArea(state, card);
  return {
    id: taken.id,
    state: {
      ...taken.state,
      villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
      players: taken.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, taken.id] } : p,
      ),
    },
  };
}

/** Surgery: the encounter attachment on `host`. */
function snare(state: GameState, host: InstanceId): { state: GameState; id: InstanceId } {
  const taken = encounterCardInVillainArea(state, SNARE.id);
  return {
    id: taken.id,
    state: {
      ...taken.state,
      villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
      instances: {
        ...taken.state.instances,
        [taken.id]: { ...mustInstance(taken.state, taken.id), attachedTo: host },
        [host]: {
          ...mustInstance(taken.state, host),
          attachments: [...mustInstance(taken.state, host).attachments, taken.id],
        },
      },
    },
  };
}

const use = (player: PlayerId, card: InstanceId, ability: string): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: card,
  abilityId: ability as Command extends { abilityId: infer A } ? A : never,
  payment: [],
});
/** Takes the show's response whenever it is offered; every other choice gets the default answer. */
const takingTheDraw = (state: GameState): readonly string[] => {
  const response = state.pendingChoice?.options.find((o) => o.optionId.includes("show."));
  return response ? [response.optionId] : defaultPick(state);
};
const run = (state: GameState, pick: (state: GameState) => readonly string[], ...commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands, pick).session.state;
const handSize = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand.length;
const hands = (state: GameState) => [handSize(state, P1), handSize(state, P2)] as const;
const identityOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;
const alliesOf = (state: GameState, player: PlayerId) =>
  mustPlayer(state, player).playArea.filter((id) => mustInstance(state, id).cardId === BUDDY.id);

describe("a leaving card's player: the one an uncontrolled card spoke to (cardLeavesPlay.speakerId)", () => {
  it("an obligation discarded by its own action: the player whose play area held it is 'that player'", () => {
    const shown = encounterCardInVillainArea(start(), SHOW.id).state;
    const mine = oblige(shown, DUTY.id, P1);
    const before = hands(mine.state);
    const after = run(mine.state, takingTheDraw, use(P1, mine.id, DUTY_ACTION.ref.id));
    expect(mustPlayer(after, P1).playArea).not.toContain(mine.id);
    expect(hands(after)).toEqual([before[0] + 1, before[1]]);
  });

  it("the other player's obligation, discarded by my card: they draw, I do not", () => {
    const shown = encounterCardInVillainArea(start(), SHOW.id).state;
    const theirs = oblige(shown, DUTY.id, P2);
    const sweep = playerCardIntoPlay(theirs.state, SWEEP.id, P1);
    const before = hands(sweep.state);
    const after = run(sweep.state, takingTheDraw, use(P1, sweep.id, SWEEP_ACTION.ref.id));
    expect(mustPlayer(after, P2).playArea).not.toContain(theirs.id);
    expect(hands(after)).toEqual([before[0], before[1] + 1]);
  });

  it("an encounter attachment on a player's card: that card's controller", () => {
    const shown = encounterCardInVillainArea(start(), SHOW.id).state;
    const attached = snare(shown, identityOf(shown, P2));
    const sweep = playerCardIntoPlay(attached.state, SWEEP.id, P1);
    const before = hands(sweep.state);
    const after = run(sweep.state, takingTheDraw, use(P1, sweep.id, SWEEP_ACTION.ref.id));
    expect(mustInstance(after, identityOf(after, P2)).attachments).toEqual([]);
    expect(hands(after)).toEqual([before[0], before[1] + 1]);
  });

  it("a minion, and an attachment on the villain, speak to no player: nobody is offered the response", () => {
    const shown = encounterCardInVillainArea(start(), SHOW.id).state;
    const engaged = minionEngagedWith(shown, GOON.id, P2);
    const villain = activeVillain(engaged.state).instanceId;
    const attached = snare(engaged.state, villain);
    const sweep = playerCardIntoPlay(attached.state, SWEEP.id, P1);
    const before = hands(sweep.state);
    const after = run(sweep.state, takingTheDraw, use(P1, sweep.id, SWEEP_ACTION.ref.id));
    expect(mustPlayer(after, P2).playArea).not.toContain(engaged.id);
    expect(mustInstance(after, villain).attachments).toEqual([]);
    expect(hands(after)).toEqual(before);
  });
});

describe("a blank rule's 'you' is the rule's speaker", () => {
  it("on an obligation: the supports of the player whose play area holds it, and nobody else's", () => {
    const mine = playerCardIntoPlay(start(), DESK.id, P1);
    const theirs = playerCardIntoPlay(mine.state, DESK.id, P2);
    expect(blankedByConstantRules(theirs.state, deps).size).toBe(0);
    const obliged = oblige(theirs.state, BLANKING.id, P1);
    expect([...blankedByConstantRules(obliged.state, deps)]).toEqual([mine.id]);
    expect(applyCommand(obliged.state, use(P1, mine.id, DESK_ACTION.ref.id), deps).ok).toBe(false);
    expect(applyCommand(theirs.state, use(P1, mine.id, DESK_ACTION.ref.id), deps).ok).toBe(true);
    // Held by the other player, it blanks theirs instead.
    const other = oblige(theirs.state, BLANKING.id, P2);
    expect([...blankedByConstantRules(other.state, deps)]).toEqual([theirs.id]);
  });

  it("on a player card: its controller's supports, as before", () => {
    const mine = playerCardIntoPlay(start(), DESK.id, P1);
    const theirs = playerCardIntoPlay(mine.state, DESK.id, P2);
    const gagged = playerCardIntoPlay(theirs.state, GAG.id, P2);
    expect([...blankedByConstantRules(gagged.state, deps)]).toEqual([theirs.id]);
  });
});

describe("an ally limit rule applies to the player it speaks to", () => {
  it("'Reduce your ally limit by 2' on an obligation: its holder's limit is 1, the other player's stays 3", () => {
    const base = start();
    expect([allyLimitFor(base, deps, P1), allyLimitFor(base, deps, P2)]).toEqual([3, 3]);
    const obliged = oblige(base, LONELY.id, P1).state;
    expect([allyLimitFor(obliged, deps, P1), allyLimitFor(obliged, deps, P2)]).toEqual([1, 3]);
  });

  it("'Increase your ally limit by 1' on a player card: its controller's only, as before; both add up", () => {
    const raised = playerCardIntoPlay(start(), BARRACKS.id, P2).state;
    expect([allyLimitFor(raised, deps, P1), allyLimitFor(raised, deps, P2)]).toEqual([3, 4]);
    const both = oblige(raised, LONELY.id, P2).state;
    expect([allyLimitFor(both, deps, P1), allyLimitFor(both, deps, P2)]).toEqual([3, 2]);
  });

  it("an ally limit is never below zero", () => {
    const one = oblige(start(), LONELY.id, P1).state;
    // A second copy (surgery: the same rule twice).
    const copy = playerCardIntoPlay(one, PING.id, P1);
    const twice: GameState = {
      ...copy.state,
      cardPool: { ...copy.state.cardPool, [PING.id]: { ...PING, abilities: [LONELY_RULE.ref, LONELY_RULE.ref] } },
    };
    expect(allyLimitFor(twice, deps, P1)).toBe(0);
  });

  /** Both players control three allies; P1 also has an upgrade whose action gives the flow a command to run under. */
  const threeEach = () => {
    let state = start();
    for (const player of [P1, P2])
      for (let i = 0; i < 3; i++) state = playerCardIntoPlay(state, BUDDY.id, player).state;
    const ping = playerCardIntoPlay(state, PING.id, P1);
    return { state: ping.state, ping: ping.id };
  };

  it("a limit that drops below the allies in play forces its player to discard down at once; the other keeps theirs", () => {
    const { state: base, ping } = threeEach();
    const obliged = oblige(base, LONELY.id, P1).state;
    const result = applyCommand(obliged, use(P1, ping, PING_ACTION.ref.id), deps);
    if (!result.ok) throw new Error(result.error.message);
    const choice = result.state.pendingChoice;
    expect(choice?.playerId).toBe(P1);
    expect(choice?.prompt).toEqual({ kind: "discardOverAllyLimit", limit: 1 });
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([2, 2]);
    expect(choice?.options.map((o) => o.optionId).sort()).toEqual([...alliesOf(obliged, P1)].sort());
    const after = run(obliged, defaultPick, use(P1, ping, PING_ACTION.ref.id));
    expect(alliesOf(after, P1)).toHaveLength(1);
    expect(alliesOf(after, P2)).toHaveLength(3);
  });

  it("three allies with no reduction in play: nobody is asked", () => {
    const { state, ping } = threeEach();
    const result = applyCommand(state, use(P1, ping, PING_ACTION.ref.id), deps);
    expect(result.ok && result.state.pendingChoice).toBe(null);
  });

  it("an ally played past the reduced limit is discarded down to it (one ally stays)", () => {
    const one = playerCardIntoPlay(oblige(start(), LONELY.id, P1).state, BUDDY.id, P1);
    const two = playerCardIntoPlay(one.state, PING.id, P1);
    // Within the limit: nothing is asked.
    const within = applyCommand(two.state, use(P1, two.id, PING_ACTION.ref.id), deps);
    expect(within.ok && within.state.pendingChoice).toBe(null);
    const second = playerCardIntoPlay(two.state, BUDDY.id, P1);
    const over = applyCommand(second.state, use(P1, two.id, PING_ACTION.ref.id), deps);
    if (!over.ok) throw new Error(over.error.message);
    expect(over.state.pendingChoice?.prompt).toEqual({ kind: "discardOverAllyLimit", limit: 1 });
    expect(over.state.pendingChoice?.minSelections).toBe(1);
  });
});
