import type { PictureSource } from "@mc/ui";
import type { PoolDestinationKind } from "../../../view/campaign-pool-model.js";
import type { BriefingCard } from "../briefing.types.js";

/** One resolved pool card of this issue: the box own words and the picture the scene leased. */
export interface PoolRowModel {
  /** The pool field it reads back (the stop key is `pool-card:<fieldId>`). */
  readonly fieldId: string;
  readonly name: string;
  /** Where this issue setup puts it ("Put into play at setup."), the box own story text. */
  readonly destination: string;
  readonly destinationKind: PoolDestinationKind;
  readonly helps: boolean;
  /** The card it opens in Inspect; null for a name that is no card. */
  readonly card: BriefingCard | null;
  readonly picture: PictureSource;
}

export interface PoolGroupModel {
  readonly kind: PoolDestinationKind;
  readonly rows: readonly PoolRowModel[];
}

/** "From the pool": the flat rows, and for the box finale the groups (one per destination). */
export interface PoolModel {
  readonly rows: readonly PoolRowModel[];
  readonly groups: readonly PoolGroupModel[] | null;
}
