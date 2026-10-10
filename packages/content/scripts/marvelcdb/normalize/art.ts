/** Artwork references: where each card's image refs come from, and which printed faces need one. */
import type { AnyCard, CardImages, ImageRef } from "../../../src/schema/index.ts";
import type { RawCard } from "../raw-types.ts";
import { brand } from "./brand.ts";
import { ART_BY_CODE, CORE_ART_BY_NAME } from "./core-raw.ts";

/** MarvelCDB nulls image fields freely, and a linked record may be absent entirely. */
export type Src = string | null | undefined;

/**
 * Upstream artwork refs for one raw record.
 *
 * These are MarvelCDB's own site-relative paths (`/bundles/cards/01001a.png`),
 * stored verbatim as references — no image bytes, and the host is resolved by
 * `imageUrl` in the schema rather than baked in here (CLAUDE.md "Content & IP
 * boundaries").
 */
export const imagesOf = (frontSrc: Src, backSrc?: Src): CardImages | undefined => {
  const front = imageOf(frontSrc);
  const back = imageOf(backSrc);
  if (!front && !back) return undefined;
  return { ...(front ? { front } : {}), ...(back ? { back } : {}) };
};

/** A `/bundles/cards/<code>.<ext>` reference, split so a stale extension can be checked against the bundled folder. */
const BUNDLED_PATH = /^\/bundles\/cards\/([^/]+)\.(?:jpg|png)$/;

/**
 * Rewrites a `/bundles/cards/<code>.jpg` reference to `.png` when that code's `.png` is the file the repo actually
 * bundles. MarvelCDB's own `imagesrc`/`backimagesrc` are `.jpg` by convention, but a scan this repo fetched from
 * Hall of Heroes is bundled as `.png` (the client resolves the ref against `assets/card-art/bundles/cards/`
 * literally, so a `.jpg` ref against a folder that only has the `.png` is a broken link, not a format choice).
 * Leaves any other reference (a code with no local file, or already `.png`) untouched.
 */
const preferBundledPng = (src: Src, localCodes: ReadonlySet<string>): Src => {
  const match = src ? BUNDLED_PATH.exec(src) : null;
  const code = match?.[1];
  return code && localCodes.has(code) ? `/bundles/cards/${code}.png` : src;
};

/**
 * Fills in `imagesrc` for records MarvelCDB publishes no image for, when the repo's own art folder has a scan under
 * that record's code (`assets/card-art/bundles/cards/<code>.png`; the Hall of Heroes fetches listed in
 * `assets/card-art/hall-of-heroes-manifest.tsv`). The path is the same `/bundles/cards/<code>.png` shape MarvelCDB
 * uses, which is what the client resolves against that folder. A record that already has an `imagesrc` pointing at
 * a file the bundle actually has is left alone (MarvelCDB stays the first source) except for the stale-extension
 * rewrite above, which fires for any record — including a bare aggregate record whose `imagesrc` names another
 * record's code (main schemes' `aggregateImage`, `flatten.ts`). Pure: the caller lists the folder.
 */
export function withLocalArt(raw: readonly RawCard[], localCodes: ReadonlySet<string>): RawCard[] {
  const fill = (r: RawCard): RawCard => {
    const linked = r.linked_card ? fill(r.linked_card) : r.linked_card;
    const local = !r.imagesrc && localCodes.has(r.code);
    const rewritten = local ? undefined : preferBundledPng(r.imagesrc, localCodes);
    const changesSrc = rewritten !== undefined && rewritten !== r.imagesrc;
    if (!local && !changesSrc && linked === r.linked_card) return r;
    return {
      ...r,
      ...(local ? { imagesrc: `/bundles/cards/${r.code}.png` } : changesSrc ? { imagesrc: rewritten } : {}),
      ...(linked ? { linked_card: linked } : {}),
    };
  };
  return raw.map(fill);
}

