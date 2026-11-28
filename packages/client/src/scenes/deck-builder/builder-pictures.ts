/** The pictures the builder hands its page: card scans and hero faces, leased while they are shown. */
import type { PictureSource } from "@mc/ui";
import type { HeroIdentityCard } from "@mc/content";
import type { ArtSource } from "../../art/art-source.js";
import { HERO_ART, heroArtForIdentity } from "../../art/hero-art.js";
import type { Picture } from "../../art/pictures.js";
import { currentPool } from "../../content/pool.js";
import { heroPictureOf } from "../../dom/hero-picture.js";
import type { PictureLeases } from "../../dom/picture-leases.js";
import { isCustomCard } from "../../view/custom-content.js";
import { qualifiedHeroName } from "../../view/hero-names.js";

export class BuilderPictures {
  readonly #leases: PictureLeases;
  /** The bundled picture chosen per hero this visit, so a redraw never reshuffles a hero with several pictures. */
  readonly #chosen = new Map<string, Picture | null>();

  constructor(leases: PictureLeases) {
    this.#leases = leases;
  }

  /** A card scan as the panel draws it: its URL (held while shown) and the key to ask again by when a pack scan fails. */
  readonly scan = (source: ArtSource | null, missing: string): PictureSource => {
    const held = this.#leases.image(source);
    return { src: held.src, missing, ...(held.retry !== undefined ? { retry: held.retry } : {}) };
  };

  /**
   * The identity picture as the panel draws it: the hero's own art (`art/heroes/`, the one chosen this visit), else the
   * identity card's scan, an installed pack hero's picture leased by its key (`dom/hero-picture.ts`).
   */
  readonly hero = (identity: HeroIdentityCard): PictureSource => {
    const id = identity.id as string;
    let chosen: Picture | null | undefined;
    // An installed pack hero's picture arrives after the first draw, so it is not remembered here.
    if (!isCustomCard(id)) {
      chosen = this.#chosen.get(id);
      if (chosen === undefined) {
        chosen = heroArtForIdentity(HERO_ART, id, currentPool());
        this.#chosen.set(id, chosen);
      }
    }
    const picture = heroPictureOf(identity, this.#leases, "tile", chosen);
    return {
      src: picture.src,
      cover: picture.cover,
      missing: qualifiedHeroName(identity),
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
    };
  };
}
