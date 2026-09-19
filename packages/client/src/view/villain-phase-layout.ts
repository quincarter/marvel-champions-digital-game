/**
 * The villain-phase walkthrough's own layout (D11, P09, L02;
 * docs/phase4-screen-gaps.md §3 "W7").
 *
 * The canvas is a full-bleed ink panel, not a centered card
 * (`overlay-layout.ts`'s shape is for a menu; this screen is a HUD over the
 * table). Composition, read off the renders:
 *  - **Desktop (D11), tablet landscape and tablet portrait (L02):** header
 *    (title + Skip), subtitle, the five-step strip, then a two-column split
 *    down to the footer — a wide **main column** ("happening now"'s
 *    breakdown, the boost cards it revealed, and "queued this phase") beside
 *    a narrower **rail**. The rail's own content differs by width class: L02
 *    draws a per-seat **"TEAM STATUS"** list above the main-scheme threat
 *    callout — the one place the design keeps everyone's HP visible while the
 *    walkthrough (or its inline interrupt window) is covering the board
 *    underneath — and drops the phase log entirely (the step strip and "queued
 *    this phase" already narrate it). Desktop keeps D11's own rail instead:
 *    the main-scheme callout on top of the phase log, no team status. Tablet
 *    portrait gets the same rail as landscape — the canvases don't draw a
 *    portrait villain phase separately, and L01/L02's own point (a persistent
 *    rail rather than phone's tabs) applies to both tablet orientations.
 *  - **Phone (P09):** one stacked column — the step strip collapses to a
 *    single "Step N of 5" line (five bordered chips don't fit at 390px, the
 *    same reasoning `Board - Phone` already applies to its own tab rail) —
 *    and the rail's own panel (main scheme, then the phase log) drops below
 *    "queued" rather than sitting beside it. No team status on phone either:
 *    phone is already one seat's own view, tab-switched, not a multi-seat rail.
 *
 * Pure function of `bounds` and the form factor — no text measurement,
 * matching every other layout module's own rule.
 */
import { hit } from "../tokens.js";
import type { FormFactor, Rect } from "./layout.js";

const MARGIN_PHONE = 8;
const MARGIN_WIDE = 28;
const PAD_PHONE = 12;
const PAD_WIDE = 24;
const RAIL_WIDTH = 300;
const RAIL_GAP = 16;
const MAIN_SCHEME_HEIGHT = 92;
/**
 * The boost-card panel's height once there is at least one boost card to
 * show it — tall enough for a real scan to be readable next to its text
 * (`view/villain-phase-boosts.ts` tiles the actual cards within it), inside
 * the 220–260px the design asks for on desktop/tablet.
 */
const BOOSTS_HEIGHT_WIDE = 240;
/** Sized so a single boost card's thumbnail lands close to the design's ~90px-wide phone thumb (`villain-phase-boosts.ts`'s own padding math). */
const BOOSTS_HEIGHT_PHONE = 142;
const MIN_QUEUED_HEIGHT = 60;
const MIN_LOG_HEIGHT = 40;

export interface VillainPhaseLayout {
  readonly panel: Rect;
  readonly title: Rect;
  readonly skip: Rect;
  readonly subtitle: Rect;
  /** The five-step chip strip. Zero height on phone, which draws `stepLine` instead. */
  readonly stepStrip: Rect;
  /** A single compact "Step N of 5" line. Zero height off phone. */
  readonly stepLine: Rect;
  /** "Happening now": the activation's breakdown, or the plain narration when there's nothing structured to show. */
  readonly happeningNow: Rect;
  /**
   * The boost cards this activation has revealed so far. Zero height when
   * `boostCount` is zero (most of the phase has none to show); tall enough
   * for a real scan (`BOOSTS_HEIGHT_WIDE`/`BOOSTS_HEIGHT_PHONE`) once there is
   * at least one, so "queued this phase" only gives up room to it when it is
   * actually drawing something.
   */
  readonly boosts: Rect;
  /** The per-seat "TEAM STATUS" list (L02) — tablet only; zero height on phone and desktop, which have no such panel. */
  readonly teamStatus: Rect;
  /** The main-scheme threat callout — top of the rail on desktop, under team status on tablet, a slim banner on phone. */
  readonly mainScheme: Rect;
  /** "Queued this phase" — the main column on wide layouts, a capped list on phone. */
  readonly queued: Rect;
  /** The phase log — desktop's own rail and phone's stacked column only; zero height on tablet, which shows team status instead. */
  readonly phaseLog: Rect;
  readonly footer: Rect;
}

/**
 * `boostCount` is how many boost cards the current activation has revealed so
 * far (`activation.boosts.length` off the walkthrough model) — defaulted to
 * zero for callers that only care about the rest of the geometry (most of
 * this file's own tests), matching `poolGridGeometry`'s own precedent for a
 * count-driven layout elsewhere in the client.
 */
