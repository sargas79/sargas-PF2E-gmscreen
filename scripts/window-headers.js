import { SETTINGS, getSetting } from "./settings.js";

/**
 * Keeps crowded window headers usable.
 *
 * PF2e actor and item sheets are V1 applications, whose header is one fixed-height row that
 * clips whatever doesn't fit. Every module that adds a header button pushes the last ones,
 * Close included, out of view. When a header runs out of room we first shrink its buttons to
 * icons (the label moves to a tooltip), and let it wrap onto a second row if that isn't enough.
 *
 * V2 applications are left alone: their extra controls already collapse into a menu.
 *
 * Windows are found by watching the page, not through render hooks. An actor or item sheet
 * only fires hooks up to `renderActorSheet` / `renderItemSheet`, never `renderApplication`,
 * and any other V1 class can cut its hook chain short the same way.
 */

const COMPACT = "gms-header-compact";
const WRAP = "gms-header-wrap";
const LABEL = "gms-header-label";

/** Below this width a truncated title counts as crowded out, in px. */
const MIN_TITLE_WIDTH = 120;

/**
 * The observer for DOM changes in each watched header.
 * @type {WeakMap<HTMLElement, MutationObserver>}
 */
const watched = new WeakMap();

/**
 * Width of each header and title when last fitted, so the resize observer ignores
 * height-only changes and the changes a fit makes itself.
 */
const fittedWidths = new WeakMap();

/** Headers waiting for the next animation frame. */
const pending = new Set();

const resizeObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    if (fittedWidths.get(target) === target.clientWidth) continue;
    const header = target.closest(".window-header");
    if (header) schedule(header);
  }
});

/**
 * Fit on the next frame. Batches bursts of changes, and keeps layout changes out of the
 * resize observer's own callback.
 */
function schedule(header) {
  if (!pending.size) {
    requestAnimationFrame(() => {
      const headers = [...pending];
      pending.clear();
      for (const h of headers) if (h.isConnected) fit(h);
    });
  }
  pending.add(header);
}

function titleOf(header) {
  return header.querySelector(":scope > .window-title");
}

function isCrowded(header) {
  if (header.scrollWidth > header.clientWidth + 1) return true;
  const title = titleOf(header);
  if (!title) return false;
  return title.scrollWidth > title.clientWidth + 1 && title.clientWidth < MIN_TITLE_WIDTH;
}

/** Wrap the bare text of each icon button in a span, so CSS can hide it. */
function wrapLabels(header) {
  for (const button of header.querySelectorAll(":scope > :not(.window-title)")) {
    // A button with no icon would vanish without its text.
    if (!button.querySelector("i, svg, img")) continue;
    for (const node of [...button.childNodes]) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const span = header.ownerDocument.createElement("span");
      span.className = LABEL;
      node.replaceWith(span);
      span.append(node);
    }
  }
}

/** Show each hidden label as a tooltip, or take those tooltips away again. */
function setTooltips(header, compact) {
  for (const label of header.querySelectorAll(`:scope > * > .${LABEL}`)) {
    const button = label.parentElement;
    if (compact) {
      const text = button.textContent.trim();
      if (!text || button.dataset.tooltip || button.hasAttribute("aria-label")) continue;
      button.dataset.tooltip = text;
      button.setAttribute("aria-label", text);
      button.dataset.gmsTooltip = "true";
    } else if (button.dataset.gmsTooltip) {
      delete button.dataset.tooltip;
      delete button.dataset.gmsTooltip;
      button.removeAttribute("aria-label");
    }
  }
}

/** False while a window is minimized, or on its way there or back. */
function isSettled(win) {
  const app = ui.windows?.[win.dataset.appid];
  return app ? app._minimized === false : !win.classList.contains("minimized");
}

function fit(header) {
  const observer = watched.get(header);
  // A minimized window isn't at its real size. Keep the layout it had: it returns to the same
  // width, and is fitted again once it's restored.
  if (!observer || !isSettled(header.parentElement)) return;

  // Measure from the natural layout each time, so a header that has room again gets its labels back.
  header.classList.remove(COMPACT, WRAP);
  const compact = isCrowded(header);
  if (compact) {
    wrapLabels(header);
    header.classList.add(COMPACT);
    if (isCrowded(header)) header.classList.add(WRAP);
  }
  setTooltips(header, compact);

  const title = titleOf(header);
  fittedWidths.set(header, header.clientWidth);
  if (title) fittedWidths.set(title, title.clientWidth);
  // Don't answer the changes just made here with another fit.
  observer.takeRecords();
}

/** The header of a V1 window element, or null for anything else. */
function headerOf(node) {
  if (node.nodeType !== Node.ELEMENT_NODE || !node.classList.contains("window-app")) return null;
  return node.querySelector(":scope > .window-header");
}

function watch(win) {
  const header = headerOf(win);
  if (!header || watched.has(header) || !getSetting(SETTINGS.compactHeaders)) return;

  const observer = new MutationObserver(() => schedule(header));
  // Modules add buttons at any point after the window renders, and a re-render can change the title.
  observer.observe(header, { childList: true, subtree: true, characterData: true });
  // The window drops its "minimized" class once it's fully restored.
  observer.observe(win, { attributes: true, attributeFilter: ["class"] });
  watched.set(header, observer);

  // The title takes the room the buttons leave, so its width changes whenever theirs does.
  resizeObserver.observe(header);
  const title = titleOf(header);
  if (title) resizeObserver.observe(title);

  fit(header);
}

function unwatch(win) {
  const header = headerOf(win);
  const observer = header && watched.get(header);
  if (!observer) return;
  observer.disconnect();
  watched.delete(header);
  resizeObserver.unobserve(header);
  const title = titleOf(header);
  if (title) resizeObserver.unobserve(title);
  pending.delete(header);
}

export function registerWindowHeaders() {
  // V1 windows are added to the page body when they open, and removed when they close.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes) unwatch(node);
      for (const node of record.addedNodes) watch(node);
    }
  });
  observer.observe(document.body, { childList: true });
  for (const win of document.body.children) watch(win);
}
