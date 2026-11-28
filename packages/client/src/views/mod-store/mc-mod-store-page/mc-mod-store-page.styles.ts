import { css } from "lit";

export const McModStorePageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--mc-fill-paper);
    /* A size container, so the heads-up's portraits can size to the screen's height (cqh). */
    container-type: size;
  }
  mc-mod-store-header {
    flex: none;
  }
  mc-pack-detail {
    flex: 1;
    min-height: 0;
  }
  /* The browse view: the caption, the tabs, then what the tab shows, under the bar's gutter. */
  .browse {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 24px 24px;
  }
  .browse > mc-mod-beta-caption,
  .browse > mc-mod-tabs,
  .browse > mc-mod-message[kind="offline"],
  .browse > mc-mod-update-bar,
  .browse > mc-mod-finders {
    flex: none;
  }
  .browse > mc-mod-tabs {
    margin-top: 2px;
  }
  .browse > mc-pack-grid,
  .browse > mc-creator-list {
    flex: 1;
    min-height: 60px;
  }
  .browse > mc-mod-message:not([kind="offline"]) {
    flex: none;
  }
`;
