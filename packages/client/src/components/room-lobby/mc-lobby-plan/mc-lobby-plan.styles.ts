import { css } from "lit";

export const McLobbyPlanStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  .facts {
    margin: 4px 0 8px;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 13px;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 124px));
    gap: 8px;
  }
  .item {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pic {
    display: block;
    aspect-ratio: 1;
  }
  .name {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 11px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .none {
    margin: 6px 0 0;
    font-family: var(--mc-font-body);
    font-size: 12px;
    opacity: 0.8;
  }
`;
