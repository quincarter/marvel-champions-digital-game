---
name: release-announcement
description: Write a release's announcement from its open `chore(release): vX.Y.Z` pull request - the release-notes header, the report page at /releases/<version>/ and the images, in the style of the v0.38.0, v0.39.0 and v0.40.0 announcements. Use when someone asks for a release report, announcement, what's-new page or release notes header, or points at a release PR to write up.
---

# Write a release announcement

Every announcement goes out in **English and Spanish**. The input is the release PR: an open
`chore(release): vX.Y.Z` pull request, which lists everything unreleased and ends with its **Special thanks**. Ask for its number only if none is open. The output is one PR, into `main`, that
goes in **before** the release PR is merged. The web build carries it first, but nobody sees it on the release
history's list until GitHub calls that release latest, so it can merge ahead of the release safely.

The v0.40.0, v0.39.0 and v0.38.0 announcements are the models. Read all three before writing: `packages/client/public/releases/` for the v0.39.0 and v0.40.0 pages, and `docs/screenshots/releases/` for each release's images and headers. v0.38.0 has no page, so read its ten images and `gh release view v0.38.0`; it shows how to carry a call to action, "We need your controller", through a release. Build the page directly in the repo. The PR's Netlify preview is where it gets reviewed, so there is no artifact step.

## 1. Gather

Everything here comes from the source, never from memory. `<previous>` is the last `v*` tag, and `<version>` is the
release PR's.

```bash
gh pr view <release-pr> --json title,body --jq '.title,.body'
git log --oneline <previous>..origin/main
node scripts/release-credits.mjs notes <previous> origin/main <version>
```

- Read the PRs behind the biggest changes, for their screenshots and what they actually do. Credit each reporter by
  GitHub handle (`gh issue view <n> --json author`). `.github/credits.json` holds the people GitHub can't see, such as
  Discord reports.
- Read each PR's **Action Items** too. They hold what a player has to do or put up with, like running a new script
  once, a save that won't carry over or a build that shows English, and that belongs in the report. Anything there
  that says a check is still open goes to Quin under the PR's Action Items.
- Check the release PR's counts against the PR that made them before putting one on a tile, and check every menu path
  and button name you print against the code.
- Count for Code shipped last, in step 7, because the report's own PR is part of the release.
- Group the changes into stories a player would care about, biggest first. Bug fixes from reports go together under
  "You asked, we fixed", with the reporter on each. Internal work goes in "Also in" or nowhere.

## 2. Write the header

`docs/screenshots/releases/<version>/release-notes-header.md`, as in v0.39.0 and v0.40.0:

1. `## A short headline`, the release's story. The history page shows it in its list.
2. One paragraph naming the big changes and thanking people, with `#123` and `@handle`.
3. `**[Read the full <version> report on the site ↗](https://marvel-champions-digital-game.netlify.app/releases/<version>/)**:`
   and a line of what's in it.
4. The section images (step 5). They are required: this is what the GitHub release description shows.

## 3. Build the report

Copy `packages/client/public/releases/<latest>/` to `<version>/` and rewrite it. Both reports have the same shape; v0.39.0 shows how a big visual feature fills a band, and v0.40.0 how many stories sit side by side. Keep the shape:

- `<title>`, `description`, the `og:` tags and every `<latest>` in the file, including both `data-history-link` links
  to `../index.html#<version>`, which the history page removes when it embeds the report.
- The top: kicker, headline with a gold second line, and `.meta` with the release PR, the previous release and date.
- `.intro` with an "Achievement unlocked" pill and a paragraph, then the `.grid` of number tiles.
- One band per story, with `<h2>`, `<h3>` and framed screenshots with captions.
- `You asked, we fixed`, `Also in <version>`, the `.thanks` wall, then `Code shipped` and the footer.

Rules for the page:

- **Self-contained:** no scripts and no outside hosts. Fonts come from `../../fonts/` and images from `img/`, by
  relative paths, because the history page rewrites them and mounts the report in a shadow root.
- **Screenshots:** WebP under `img/`, about 1.4 MB to 3 MB in all, since `public/` ships in every app bundle. Reuse the
  PRs' screenshots, or take new ones with `scripts/shoot-app.mjs`. A PR's images are at the raw URLs in its body. Pull
  them with `curl` into a scratch folder and convert them with Pillow, which is on the rig: 1280 wide for a desktop
  shot, a phone shot left at its size, quality about 72 to 78. `img/og.jpg` is 1200x630, a crop of the top story's best
  screenshot. Keep each `<img>`'s `width` and `height` the file's real size.
- Don't leave a test build's numbers unexplained: if a shot shows a made-up version, say so in its caption.
- **No new `html` or `body` rules beyond the ones already there,** and use `max-width` and `min-width` media queries,
  which the history page turns into container queries.
