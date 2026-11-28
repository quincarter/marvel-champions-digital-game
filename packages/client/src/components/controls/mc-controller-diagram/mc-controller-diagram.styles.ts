import { css } from "lit";

export const McControllerDiagramStyles = css`
  :host {
    display: block;
    width: 100%;
  }
  .frame {
    position: relative;
    width: 100%;
    aspect-ratio: var(--aspect, 1);
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-paper);
    outline-offset: -1px;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .glyph {
    position: absolute;
  }
  .missing {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 12px;
    text-align: center;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    font-size: var(--mc-small-12, 12px);
  }
`;
