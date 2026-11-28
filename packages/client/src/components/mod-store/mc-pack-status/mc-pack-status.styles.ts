import { css } from "lit";

export const McPackStatusStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 30px;
    gap: 2px;
  }
  .line,
  .words {
    font-weight: 800;
    font-size: 12px;
    line-height: 1.2;
  }
  .line {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  /* A failure is a "!" and the words in Hero Red; the mark carries it where colour cannot. */
  .failure {
    color: var(--mc-text-red);
  }
  .words {
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    height: 10px;
    padding: 2px;
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
  .fill {
    height: 100%;
    background: var(--mc-fill-ink);
  }
`;
