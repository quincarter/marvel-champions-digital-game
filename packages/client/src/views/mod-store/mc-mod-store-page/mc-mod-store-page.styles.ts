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
  mc-top-bar {
    flex: none;
  }
  /* The caution tag: ink words on yellow, so it never rests on colour alone. */
  .badge {
    flex: none;
    padding: 3px 8px;
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink-on-hue);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }
  .installed {
    flex: none;
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
  }
  .about {
    flex: none;
    min-width: 132px;
    height: 44px;
    --mc-button-size: 18px;
  }
  :host([size="phone"]) .about {
    min-width: 44px;
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
