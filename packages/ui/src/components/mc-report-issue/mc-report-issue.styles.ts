import { css } from "lit";

export const McReportIssueStyles = css`
  :host {
    display: block;
    position: absolute;
    inset: 0;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--mc-fill-void) calc(var(--mc-scrim, 0.7) * 100%), transparent);
  }
  .box {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100% - 48px));
    max-height: calc(100% - 16px);
    overflow-y: auto;
    padding: 24px;
    background: var(--mc-fill-paper);
    border: 4px solid var(--mc-line-ink);
    animation: rise 180ms cubic-bezier(0.5, 1, 0.89, 1);
  }
  :host([columns="2"]) .box {
    width: min(860px, calc(100% - 48px));
  }
  :host([phone]) .box {
    width: min(560px, calc(100% - 16px));
    padding: 16px;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 40px));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .box {
      animation: none;
    }
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding-bottom: 8px;
    margin-bottom: 10px;
    border-bottom: 2px solid color-mix(in srgb, var(--mc-line-ink) 50%, transparent);
  }
  .title {
    font-family: var(--mc-font-display);
    font-size: 22px;
    text-transform: uppercase;
  }
  .close {
    width: 44px;
    height: 44px;
    margin-right: -8px;
  }
  .steps {
    display: flex;
    gap: 24px;
  }
  .col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .feedback {
    margin: 12px 0 0;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.25;
  }
`;
