import { css } from "lit";

/**
 * The wide layout (D04): a left aspect / filter / chart rail, the card pool in the middle, "Your deck" on its own ink ground
 * on the right. The rails keep their widths and the pool takes the rest, adding columns as it grows.
 */
export const DeckBuilderResponsiveStyles = css`
  .wide {
    display: grid;
    grid-template-columns: 230px minmax(240px, 1fr) 300px;
    gap: 24px;
    min-height: 0;
  }
  .wide > * {
    min-height: 0;
  }
  .rail-left {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .rail-left > * {
    flex: none;
  }
  .mid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .mid > * {
    flex: none;
  }
  .mid mc-pool-list,
  .mid .scroll {
    flex: 1 1 auto;
  }
  /* "Your deck" on its own ink ground, as far down as the page goes. */
  .rail-right {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    margin-top: -8px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    outline: 2px solid var(--mc-line-ink);
  }
  .rail-right > * {
    flex: none;
  }
  .rail-right .scroll {
    flex: 1 1 auto;
    min-height: 0;
    gap: 0;
  }
  .rail-right mc-deck-list {
    flex: 1 1 auto;
    min-height: 0;
  }
  .rail-right mc-builder-save-bar {
    margin-top: auto;
  }
  mc-builder-tabs {
    flex: none;
  }
`;
