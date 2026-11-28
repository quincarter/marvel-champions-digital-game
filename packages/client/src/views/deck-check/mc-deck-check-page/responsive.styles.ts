import { css } from "lit";

/**
 * Deck check's responsive rules, in one place: the three-column wide layout (a parchment rail, the cards, an ink panel)
 * and the one-column narrow and phone layouts (a tab strip, one tab's content, an ink footer). The page's `size`
 * attribute picks between them (the scene decides it from the form factor, as `view/deck-check-layout.ts` always did).
 */
export const DeckCheckResponsiveStyles = css`
  :host {
    --pad: 24px;
  }
  :host([size="phone"]) {
    --pad: 16px;
  }
  .wide {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 230px minmax(260px, 1fr) 300px;
    grid-template-rows: minmax(0, 1fr);
    gap: 24px;
    padding: var(--pad);
  }
  .rail {
    display: flex;
    flex-direction: column;
    gap: 13px;
    min-height: 0;
    overflow-y: auto;
    overflow-x: clip;
  }
  .rail mc-cost-curve {
    margin-top: auto;
  }
  .narrow {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .column {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(calc(100% - var(--pad) * 2), 640px);
    margin: var(--pad) auto 0;
  }
  /* The LB / RB hint over the tab strip: a row of its own, only while a keyboard or pad is in use. */
  .tab-hint {
    position: relative;
    flex: none;
    height: 14px;
    margin-bottom: -6px;
  }
  .tab-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tab-body.scroll {
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
  }
  .tab-body mc-deck-card-sections {
    flex: 1;
  }
  .sort {
    flex: none;
    width: 132px;
    height: 44px;
  }
  .footer {
    flex: none;
    display: flex;
    justify-content: center;
    padding: 12px var(--pad);
    background: var(--mc-fill-ink);
  }
  .footer mc-deck-actions {
    width: min(100%, 640px);
  }
`;
