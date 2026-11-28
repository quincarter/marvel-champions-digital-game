/**
 * The types the Briefing's calls share: what a call kind is handed to draw (`CallInput`), the kinds a pending question can be
 * (`CallKind`, decided by `call-kind.ts`), and the plain data the two shared pieces take (`OptionTileModel`, `ConfirmBarModel`).
 * Every call draws into the column it is given and answers through `ctx.answer(picked)`; none of them computes legality.
 */
import type { Campaign, CardId } from "@mc/content";
import type { CampaignPendingChoice } from "@mc/engine";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import type { AspectStamp } from "../../../../view/aspect-stamp.js";
import type { PickCard } from "../../../../view/campaign-briefing-model.js";
import type { ModularSetCallView } from "../../../../view/campaign-modular-call-model.js";
import type { RoleBuildCard, RoleBuildContext } from "../../../../view/campaign-role-build-model.js";
import type { SeatHeaderView } from "../../../../view/campaign-role-call-model.js";
import type { SideSchemeBriefing } from "../../../../view/campaign-side-scheme-model.js";
import type { Rect } from "../../../../view/layout.js";
import type { BriefingCtx, Column } from "../context.js";

/** What every call draw is handed: the page's context, its builder, the column it sits in and where it starts. */
export interface CallInput {
  readonly ctx: BriefingCtx;
  readonly b: SheetBuilder;
  readonly col: Column;
  readonly top: number;
  readonly pending: CampaignPendingChoice;
}

/** A call kind's own draw: returns the bottom of what it drew. */
export type CallDraw = (input: CallInput) => number;

export interface RoleBuildData {
  readonly ctx: RoleBuildContext;
  readonly cards: readonly RoleBuildCard[];
}

/** Which question the pending call is, with the data that kind draws from (null where the kind needs none). */
export type CallKind =
  | { readonly kind: "roleBuild"; readonly build: RoleBuildData }
  | { readonly kind: "sideScheme"; readonly scheme: SideSchemeBriefing }
  | { readonly kind: "modular"; readonly view: ModularSetCallView }
  | { readonly kind: "role"; readonly roles: NonNullable<Campaign["roles"]>; readonly header: SeatHeaderView }
  | { readonly kind: "random" }
  /** A pick of options: plain buttons, or with `cards` (every option a card) each beside its picture. */
  | { readonly kind: "options"; readonly cards: ReadonlyMap<string, PickCard> | null };

/** A tile of a call's choice (a role, an encounter set): framed, with a name, its words and one press. */
export interface OptionTileModel {
  /** The press and stop key (`role:<id>`, `call-option:<id>`). */
  readonly key: string;
  readonly rect: Rect;
  readonly title: string;
  /** Aspect chips right of the title. */
  readonly chips?: readonly AspectStamp[];
  readonly body: string;
  /** The body in the warning red (a taken role says so in words). */
  readonly bodyWarn?: boolean;
  /** A small label at the tile's foot, in `footerColor`. */
  readonly footer?: string;
  readonly footerColor?: number;
  /** A tile that cannot be picked: shown, dimmed, spelled out, with no press. */
  readonly available: boolean;
  /** A heal-green stripe down the left edge (the set already chosen). */
  readonly stripe?: boolean;
  readonly onPick: () => void;
}

export interface ConfirmBarModel {
  readonly back: { readonly key: string; readonly run: () => void };
  readonly confirm: { readonly key: string; readonly run: () => void };
  /** A third, quiet button under the two (role-building's "Inspect"). */
  readonly read?: { readonly key: string; readonly run: () => void };
}

/** The card a picture shows and what its press opens. */
export interface PickArtCard {
  readonly cardId: CardId;
  readonly name: string;
}
