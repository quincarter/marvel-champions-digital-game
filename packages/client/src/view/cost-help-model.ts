/**
 * Another player paying a part of a cost in the user's place (`RuleSpec costsPayableByAnyPlayer`, "While paying costs
 * on attached card, any player may help pay those costs"; docs/phase7-wave10-hero-packs.md H3.19).
 *
 * A helper's resources and cards need nothing new: the engine lists them as payment sources and cost picks, and the
 * payment bar already says who helped (`payment-model.ts`). What a card cannot carry is a part worded "you" with no
 * card named ("take 2 damage", "discard the top card of your deck"). `legalActions` says who can pay each such part
 * right now (`LegalAction.costHelp`); `example` has the user pay it whenever they can. This module is the pure read of
 * that offer and of the answer: the prompts to ask before the command is built, the `costSelection.paidBy` an answer
 * makes, and the words for the bar. Every judgement stays the engine's: a named helper is checked by `tryPayment` or by
 * the command itself, and `costHelpFor` gives a helper the reason they cannot.
 */
import {
  controllerOf,
  costHelpFor,
  type Command,
  type CostSelection,
  type DelegableCostPart,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from "@mc/engine";
import { faceUpName } from "./names.js";

/** What each part asks of whoever pays it, as the prompt's title and as the bar's line. */
const PART_WORDS: Readonly<Record<DelegableCostPart, { readonly ask: string; readonly did: string }>> = {
  damageSelf: { ask: "takes the damage", did: "the damage" },
  indirectDamage: { ask: "takes the indirect damage", did: "the indirect damage" },
  discardFromDeck: { ask: "discards from their deck", did: "the discard from their deck" },
  discardRandomFromHand: { ask: "discards at random from their hand", did: "the random discard from their hand" },
  dealEncounterCards: { ask: "is dealt the encounter card", did: "the encounter card dealt" },
};

export interface CostHelpOption {
  readonly playerId: PlayerId;
  /** "You" for the player using the ability, the hero's name for anyone else. */
  readonly label: string;
}

/** A player who cannot pay a part right now, and the engine's own reason (`costHelpFor`). */
export interface CostHelpRefusal {
  readonly playerId: PlayerId;
  readonly label: string;
  readonly reason: string;
}

/** One question to ask before an ability with a shareable part is used: which player pays that part. */
export interface CostHelpPrompt {
  readonly part: DelegableCostPart;
  readonly title: string;
  readonly options: readonly CostHelpOption[];
  /** Players who cannot take this part, with why ("Their deck is too short"); empty when `deps` were not given. */
  readonly unavailable: readonly CostHelpRefusal[];
}

const nameOf = (state: GameState, playerId: PlayerId): string => {
  const seat = state.players.find((player) => player.playerId === playerId);
  return (seat && faceUpName(state, seat.identity.instanceId)) || "Another player";
};

/**
 * The questions this action asks: one per part more than one player can pay, or that only another player can. A part
 * only the user can pay is not asked (there is nothing to choose), and an action with no `costHelp` asks nothing.
 */
export function costHelpPromptsFor(state: GameState, entry: LegalAction, deps?: EngineDeps): readonly CostHelpPrompt[] {
  const userId = entry.example.playerId;
  return (entry.costHelp ?? [])
    .filter((help) => help.payers.some((payer) => payer !== userId))
    .map((help) => ({
      part: help.part,
      title: `Who ${PART_WORDS[help.part].ask}?`,
      options: help.payers.map((playerId) => ({
        playerId,
        label: playerId === userId ? "You" : nameOf(state, playerId),
      })),
      unavailable: deps
        ? state.players
            .map((player) => player.playerId)
            .filter((playerId) => !help.payers.includes(playerId))
            .flatMap((playerId) => {
              const answer = costHelpFor(state, userId, entry.action, playerId, {}, deps).find(
                (candidate) => candidate.part === help.part,
              );
              return answer && !answer.ok
                ? [{ playerId, label: playerId === userId ? "You" : nameOf(state, playerId), reason: answer.message }]
                : [];
            })
        : [],
    }));
}

/**
 * `entry` with the answers to its prompts in the command its `example` is: each `[part, payer]` goes through
 * `withCostHelper`, so a part the user pays is left out of `paidBy`. Later steps (a branch pick, a payment) start from
 * this command's `paidBy`, so the answer is not asked twice.
 */
export function withCostHelpAnswers(
  entry: LegalAction,
  answers: readonly (readonly [DelegableCostPart, PlayerId])[],
): LegalAction {
  const { example } = entry;
  if (example.type !== "useAbility" && example.type !== "playCard") return entry;
  let selection = example.costSelection;
  for (const [part, payer] of answers) selection = withCostHelper(selection, example.playerId, part, payer);
  const { costSelection: _old, ...rest } = example;
  return { ...entry, example: { ...rest, ...(selection ? { costSelection: selection } : {}) } as Command };
}

/**
 * `selection` with the parts of `entry`'s command that another player pays carried over (a branch pick or a counter
 * count is built from nothing, and would otherwise lose them). Undefined when there is nothing to say.
 */
export function withEntryPayers(entry: LegalAction, selection?: CostSelection): CostSelection | undefined {
  const { example } = entry;
  const paidBy =
    example.type === "useAbility" || example.type === "playCard" ? example.costSelection?.paidBy : undefined;
  if (!paidBy || Object.keys(paidBy).length === 0) return selection;
  return { ...selection, paidBy: { ...paidBy, ...selection?.paidBy } };
}

/** One other player who must agree before `command` is sent: the cards of theirs it uses and the parts they pay. */
export interface ConsentHelper {
  readonly playerId: PlayerId;
  readonly instanceIds: readonly InstanceId[];
  readonly parts: readonly DelegableCostPart[];
}

/**
 * Every other player `command` takes something from, in seat order: the cards it names in `costChoices` (a discard
 * from hand, a card in play) that sit in another player's hand or area, the parts `costSelection.paidBy` hands them,
 * and `fromPayment`, the helpers a payment already found (their hand cards and resource abilities). Empty for any
 * command that touches only the user's own things, which is every command off a card without the shared-cost rule.
 */
export function consentHelpersOf(
  state: GameState,
  userId: PlayerId,
  command: Command,
  fromPayment: readonly { readonly playerId: PlayerId; readonly instanceIds: readonly InstanceId[] }[] = [],
): readonly ConsentHelper[] {
  const cards = new Map<PlayerId, InstanceId[]>();
  const add = (playerId: PlayerId, ids: readonly InstanceId[]): void => {
    const list = cards.get(playerId) ?? [];
    for (const id of ids) if (!list.includes(id)) list.push(id);
    cards.set(playerId, list);
  };
  for (const helper of fromPayment) add(helper.playerId, helper.instanceIds);
  const choices = command.type === "useAbility" || command.type === "playCard" ? command.costChoices : undefined;
  for (const ids of Object.values(choices ?? {})) {
    for (const id of ids) {
      // A card in another player's hand is a discard from their hand. A card in their play area counts only for an
      // ability's cost: a play's `host` pick is where a card goes, not something it takes from that player.
      const inHand = state.players.find((player) => player.hand.includes(id));
      const owner = inHand?.playerId ?? (command.type === "useAbility" ? controllerOf(state, id) : null);
      if (owner && owner !== userId) add(owner, [id]);
    }
  }
  const selection = command.type === "useAbility" || command.type === "playCard" ? command.costSelection : undefined;
  const parts = new Map(costHelpersOf(state, userId, selection).map((helper) => [helper.playerId, helper.parts]));
  return state.players
    .map((player) => player.playerId)
    .filter((playerId) => cards.has(playerId) || parts.has(playerId))
    .map((playerId) => ({ playerId, instanceIds: cards.get(playerId) ?? [], parts: parts.get(playerId) ?? [] }));
}

/** "the damage", "the random discard from their hand": what a helper agrees to pay, for the consent bar. */
export const costPartDid = (part: DelegableCostPart): string => PART_WORDS[part].did;

/**
 * `selection` with `payer` paying `part`: named in `paidBy` when they are not the user, removed from it when they
 * are (the user pays whatever is not named). Undefined when nothing is left to say.
 */
export function withCostHelper(
  selection: CostSelection | undefined,
  userId: PlayerId,
  part: DelegableCostPart,
  payer: PlayerId,
): CostSelection | undefined {
  const { paidBy, ...rest } = selection ?? {};
  const { [part]: _replaced, ...others } = paidBy ?? {};
  const next = payer === userId ? others : { ...others, [part]: payer };
  const merged: CostSelection = { ...rest, ...(Object.keys(next).length > 0 ? { paidBy: next } : {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/** The other players `selection` hands a part to, in seat order, each with the parts they pay: who must agree. */
export function costHelpersOf(
  state: GameState,
  userId: PlayerId,
  selection: CostSelection | undefined,
): readonly { readonly playerId: PlayerId; readonly parts: readonly DelegableCostPart[] }[] {
  const entries = Object.entries(selection?.paidBy ?? {}) as [DelegableCostPart, PlayerId][];
  return state.players
    .map((player) => player.playerId)
    .filter((playerId) => playerId !== userId)
    .map((playerId) => ({ playerId, parts: entries.filter(([, payer]) => payer === playerId).map(([part]) => part) }))
    .filter((helper) => helper.parts.length > 0);
}

/** "Helped by Spider-Man: the damage", one line per other player `selection` hands a part to. */
export function costHelpLines(
  state: GameState,
  userId: PlayerId,
  selection: CostSelection | undefined,
): readonly string[] {
  return costHelpersOf(state, userId, selection).map(
    (helper) =>
      `Helped by ${nameOf(state, helper.playerId)}: ${helper.parts.map((part) => PART_WORDS[part].did).join(", ")}`,
  );
}
