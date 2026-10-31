/**
 * The release history page (issue #588). The list comes from `history/manifest.json`, which
 * `vite-release-history.ts` writes from the changelog. The address's hash picks the release, so a link in the list is
 * a plain `#v0.33.0`: the browser's back and forward work, a link can be shared, and nothing reloads.
 *
 * A release with a report gets that report, fetched and mounted in a shadow root so its styles stay its own. Any other
 * release is drawn from `history/<version>.json`. Lives in `public/` beside the reports, which is why it is plain
 * script with no imports.
 */
(() => {
  const BASE = new URL(".", document.currentScript.src);
  const REPO = "https://github.com/quincarter/marvel-champions-digital-game";
  const SHORT_DATE = { month: "short", day: "numeric", timeZone: "UTC" };
  const LONG_DATE = { ...SHORT_DATE, year: "numeric" };
  const MONTH = { month: "long", year: "numeric", timeZone: "UTC" };

  const $ = (id) => document.getElementById(id);
  const main = $("content");
  const rail = $("rail");
  const list = $("list");
  const openButton = $("bar-open");
  const closeButton = $("rail-close");
  const narrow = matchMedia("(max-width: 900px)");

  /** Newest first. */
  let manifest = [];
  /** The release on the page, and the shadow root of its report if it has one. */
  let current = null;
  let reportRoot = null;
  let routeId = 0;
  const notes = new Map();
  const reports = new Map();

  const when = (date, format) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", format);
  const escape = (text) =>
    String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fetchOk = async (url, read) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return read(response);
  };

  function drawList() {
    let month = "";
    list.innerHTML = manifest
      .map(({ version, date, title, report }) => {
        const next = when(date, MONTH);
        const heading = next === month ? "" : `<h2>${next}</h2>`;
        month = next;
        return `${heading}<a href="#${version}" data-version="${version}"${report ? ' class="full"' : ""}>
          <span class="v">${version}</span><small>${when(date, SHORT_DATE)}</small><b>${escape(title)}</b></a>`;
      })
      .join("");
    const oldest = manifest.at(-1);
    $("rail-count").textContent = `${manifest.length} releases since ${when(oldest.date, LONG_DATE)}`;
  }

  /** A report's styles, made to work inside a shadow root and to answer to its own width rather than the window's. */
  function reportStyles(css) {
    return `
      :host { display: block; container: report / inline-size; }
      a:focus { outline: 3px solid var(--gold); outline-offset: 2px; }
      ${css
        .replace(/@font-face\s*\{[^}]*\}/g, "")
        .replace(/(^|\})\s*html\s*\{[^}]*\}/g, "$1")
        .replace(/(^|[}\s])body(\s*\{)/g, "$1:host$2")
        .replace(/:root/g, ":host")
        .replace(/@media\s*\(((?:max|min)-width:[^)]+)\)/g, "@container report ($1)")
        .replace(/(\d)vw\b/g, "$1cqw")}`;
  }

  async function loadReport(version) {
    if (reports.has(version)) return reports.get(version);
    const url = new URL(`${version}/index.html`, BASE);
    const page = new DOMParser().parseFromString(await fetchOk(url, (r) => r.text()), "text/html");
    page.querySelectorAll("[data-history-link]").forEach((link) => link.remove());
    for (const el of page.querySelectorAll("[src]")) el.src = new URL(el.getAttribute("src"), url).href;
    for (const el of page.querySelectorAll("[href]")) el.href = new URL(el.getAttribute("href"), url).href;
    const report = {
      css: reportStyles([...page.querySelectorAll("style")].map((s) => s.textContent).join("\n")),
      html: page.body.innerHTML,
    };
    reports.set(version, report);
    return report;
  }

  async function loadNotes(version) {
    if (!notes.has(version))
      notes.set(version, await fetchOk(new URL(`history/${version}.json`, BASE), (r) => r.json()));
    return notes.get(version);
  }

  function pageHtml(release) {
    const { version, date, title, summaryHtml, counts, images, sections } = release;
    const tiles = counts
      .map(({ kind, count }) => `<div class="tile ${escape(kind)}"><h4>${escape(kind)}</h4><div>${count}</div></div>`)
      .join("");
    const shots = images
      .map(
        ({ src, alt }) =>
          `<a href="${escape(src)}"><img src="${escape(src)}" alt="${escape(alt)}" loading="lazy" /></a>`,
      )
      .join("");
    const body = sections
      .map(
        ({ kind, open, itemsHtml }) => `<details${open ? " open" : ""}>
          <summary>${escape(kind)}<span>${itemsHtml.length}</span></summary>
          <ul>${itemsHtml.map((item) => `<li>${item}</li>`).join("")}</ul></details>`,
      )
      .join("");
    return `<article class="page">
      <header>
        <span class="tag">${version}</span>
        <h2 class="title">${escape(title)}</h2>
        <div class="kick" style="margin-top: 12px">${when(date, LONG_DATE)}</div>
        <p class="lede">${summaryHtml}</p>
      </header>
      <div class="tiles">${tiles}</div>
      ${shots ? `<div class="shots">${shots}</div>` : ""}
      ${body}
    </article>`;
  }

  function pagerHtml(index) {
    const link = (entry, cls, label) =>
      entry
        ? `<a class="${cls}" href="#${entry.version}"><small>${label} · ${entry.version}</small><b>${escape(entry.title)}</b></a>`
        : "";
    return `<nav class="pager" aria-label="Newer and older releases">
      ${link(manifest[index - 1], "newer", "‹ Newer")}${link(manifest[index + 1], "older", "Older ›")}</nav>`;
  }

  function stripHtml({ version, date, report }, release) {
    const link = report
      ? `<a href="${version}/index.html">Open on its own page ↗</a>`
      : `<a href="${escape(release.linkUrl)}">${escape(release.linkLabel)}</a>`;
    return `<div class="strip"><span>${version} · ${when(date, LONG_DATE)}</span><span>${link}</span></div>`;
  }

  function markCurrent(entry, index) {
    for (const link of list.querySelectorAll("a")) {
      if (link.dataset.version === entry.version) {
        link.setAttribute("aria-current", "page");
        // Only the list moves: `scrollIntoView` would drag the page along with it.
        const top = link.offsetTop - list.offsetTop;
        if (top < list.scrollTop || top + link.offsetHeight > list.scrollTop + list.clientHeight)
          list.scrollTop = top - list.clientHeight / 2;
      } else link.removeAttribute("aria-current");
    }
    $("bar-version").textContent = `${entry.version} · ${when(entry.date, SHORT_DATE)}`;
    $("bar-title").textContent = `${entry.title} ▾`;
    const step = (link, neighbor) => {
      link.href = neighbor ? `#${neighbor.version}` : "#";
      link.setAttribute("aria-disabled", String(!neighbor));
      if (neighbor) link.removeAttribute("tabindex");
      else link.tabIndex = -1;
    };
    step($("bar-newer"), manifest[index - 1]);
    step($("bar-older"), manifest[index + 1]);
    document.title = `${entry.version} · Release history · Marvel Champions: Digital Edition`;
  }

  function showFailure(entry) {
    main.innerHTML = `<p class="state">This release didn't load.
      <a href="${REPO}/releases/tag/${entry.version}">Read it on GitHub ↗</a></p>`;
  }

  async function route() {
    const hash = location.hash.slice(1);
    // Any other hash is the skip link's, which the browser handles.
    if (hash && !/^v\d/.test(hash)) return;
    const index = Math.max(
      0,
      manifest.findIndex((entry) => entry.version === hash),
    );
    const entry = manifest[index];
    setSheet(false);
    if (current === entry.version) return;
    current = entry.version;
    const id = ++routeId;
    markCurrent(entry, index);
    reportRoot = null;
    try {
      if (entry.report) {
        const report = await loadReport(entry.version);
        if (id !== routeId) return;
        main.innerHTML = `${stripHtml(entry)}<div id="report"></div>${pagerHtml(index)}`;
        reportRoot = main.querySelector("#report").attachShadow({ mode: "open" });
        reportRoot.innerHTML = `<style>${report.css}</style>${report.html}`;
      } else {
        const release = await loadNotes(entry.version);
        if (id !== routeId) return;
        main.innerHTML = `${stripHtml(entry, release)}${pageHtml(release)}${pagerHtml(index)}`;
      }
    } catch {
      if (id === routeId) showFailure(entry);
      return;
    }
    window.scrollTo(0, 0);
  }

  function setSheet(open) {
    const wasOpen = rail.classList.contains("open");
    rail.classList.toggle("open", open);
    openButton.setAttribute("aria-expanded", String(open));
    if (open && !wasOpen) (list.querySelector('[aria-current="page"]') ?? closeButton).focus();
    else if (!open && wasOpen) openButton.focus();
  }

  openButton.addEventListener("click", () => setSheet(true));
  closeButton.addEventListener("click", () => setSheet(false));
  addEventListener("hashchange", route);
  addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSheet(false);
    const inList = event.target.closest?.(".list");
    if (inList && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      step(event.key === "ArrowDown" ? 1 : -1);
    }
  });

  /* The controller. The page runs outside the game, so this is its own small version of the game's input: buttons by
     standard-layout position, and the same family detection as `view/pad-family.ts`. */

  const FAMILY_GLYPHS = {
    xbox: { confirm: "A", back: "B", list: "Y", left: "LB", right: "RB" },
    playstation: { confirm: "✕", back: "○", list: "△", left: "L1", right: "R1" },
    nintendo: { confirm: "A", back: "B", list: "X", left: "L", right: "R" },
  };
  const DPAD_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>`;
  const REPEAT_DELAY = 350;
  const REPEAT_EVERY = 110;
  const DEADZONE = 0.3;
  const SCROLL_PER_FRAME = 22;
  const [A, B, X, Y, LB, RB] = [0, 1, 2, 3, 4, 5];
  const [UP, DOWN, LEFT, RIGHT] = [12, 13, 14, 15];

  /** What `Gamepad.id` says this pad is; the same answers as `detectPad` in `view/pad-family.ts`. */
  function familyOf(id) {
    const name = id.toLowerCase();
    if (/steam|28de/.test(name)) return "xbox";
    if (/054c|dualsense|dualshock|playstation/.test(name)) return "playstation";
    if (/057e|pro controller|joy-con|nintendo/.test(name)) return "nintendo";
    return "xbox";
  }

  let family = null;
  /** Per button: when it went down, and when it last repeated. */
  const held = new Map();

  function drawHints() {
    const glyphs = FAMILY_GLYPHS[family];
    const sheetOpen = rail.classList.contains("open");
    const hint = (glyph, label) => `<span class="hint">${glyph}${label}</span>`;
    const face = (text) => `<span class="glyph">${text}</span>`;
    const shoulder = (text) => `<span class="glyph shoulder">${text}</span>`;
    $("hints").innerHTML = [
      hint(`<span class="glyph dpad">${DPAD_SVG}</span>`, "Move"),
      hint(face(glyphs.confirm), "Open"),
      hint(`${shoulder(glyphs.left)}${shoulder(glyphs.right)}`, "Newer / older"),
      hint(`<span class="glyph stick">R</span>`, "Scroll"),
      narrow.matches && !sheetOpen ? hint(face(glyphs.list), "List") : "",
      narrow.matches && sheetOpen ? hint(face(glyphs.back), "Close") : "",
    ].join("");
  }

  const visible = (el) => el.getClientRects().length > 0;
  const focusedEl = () => reportRoot?.activeElement ?? document.activeElement;

  /** The two columns a controller moves between: the releases (or the bar) and whatever is on the page. */
  function railStops() {
    if (narrow.matches && !rail.classList.contains("open")) {
      return [$("bar-newer"), openButton, $("bar-older")].filter((el) => el.getAttribute("aria-disabled") !== "true");
    }
    return [...rail.querySelectorAll("a, button")].filter(visible);
  }
  function mainStops() {
    const inMain = [...main.querySelectorAll("a[href], summary")].filter(visible);
    const inReport = reportRoot ? [...reportRoot.querySelectorAll("a[href]")].filter(visible) : [];
    return [...inReport, ...inMain];
  }
  function inMain(el) {
    return !!el && (el.getRootNode() === reportRoot || main.contains(el));
  }

  function focusStop(el) {
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center" });
  }

  function step(delta) {
    const active = focusedEl();
    const column = inMain(active) ? mainStops() : railStops();
    const at = column.indexOf(active);
    const next = column[at === -1 ? 0 : at + delta];
    if (next) focusStop(next);
    // Past the last link there may still be page to read.
    else if (inMain(active)) window.scrollBy({ top: delta * innerHeight * 0.7 });
  }

  function intoMain() {
    const stops = mainStops();
    const first = stops.find((el) => el.getBoundingClientRect().top >= 0) ?? stops[0];
    if (first) focusStop(first);
  }

  function intoRail() {
    const stops = railStops();
    const here = stops.find((el) => el.getAttribute("aria-current") === "page");
    (here ?? stops[0])?.focus();
  }

  function goBy(delta) {
    const at = manifest.findIndex((entry) => entry.version === current);
    const entry = manifest[at + delta];
    if (entry) location.hash = entry.version;
  }

  function confirm() {
    const active = focusedEl();
    if (active && active !== document.body && active !== main) active.click();
    else intoRail();
  }

  function back() {
    if (rail.classList.contains("open")) setSheet(false);
    else if (inMain(focusedEl())) intoRail();
  }

  function press(button) {
    // With the game's default Use Nintendo Switch layout, a Nintendo pad's buttons act by their printed label.
    const [yes, no] = family === "nintendo" ? [B, A] : [A, B];
    if (button === yes) confirm();
    else if (button === no) back();
    else if (button === Y && narrow.matches) setSheet(true);
    else if (button === UP) step(-1);
    else if (button === DOWN) step(1);
    else if (button === RIGHT) intoMain();
    else if (button === LEFT) intoRail();
    else if (button === LB) goBy(-1);
    else if (button === RB) goBy(1);
  }

  const REPEATS = new Set([UP, DOWN]);

  function poll(now) {
    requestAnimationFrame(poll);
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!pad) return;
    let used = false;
    for (const button of [A, B, X, Y, LB, RB, UP, DOWN, LEFT, RIGHT]) {
      const down = pad.buttons[button]?.pressed;
      const seen = held.get(button);
      if (!down) held.delete(button);
      else if (!seen) {
        held.set(button, { since: now, last: now });
        used = true;
        wake(pad);
        press(button);
      } else if (REPEATS.has(button) && now - seen.since > REPEAT_DELAY && now - seen.last > REPEAT_EVERY) {
        seen.last = now;
        press(button);
      }
    }
    const scroll = [pad.axes[3] ?? 0, pad.axes[1] ?? 0].find((axis) => Math.abs(axis) > DEADZONE);
    if (scroll) {
      wake(pad);
      window.scrollBy({ top: scroll * SCROLL_PER_FRAME, behavior: "instant" });
      used = true;
    }
    if (used) drawHints();
  }

  function wake(pad) {
    family = familyOf(pad.id);
    document.documentElement.classList.add("pad");
  }

  /** The mouse or a finger takes over from the controller, and its hints leave. */
  addEventListener("pointerdown", () => document.documentElement.classList.remove("pad"));

  fetchOk(new URL("history/manifest.json", BASE), (r) => r.json())
    .then((entries) => {
      manifest = entries;
      drawList();
      if (navigator.getGamepads) requestAnimationFrame(poll);
      return route();
    })
    .catch(() => {
      main.innerHTML = `<p class="state">The release list didn't load.
        <a href="${REPO}/releases">Every release is on GitHub ↗</a></p>`;
    });
})();
