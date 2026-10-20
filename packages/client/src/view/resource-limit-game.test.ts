/**
 * Issue #292: Finesse ("Hero Resource: Exhaust Finesse → generate a [wild] resource for an aspect card") can't pay for
 * Self-Propelled Glide, a Spider-Woman hero card that shows no aspect. Inspect says so on both cards, from the engine's
 * own answer (`resourcesNotFor`), with a real Spider-Woman game; the pause menu's table rules explain "aspect card".
 */
import { beforeAll, describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import { applyCommand, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { SessionStore } from "../store/session-store.js";
import { inspectModel } from "./inspect-model.js";
import { rulesGlossaryOf } from "./rules-reference.js";

const FINESSE = "04033";
const GLIDE = "04039";
const INTERROGATION_ROOM = "04048";

let state: GameState;
let me: PlayerId;
let finesse: InstanceId;
let glide: InstanceId;
let room: InstanceId;

/** Moves the first copy of each code from the deck (or the hand) to the front of the hand. */
function intoHand(game: GameState, playerId: PlayerId, codes: readonly string[]): [GameState, InstanceId[]] {
  const player = game.players.find((p) => p.playerId === playerId)!;
  const ids = codes.map((code) => {
    const found = [...player.hand, ...player.deck].find((id) => game.instances[id]?.cardId === cardId(code));
    if (!found) throw new Error(`${code} not in ${playerId}'s deck or hand`);
    return found;
  });
  const rest = (list: readonly InstanceId[]) => list.filter((id) => !ids.includes(id));
  return [
    {
      ...game,
      players: game.players.map((p) =>
        p.playerId === playerId ? { ...p, deck: rest(p.deck), hand: [...ids, ...rest(p.hand)] } : p,
      ),
    },
    ids,
  ];
}

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "spider-woman-aggression-justice" }],
    seed: 11,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  me = store.state.perspectiveId!;
  const flipped = applyCommand(store.state.game!, { type: "changeForm", playerId: me }, POOL_DEPS);
  if (!flipped.ok) throw new Error(flipped.error.message);
  const [staged, ids] = intoHand(flipped.state, me, [FINESSE, GLIDE, INTERROGATION_ROOM]);
  [finesse, glide, room] = ids as [InstanceId, InstanceId, InstanceId];
  // Finesse costs 2: paid with two hand cards that are none of the three.
  const payers = staged.players
    .find((p) => p.playerId === me)!
    .hand.filter((id) => !ids.includes(id))
    .slice(0, 2);
  const played = applyCommand(
    staged,
    {
      type: "playCard",
      playerId: me,
      cardInstanceId: finesse,
      payment: payers.map((id) => ({ fromHand: id })),
      attachToInstanceId: null,
    },
    POOL_DEPS,
  );
  if (!played.ok) throw new Error(played.error.message);
  state = played.state;
});

describe("Inspect explains Finesse's limit (issue #292)", () => {
  test("Finesse says it pays only for an aspect card, and what that is", () => {
    const note = inspectModel(state, finesse, null, me, POOL_DEPS).resourceNote;
    expect(note).toContain("It pays only for an aspect card");
    expect(note).toContain("a hero's own card counts only if it shows one too");
  });

  test("Self-Propelled Glide names Finesse and why it can't help pay", () => {
    expect(inspectModel(state, glide, null, me, POOL_DEPS).resourceNote).toBe(
      "Finesse can't help pay for this card: it pays only for an aspect card, and this card shows no aspect.",
    );
  });

  test("an aspect card Finesse can pay for gets no such note", () => {
    expect(inspectModel(state, room, null, me, POOL_DEPS).resourceNote).toBeNull();
  });

  test("while paying for Glide, Finesse's own note says it can't pay for it", () => {
    const note = inspectModel(state, finesse, null, me, POOL_DEPS, {
      payment: {
        subjectInstanceId: glide,
        paid: 0,
        required: 1,
        spendableInstanceIds: new Set(),
        notForInstanceIds: new Set([finesse]),
      },
    }).resourceNote;
    expect(note).toContain("It can't pay for Self-Propelled Glide.");
  });
});

describe("the pause menu's table rules explain aspect cards (issue #292)", () => {
  test("lists Aspect card with the table's cards that name it", () => {
    const entry = rulesGlossaryOf(state, POOL_DEPS).find((candidate) => candidate.id === "aspectCard");
    expect(entry?.definition).toContain("Self-Propelled Glide shows none");
    expect(entry?.cardRefs.map((ref) => ref.name)).toContain("Finesse");
  });
});
