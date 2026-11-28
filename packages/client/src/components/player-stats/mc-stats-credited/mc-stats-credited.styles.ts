import { css } from "lit";

export const McStatsCreditedStyles = css`
  :host {
    display: flex;
    min-width: 0;
    gap: 4px;
    align-items: baseline;
  }
  :host([lines="2"]),
  :host([lines="3"]) {
    flex-direction: column;
    gap: 0;
    align-items: stretch;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([lines="2"]) .name,
  :host([lines="3"]) .name {
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--name-lines, 1);
    line-clamp: var(--name-lines, 1);
  }
  /* The credit never gives way: a custom pack's content is never read as an official card. */
  .credit {
    flex: none;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.8;
    font-size: 0.85em;
  }
`;
