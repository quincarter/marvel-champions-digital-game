import { cardId, PLAYABLE_CARDS } from "@mc/content";
import type { EngineDeps, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { DRAX_KIT } from "../wave3/drax/drax-kit.js";
import { firstLegal, P1, patchInstance, playerOf, use, type Picker } from "./harness.js";
import { driveEventsPicking } from "./staging.js";

/** Moondragon (`drax` 19013): "Action: exhaust and discard Moondragon → that minion attacks another enemy of your choice". */
export const MOONDRAGON = "19013";
const MOONDRAGON_ACTION = "19013.moondragon-action";

/**
 * Makes one official enemy attack another with a real card: Moondragon is put into `player`'s play area (one of their
 * deck cards becomes her) and her action is used, choosing `attacker` and `target`. The attack is the engine's
 * `enemyAttacksEnemy` (docs/phase7-wave3.md §3.23, §4 Q12), which "when/after [this card] is attacked" also hears
 * (`patternHearsKind`). Every other choice goes to `pick`. Moondragon's card and script are added to the game's card
 * pool and to `deps` for this run when an earlier wave's game lacks them.
 */
export function moondragonAttack(
  deps: EngineDeps,
  state: GameState,
  attacker: InstanceId,
  target: InstanceId,
  opts: { readonly pick?: Picker; readonly player?: PlayerId } = {},
): { readonly state: GameState; readonly events: readonly GameEvent[]; readonly moondragon: InstanceId } {
  const player = opts.player ?? P1;
  const pick = opts.pick ?? firstLegal;
  const owner = playerOf(state, player);
  const moondragon = owner.deck[0] ?? owner.discard[0];
  if (!moondragon) throw new Error(`${player} has no deck or discard card to turn into Moondragon`);
  const card = PLAYABLE_CARDS.find((c) => c.id === cardId(MOONDRAGON));
  if (!card) throw new Error(`no card ${MOONDRAGON}`);
  const placed: GameState = {
    ...state,
    cardPool: { ...state.cardPool, [card.id]: card },
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: p.deck.filter((id) => id !== moondragon),
            discard: p.discard.filter((id) => id !== moondragon),
            playArea: [...p.playArea, moondragon],
          }
        : p,
    ),
  };
  const staged = patchInstance(placed, moondragon, {
    cardId: cardId(MOONDRAGON),
    faceup: true,
    exhausted: false,
    controllerId: player,
  });
  const choosing: Picker = (s) => {
    const prompt = s.pendingChoice?.prompt;
    if (prompt?.kind === "chooseTarget" && prompt.slot === "attacker") return [attacker];
    if (prompt?.kind === "chooseTarget" && prompt.slot === "attacked") return [target];
    return pick(s);
  };
  const ability = DRAX_KIT[MOONDRAGON_ACTION];
  const withMoondragon: EngineDeps =
    deps.abilities[MOONDRAGON_ACTION] !== undefined || ability === undefined
      ? deps
      : { ...deps, abilities: { ...deps.abilities, [MOONDRAGON_ACTION]: ability } };
  const run = driveEventsPicking(withMoondragon, staged, choosing, use(player, moondragon, MOONDRAGON_ACTION));
  return { ...run, moondragon };
}
