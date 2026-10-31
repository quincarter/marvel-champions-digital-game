---
name: release-announcement
description: Write a release's announcement from its open `chore(release): vX.Y.Z` pull request - the release-notes header, the report page at /releases/<version>/ and the images, in the design of the v0.39.0 and v0.40.0 reports. Use when someone asks for a release report, announcement, what's-new page or release notes header, or points at a release PR to write up.
---

# Write a release announcement

The input is the release PR: an open `chore(release): vX.Y.Z` pull request, which lists everything unreleased and
ends with its **Special thanks**. Ask for its number only if none is open. The output is one PR, into `main`, that
goes in **before** the release PR is merged. The web build carries it first, but nobody sees it on the release
history's list until GitHub calls that release latest, so it can merge ahead of the release safely.

The v0.39.0 and v0.40.0 reports are the models. Read both before writing: `packages/client/public/releases/` for the pages, and `docs/screenshots/releases/` for their headers and images. Build the page directly in the repo. The PR's Netlify preview is where it gets reviewed, so there is no artifact step.

## 1. Gather

Everything here comes from the source, never from memory. `<previous>` is the last `v*` tag, and `<version>` is the
release PR's.

```bash
gh pr view <release-pr> --json title,body --jq '.title,.body'
git log --oneline <previous>..origin/main
node scripts/release-credits.mjs notes <previous> origin/main <version>
```

- Read the PRs behind the biggest changes, for their screenshots and what they actually do. Credit each reporter by
  GitHub handle. `.github/credits.json` holds the people GitHub can't see, such as Discord reports.
- Count for Code shipped: pull requests merged, files changed, lines added and removed
  (`git diff --shortstat <previous> origin/main`, and `git log --merges` or the `(#n)` subjects for the PRs).
- Group the changes into stories a player would care about, biggest first. Bug fixes from reports go together under
  "You asked, we fixed", with the reporter on each. Internal work goes in "Also in" or nowhere.

## 2. Write the header

`docs/screenshots/releases/<version>/release-notes-header.md`, as in v0.39.0 and v0.40.0:

1. `## A short headline`, the release's story. The history page shows it in its list.
2. One paragraph naming the big changes and thanking people, with `#123` and `@handle`.
3. `**[Read the full <version> report on the site ↗](https://marvel-champions-digital-game.netlify.app/releases/<version>/)**:`
   and a line of what's in it.
4. The report images (step 4), if there are any.

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
  PRs' screenshots, or take new ones with `scripts/shoot-app.mjs`. `img/og.jpg` is 1200x630.
- **No new `html` or `body` rules beyond the ones already there,** and use `max-width` and `min-width` media queries,
  which the history page turns into container queries.
- No sideways scroll at phone width.

Copy and voice: plain sentences, in the first person where it's Quin speaking, with no em dashes. State only what the
release PR and the code confirm.

## 4. Images for the GitHub notes

One JPG per story, cut from the report at 2x, in `docs/screenshots/releases/<version>/`, named
`v0-40-0-release-01-the-numbers.jpg` style. List them in the header as `![what it shows](raw URL)`, with the URL
pinned to the commit that adds them. Commit the images first, then the header that names that commit.

## 5. Wire it in

- `RELEASE_NOTICE_VERSION` in `packages/client/src/view/release-notice.ts`, which `view/release-notice.test.ts` checks
  has a report.
- The `/shadowland-info.html` redirect in `netlify.toml`, which older builds' title bar opens.
- A changie fragment: `changie new -k Added -b "The <version> release report has its own page on the site, at /releases/<version>/"`.

## 6. Check and ship

- Run the touched unit test, `pnpm exec oxfmt` and `pnpm exec oxlint` on the changed files.
- With the dev server up, open `/releases/index.html#<version>`: the report sits on top, its notes below, nothing runs
  sideways, and every image loads. The page must have a `.changes/<version>.md` to appear, so before the release PR
  merges check the report on its own at `/releases/<version>/index.html`.
- Screenshot it at `se`, `pixel`, `tablet-portrait`, `tablet` and `desktop` for the PR.
- Merge the latest `origin/main`, branch `feature/<version>-release-report`, commit as Quin with no Claude attribution.
- The PR says what the report covers, and asks Quin to read the copy under **Action Items**.
