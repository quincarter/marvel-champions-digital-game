/**
 * Which question the pending call is, with the data its kind shows: decided by `call-kind.ts` from the engine own offer, turned into
 * the `CallModel` the Briefing page shows by `call-model.ts`.
 */
import type { Campaign } from "@mc/content";
import type { PickCard } from "../../../../view/campaign-briefing-model.js";
import type { ModularSetCallView } from "../../../../view/campaign-modular-call-model.js";
import type { SeatHeaderView } from "../../../../view/campaign-role-call-model.js";
import type { SideSchemeBriefing } from "../../../../view/campaign-side-scheme-model.js";
import type { RoleBuildData } from "../../../../components/briefing/mc-briefing-role-build/mc-briefing-role-build.types.js";

export type { RoleBuildData };

/** Which question the pending call is, with the data that kind draws from (null where the kind needs none). */
export type CallKind =
  | { readonly kind: "roleBuild"; readonly build: RoleBuildData }
  | { readonly kind: "sideScheme"; readonly scheme: SideSchemeBriefing }
  | { readonly kind: "modular"; readonly view: ModularSetCallView }
  | { readonly kind: "role"; readonly roles: NonNullable<Campaign["roles"]>; readonly header: SeatHeaderView }
  | { readonly kind: "random" }
  /** A pick of options: plain buttons, or with `cards` (every option a card) each beside its picture. */
  | { readonly kind: "options"; readonly cards: ReadonlyMap<string, PickCard> | null };
