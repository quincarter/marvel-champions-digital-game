import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAYABLE_DEPS } from "@mc/cards";
import { CORE_SCENARIOS } from "@mc/content";
import type { EngineDeps } from "@mc/engine";
import { builtCommunityPack, COMMUNITY_DIR, communityPackNames } from "./fixtures/community-pack.js";
import { gameDepsWithPack, packModularSetChoices } from "./game.js";
import { playCampaign, playSmokeGame, smokeSchedule, type SmokeGame, type SmokePlan } from "./smoke.js";
import { publishIssues, validatePack } from "./validate.js";

/**
 * Every community pack in content-packs/community (a folder per pack, the SDK's source layout): build it, validate
 * the built output, then play 3 seeds of each of its decks and each of its modular sets, on the real engine with the
 * pack's cards and abilities read back from the built JSON (what `mc-pack test` plays).
 *
 * Each smoke game is a test of its own (`smokeSchedule` lists them), so a pack with many decks and sets (Mephisto
 * plays 18 games) is many short tests rather than one that runs past the timeout on a busy runner. The packs are built
 * once for the run (./fixtures/community-pack.ts), at collection, so the games can be listed by name.
 */
const CORE_RHINO = CORE_SCENARIOS.find((s) => String(s.id) === "rhino")!;
const SEEDS = 3;

const packFolders = communityPackNames();
const built = new Map(
  await Promise.all(packFolders.map(async (name) => [name, await builtCommunityPack(name)] as const)),
);

const label = (plan: SmokePlan): string =>
  [
    plan.name,
    `at ${plan.scenario}`,
    ...(plan.modularSet ? [`with ${plan.modularSet}`] : []),
    ...(plan.difficulty ? [plan.difficulty] : []),
  ].join(" ");
const failures = (games: readonly SmokeGame[]): string[] =>
  games.filter((g) => !g.ok).map((g) => `${g.deck} seed ${g.seed}${g.node ? ` (${g.node})` : ""}: ${g.error}`);

describe("community packs", () => {
  it("has at least one pack folder", () => {
    expect(packFolders.length).toBeGreaterThan(0);
  });

  for (const name of packFolders) {
    describe(name, () => {
      const { pack, hasArt } = built.get(name)!;
      const schedule = smokeSchedule(pack, { games: SEEDS });
      let deps: EngineDeps | undefined;
      const depsOf = (): EngineDeps => (deps ??= gameDepsWithPack(PLAYABLE_DEPS, pack));

      it("has the credits and the creator's permission", () => {
        const source = join(COMMUNITY_DIR, name);
        for (const file of ["CREDITS.md", "PERMISSION.md"]) expect(existsSync(join(source, file)), file).toBe(true);
        expect(pack.manifest.permission, "permission in pack.json").toBeDefined();
      });

      // The publish gate (docs/custom-content-packs.md §11.4): publish-packs.yml runs `mc-pack validate --publish` and
      // fails on a pack that is neither a DRAFT nor granted. A pending pack says why, for that failure's log.
      it("records its approval: granted and publishable, or pending with what is missing", () => {
        const permission = pack.manifest.permission;
        expect(permission?.status, "permission.status").toMatch(/^(granted|pending)$/);
        if (permission?.status === "granted") expect(publishIssues(pack.manifest)).toEqual([]);
        else expect(permission?.note, "permission.note says what is missing").toBeTruthy();
      });

      it("validates as built, every ability scripted", () => {
        expect(validatePack(pack)).toEqual([]);
      });

      it("has a picture for every card face in each language, when the art is present", () => {
        if (!hasArt) return;
        for (const lang of pack.manifest.languages?.available ?? []) {
          for (const card of pack.cards) {
            // A hero identity is one record with two faces (01a, 01b), each with its own picture.
            const base = String(card.id).replace(/a$/, "");
            const codes = card.type === "hero_identity" ? [`${base}a`, `${base}b`] : [String(card.id)];
            for (const code of codes)
              expect(pack.files.has(`cards/${lang}/${code}.webp`), `${lang}: ${code}`).toBe(true);
          }
        }
      });

      it("ships its store cover when the cover file is present", () => {
        const source = JSON.parse(readFileSync(join(COMMUNITY_DIR, name, "pack.json"), "utf8")) as { cover?: string };
        if (source.cover === undefined || !existsSync(join(COMMUNITY_DIR, name, source.cover))) return;
        expect(pack.manifest.cover).toBe(source.cover);
        expect(pack.files.has(source.cover)).toBe(true);
      });

      it("plans a smoke game for each of its decks and each of its modular sets", () => {
        const decks = schedule.plans.filter((plan) => !plan.modularSet).map((plan) => plan.name);
        for (const deck of pack.decks ?? []) expect(decks, `deck ${String(deck.id)}`).toContain(String(deck.id));
        // A pack's modular set (not a hero's nemesis set) is picked at the Core scenario with a base precon.
        const sets = schedule.plans.flatMap((plan) => (plan.modularSet ? [plan.modularSet] : []));
        for (const set of packModularSetChoices(CORE_RHINO, [pack]))
          expect(sets, `modular set ${String(set.id)}`).toContain(String(set.id));
      });

      for (const plan of schedule.plans) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          it(`plays ${label(plan)}, seed ${seed}, to an outcome, and replays`, () => {
            expect(failures([playSmokeGame(pack, depsOf(), plan, seed, schedule.maxCommands)])).toEqual([]);
          });
        }
      }

      for (const campaign of schedule.campaigns) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          it(`plays campaign ${campaign.id}, seed ${seed}, through every node`, () => {
            const run = playCampaign(pack, campaign, seed, depsOf(), schedule.maxCommands);
            expect(failures(run.games)).toEqual([]);
          });
        }
      }
    });
  }
});
