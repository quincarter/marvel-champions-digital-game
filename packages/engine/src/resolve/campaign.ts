/**
 * Writing back to the campaign from inside a game (design §6.1, §6.2).
 *
 * A game never touches a `CampaignLog`: both kinds of write accumulate in `GameState.campaignWrites` as plain data
 * and the runner folds them in afterwards (design §7.2). They are kept there — rather than being derived from the
 * event stream when the game ends — so that a game *is* the record of what it wrote, and so a lost game's writes stay
 * distinguishable from the between-games writes `LossPolicy.retryBaseline` rolls back: RRG 1.8 p. 29 keeps a removal
 * "even if players retry the scenario wherein that card was removed", and design §6.2 reads an in-game log write the
 * same way.
 */

import { campaignFaceOf, sameCampaignFace } from "../campaign-state.js";
import { NO_CAMPAIGN_WRITES, type CampaignLogValueSpec, type LogValue, type LogWrite } from "../campaign.js";
import { emit, type Ctx } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import { getInstance } from "../query.js";
import { evaluate, resolveValue, type EffectContext } from "../select.js";
import { selectCards } from "./cards.js";

/** Appends one resolved write. Silently does nothing outside a campaign game, where there is nothing to write to. */
export function recordCampaignWrite(ctx: Ctx, write: LogWrite): void {
  if (!ctx.state.campaign) return;
  const writes = ctx.state.campaignWrites ?? NO_CAMPAIGN_WRITES;
  ctx.state = { ...ctx.state, campaignWrites: { ...writes, logWrites: [...writes.logWrites, write] } };
  emit(ctx, { type: "campaignLogWritten", write });
}

/**
 * Records one card **face** as removed from the campaign (RRG 1.8 p. 29; ruling April 30, 2026 (4) answer 2).
 *
 * Recording the same face twice adds nothing and says nothing: removal is a fact about the campaign, not a counter.
 * A second *face* of the same card is a separate removal, which is the whole point of the ruling.
 */
export function recordCampaignRemoval(ctx: Ctx, id: InstanceId): void {
  if (!ctx.state.campaign || !getInstance(ctx.state, id)) return;
  const card = campaignFaceOf(ctx.state, id);
  if (!card) return;
  const writes = ctx.state.campaignWrites ?? NO_CAMPAIGN_WRITES;
  if (writes.removedFromCampaign.some((removed) => sameCampaignFace(removed, card))) return;
  ctx.state = {
    ...ctx.state,
    campaignWrites: { ...writes, removedFromCampaign: [...writes.removedFromCampaign, card] },
  };
  emit(ctx, { type: "campaignCardRemoved", instanceId: id, card });
}

/**
 * The `LogValue` an in-game write puts in the field, read out of the game the way any card ability reads it.
 *
 * Null when a `cardRef` write names no card — "record the name of the card you chose" with nothing chosen records
 * nothing, rather than a card-shaped hole the runner would have to interpret.
 */
export function campaignLogValueOf(ctx: Ctx, spec: CampaignLogValueSpec, context: EffectContext): LogValue | null {
  switch (spec.kind) {
    case "number":
      return { kind: "number", value: resolveValue(ctx.state, spec.amount, context, ctx.deps) };
    case "flag":
      return { kind: "flag", value: spec.when ? evaluate(ctx.state, spec.when, context) : true };
    case "cardList": {
      // Duplicates are kept: "Record each copy individually" (ruling June 2, 2026 (3) answer 3).
      const cardIds = selectCards(ctx, spec.cards, context).flatMap((id) => {
        const instance = getInstance(ctx.state, id);
        return instance ? [instance.cardId] : [];
      });
      return { kind: "cardList", cardIds };
    }
    case "cardRef": {
      const [id] = selectCards(ctx, spec.card, context);
      const card = id === undefined ? null : campaignFaceOf(ctx.state, id);
      if (!card) return null;
      return spec.withFace && card.face !== undefined
        ? { kind: "cardRef", cardId: card.cardId, face: card.face }
        : { kind: "cardRef", cardId: card.cardId };
    }
    case "choice":
      return { kind: "choice", option: spec.option };
    case "text":
      return { kind: "text", value: spec.value };
  }
}