/** One face's ref, for where the schema models a single printed face. */
export const imageOf = (src: Src): ImageRef | undefined => (src ? brand("image", src) : undefined);

const RAW_TO_SCHEMA_TYPE: Readonly<Record<string, string>> = {
  ally: "ally",
  event: "event",
  support: "support",
  upgrade: "upgrade",
  resource: "resource",
  player_side_scheme: "player_side_scheme",
  minion: "minion",
  attachment: "attachment",
  treachery: "treachery",
  obligation: "obligation",
  environment: "environment",
  side_scheme: "side_scheme",
};

/**
 * Art-for-reprints policy (docs/phase7-wave1.md task item 3). A card reprinted verbatim in a later pack (the
 * "basic"/pool cards — Energy, Genius, Strength, Avengers Mansion, Helicarrier, and Core allies/events/resources a
 * hero pack re-lists under its own MarvelCDB code, e.g. cap's Hawkeye 03012) gets no `imagesrc` of its own on
 * MarvelCDB: the physical card was never re-photographed, since it is the same printing. Rather than fail
 * ingestion on "no artwork reference", such a card's art resolves to its first printing's — matched by exact
 * printed name and MarvelCDB type_code, which is how MarvelCDB itself groups reprints (its own `duplicated_by`
 * field is unreliable/empty for these wave 1 records, verified against the raw cache). Currently only Core is a
 * possible "first printing" for wave 1; a later cycle reprinting a wave 1 card would need this map extended to
 * search that pack's own cards too.
 */
export const reprintImages = (r: RawCard): CardImages | undefined => {
  const schemaType = RAW_TO_SCHEMA_TYPE[r.type_code];
  if (!schemaType) return undefined;
  // The record's own `duplicate_of_code` target names the exact original; the name lookup is the fallback.
  const src =
    (r.duplicate_of_code ? ART_BY_CODE.get(r.duplicate_of_code) : undefined) ??
    CORE_ART_BY_NAME.get(`${r.type_code} ${r.name}`);
  return src ? { front: brand("image", src) } : undefined;
};

/**
 * The printed faces of a normalized card, for the artwork coverage check. A
 * card's faces live in different places depending on its type — a hero identity
 * has two, a villain one per stage, a main scheme two per stage — so this is
 * the one place that knows where to look.
 */
export function printedFaces(card: AnyCard): { readonly what: string; readonly image?: ImageRef }[] {
  switch (card.type) {
    case "hero_identity":
      return [
        { what: "the hero face", ...(card.hero.image ? { image: card.hero.image } : {}) },
        { what: "the alter-ego face", ...(card.alterEgo.image ? { image: card.alterEgo.image } : {}) },
        // A separated identity's other two faces (docs/phase7-wave2.md §6.10 — SP//dr) are printed cards too.
        ...(card.separatedIdentity
          ? [
              {
                what: "the hero card's other side",
                ...(card.separatedIdentity.heroCardOtherSide.image
                  ? { image: card.separatedIdentity.heroCardOtherSide.image }
                  : {}),
              },
              {
                what: "the alter-ego card's other side",
                ...(card.separatedIdentity.alterEgoCardOtherSide.image
                  ? { image: card.separatedIdentity.alterEgoCardOtherSide.image }
                  : {}),
              },
            ]
          : []),
      ];
    case "villain":
      return card.sides.flatMap((side) =>
        side.stages.map((stage) => ({
          what: `side ${side.side} stage ${stage.stageNumber}`,
          ...(stage.image ? { image: stage.image } : {}),
        })),
      );
    case "main_scheme":
      return card.stages.flatMap((stage) => [
        { what: `stage ${stage.stageNumber}A`, ...(stage.aSide.image ? { image: stage.aSide.image } : {}) },
        { what: `stage ${stage.stageNumber}B`, ...(stage.image ? { image: stage.image } : {}) },
      ]);
    default:
      return [{ what: "the card front", ...(card.images?.front ? { image: card.images.front } : {}) }];
  }
}
