import { pointRootLinksAt } from "./release-links.js";

const GAME = "https://marvel.example.test/";

describe("pointRootLinksAt", () => {
  it("sends the history page's and a report's Play links to the game", () => {
    expect(pointRootLinksAt('<a class="play" href="../">Play</a>', GAME)).toBe(
      `<a class="play" href="${GAME}">Play</a>`,
    );
    expect(pointRootLinksAt('<a\n  href="../../">Jugar</a>', GAME)).toBe(`<a\n  href="${GAME}">Jugar</a>`);
  });

  it("leaves release navigation, assets and other links alone", () => {
    const html = [
      '<a href="../index.html#v0.44.0">',
      '<a href="../index.html?lang=es#v0.44.0">',
      '<link href="../../fonts/a.woff2">',
      '<a href="https://example.test/">',
      '<a href="./">',
      '<a data-href="../../">',
    ].join("");
    expect(pointRootLinksAt(html, GAME)).toBe(html);
  });
});