- No sideways scroll at phone width.

Copy and voice: plain sentences, in the first person where it's Quin speaking, with no em dashes. State only what the
release PR and the code confirm.

## 4. Write it in Spanish

Read `docs/releases/es/README.md`: it holds the file shape, what stays in English and the term table. Write the English
first, get it final, then translate it, so the two say the same thing.

- `docs/releases/es/<version>.md`: the header's headline, paragraph and image alt text, then every line of the release
  PR's notes, with the same sections and items in the same order. `view/release-notes-es.test.ts` fails on the release
  PR if it drifts, so if a fragment lands after you write it, add its line, with this PR's own fragment included.
- `docs/releases/es/reports/<version>.json`: the report's text map, from each block of English in `index.html` (a `p`,
  `li`, heading, caption or `div`, with its inline tags, plus alt text and `content` attributes) to its Spanish. The
  build writes `index.es.html` from the page and the map, and it isn't in git, so layout, images and numbers only ever
  change in `index.html`. Copy the wording of v0.40.0's map where a line recurs.
- `view/release-report-spanish.test.ts` fails if a block has no Spanish or a key has no block. So once the map exists,
  changing a line of English means changing its key too. `reportTexts` lists what the page needs.
- `index.html`'s `.meta` has an Español link inside a `data-history-link` span. The map gives its Spanish version, which
  links back as English and sends All releases to `../index.html?lang=es#<version>`.
- The build adds the notice that says the Spanish is AI translated. The history page drops it and shows its own bar
  while Spanish is on.
- The header gets one line under its English report link:
  `**[Lee el informe completo en español ↗](https://marvel-champions-digital-game.netlify.app/releases/<version>/index.es.html)**`.
- Screenshots and the GitHub release's section images stay in English, since the game's own text is English.
- Say in the PR's Action Items that a Spanish speaker should read it, and name the lines you weren't sure of.

## 5. Section images for the GitHub release

The GitHub release description carries the report as images, cut from the finished page in sections so it stays small
and easy to read. Every release needs them.

- With the dev server up, `node scripts/shoot-release-report.mjs <version> sections` cuts one JPG per section of the
  page, in order: the numbers first (the top of the page down to the tiles), then each band, with Thank you on its own.
  They land in `docs/screenshots/releases/<version>/`, about 2848 px wide, named in the
  `v0-40-0-release-01-the-numbers.jpg` style. v0.40.0 has 14 and v0.39.0 has 9.
- List them in the header as `![what it shows](raw URL)`, with the alt text naming what the image holds and the URL
  pinned to the commit that adds them. Commit the images first, then the header that names that commit. Cut them only
  once Code shipped is final (step 7), or that image and its alt text go stale.

## 6. Wire it in

- `RELEASE_NOTICE_VERSION` in `packages/client/src/view/release-notice.ts`, which `view/release-notice.test.ts` checks
  has a report.
- The `/shadowland-info.html` redirect in `netlify.toml`, which older builds' title bar opens.
- A changie fragment: `changie new -k Added -b "The <version> release report has its own page on the site, at /releases/<version>/"`.

## 7. Check and ship

- Run the touched unit test, `pnpm exec oxfmt` and `pnpm exec oxlint` on the changed files.
- A fresh worktree needs `pnpm install`, and not `pnpm assets:fetch`: the report needs no media.
- The history page only finds a report through `.changes/<version>.md`, which the release writes. To check the report
  inside it, write a short temporary `.changes/<version>.md`, restart the dev server (the notes are read when it
  starts), and delete the file afterwards.
- Open `/releases/index.html?lang=es#<version>` too, and press the toggle on it: the page stays on the release and the
  report and notes swap language.
- `node scripts/shoot-release-report.mjs <version> sizes` shoots `se`, `pixel`, `tablet-portrait`, `tablet` and
  `desktop`, alone and inside the history, and fails on sideways scroll, a broken image or a wrong `width` or `height`.
  Read the screenshots too. To show them in the PR, commit them under `docs/pr-screenshots/`, link them by that commit
  and remove them in the next commit, so they don't ship or count in Code shipped.
- Merge the latest `origin/main`, branch `feature/<version>-release-report`, commit as Quin with no Claude attribution.
- **Code shipped comes last.** With everything else staged, count pull requests from the `(#n)` subjects in
  `git log <previous>..origin/main`, plus one for this PR, and take files and lines from
  `git diff --cached --shortstat <previous>`. Put them in the page, cut the images, commit, and re-pin the header.
- The release PR is regenerated on every merge. If anything lands on `main` after you start, re-read its notes and
  recount before this PR merges.
- The PR says what the report covers, and asks Quin to read the copy, in both languages, under **Action Items**. It merges before the
  release PR.
