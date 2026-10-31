/**
 * Draws the title screen's release notice bar (`view/release-notice.ts`). A slim ink strip across the top with a
 * caution-yellow NEW tag, the message in the display face and "Read more ↗" at the right; a tap anywhere on it opens
 * the release report outside the game.
 */
import type Phaser from "phaser";
import { signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";
import { fitText } from "./widgets.js";
import { onTap } from "./tap.js";
import { isNativeShell, openExternal } from "../platform/platform.js";
import { releaseReportUrl } from "../view/release-report-link.js";
import {
  NOTICE_BAR_GAP,
  RELEASE_NOTICE_LINK,
  RELEASE_NOTICE_TAG,
  RELEASE_NOTICE_TEXT,
  noticeBarParts,
} from "../view/release-notice.js";

/** Opens the release report, exactly as the sync screens open their guide. */
export function openReleaseReport(): void {
  openExternal(releaseReportUrl(globalThis.location?.href ?? "", isNativeShell()));
}

/** Draws the bar in `rect` and makes all of it one tap target. Returns what a focus stop activates. */
export function drawReleaseNoticeBar(scene: Phaser.Scene, rect: Rect): () => void {
  scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
  // A thin caution rule under it, so the strip reads apart from the phone's own ink ground.
  scene.add.rectangle(rect.x, rect.y + rect.height - 2, rect.width, 2, signal.caution.hex).setOrigin(0, 0);

  const paper = surface.paper.hex;
  const probe = scene.add.text(0, 0, RELEASE_NOTICE_LINK, textStyle(typeRole.rowTitle, paper));
  const parts = noticeBarParts(rect, probe.width);
  probe.destroy();
  const midY = parts.midY - 1;

  const tagText = scene.add
    .text(0, 0, RELEASE_NOTICE_TAG, textStyle(typeRole.label, surface.inkOnHue.hex))
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
    .text(messageX, midY, RELEASE_NOTICE_TEXT, textStyle(typeRole.sectionHeader, paper))
    .setOrigin(0, 0.5);
  fitText(message, link.x - link.width - NOTICE_BAR_GAP - messageX, typeRole.sectionHeader.size);

  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  onTap(zone, openReleaseReport, "title:release-notice");
  return openReleaseReport;
}
