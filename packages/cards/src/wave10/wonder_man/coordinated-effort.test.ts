import { applyCommand, legalActions, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  APPEAL,
  APPEAL_ACTION,
  BACKFLIP,
  EFFORT_REF,
  EXHAUST_BRANCH,
  GENIUS,
  SPEND_BRANCH,
  UNREGISTERED_ACTION,
  UNREGISTERED_SUPER,
  effortOn,
  emptyHand,
  herculesTable,
  obligationHeld,
} from "../../dsl/wave10-costs-payable-by-any-player.testing.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE10_DEPS } from "../testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * 58032 Coordinated Effort (Wonder Man's pack, Leadership upgrade): "Attach to an encounter card in play. Max 1 per
 * encounter card. While paying costs on attached card, any player may help pay those costs." Played from the pack's
 * registered script (`WAVE10_DEPS`) in real games against Core's Rhino: Hercules holds an obligation, Core's
 * Spider-Man is the other player.
 *
 * Owner answer 21B (docs/phase7-wave10.md section 4.0), an interpretation: the words are the Rules Reference's for
 * Alliance (RRG 1.8 p. 6) and neither limits costs to resources, so other players may pay resources and any other part
 * their own cards can pay; a part that names the user's own card stays with the user. No ruling in
 * docs/rulings/marvel-champions-rulings-post-rrg-1-7.md names the card.
 *
 * - Appeal to Athena (`hercules` 59035): "Alter-Ego Action: Exhaust Hercules or spend [mental][mental] → remove this
 *   obligation from the game."
 * - Unregistered Super (Civil War 56106): "Alter-Ego Action: Discard an identity-specific card from your hand →
 *   discard this card."
 */
const run = (state: GameState, ...commands: Command[]) =>
  driveEventsPicking(WAVE10_DEPS, state, firstLegal, ...commands);
const refusal = (state: GameState, command: Command) => {
  const result = applyCommand(state, command, WAVE10_DEPS);
  return result.ok ? null : result.error.code;
};
const fromHand = (...ids: readonly InstanceId[]) => ids.map((id) => ({ fromHand: id }));
/** Whether `legalActions` offers P1 an ability on `card`, and the branches of its either/or cost it can pay. */
function offered(state: GameState, card: InstanceId) {
  const actions = legalActions(state, P1, WAVE10_DEPS);
  if (actions.kind !== "turn") throw new Error(`not P1's turn: ${actions.kind}`);
  return actions.legal.find((entry) => entry.action.kind === "useAbility" && entry.action.instanceId === card);
}

describe("58032 Coordinated Effort", () => {
  it("is registered, and its script is the rule on the attached card", () => {
    expect(WAVE10_DEPS.abilities[EFFORT_REF]?.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "costsPayableByAnyPlayer", card: { hostOfSelf: true } }],
    });
  });

  it("a helper pays the resources: Spider-Man's Genius pays Appeal to Athena's [mental][mental] for Hercules", () => {
    const held = obligationHeld(herculesTable({ twoPlayers: true }), APPEAL);
    const attached = effortOn(held.state, held.id);
    const given = moveToHand(emptyHand(attached.state, P1), P2, GENIUS);
    const genius = given.ids[0]!;
    expect(offered(given.state, held.id)?.costBranches).toEqual([0, 1]);

    const out = run(given.state, use(P1, held.id, APPEAL_ACTION, fromHand(genius), undefined, SPEND_BRANCH));
    expect(out.state.removedFromGame).toContain(held.id);
    expect(playerOf(out.state, P2).discard).toContain(genius);
    expect(inst(out.state, identityOf(out.state, P1)).exhausted).toBe(false);
    // The upgrade was attached to the obligation; with its card gone it is discarded (RRG 1.8 "Attachment", p. 8).
    expect(playerOf(out.state, P1).discard).toContain(attached.id);

    // The same table without the upgrade: the Genius is not Hercules's to spend.
    const bare = moveToHand(emptyHand(held.state, P1), P2, GENIUS);
    const command = use(P1, held.id, APPEAL_ACTION, fromHand(bare.ids[0]!), undefined, SPEND_BRANCH);
    expect(refusal(bare.state, command)).toBe("card_not_in_zone");
    expect(offered(bare.state, held.id)?.costBranches).toEqual([0]);
  });

  it("a helper pays a non-resource part: Spider-Man discards Backflip for Unregistered Super's discard", () => {
    const held = obligationHeld(herculesTable({ twoPlayers: true }), UNREGISTERED_SUPER);
    const attached = effortOn(held.state, held.id);
    const given = moveToHand(emptyHand(attached.state, P1), P2, BACKFLIP);
    const flip = given.ids[0]!;
    // Hercules holds no card at all, so only the helper's identity-specific card can pay.
    expect(offered(given.state, held.id)).toBeDefined();

    const out = run(given.state, use(P1, held.id, UNREGISTERED_ACTION, [], { discard: [flip] }));
    expect(playerOf(out.state, P2).discard).toContain(flip);
    expect(playerOf(out.state, P1).playArea).not.toContain(held.id);

    const bare = moveToHand(emptyHand(held.state, P1), P2, BACKFLIP);
    expect(refusal(bare.state, use(P1, held.id, UNREGISTERED_ACTION, [], { discard: [bare.ids[0]!] }))).toBe(
      "card_not_in_zone",
    );
    expect(offered(bare.state, held.id)).toBeUndefined();
  });

  it("a part naming the user's own card is not delegated: 'Exhaust Hercules' is Hercules's alone", () => {
    const held = obligationHeld(herculesTable({ twoPlayers: true }), APPEAL);
    const attached = effortOn(held.state, held.id).state;
    const tired = patchInstance(emptyHand(emptyHand(attached, P1), P2), identityOf(attached, P1), { exhausted: true });
    // Hercules is exhausted, nobody holds a card: neither branch can be paid, however ready Spider-Man is.
    expect(inst(tired, identityOf(tired, P2)).exhausted).toBe(false);
    expect(offered(tired, held.id)).toBeUndefined();
    expect(refusal(tired, use(P1, held.id, APPEAL_ACTION, [], undefined, EXHAUST_BRANCH))).toBe("already_exhausted");
    // A hand-built command that names Spider-Man for the exhaust is refused.
    const handed = { ...EXHAUST_BRANCH, paidBy: { exhaustIdentity: P2 } } as never;
    expect(refusal(tired, use(P1, held.id, APPEAL_ACTION, [], undefined, handed))).toBe("invalid_choice");
    // The helper cannot trigger the obligation either: it is in Hercules's play area (RRG 1.8 "Obligation", p. 30).
    expect(refusal(tired, use(P2, held.id, APPEAL_ACTION, [], undefined, EXHAUST_BRANCH))).not.toBeNull();

    // Ready, Hercules pays it himself, and only he exhausts.
    const out = run(attached, use(P1, held.id, APPEAL_ACTION, [], undefined, EXHAUST_BRANCH));
    expect(inst(out.state, identityOf(out.state, P1)).exhausted).toBe(true);
    expect(inst(out.state, identityOf(out.state, P2)).exhausted).toBe(false);
  });

  it("solo it changes nothing: the same legal action with and without the upgrade", () => {
    const held = obligationHeld(herculesTable(), APPEAL);
    const attached = effortOn(held.state, held.id).state;
    const bare = offered(held.state, held.id);
    const helped = offered(attached, held.id);
    expect(helped?.example).toEqual(bare?.example);
    expect(helped?.costBranches).toEqual(bare?.costBranches);
    expect(helped?.costHelp).toBeUndefined();
    // With an empty hand the spend branch is out of reach either way.
    expect(offered(emptyHand(attached, P1), held.id)?.costBranches).toEqual([0]);
    expect(offered(emptyHand(held.state, P1), held.id)?.costBranches).toEqual([0]);
  });
});
