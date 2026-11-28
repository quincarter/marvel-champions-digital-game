import { css } from "lit";

export const McDecksImportBoxStyles = css`
  .box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    border: 2px solid var(--mc-line-ink);
  }
  .heading {
    margin: 0;
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .description {
    margin: 0;
    font-size: 13px;
    line-height: 1.3;
    opacity: 0.8;
  }
  .buttons {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .buttons .ctl,
  .go .ctl {
    height: 28px;
  }
  .paste {
    height: 64px;
  }
  .link {
    height: 28px;
  }
  @media (pointer: coarse), (max-width: 1279px) {
    .buttons .ctl,
    .go .ctl,
    .link {
      height: 44px;
    }
    .description {
      font-size: 11px;
    }
  }
`;
