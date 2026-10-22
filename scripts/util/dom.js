/**
 * True the first time it's called for an element. A partial render leaves the other parts' DOM
 * in place, so `onRender` hooks use this to avoid stacking duplicate listeners on it.
 */
export function bindOnce(element) {
  if (element.dataset.gmsBound) return false;
  element.dataset.gmsBound = "true";
  return true;
}
