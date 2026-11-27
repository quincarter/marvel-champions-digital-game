import { describe, expect, it } from "vitest";
import "./mc-article.js";

describe("mc-article", () => {
  it("flows a title, headings, paragraphs, bullets, quotes and pictures natively", async () => {
    const article = document.createElement("mc-article");
    article.model = {
      title: "Setup",
      blocks: [
        { kind: "heading", text: "Step one" },
        { kind: "paragraph", text: "Shuffle." },
        { kind: "bullet", text: "Top", depth: 0 },
        { kind: "bullet", text: "Nested", depth: 1 },
        { kind: "quote", text: "Flavor" },
        { kind: "picture", src: "/p.png", fallback: "a page" },
        { kind: "picture", src: null, fallback: "Loading the page…" },
      ],
    };
    document.body.append(article);
    await article.updateComplete;
    const root = article.shadowRoot!;
    expect(root.querySelector("h2.title")!.textContent).toBe("Setup");
    expect(root.querySelectorAll(".bullet")).toHaveLength(2);
    expect(root.querySelector(".bullet.deep")!.textContent).toContain("Nested");
    expect(root.querySelector(".quote")).not.toBeNull();
    expect(root.querySelector(".picture img")!.getAttribute("loading")).toBe("lazy");
    expect(root.textContent).toContain("Loading the page…");
    expect(article.scroller).toBe(root.querySelector(".scroller"));
    article.remove();
  });
});
