/** What the model builders read of the screen besides the builder's state: its size and the services that need a scene. */
import type { PictureSource } from "@mc/ui";
import type { ControlGlyph } from "@mc/ui";
import type { HeroIdentityCard } from "@mc/content";
import type { BuilderLayout } from "../../components/deck-builder/mc-builder-header/mc-builder-header.types.js";
import type { ArtSource } from "../../art/art-source.js";
import type { DeckBuilderRowSizes } from "../../view/deck-builder-rows.js";

export interface ModelEnv {
  readonly layout: BuilderLayout;
  readonly width: number;
  readonly height: number;
  /** The filters sit behind a Filters chip (everywhere but a desktop-size screen, and any short window). */
  readonly folded: boolean;
  readonly desktop: boolean;
  /** The global Card size factor (1, 1.25, 1.5). */
  readonly cardScale: number;
  readonly rows: DeckBuilderRowSizes;
  /** A card scan as the panel draws it: leased while shown, the retry key a failing pack scan is asked again by. */
  readonly scan: (source: ArtSource | null, missing: string) => PictureSource;
  /** The identity's hero picture, as a cover crop around the face. */
  readonly heroPicture: (identity: HeroIdentityCard) => PictureSource;
  /** A control's key / pad glyph while a keyboard or pad is in use. */
  readonly glyph: (
    key: string,
    ids: readonly ("cancel" | "zonePrevious" | "zoneNext")[],
    ground: "paper" | "ink",
    height: number,
  ) => ControlGlyph | undefined;
}
