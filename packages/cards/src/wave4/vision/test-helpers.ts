import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { firstLegal, moveToHand, P1, playerOf, runWith, settle, type Picker } from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";

/**
 * `playFromHand`'s own `payWith` picks the first N *other* hand cards regardless of what resource type they print
 * (`packages/cards/src/testing/harness.ts`), which only pays a specific-type cost (Density Control's mental pip,
 * Jocasta's mental pip, …) by luck of the opening hand. This guarantees the payment by explicitly drawing one of
 * Vision's own basic resource cards (Energy/26025 energy·2, Genius/26026 mental·2, Strength/26027 physical·2) first
 * and spending it alongside however many more arbitrary hand cards the rest of the cost needs.
 */
export function playFromHandTyped(
  state: GameState,
  code: string,
  cost: number,
  resourceCode: "26025" | "26026" | "26027",
  pick: Picker = firstLegal,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const givenCard = moveToHand(state, player, code);
  const [id] = givenCard.ids as [InstanceId];
  const givenResource = moveToHand(givenCard.state, player, resourceCode);
  const [resource] = givenResource.ids as [InstanceId];
  const rest = playerOf(givenResource.state, player)
    .hand.filter((c) => c !== id && c !== resource)
    .slice(0, Math.max(0, cost - 1));
  const payment = [resource, ...rest];
  const played = settle(
    runWith(WAVE4_DEPS, givenResource.state, {
      type: "playCard",
      playerId: player,
      cardInstanceId: id,
      payment: payment.map((from) => ({ fromHand: from })),
      attachToInstanceId: null,
    } as never),
    pick,
    undefined,
    WAVE4_DEPS,
  );
  return { state: played, id };
}
