import { css } from "lit";

export const McPictureStyles = css`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
  }
  :host([cover]) img {
    object-fit: cover;
  }
  .missing {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.5;
  }
  :host([framed])::after {
    content: "";
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 2px var(--mc-line-ink);
    pointer-events: none;
  }
`;
