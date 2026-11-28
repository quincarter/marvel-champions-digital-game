/**
 * Which question the pending call is, and the data its kind draws from. Pure over the Briefing's state and the pending
 * choice (the engine's own offer): what is legal is read from `pending.options`, never recomputed here. The order is the
 * old screen's: role-building, the side-scheme pick, the modular-set pick, then a plain pick (a role tile set, a random
 * accept / decline, or a list of options).
 */
import { CAMPAIGNS as CONTENT_CAMPAIGNS, type AnyCard, type CoreAspect } from "@mc/content";
import type { CampaignPendingChoice } from "@mc/engine";
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import { POOL_SCENARIOS, packNameOf } from "../../../../content/pool.js";
import { cardPickOptionsOf } from "../../../../view/campaign-briefing-model.js";
import { optionLabelsOf } from "../../../../view/campaign-option-labels.js";
import {
  isModularSetCall,
  modularCallSourceOf,
  modularSetCallOf,
} from "../../../../view/campaign-modular-call-model.js";
import { isRoleBuildChoice, seatRoleOf, type RoleBuildCard } from "../../../../view/campaign-role-build-model.js";
import { isRoleChoice, seatHeaderOf } from "../../../../view/campaign-role-call-model.js";
import { sideSchemeBriefingOf } from "../../../../view/campaign-side-scheme-model.js";
import { cardCountForSet, descriptorForSet } from "../../../../view/modular-sets.js";
import type { BriefingState } from "../context.js";
import { ENCOUNTER_SET_NAMES, KNOWN_ENCOUNTER_SET_IDS, cardNameOf, heroNameOf } from "../names.js";
import type { CallKind, RoleBuildData } from "./calls.types.js";

const rolesOf = (state: BriefingState): NonNullable<(typeof CONTENT_CAMPAIGNS)[number]["roles"]> | undefined =>
  CONTENT_CAMPAIGNS.find((campaign) => (campaign.id as string) === (state.record?.campaignId as string))?.roles;

/** Role-building's context and its cards (the seat's role, deck aspects and hero stats), or null for any other choice. */
export function roleBuildDataOf(state: BriefingState, pending: CampaignPendingChoice): RoleBuildData | null {
  const record = state.record;
  const roles = rolesOf(state);
  const seat = record?.seats.find((candidate) => candidate.seatNumber === pending.seatNumber);
  if (!roles || !seat) return null;
  const role = seatRoleOf(seat, roles, state.answers);
  const cardOf = (id: string): { type: string; aspect?: string } | undefined => {
    const card = campaignCardsById().get(id);
    return card ? { type: card.type, aspect: (card as { aspect?: string }).aspect ?? "" } : undefined;
  };
  if (!role || !isRoleBuildChoice(pending, role, cardOf)) return null;
  const hero = campaignCardsById().get(seat.identityCardId as string);
  const labels = optionLabelsOf(pending.options, (id) => campaignCardsById().get(id), packNameOf);
  const cards = pending.options.map((id): RoleBuildCard => {
    const card = campaignCardsById().get(id)! as AnyCard & {
      aspect: CoreAspect;
      cost?: number;
      specialCost?: unknown;
      text?: { current: string };
    };
    return {
      id,
      label: labels.get(id) ?? card.name,
      name: card.name,
      type: card.type as "event" | "upgrade",
      aspect: card.aspect,
      cost: card.specialCost ? null : (card.cost ?? null),
      text: card.text?.current ?? "",
    };
  });
  return {
    cards,
    ctx: {
      heroName: heroNameOf(seat.identityCardId),
      roleName: role.name,
      roleAspects: role.aspects as readonly CoreAspect[],
      deckAspects: seat.deck.aspects as readonly CoreAspect[],
      atk: hero?.type === "hero_identity" ? hero.hero.atk : null,
      thw: hero?.type === "hero_identity" ? hero.hero.thw : null,
    },
  };
}

/** The question the pending call is. */
export function callKindOf(state: BriefingState, pending: CampaignPendingChoice): CallKind {
  const { record, definition } = state;
  if (record) {
    const build = roleBuildDataOf(state, pending);
    if (build) return { kind: "roleBuild", build };
    if (definition && pending.seatNumber === null) {
      const scheme = sideSchemeBriefingOf({ definition, record, pending, cardName: cardNameOf });
      if (scheme && scheme.instructionId === pending.instructionId && scheme.offered.length > 0) {
        return { kind: "sideScheme", scheme };
      }
    }
    const roles = rolesOf(state);
    if (definition && isModularSetCall(pending, KNOWN_ENCOUNTER_SET_IDS, roles)) {
      const node = definition.graph.nodes.find((candidate) => candidate.id === record.position.nextNodeId);
      const source = node
        ? modularCallSourceOf(
            pending,
            [...(definition.everyNodeSetup ?? []), ...(node.composition ?? []), ...node.setup],
            definition.logFields,
            record.shared,
          )
        : null;
      if (node && source) {
        const scenarioId = node.scenario.kind === "fixed" ? (node.scenario.scenarioId as string) : null;
        const view = modularSetCallOf({
          pending,
          answers: state.answers,
          universe: source.universe,
          checkedOff: source.checkedOff,
          scenario: POOL_SCENARIOS.find((scenario) => (scenario.id as string) === scenarioId),
          seatCount: record.seats.length,
          setNameOf: (id) => ENCOUNTER_SET_NAMES.get(id) ?? id,
          cardCountOf: (id) => cardCountForSet(id, campaignCardsById()),
          descriptorOf: (id) => descriptorForSet(id, campaignCardsById()),
        });
        return { kind: "modular", view };
      }
    }
    const header = seatHeaderOf(pending, record.seats, heroNameOf);
    if (roles && header && isRoleChoice(pending, roles)) return { kind: "role", roles, header };
  }
  if (pending.random) return { kind: "random" };
  return { kind: "options", cards: cardPickOptionsOf(pending.options, (id) => campaignCardsById().get(id)) };
}

let memo: { readonly pending: CampaignPendingChoice; readonly record: unknown; readonly kind: CallKind } | null = null;

/** `callKindOf`, kept for the pending call: the page asks it several times a draw (shape, draw, Inspect), and a redraw must not rebuild it. */
export function callKindFor(state: BriefingState, pending: CampaignPendingChoice): CallKind {
  if (memo && memo.pending === pending && memo.record === state.record) return memo.kind;
  const kind = callKindOf(state, pending);
  memo = { pending, record: state.record, kind };
  return kind;
}
