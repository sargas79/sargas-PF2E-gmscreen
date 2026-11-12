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
 */

const COMPACT = "gms-header-compact";
const WRAP = "gms-header-wrap";
const LABEL = "gms-header-label";

/** Below this width a truncated title counts as crowded out, in px. */
const MIN_TITLE_WIDTH = 120;

/**
 * Headers being watched, with their application and the observer for DOM changes.
 * @type {WeakMap<HTMLElement, {app: object, observer: MutationObserver}>}
 */
const watched = new WeakMap();

/** Last width fitted per header, so the resize observer ignores height-only changes. */
const fittedWidths = new WeakMap();

/** Headers waiting for the next animation frame. */
const pending = new Set();

const resizeObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    if (fittedWidths.get(target) !== target.clientWidth) schedule(target);
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

function isCrowded(header) {
  if (header.scrollWidth > header.clientWidth + 1) return true;
  const title = header.querySelector(":scope > .window-title");
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

function fit(header) {
  // A window that is minimized, or on its way there or back, isn't at its real size. Keep the
  // layout it had: it returns to the same width, and is fitted again once it's restored.
  if (watched.get(header)?.app._minimized !== false) return;

  // Measure from the natural layout each time, so a header that has room again gets its labels back.
  header.classList.remove(COMPACT, WRAP);
  const compact = isCrowded(header);
  if (compact) {
    wrapLabels(header);
    header.classList.add(COMPACT);
    if (isCrowded(header)) header.classList.add(WRAP);
  }
  setTooltips(header, compact);
  fittedWidths.set(header, header.clientWidth);
}

function headerOf(app) {
  if (!app.popOut) return null;
  const element = app.element?.[0];
  return element?.querySelector(":scope > .window-header") ?? null;
}

function watch(app) {
  if (!getSetting(SETTINGS.compactHeaders)) return;
  const header = headerOf(app);
  if (!header) return;
  if (!watched.has(header)) {
    const observer = new MutationObserver(() => schedule(header));
    // Modules add their buttons at any point after the window renders.
    observer.observe(header, { childList: true });
    // The window drops its "minimized" class once it's fully restored.
    observer.observe(header.parentElement, { attributes: true, attributeFilter: ["class"] });
    watched.set(header, { app, observer });
    resizeObserver.observe(header);
  }
  fit(header);
}

function unwatch(app) {
  const header = headerOf(app);
  if (!header) return;
  watched.get(header)?.observer.disconnect();
  watched.delete(header);
  resizeObserver.unobserve(header);
  pending.delete(header);
}

export function registerWindowHeaders() {
  // These fire for every V1 application, whatever its class.
  Hooks.on("renderApplication", watch);
  Hooks.on("closeApplication", unwatch);
}
