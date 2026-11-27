import { css } from "lit";

export const McPictureRowStyles = css`
  :host {
    display: block;
    position: relative;
    pointer-events: none;
  }
  .group {
    position: absolute;
    left: 4px;
    top: 2px;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
  }
  .card {
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 4px;
    background: var(--mc-fill-card);
    outline: 2.5px solid var(--mc-line-ink);
    outline-offset: -1.25px;
    color: var(--mc-text-ink);
  }
  .card.selected {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    outline-width: 3px;
  }
  .card.alert {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -1.5px;
  }
  .card.dim .picture,
  .card.dim .title {
    opacity: 0.55;
  }
  .picture {
    position: absolute;
    left: 6px;
    top: 6px;
    bottom: 6px;
    overflow: hidden;
    background: var(--mc-fill-parchment);
  }
  .picture img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .stamps {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
  }
  .stamp {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 2px 5px;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.1;
    white-space: nowrap;
  }
  .words {
    overflow: hidden;
    position: absolute;
    top: 8px;
    bottom: 6px;
    right: 10px;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-family: var(--mc-font-display);
    font-size: 18px;
    letter-spacing: 0.6px;
    line-height: 1.05;
    text-transform: uppercase;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .card.short .title {
    font-size: 14px;
  }
  .card.alert .title {
    color: var(--mc-text-red);
  }
  .meta {
    margin-top: 3px;
    font-size: var(--mc-small-11);
    font-weight: 600;
    line-height: 1.25;
    opacity: 0.6;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .words.has-footer .meta {
    -webkit-line-clamp: 1;
  }
  .card.selected .meta {
    opacity: 0.75;
  }
  .footer {
    margin-top: auto;
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .badge {
    position: absolute;
    right: 14px;
    bottom: 10px;
    padding: 2px 4px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1px;
  }
`;
