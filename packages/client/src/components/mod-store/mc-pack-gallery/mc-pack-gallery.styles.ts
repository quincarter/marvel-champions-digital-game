import { css } from "lit";

/** Tiles of 104 to 176px, 12px apart (8 on a phone); each group starts on a row of its own. */
export const McPackGalleryStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .count {
    flex: none;
    padding: 3px 2px 0;
    height: 22px;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .list {
    flex: 1;
    min-height: 0;
    padding-right: 12px;
  }
  .head {
    height: 22px;
    display: flex;
    align-items: center;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    border-bottom: 2px solid var(--mc-line-ink);
    margin-bottom: 4px;
    white-space: pre;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 176px));
    gap: 12px;
    padding-bottom: 12px;
  }
  :host([size="phone"]) .tiles {
    gap: 8px;
    padding-bottom: 8px;
  }
`;
