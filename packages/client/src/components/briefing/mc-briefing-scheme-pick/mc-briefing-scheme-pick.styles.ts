import { css } from "lit";

export const McBriefingSchemePickStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    container-type: inline-size;
  }
  .prompt,
  .note {
    margin: 0;
  }
  .note {
    margin-bottom: 2px;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "title pick"
      "cards cards";
    align-items: center;
    gap: 8px 12px;
    padding: 8px 12px 10px;
  }
  .title {
    grid-area: title;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .cards {
    grid-area: cards;
    display: grid;
    grid-template-columns: repeat(var(--cards, 3), minmax(0, 1fr));
    gap: 8px;
  }
  mc-briefing-pick-card {
    --pick-height: 64px;
  }
  .pick {
    grid-area: pick;
    width: 84px;
    height: 44px;
  }
  /* Wide: one line, the captions beside their pictures, Pick at the end; the label is the captions. */
  @container (min-width: 560px) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: "cards pick";
    }
    .title {
      display: none;
    }
    mc-briefing-pick-card {
      --pick-height: 76px;
    }
    .pick {
      width: 96px;
    }
  }
`;
