import { describe, expect, test } from "vitest";
import {
  GMW_CAMPAIGN_DEFINITION,
  MTS_CAMPAIGN_DEFINITION,
  CAMPAIGNS,
  SM_CAMPAIGN_DEFINITION,
  TRORS_CAMPAIGN_DEFINITION,
} from "@mc/cards";
import { ART_CATALOG } from "../art/scenario-art.js";
import { SAGA_VOLUMES, issueStoryFor, lineForRoster, storyFor } from "./story.js";

describe("campaign story", () => {
  test("MC10's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("trors");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      TRORS_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
  });

  test("MC16's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("gmw");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      GMW_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
  });

  test("MC21's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("mts");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      MTS_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
  });

  test("every mts comicBeats ref points at a page and beat that exist, and every page file is used by some issue or the finale", () => {
    const story = storyFor("mts")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      for (const ref of issue.comicBeats ?? []) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `mts comicBeats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `mts comicBeats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
      }
    }
    if (story.finale.page) usedFiles.add(story.finale.page);
    for (const page of pages) {
      expect(usedFiles.has(page.file), `mts page never used: ${page.file}`).toBe(true);
    }
  });

  test("every mts issue with an Aftermath shows a real comic panel there, not a placeholder note", () => {
    const story = storyFor("mts")!;
    const pages = story.pages!;
    for (const issue of story.issues.filter((i) => i.aftermath)) {
      const refs = issue.aftermathBeats ?? [];
      expect(refs.length, `mts ${issue.nodeId}: no aftermathBeats`).toBeGreaterThan(0);
      for (const ref of refs) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page?.beats[ref.beatIndex], `mts aftermathBeats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
      }
    }
  });

  test("every comicBeats ref points at a page and beat that exist, and every page file is used by some issue or is the box's known unwired aftermath/finale page", () => {
    const story = storyFor("gmw")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      for (const ref of issue.comicBeats ?? []) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `gmw comicBeats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `gmw comicBeats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
      }
    }
    // 04-knowhere (scenario 4 aftermath) and 06-finale (the finale spread) are recorded but not wired to an
    // issue opener yet — those screens land in a later pass (see the story file's own header note).
    const unwired = new Set(["04-knowhere", "06-finale"]);
    for (const page of pages) {
      if (!usedFiles.has(page.file)) expect(unwired.has(page.file), `gmw page never used: ${page.file}`).toBe(true);
    }
  });

  test("MC10's comicBeats ref points at a page and beat that exist, every page file is used or is the unwired epilogue, and every issue's own beats climb in reading order", () => {
    const story = storyFor("trors")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      const refs = issue.comicBeats ?? [];
      let lastPage: string | null = null;
      let lastBeatIndex = -1;
      for (const ref of refs) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `trors comicBeats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `trors comicBeats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
        // Reading order within one page climbs (a page shared across two issues, like GMW's museum split, can
        // pick up mid-page rather than always starting at beat 0 — the prior issue already claimed the earlier
        // beats), but this issue's own refs never repeat or reverse a beat on the same page.
        if (ref.page === lastPage) {
          expect(ref.beatIndex, `${issue.nodeId}: ${ref.page} beats out of reading order`).toBeGreaterThan(
            lastBeatIndex,
          );
        }
        lastPage = ref.page;
        lastBeatIndex = ref.beatIndex;
      }
    }
    // 08-epilogue is the finale's own page — recorded for a later comic pass over the Finale screen, not wired
    // to any issue yet (see the story file's own header note).
    const unwired = new Set(["08-epilogue"]);
    for (const page of pages) {
      if (!usedFiles.has(page.file)) expect(unwired.has(page.file), `trors page never used: ${page.file}`).toBe(true);
    }
  });

  test("every MC10 page is marked lettered — the reader draws none of its own captions/bubbles over the box's official art", () => {
    for (const page of storyFor("trors")!.pages ?? []) expect(page.lettered, page.file).toBe(true);
  });

  test("every trors page file on disk exists in art/campaigns/trors/pages, matching the story's own page list", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/trors/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith("."))
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    const named = (storyFor("trors")!.pages ?? []).map((page) => page.file).sort();
    expect(onDisk).toEqual(named);
  });

  test("every gmw stagePanels ref points at a page and beat that exist", () => {
    const story = storyFor("gmw")!;
    const pages = story.pages!;
    for (const issue of story.issues) {
      for (const [stage, ref] of Object.entries(issue.stagePanels ?? {})) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `gmw stagePanels: ${issue.nodeId} stage ${stage}: unknown page "${ref.page}"`).toBeDefined();
        expect(
          page!.beats[ref.beatIndex],
          `gmw stagePanels: ${issue.nodeId} stage ${stage}: ${ref.page}#${ref.beatIndex}`,
        ).toBeDefined();
        // A `stagePanels` entry with no matching `stageLines` entry would draw a panel with an empty speech
        // bubble — the beat never opens for a stage the story has nothing to say about (`campaign-beat-model.ts`),
        // so a `stagePanels` entry with no line is dead data.
        expect(
          issue.stageLines[Number(stage)],
          `gmw stagePanels: ${issue.nodeId} stage ${stage} has no matching stageLines entry`,
        ).toBeDefined();
      }
    }
  });

  test("MC27's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("sm");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      SM_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
  });

  test("sm issue #1's picking-phase panel is real villain art, not the placeholder note the screen used to show", () => {
    // Reported: the Aftermath's left panel (`scenes/campaign/aftermath.ts`'s `#drawArt`) reads `aftermathArt`
    // directly, not `aftermathBeats` (that only drives the *summary* phase's guided read) — so a "note" placeholder
    // here showed literal placeholder text even once this box's own scenario villain art shipped.
    const sandman = storyFor("sm")!.issues.find((issue) => issue.nodeId === "sandman")!;
    expect(sandman.aftermathArt).toEqual({ kind: "villain" });
    // The `{ kind: "villain" }` fallback (`#drawArt`) only draws something once art/scenarios/sandman/villain.*
    // actually exists — this is what proves the fallback isn't itself a second placeholder.
    expect(ART_CATALOG.scenarios.get("sandman")?.villain.length).toBeGreaterThan(0);
  });

  test("every sm comicBeats/aftermathBeats ref points at a page and beat that exist, and every page file is used by some issue or the finale", () => {
    const story = storyFor("sm")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      for (const ref of [...(issue.comicBeats ?? []), ...(issue.aftermathBeats ?? [])]) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `sm beats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `sm beats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
      }
    }
    if (story.finale.page) usedFiles.add(story.finale.page);
    for (const page of pages) {
      expect(usedFiles.has(page.file), `sm page never used: ${page.file}`).toBe(true);
    }
  });

  test("every sm page file on disk exists in art/campaigns/sm/pages, matching the story's own page list", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/sm/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith(".") && file !== "CREDITS.md")
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    const named = (storyFor("sm")!.pages ?? []).map((page) => page.file).sort();
    expect(onDisk).toEqual(named);
  });

  test("MC32's story has exactly one issue per campaign node, in node order", () => {
    expect(storyFor("mut_gen")?.issues.map((issue) => issue.nodeId)).toEqual(
      CAMPAIGNS.mut_gen!.graph.nodes.map((node) => node.id),
    );
  });

  test("every mut_gen issue has beats, every beat ref exists, and every page is used", () => {
    const story = storyFor("mut_gen")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      expect(issue.comicBeats?.length, `mut_gen ${issue.nodeId} has no comicBeats`).toBeGreaterThan(0);
      for (const ref of [...(issue.comicBeats ?? []), ...(issue.aftermathBeats ?? [])]) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `mut_gen beats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `mut_gen beats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
      }
    }
    if (story.finale.page) usedFiles.add(story.finale.page);
    for (const page of pages) {
      expect(page.lettered).toBe(true);
      expect(usedFiles.has(page.file), `mut_gen page never used: ${page.file}`).toBe(true);
    }
  });

  test("every mut_gen page file on disk exists in art/campaigns/mut_gen/pages, matching the story's own page list", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/mut_gen/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith(".") && file !== "CREDITS.md")
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    const named = (storyFor("mut_gen")!.pages ?? []).map((page) => page.file).sort();
    expect(onDisk).toEqual(named);
  });

  test("every mts page file on disk exists in art/campaigns/mts/pages, matching the story's own page list", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/mts/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith(".") && file !== "CREDITS.md")
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    const named = (storyFor("mts")!.pages ?? []).map((page) => page.file).sort();
    expect(onDisk).toEqual(named);
  });

  test("every gmw, trors, mts and sm panel rect sits inside its page's own bounds", () => {
    for (const campaignId of ["gmw", "trors", "mts", "sm"]) {
      const story = storyFor(campaignId)!;
      for (const page of story.pages ?? []) {
        for (const beat of page.beats) {
          const { x, y, w, h } = beat.panel;
          expect(x, `${campaignId}/${page.file}`).toBeGreaterThanOrEqual(0);
          expect(y, `${campaignId}/${page.file}`).toBeGreaterThanOrEqual(0);
          expect(x + w, `${campaignId}/${page.file}`).toBeLessThanOrEqual(page.width);
          expect(y + h, `${campaignId}/${page.file}`).toBeLessThanOrEqual(page.height);
        }
      }
    }
  });

  test("a hero line falls back to narration when that hero did not sign the roster", () => {
    const line = issueStoryFor("trors", "crossbones")!.opener[2]!.lines[0]!;
    expect(lineForRoster(line, ["04001a"])?.speaker.kind).toBe("hero");
    expect(lineForRoster(line, ["01001a"])).toEqual({ speaker: { kind: "narrator" }, text: line.fallback });
    const noFallback = issueStoryFor("trors", "crossbones")!.opener[2]!.lines[1]!;
    expect(lineForRoster(noFallback, ["01001a"])).toBeNull();
  });

  test("the saga lists ten campaign boxes and no Civil War", () => {
    expect(SAGA_VOLUMES.map((volume) => volume.boxCode)).not.toContain("MC56");
    expect(SAGA_VOLUMES).toHaveLength(10);
  });
});

