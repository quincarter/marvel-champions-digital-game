import { css } from "lit";

export const McCivilLeadersStyles = css`
  :host {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    gap: 14px;
    color: var(--mc-text-ink);
  }
  .top {
    display: flex;
    gap: 12px;
  }
  .portrait {
    flex: none;
    width: 110px;
    aspect-ratio: 5 / 7;
  }
  .facts {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .name {
    font-family: var(--mc-font-display);
    font-size: 22px;
    letter-spacing: 0.03em;
  }
  .word {
    font-size: var(--mc-small-10, 10px);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .stage {
    font-size: var(--mc-small-12, 12px);
  }
  .note {
    font-size: var(--mc-small-11, 11px);
    opacity: 0.75;
  }
  .always {
    margin-top: 8px;
    font-size: var(--mc-small-13, 13px);
    font-weight: 800;
  }
  .faces {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
  .face {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  mc-card-art {
    display: block;
    aspect-ratio: 7 / 5;
    width: 100%;
  }
  .over {
    position: absolute;
    inset: 0 0 18px 0;
  }
  .read {
    display: block;
    margin-top: 4px;
    font-size: var(--mc-small-10, 10px);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.8;
  }
`;
