import { css } from "lit";

/**
 * A right-aligned row of square chrome buttons 8px apart (44px, 40px on a phone); a button with words beside its picture
 * is wider (58px, 52px on a phone). The measures are the table top bar slots (`view/language-button.ts`), so the pop-ups
 * that anchor to a slot land on the button.
 */
export const McTitleIconRowStyles = css`
  :host {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    --icon-button-size: 44px;
    --wide-width: 58px;
  }
  :host([mode="phone"]) {
    --icon-button-size: 40px;
    --wide-width: 52px;
  }
  mc-icon-button[label] {
    --icon-button-width: var(--wide-width);
  }
`;