describe("MojoMania's story (MC39)", () => {
  const story = storyFor("mojo")!;

  test("has exactly one issue per campaign node, in node order", () => {
    expect(story.issues.map((issue) => issue.nodeId)).toEqual(CAMPAIGNS.mojo!.graph.nodes.map((node) => node.id));
  });

  test("every issue carries the whole set of copy the other boxes' issues do", () => {
    for (const issue of story.issues) {
      const where = `mojo ${issue.nodeId}`;
      for (const field of ["title", "villain", "blurb", "recap", "teaser", "rewindTaunt"] as const) {
        expect(issue[field], `${where}.${field}`).toBeTruthy();
      }
      expect(issue.opener, `${where} opener`).toHaveLength(3);
      expect(issue.briefing.text, `${where} briefing`).toBeTruthy();
      expect(issue.aftermath?.text, `${where} aftermath`).toBeTruthy();
      expect(issue.aftermathArt, `${where} aftermathArt`).toBeDefined();
      expect(issue.briefingNotes?.length ?? 0, `${where} briefingNotes`).toBeGreaterThanOrEqual(3);
      expect(issue.briefingNotes!.some((note) => note.status === "done")).toBe(true);
    }
  });

  test("stage lines exist for exactly the stages a scenario flips through", () => {
    // MaGog stays at stage 1; Spiral and Mojo flip to II (standard) or III (expert).
    expect(Object.keys(story.issues[0]!.stageLines)).toEqual([]);
    for (const issue of story.issues.slice(1)) expect(Object.keys(issue.stageLines)).toEqual(["2", "3"]);
  });

  test("the box names a default cast, a cover blurb and a roster note that does not claim the cast ships in it", () => {
    expect(story.castIdentityIds).toEqual(["37001a", "38001a"]);
    expect(story.tagline).toBeTruthy();
    expect(story.blurb.length).toBeGreaterThan(40);
    expect(story.rosterNote).toBeTruthy();
    expect(story.rosterNote).not.toMatch(/ship in this box/i);
  });

  test("a hero line falls back to narration for a roster without that hero", () => {
    const line = story.issues[0]!.aftermath!;
    expect(lineForRoster(line, ["37001a"])?.speaker.kind).toBe("hero");
    expect(lineForRoster(line, ["01001a"])?.speaker.kind).toBe("narrator");
  });

  test("every NPC portrait names a scenario with villain art, and no panel names an artboard that is not on disk", () => {
    for (const issue of story.issues) {
      for (const speaker of [
        issue.briefing.speaker,
        ...issue.opener.flatMap((panel) => panel.lines.map((line) => line.speaker)),
      ]) {
        if (speaker.kind === "npc" && speaker.portraitScenarioId) {
          expect(ART_CATALOG.scenarios.get(speaker.portraitScenarioId)?.villain.length, speaker.name).toBeGreaterThan(
            0,
          );
        }
      }
    }
  });

  test("every artboard an opener names is on disk", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/mojo/artboards");
    const onDisk = new Set(readdirSync(dir).map((file) => file.slice(0, file.lastIndexOf("."))));
    const missing: string[] = [];
    for (const issue of story.issues) {
      for (const panel of issue.opener) {
        if (panel.art.kind === "artboard" && !onDisk.has(panel.art.name)) missing.push(panel.art.name);
      }
    }
    expect(missing).toEqual([]);
  });

  test("every issue's scenario has a villain picture for the opener and the aftermath", () => {
    for (const issue of story.issues) {
      expect(ART_CATALOG.scenarios.get(issue.nodeId)?.villain.length, issue.nodeId).toBeGreaterThan(0);
    }
  });

  test("the plain-words copy is keyed by instruction ids the definition really has", () => {
    const ids = new Set(
      CAMPAIGNS.mojo!.graph.nodes.flatMap((node) =>
        [...(node.composition ?? []), ...node.setup, ...node.victory].map((instruction) => instruction.id),
      ),
    );
    for (const id of [...Object.keys(story.setupCalls ?? {}), ...Object.keys(story.aftermathCalls ?? {})]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
  test("the lettered pages: every beat ref exists, rects sit inside their page, every page is used, the files are on disk", async () => {
    const pages = story.pages!;
    const used = new Set<string>();
    for (const issue of story.issues) {
      for (const ref of issue.comicBeats ?? []) {
        expect(
          pages.find((p) => p.file === ref.page)?.beats[ref.beatIndex],
          `${issue.nodeId} ${ref.page}#${ref.beatIndex}`,
        ).toBeDefined();
        used.add(ref.page);
      }
    }
    for (const ref of story.finale.comicBeats ?? []) used.add(ref.page);
    expect(story.finale.page).toBe("02-and-so-it-goes");
    for (const page of pages) {
      // An artboard page is clean art the reader letters itself; the two comic pages carry their own lettering.
      expect(page.lettered === true, page.file).toBe(page.artboard !== true);
      expect(used.has(page.file), `mojo page never used: ${page.file}`).toBe(true);
      for (const { panel } of page.beats) {
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.y).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.w, page.file).toBeLessThanOrEqual(page.width);
        expect(panel.y + panel.h, page.file).toBeLessThanOrEqual(page.height);
      }
    }
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/mojo/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith("."))
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    expect(onDisk).toEqual(
      pages
        .filter((page) => !page.artboard)
        .map((page) => page.file)
        .sort(),
    );
  });

  test("every issue reads pictures before its briefing: #1 the lettered spread, #2 and #3 three artboards each in two framings", () => {
    expect(story.issues.map((issue) => issue.comicBeats?.length ?? 0)).toEqual([14, 6, 6]);
    for (const issue of story.issues) expect(issue.opener).toHaveLength(3);
    for (const issue of story.issues.slice(1)) {
      const names = issue.opener.map((panel) => (panel.art.kind === "artboard" ? panel.art.name : null));
      expect(issue.comicBeats!.map((ref) => ref.page)).toEqual(names.flatMap((name) => [name, name]));
    }
  });

  test("a phone reads one framing of each picture and a desktop the other, with the same caption and lines", () => {
    for (const issue of story.issues.slice(1)) {
      const beats = issue.comicBeats!.map(
        (ref) => story.pages!.find((p) => p.file === ref.page)!.beats[ref.beatIndex]!,
      );
      for (let i = 0; i < beats.length; i += 2) {
        const [wide, narrow] = [beats[i]!, beats[i + 1]!];
        expect(wide.wideOnly).toBe(true);
        expect(narrow.narrowOnly).toBe(true);
        expect(narrow.caption).toBe(wide.caption);
        expect(narrow.lines.map((l) => l.text)).toEqual(wide.lines.map((l) => l.text));
        // The wide framing is the 2.04:1 reading area's shape and the phone's the 0.574:1 one, so a bubble's page
        // coordinates land where they were measured.
        expect(wide.panel.w / wide.panel.h).toBeCloseTo(1440 / 705, 1);
        expect(narrow.panel.w / narrow.panel.h).toBeCloseTo(390 / 680, 1);
      }
    }
  });

  test("every illustrated bubble's tail lands inside its wide beat, the bubble in the picture, and the copy stays short", () => {
    for (const page of story.pages!.filter((p) => p.artboard)) {
      for (const beat of page.beats) {
        expect(beat.caption?.length ?? 0, page.file).toBeLessThanOrEqual(75);
        expect(beat.caption?.split(/[.!?]\s/).length ?? 1, `${page.file} caption is one sentence`).toBeLessThanOrEqual(
          2,
        );
        for (const line of beat.lines) {
          expect(line.text.length, page.file).toBeLessThanOrEqual(60);
          if (beat.narrowOnly) {
            expect(line.placement, `${page.file} phone beat`).toBeUndefined();
            continue;
          }
          // Rogue is not in the hallway picture, so her line has no one to point at and stacks at the bottom.
          if (!line.placement) {
            expect(page.file).toBe("hallway");
            continue;
          }
          const { speaker, bubble } = line.placement;
          expect(speaker.x, page.file).toBeGreaterThanOrEqual(beat.panel.x);
          expect(speaker.x, page.file).toBeLessThanOrEqual(beat.panel.x + beat.panel.w);
          expect(speaker.y, page.file).toBeGreaterThanOrEqual(beat.panel.y);
          expect(speaker.y, page.file).toBeLessThanOrEqual(beat.panel.y + beat.panel.h);
          expect(bubble.x, page.file).toBeGreaterThan(beat.panel.x);
          expect(bubble.x, page.file).toBeLessThan(beat.panel.x + beat.panel.w);
          expect(bubble.y, page.file).toBeGreaterThan(beat.panel.y);
          expect(bubble.y, page.file).toBeLessThan(beat.panel.y + beat.panel.h);
        }
      }
    }
  });

  test("Rewind's photo is a beat with placed art, and the hallway's hero line keeps its narration", () => {
    for (const issue of story.issues.slice(1)) {
      const ref = issue.rewindPanel!;
      expect(story.pages!.find((p) => p.file === ref.page)!.note, issue.nodeId).toBeUndefined();
    }
    const hallway = story.pages!.find((p) => p.file === "hallway")!;
    expect(hallway.note).toBeUndefined();
    expect(lineForRoster(hallway.beats[0]!.lines[0]!, ["01001a"])?.speaker.kind).toBe("narrator");
    expect(lineForRoster(hallway.beats[0]!.lines[0]!, ["38001a"])?.speaker.kind).toBe("hero");
  });

  test("on a phone the reader reaches every panel in halves no wider than 530 source pixels (a 498-wide panel plus its 4% margin), wide panels whole on desktop", () => {
    for (const page of story.pages!.filter((p) => !p.artboard)) {
      const narrow = page.beats.filter((b) => !b.wideOnly);
      const wide = page.beats.filter((b) => !b.narrowOnly);
      expect(narrow.length).toBeGreaterThan(0);
      expect(wide.length).toBeGreaterThan(0);
      for (const b of narrow) expect(b.panel.w, page.file).toBeLessThanOrEqual(530);
    }
  });
});