export function villainPhaseLayout(bounds: Rect, formFactor: FormFactor, boostCount: number = 0): VillainPhaseLayout {
  const phone = formFactor === "phone";
  const tablet = formFactor === "tabletLandscape" || formFactor === "tabletPortrait";
  const boostsHeightWide = boostCount > 0 ? BOOSTS_HEIGHT_WIDE : 0;
  const boostsHeightPhone = boostCount > 0 ? BOOSTS_HEIGHT_PHONE : 0;
  const margin = phone ? MARGIN_PHONE : MARGIN_WIDE;
  const pad = phone ? PAD_PHONE : PAD_WIDE;
  const panel: Rect = { x: bounds.x + margin, y: bounds.y + margin, width: bounds.width - margin * 2, height: bounds.height - margin * 2 };
  const contentX = panel.x + pad;
  const contentWidth = panel.width - pad * 2;

  let y = panel.y + pad;
  const titleHeight = phone ? 22 : 34;
  const skipWidth = 96;
  const title: Rect = { x: contentX, y, width: contentWidth - skipWidth - 12, height: Math.max(titleHeight, hit.target) };
  const skip: Rect = { x: contentX + contentWidth - skipWidth, y, width: skipWidth, height: hit.target };
  y += Math.max(title.height, skip.height) + 6;

  const subtitle: Rect = { x: contentX, y, width: contentWidth, height: 20 };
  y += subtitle.height;

  const stepStripHeight = phone ? 0 : 58;
  const stepLineHeight = phone ? 20 : 0;
  const stepStrip: Rect = { x: contentX, y, width: contentWidth, height: stepStripHeight };
  const stepLine: Rect = { x: contentX, y, width: contentWidth, height: stepLineHeight };
  y += Math.max(stepStripHeight, stepLineHeight) + 14;

  const footer: Rect = { x: contentX, y: panel.y + panel.height - pad - hit.primary, width: contentWidth, height: hit.primary };
  const bodyBottom = footer.y - 12;

  if (phone) {
    const nowHeight = 128;
    const boostsHeight = boostsHeightPhone;
    const mainSchemeHeight = 56;
    const happeningNow: Rect = { x: contentX, y, width: contentWidth, height: nowHeight };
    y += nowHeight + 8;
    const boosts: Rect = { x: contentX, y, width: contentWidth, height: boostsHeight };
    // No second gap when there is nothing to show — an empty boosts rect
    // should not cost "queued this phase" room it isn't using.
    y += boostsHeight + (boostsHeight > 0 ? 8 : 0);
    const mainScheme: Rect = { x: contentX, y, width: contentWidth, height: mainSchemeHeight };
    y += mainSchemeHeight + 8;
    const queuedHeight = Math.max(MIN_QUEUED_HEIGHT, Math.min(90, bodyBottom - y - MIN_LOG_HEIGHT - 16));
    const queued: Rect = { x: contentX, y, width: contentWidth, height: Math.max(0, queuedHeight) };
    y += queued.height + 8;
    const phaseLog: Rect = { x: contentX, y, width: contentWidth, height: Math.max(0, bodyBottom - y) };
    const teamStatus: Rect = { x: contentX, y, width: 0, height: 0 };
    return { panel, title, skip, subtitle, stepStrip, stepLine, happeningNow, boosts, teamStatus, mainScheme, queued, phaseLog, footer };
  }

  const railX = contentX + contentWidth - RAIL_WIDTH;
  const mainWidth = contentWidth - RAIL_WIDTH - RAIL_GAP;

  // Right rail: desktop (D11) keeps the main-scheme callout on top with the
  // phase log filling what's left; tablet (L02) puts "TEAM STATUS" on top of
  // the main-scheme callout instead, and drops the phase log — the step strip
  // and "queued this phase" already narrate it, and this rail's whole point is
  // to keep everyone's HP legible behind the walkthrough, not to duplicate the log.
  const mainScheme: Rect = tablet
    ? { x: railX, y: bodyBottom - MAIN_SCHEME_HEIGHT, width: RAIL_WIDTH, height: MAIN_SCHEME_HEIGHT }
    : { x: railX, y, width: RAIL_WIDTH, height: MAIN_SCHEME_HEIGHT };
  const teamStatus: Rect = tablet
    ? { x: railX, y, width: RAIL_WIDTH, height: Math.max(0, mainScheme.y - 12 - y) }
    : { x: railX, y, width: 0, height: 0 };
  const phaseLog: Rect = tablet
    ? { x: railX, y: bodyBottom, width: RAIL_WIDTH, height: 0 }
    : { x: railX, y: y + MAIN_SCHEME_HEIGHT + 12, width: RAIL_WIDTH, height: Math.max(0, bodyBottom - (y + MAIN_SCHEME_HEIGHT + 12)) };

  // Main column: "happening now", the boost cards it revealed, then "queued this phase" filling what's left.
  const happeningNow: Rect = { x: contentX, y, width: mainWidth, height: 168 };
  const boosts: Rect = { x: contentX, y: happeningNow.y + happeningNow.height + 12, width: mainWidth, height: boostsHeightWide };
  // No second gap when there is nothing to show — see the phone branch's own comment.
  const queuedTop = boosts.y + boosts.height + (boostsHeightWide > 0 ? 12 : 0);
  const queued: Rect = { x: contentX, y: queuedTop, width: mainWidth, height: Math.max(0, bodyBottom - queuedTop) };

  return { panel, title, skip, subtitle, stepStrip, stepLine, happeningNow, boosts, teamStatus, mainScheme, queued, phaseLog, footer };
}
