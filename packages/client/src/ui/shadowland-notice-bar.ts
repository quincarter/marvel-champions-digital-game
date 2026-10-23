/**
 * TEMPORARY (`view/shadowland-notice.ts`): draws the title screen's Shadowland notice bar. A slim ink strip across the
 * top with a caution-yellow NOTICE tag, the question in the display face and "Read more ↗" at the right; a tap
 * anywhere on it opens `public/shadowland-info.html` outside the game.
 */
import type Phaser from "phaser";
import { signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";
import { fitText } from "./widgets.js";
import { onTap } from "./tap.js";
import { isNativeShell, openExternal } from "../platform/platform.js";
import { shadowlandInfoUrl } from "../view/shadowland-info-link.js";
import {
  NOTICE_BAR_GAP,
  SHADOWLAND_NOTICE_LINK,
  SHADOWLAND_NOTICE_TAG,
  SHADOWLAND_NOTICE_TEXT,
  noticeBarParts,
} from "../view/shadowland-notice.js";

/** Opens the Shadowland page, exactly as the sync screens open their guide. */
export function openShadowlandInfo(): void {
  openExternal(shadowlandInfoUrl(globalThis.location?.href ?? "", isNativeShell()));
}

/** Draws the bar in `rect` and makes all of it one tap target. Returns what a focus stop activates. */
export function drawShadowlandNoticeBar(scene: Phaser.Scene, rect: Rect): () => void {
  scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
  // A thin caution rule under it, so the strip reads apart from the phone's own ink ground.
  scene.add.rectangle(rect.x, rect.y + rect.height - 2, rect.width, 2, signal.caution.hex).setOrigin(0, 0);

  const paper = surface.paper.hex;
  const probe = scene.add.text(0, 0, SHADOWLAND_NOTICE_LINK, textStyle(typeRole.rowTitle, paper));
  const parts = noticeBarParts(rect, probe.width);
  probe.destroy();
  const midY = parts.midY - 1;

  const tagText = scene.add
    .text(0, 0, SHADOWLAND_NOTICE_TAG, textStyle(typeRole.label, surface.ink.hex))
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  const tagWidth = tagText.width + 12;
  const tagHeight = tagText.height + 6;
  scene.add.rectangle(parts.tagX, midY - tagHeight / 2, tagWidth, tagHeight, signal.caution.hex).setOrigin(0, 0);
  tagText.setPosition(parts.tagX + 6, midY).setDepth(1);

  const link = scene.add.text(0, midY, parts.link, textStyle(typeRole.rowTitle, paper)).setOrigin(1, 0.5);
  link.setX(parts.linkRight);
  scene.add
    .graphics()
    .fillStyle(paper, 0.6)
    .fillRect(link.x - link.width, link.y + link.height / 2, link.width, 1);

  const messageX = parts.tagX + tagWidth + NOTICE_BAR_GAP;
  const message = scene.add
    .text(messageX, midY, SHADOWLAND_NOTICE_TEXT, textStyle(typeRole.sectionHeader, paper))
    .setOrigin(0, 0.5);
  fitText(message, link.x - link.width - NOTICE_BAR_GAP - messageX, typeRole.sectionHeader.size);

  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  onTap(zone, openShadowlandInfo, "title:shadowland-notice");
  return openShadowlandInfo;
}
