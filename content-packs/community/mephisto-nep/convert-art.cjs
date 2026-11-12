/**
 * Converts the author's PNGs (the unzipped "Mephisto" download) to the pack's pictures: WebP, 900 px on the long side,
 * quality 85, landscape cards (main and side schemes, stored rotated in the source) turned upright.
 * Usage: node convert-art.cjs <folder with "Scenario Pack/"> <this pack folder>   (see fetch-art.sh)
 * Output names: cards/en/x.mephisto-nep.<code>.webp (villain stages I/II/III = 01, 01b, 01c; main scheme faces
 * 1A..3B = 02a..02f; Gateway/Hell = 03a/03b) and alt-art/en/<base card code>.webp for the Standard/Expert art.
 */
const fs0 = require("fs");
function loadSharp() {
  try {
    return require("sharp");
  } catch {
    let dir = __dirname;
    for (let i = 0; i < 6; i++, dir = require("path").dirname(dir)) {
      const pnpm = require("path").join(dir, "node_modules", ".pnpm");
      if (fs0.existsSync(pnpm)) {
        const hit = fs0.readdirSync(pnpm).find((n) => n.startsWith("sharp@"));
        if (hit) return require(require("path").join(pnpm, hit, "node_modules", "sharp"));
      }
    }
    throw new Error("sharp not found: run inside the repository after pnpm install");
  }
}
const sharp = loadSharp();
const fs = require("fs"),
  path = require("path");
const SRC = require("path").join(process.argv[2], "Scenario Pack") + "/";
const OUT = require("path").resolve(process.argv[3]) + "/";
const P = "x.mephisto-nep.";
const sc = "(Scenario) Mephisto/",
  bh = "(Modular) Blackheart/",
  co = "(Modular) Corruptive Offers/",
  da = "(Modular) Damned/",
  md = "(Modular) Mother of Demons/",
  se = "Standard & Expert/";
const L = [
  ["01", "(01) Mephisto I", "p"],
  ["01b", "(02) Mephisto II", "p"],
  ["01c", "(03) Mephisto III", "p"],
  ["02a", "(04A) Battle for the Soul", "l"],
  ["02b", "(04B) Battle for the Soul", "l"],
  ["02c", "(05A) Fiendish Investment", "l"],
  ["02d", "(05B) Fiendish Investment", "l"],
  ["02e", "(06A) Hellbound Obsession", "l"],
  ["02f", "(06B) Hellbound Obsession", "l"],
  ["03a", "(07A) Gateway to Corruption", "p"],
  ["03b", "(07B) Hell", "p"],
  ["04", "(08) Hell Lord", "p"],
  ["05", "(09) Endless Greed", "p"],
  ["06", "(10) Gluttonous Restoration", "p"],
  ["07", "(11) Lusting Existence", "p"],
  ["08", "(12) Prideful Ambitions", "p"],
  ["09", "(13) Shackled Wrath", "p"],
  ["10", "(14) Slothful Endurance", "p"],
  ["11", "(15) Unquenchable Envy", "p"],
  ["12", "(16) Aid the Condemned", "l"],
  ["13", "(17) Culling the Damned", "l"],
  ["14", "(18) Exposing Intentions", "l"],
  ["15", "(19) Hotel Inferno", "l"],
  ["16", "(20) Alter the Deal", "p"],
  ["17", "(21) Dark Compulsions", "p"],
  ["18", "(23) Demonic Fury", "p"],
  ["19", "(24) Infernal Temper", "p"],
  ["20", "(26) Meager Request", "p"],
  ["21", "(28) Rewrite History", "p"],
].map(([c, n, k]) => [sc + n, c, k]);
const B = [
  ["22", "(B01) Blackheart", "p"],
  ["23", "(B02) Prince's Offer", "l"],
  ["24", "(B03) Black-Hearted", "p"],
  ["25", "(B04) Sinful Ambitions", "p"],
].map(([c, n, k]) => [bh + n, c, k]);
const C = [
  ["26", "(CO01) Deathless Persistence"],
  ["27", "(CO02) Famished Power"],
  ["28", "(CO03) Pestilent Nature"],
  ["29", "(CO04) Warring Rage"],
  ["30", "(CO05) Soul Gambling"],
].map(([c, n]) => [co + n, c, "p"]);
const D = [
  ["31", "(D01) Demon Amalgam", "p"],
  ["32", "(D02) Demon Lieutenant", "p"],
  ["33", "(D03) Demon Soldier", "p"],
  ["34", "(D05) Dweller Demon", "p"],
  ["35", "(D06) Harmony Demon", "p"],
  ["36", "(D07) Human Demon", "p"],
  ["37", "(D09) Demonized", "p"],
  ["38", "(D10) Dark Lord's Tactics", "l"],
  ["39", "(D11) Hell's Legions", "l"],
  ["40", "(D12) Condemned Soul Portal", "p"],
].map(([c, n, k]) => [da + n, c, k]);
const M = [
  ["41", "(MoD01) Lilith", "p"],
  ["42", "(MoD02) Call of the Demoness", "l"],
  ["43", "(MoD03) Lilin Remaking", "p"],
  ["44", "(MoD04) Spawn Magic", "p"],
].map(([c, n, k]) => [md + n, c, k]);
const jobs = [...L, ...B, ...C, ...D, ...M].map(([s, c, k]) => [s, "cards/en/" + P + c + ".webp", k]);
const A = [
  ["01186", "(S01) Advance"],
  ["01187", "(S03) Assault"],
  ["01188", "(S06) Caught Off Guard"],
  ["01189", "(S07) Gang-Up"],
  ["01190", "(S05) Shadow of the Past"],
  ["01191", "(E01) Exhaustion"],
  ["01192", "(E02) Masterplan"],
  ["01193", "(E03) Under Fire"],
];
for (const [c, n] of A) jobs.push([se + n, "alt-art/en/" + c + ".webp", "p"]);
(async () => {
  for (const [s, o, k] of jobs) {
    let img = sharp(SRC + s + ".png");
    if (k === "l") img = img.rotate(-90);
    img = img.resize(k === "l" ? { width: 900 } : { height: 900, width: 900, fit: "inside" });
    fs.mkdirSync(path.dirname(OUT + o), { recursive: true });
    const r = await img.webp({ quality: 85 }).toFile(OUT + o);
    console.log(o, r.width, r.height, r.size);
  }
})();
