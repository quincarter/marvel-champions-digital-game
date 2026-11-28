import type { Page } from "@playwright/test";
import { settle } from "./helpers.js";

/**
 * Scrolls the Briefing panel so the first element whose own text contains `text` is in view: a text scrolled out of its panel is not
 * on screen to read (`__mcFindText`), as a player would have to scroll to it too.
 */
export async function revealText(page: Page, text: string): Promise<void> {
  await page.evaluate((needle) => {
    const visit = (node: ParentNode): boolean => {
      for (const element of Array.from(node.querySelectorAll("*"))) {
        const own = Array.from(element.childNodes)
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent ?? "")
          .join("");
        if (own.toLowerCase().includes(needle.toLowerCase())) {
          (element as HTMLElement).scrollIntoView({ block: "center" });
          return true;
        }
        if (element.shadowRoot && visit(element.shadowRoot)) return true;
      }
      return false;
    };
    const layer = document.getElementById("mc-ui");
    if (layer) visit(layer);
  }, text);
  await settle(page);
}
