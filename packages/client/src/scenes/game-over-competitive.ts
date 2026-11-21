/**
 * The Civil War Competitive result as the game-over screen draws it (issue #883): each team's leader picture with its
 * side and result over it, the winner's column the wider, a row of card scans under each (the leader, then the team's
 * heroes), and the tie-break panel. It is drawn in the campaign Victory / Defeat screen's own ink, paper, display type
 * and frames (`scenes/game-over.ts` hands in its pieces through `CompetitiveKit`), so the two read as one screen.
 * Every word comes from `view/competitive-game-over.ts` and every position from `view/competitive-game-over-layout.ts`.
 */
import type Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import { ART_CATALOG, villainArtFor } from "../art/scenario-art.js";
import type { Picture } from "../art/pictures.js";
import { signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { fitText, label } from "../ui/widgets.js";
import type { CompetitiveGameOver, CompetitiveResultTeam } from "../view/competitive-game-over.js";
import type { TeamColumnLayout } from "../view/competitive-game-over-layout.js";
import type { Rect } from "../view/layout.js";

/** What the game-over scene lends this module, so the campaign screen's text, scans and pictures are reused as they are. */
export interface CompetitiveKit {
  readonly scene: Phaser.Scene;
  display(x: number, y: number, text: string, size: number, color: number, wrapWidth?: number): Phaser.GameObjects.Text;
  /** A card scan fitted into `slot` with hover, hold-to-inspect and a keyboard stop; the rect it covers, or null while its picture is on its way. */
  scan(instanceId: InstanceId, slot: Rect, center?: boolean): Rect | null;
  /** A picture covering `panel`; false while it is still loading (the scene redraws when it arrives). */
  picture(picture: Picture, panel: Rect): boolean;
}

/** The leader's own picture (`art/scenarios/<leader>/villain.*`), the same one each time this screen is drawn. */
export const leaderPictureOf = (team: CompetitiveResultTeam): Picture | null =>
  team.leaderScenarioId ? villainArtFor(ART_CATALOG, team.leaderScenarioId, () => 0) : null;

/** One team: the leader's picture, its words, and the scans. `winnerShown` dims the team that did not win. */
export function drawTeamColumn(
  kit: CompetitiveKit,
  team: CompetitiveResultTeam,
  layout: TeamColumnLayout,
  options: { readonly winnerShown: boolean; readonly displaySize: number },
): void {
  const { scene } = kit;
  const { frame, banner, label: strip, cards } = layout;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(frame.x, frame.y, frame.width, frame.height);
  const picture = leaderPictureOf(team);
  if (picture) kit.picture(picture, banner);
  // The team that lost is dimmed beside the winner, and says so in words under the picture as well.
  if (options.winnerShown && !team.winner) {
    scene.add.graphics().fillStyle(surface.void.hex, 0.5).fillRect(banner.x, banner.y, banner.width, banner.height);
  }
  scene.add.graphics().fillStyle(surface.ink.hex, 0.86).fillRect(strip.x, strip.y, strip.width, strip.height);
  const pad = 12;
  const title = kit.display(
    strip.x + pad,
    strip.y + 6,
    `${team.sideLabel} · ${team.resultLabel}`,
    options.displaySize,
    team.winner ? signal.caution.hex : surface.paper.hex,
  );
  fitText(title, strip.width - pad * 2, options.displaySize);
  const sub = [...team.tags, strip.width >= 260 ? team.leader?.name : undefined]
    .filter((part): part is string => !!part)
    .join("  ·  ");
  const subText = label(scene, strip.x + pad, title.y + title.height + 2, sub, typeRole.label, surface.paper.hex, 0.9);
  fitText(subText, strip.width - pad * 2, typeRole.label.size);

  const ids = [team.leader?.instanceId, ...team.heroes.map((hero) => hero.instanceId)];
  cards.forEach((slot, index) => {
    const id = ids[index];
    if (id) kit.scan(id, slot, true);
  });
  scene.add
    .graphics()
    .lineStyle(team.winner ? 6 : 3, surface.paper.hex, 1)
    .strokeRect(frame.x, frame.y, frame.width, frame.height);
}

/** The tie-break (or "how it ended") panel: the heading, then each line with its numbers to the right. */
export function drawResultPanel(kit: CompetitiveKit, model: CompetitiveGameOver, rect: Rect): void {
  const { scene } = kit;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.lineStyle(4, surface.paper.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
  const heading = kit.display(rect.x + 20, rect.y + 16, model.panel.heading, 22, surface.paper.hex);
  g.fillStyle(surface.paper.hex, 0.3).fillRect(
    heading.x + heading.width + 10,
    heading.y + heading.height / 2 - 1,
    rect.x + rect.width - 20 - (heading.x + heading.width + 10),
    3,
  );
  let y = heading.y + heading.height + 12;
  for (const line of model.panel.lines) {
    if (y > rect.y + rect.height - 30) break;
    // The deciding measure is marked with a star in its words, never by colour alone.
    const detail = line.detail
      ? scene.add
          .text(rect.x + rect.width - 20, y, line.detail, textStyle(typeRole.emphasis, surface.paper.hex, 0.85))
          .setOrigin(1, 0)
      : null;
    const text = scene.add.text(
      rect.x + 20,
      y,
      line.text,
      textStyle(
        line.decided ? typeRole.emphasis : typeRole.body,
        line.decided ? signal.caution.hex : surface.paper.hex,
        1,
      ),
    );
    fitText(text, rect.width - 40 - (detail ? detail.width + 16 : 0), typeRole.body.size);
    y += Math.max(text.height, detail?.height ?? 0) + 8;
  }
}
