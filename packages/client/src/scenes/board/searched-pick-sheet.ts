/**
 * A pick of cards off the board as a sheet of card faces: Hunted's minion (Tigra, 56007) in the encounter deck or
 * discard pile, or Make the Call's ally (01071) in a player's discard pile. Each candidate is shown as its printed front
 * with an area tag in words under it and an Inspect button. Tapping a face chooses it; Cancel (or Escape) backs out. The
 * candidates are the engine's `LegalAction.targets` and the faces are read from them (`view/play-aim.ts`); this file
 * only lays them out (`view/searched-pick-layout.ts`) and wires the taps.
 */
import { drawArt } from "../../art/card-art.js";
import { accent, border, ink, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { fitText, fitWrapped, McButton } from "../../ui/widgets.js";
import { bindHoldTarget } from "../../ui/hold-target.js";
import type { Rect } from "../../view/layout.js";
import type { SearchedPickView } from "../../view/play-aim.js";
import { searchedPickLayout } from "../../view/searched-pick-layout.js";
import { SCENES } from "../keys.js";
import type { BoardDrawContext } from "./context.js";

export function drawSearchedPickSheet(ctx: BoardDrawContext, viewport: Rect, pick: SearchedPickView, top = 0): void {
  const { scene, controller } = ctx;
  // The sheet starts below `top`, the table's top bar, where the chrome buttons stay drawn (#515); the scrim covers all.
  const below: Rect = { ...viewport, y: viewport.y + top, height: viewport.height - top };
  const layout = searchedPickLayout(below, pick.options.length, pick.confirm, pick.page ?? 0);

  // The scrim also swallows taps, so nothing on the table underneath answers while the sheet is up.
  scene.add
    .graphics()
    .fillStyle(surface.ink.hex, 0.72)
    .fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
  scene.add.zone(viewport.x, viewport.y, viewport.width, viewport.height).setOrigin(0, 0).setInteractive();
  const g = scene.add.graphics();
  const { sheet } = layout;
  g.fillStyle(surface.paper.hex, 1).fillRect(sheet.x, sheet.y, sheet.width, sheet.height);
  g.lineStyle(4, surface.ink.hex, 1).strokeRect(sheet.x, sheet.y, sheet.width, sheet.height);

  const title = scene.add
    .text(
      layout.title.x,
      layout.title.y + layout.title.height / 2,
      pick.prompt,
      textStyle(typeRole.barTitle, surface.ink.hex),
    )
    .setOrigin(0, 0.5);
  fitWrapped(title, layout.title.width, layout.titleLines, typeRole.barTitle.size);
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "quiet",
      label: "Cancel",
      type: typeRole.label,
      rect: layout.cancel,
      onClick: () => controller.cancel(),
    }),
  );
  if (layout.confirm) {
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "primary",
        label: "Confirm",
        type: typeRole.label,
        rect: layout.confirm,
        enabled: !!pick.chosen,
        reason: "Choose an ally first",
        onClick: () => void controller.confirmSearched(),
      }),
    );
  }

  const { pager } = layout;
  if (pager) {
    // A list longer than the sheet holds (every ally in every discard pile, on a phone) pages instead of shrinking
    // its faces past reading or running off the sheet (#420).
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "secondary",
        label: "Previous",
        type: typeRole.label,
        rect: pager.previous,
        enabled: pager.page > 0,
        onClick: () => controller.showSearchedPage(pager.page - 1),
      }),
      new McButton(scene, {
        kind: "secondary",
        label: "Next",
        type: typeRole.label,
        rect: pager.next,
        enabled: pager.page < pager.pages - 1,
        onClick: () => controller.showSearchedPage(pager.page + 1),
      }),
    );
    const pageText = scene.add
      .text(
        pager.label.x + pager.label.width / 2,
        pager.label.y + pager.label.height / 2,
        `Page ${pager.page + 1} of ${pager.pages}`,
        textStyle(typeRole.label, surface.ink.hex),
      )
      .setOrigin(0.5);
    fitText(pageText, pager.label.width, typeRole.label.size);
  }

  layout.tiles.forEach((rects, onPage) => {
    const index = layout.first + onPage;
    const option = pick.options[index]!;
    const { face, tag, caption, inspect } = rects;
    g.fillStyle(surface.parchment.hex, 1).fillRect(face.x, face.y, face.width, face.height);
    const drawn = drawArt(scene, ctx.art.request(scene, option.art), face, { fit: "contain" }) !== null;
    if (!drawn) {
      // No scan for this card: its name on the parchment, so the tile is still a card you can read.
      scene.add
        .text(
          face.x + face.width / 2,
          face.y + face.height / 2,
          option.name,
          textStyle(typeRole.rowTitle, surface.ink.hex),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(face.width - 12)
        .setAlign("center");
    }
    g.lineStyle(border.object, surface.ink.hex, 1).strokeRect(face.x, face.y, face.width, face.height);
    // The area tag: a solid strip with words, never a colour alone.
    g.fillStyle(option.areaTag === "ENCOUNTER DECK" ? surface.ink.hex : accent.heroRed.hex, 1).fillRect(
      tag.x,
      tag.y,
      tag.width,
      tag.height,
    );
    const tagText = scene.add
      .text(tag.x + tag.width / 2, tag.y + tag.height / 2, option.areaTag, textStyle(typeRole.stamp, surface.paper.hex))
      .setOrigin(0.5);
    fitText(tagText, tag.width - 8, typeRole.stamp.size);
    const name = scene.add.text(caption.x, caption.y + 4, option.name, textStyle(typeRole.rowTitle, surface.ink.hex));
    fitText(name, caption.width, 15);
    if (!option.available) {
      // Shown but not choosable (an ally Make the Call cannot pay for): washed out, and the caption says why.
      g.fillStyle(surface.paper.hex, 0.65).fillRect(face.x, face.y, face.width, face.height + tag.height);
    }
    if (pick.chosen === option.instanceId) {
      const ring = { x: face.x - 4, y: face.y - 4, width: face.width + 8, height: face.height + tag.height + 8 };
      g.lineStyle(6, accent.heroRed.hex, 1).strokeRect(ring.x, ring.y, ring.width, ring.height);
    }
    const kind = scene.add.text(
      caption.x,
      name.y + name.height + 2,
      [option.typeWord, option.copy, option.unavailable].filter(Boolean).join(" · "),
      textStyle(typeRole.label, surface.ink.hex, ink.label),
    );
    fitText(kind, caption.width, typeRole.label.size);

    const choose = (): void => void controller.chooseSearched(option.instanceId);
    const openInspect = (): void => {
      if (scene.scene.isActive(SCENES.inspect)) return;
      scene.scene.launch(SCENES.inspect, { card: { cardId: option.cardId, face: { kind: "front" } } });
      scene.scene.bringToTop(SCENES.inspect);
    };
    // The whole face: tap chooses, press-and-hold or right-click inspects.
    const zone = scene.add
      .zone(face.x, face.y, face.width, face.height + tag.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    bindHoldTarget(scene, zone, { key: option.instanceId, onTap: choose, onInspect: openInspect });
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "secondary",
        label: "Inspect",
        type: typeRole.label,
        rect: inspect,
        onClick: openInspect,
      }),
    );
    ctx.frame.focusRects.set(`searched:${index}`, rects.tile);
  });
}
