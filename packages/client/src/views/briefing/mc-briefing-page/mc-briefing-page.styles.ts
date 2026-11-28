import { css } from "lit";

/**
 * The page: the box art faded across it, the ink bar, then the body (a phone: one scrolling page of the story and, across its foot,
 * the coloured pane with a paper panel; wide: the left column and the coloured right pane flush to the right edge with a paper panel
 * hugging the decks and sections), the phone strip, the error line and the ink action bar, with the "which deck?" chooser over all
 * of it. Layout is flow, grid and native scrolling; while a call scrolls itself (role-building) the page and the left column do not.
 */
export const McBriefingPageStyles = css`
  :host {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--mc-fill-paper);
  }
  .page-art {
    position: absolute;
    inset: 0;
    opacity: 0.12;
    pointer-events: none;
  }
  mc-top-bar {
    position: relative;
    flex: none;
    height: var(--bar-height);
  }
  .body {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .story {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  .composing {
    margin: 0;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  /* The coloured pane: the chosen ground, the box art over it, the dark veil and its frame. */
  .pane {
    position: relative;
    isolation: isolate;
    background: var(--pane-ground);
  }
  .pane-art {
    position: absolute;
    inset: 0;
    opacity: 0.34;
    z-index: -2;
    pointer-events: none;
  }
  .pane::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: color-mix(in srgb, var(--mc-fill-ink-on-hue) 34%, transparent);
    box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--mc-fill-ink-on-hue) 34%, transparent);
    pointer-events: none;
  }
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
    box-sizing: border-box;
    padding: 12px;
    background: var(--mc-fill-paper);
    border: 2px solid var(--mc-line-ink);
  }
  /* Phone: one scrolling page from under the bar to the strip. */
  .page {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .page .story {
    padding: 20px var(--gutter) 0;
  }
  .page .pane {
    margin-top: 20px;
    padding: 20px 4px 16px;
  }
  .page[data-own] {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .page[data-own] .story {
    flex: 1 1 0;
    min-height: 0;
    padding-bottom: 12px;
  }
  /* Wide: the left column scrolls on its own, and the right pane sits flush to the right edge. */
  .columns {
    flex: 1 1 0;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
  }
  .left {
    min-height: 0;
    min-width: 0;
    padding: 20px 16px 16px var(--gutter);
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
  }
  .left[data-own] {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .left[data-own] .story {
    flex: 1 1 0;
    min-height: 0;
  }
  .right {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    padding: 28px;
  }
  :host([wide-desktop]) .right {
    padding: 40px;
  }
  .right .panel {
    flex: 0 1 auto;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
  }
  mc-briefing-watch-strip {
    flex: none;
  }
  .error {
    flex: none;
    margin: 0;
    padding: 4px var(--gutter);
    font-weight: 800;
    font-size: var(--mc-small-12);
    letter-spacing: 1.2px;
    color: var(--mc-text-red);
    background: var(--mc-fill-paper);
    position: relative;
  }
  mc-briefing-action-bar {
    position: relative;
    flex: none;
    height: var(--action-height);
  }
  mc-briefing-call[owns-scroll] {
    flex: 1 1 0;
    min-height: 0;
  }
`;
