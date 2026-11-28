import { PressBaseStyles } from "@mc/ui";
import { css } from "lit";

export const McGuideOptionStyles = [
  PressBaseStyles,
  css`
    :host {
      min-width: 0;
    }
    .frame {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 20px;
      background: var(--mc-fill-card);
      border: 1.5px solid var(--mc-line-ink);
    }
    :host([selected]) .frame {
      border: 3px solid var(--mc-fill-red);
      /* The heavier border takes room: the padding gives it back so the words do not move. */
      padding: 12.5px 18.5px;
    }
    .radio {
      flex: none;
      width: 18px;
      height: 18px;
      margin-top: 1px;
      border: 2px solid var(--mc-line-ink);
      border-radius: 50%;
    }
    .radio[data-on] {
      background: radial-gradient(circle, var(--mc-fill-red) 0 4px, transparent 5px);
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    .title {
      font-size: 17px;
      font-weight: 800;
      line-height: 1.2;
    }
    .body {
      margin-top: 4px;
      font-size: 13px;
      line-height: 1.4;
    }
    /* Stays clear of the stamp at the card's top right. */
    .tagged .text {
      padding-right: 96px;
    }
    .tag {
      position: absolute;
      top: 10px;
      right: 10px;
    }
  `,
];
