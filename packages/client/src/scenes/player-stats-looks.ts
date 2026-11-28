/**
 * The pictures Your stats shows, as the page's elements take them (`PictureSource`): a card's scan, a hero's artwork (a
 * Mod Store hero's from its installed pack, #966) and a scenario's villain. Each is leased (`dom/picture-leases.ts`) for the
 * pass that builds the page, so the pack art cache cannot revoke a URL a mounted picture holds; the scene brackets a pass
 * with `begin()` and `end()`.
 */
import type { PictureFocus, PictureSource } from "@mc/ui";
import type { AnyCard } from "@mc/content";
import { currentCardsById, currentScenarios } from "../content/pool.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { artFor, type ArtSource } from "../art/art-source.js";
import { heroFocusOf, heroSourceOf, villainSourceOf } from "../art/matchup-pictures.js";
import type { PictureLeases } from "../dom/picture-leases.js";
import { scenarioCardIdOf } from "../view/random-villain.js";
import type Phaser from "phaser";
import { onArtChange } from "../language-change.js";
import { cardArt } from "../art/card-art.js";
import { cardFaces } from "../art/card-face-baker.js";
import { onBackfillProgress } from "../progression/stats-backfill.js";

/**
 * The picture a stats row draws for a card. A hero identity shows its hero side: a separated identity (SP//dr Suit) has
 * no front scan of its own, only its sides' (#966).
 */
export const statCardArt = (card: AnyCard | undefined): ArtSource | null =>
  card?.type === "hero_identity"
    ? (artFor(card, { kind: "hero" }) ?? artFor(card, { kind: "front" }))
    : artFor(card, { kind: "front" });

/** A scenario by id: the pool's or an installed pack's. */
const scenarioById = (id: string) => currentScenarios().find((scenario) => (scenario.id as string) === id);

export interface StatsLooks {
  readonly deps: {
    readonly hasCard: (cardId: string) => boolean;
    readonly cardPicture: (cardId: string) => PictureSource | null;
    readonly heroPicture: (identityId: string) => PictureSource | null;
    readonly villainPicture: (scenarioId: string) => PictureSource | null;
  };
  readonly hero: (identityId: string) => PictureSource | null;
  readonly villain: (scenarioId: string) => PictureSource | null;
}

export function playerStatsLooks(leases: PictureLeases): StatsLooks {
  const of = (source: ArtSource | null, missing: string, focus: PictureFocus | null): PictureSource | null => {
    const held = leases.image(source);
    return {
      src: held.src,
      cover: focus ?? { x: 0.5, y: 0.2 },
      missing,
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
    };
  };
  const hero = (identityId: string): PictureSource | null => {
    const focus = heroFocusOf(identityId);
    // The art's own focus point centers the crop on the subject, kept inside the picture (the cover crop's `centered`).
    return of(
      heroSourceOf(identityId, loadedPacks()),
      "",
      focus ? { x: focus.x ?? 0.5, y: focus.y ?? 0.2, centered: true } : null,
    );
  };
  const villain = (scenarioId: string): PictureSource | null => {
    const scenario = scenarioById(scenarioId);
    return of(villainSourceOf(scenarioId, scenario ? scenarioCardIdOf(scenario) : null, loadedPacks()), "", null);
  };
  return {
    deps: {
      hasCard: (cardId) => currentCardsById().has(cardId),
      cardPicture: (cardId) => {
        const card = currentCardsById().get(cardId);
        return of(statCardArt(card), card?.name ?? cardId, null);
      },
      heroPicture: hero,
      villainPicture: villain,
    },
    hero,
    villain,
  };
}

/**
 * Draws the page again when pictures arrive (a card scan, a baked face, a Mod Store hero's or villain's picture read from
 * its pack a moment after the first ask, #966) once per batch, and when older games finish being filled in (#529:
 * the Overview says how far it has got, and the stats reload when it ends). Returns the function that stops listening.
 */
export function watchStatsArt(scene: Phaser.Scene, on: { redraw: () => void; reload: () => void }): (() => void)[] {
  let queued = false;
  const redraw = (): void => {
    if (queued) return;
    queued = true;
    scene.time.delayedCall(0, () => {
      queued = false;
      on.redraw();
    });
  };
  return [
    cardArt(scene).onArrived(redraw),
    cardFaces(scene).onBaked(redraw),
    onArtChange(redraw),
    onBackfillProgress((progress) => (progress.running ? redraw() : on.reload())),
  ];
}
