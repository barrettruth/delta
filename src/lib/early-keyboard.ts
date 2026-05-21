export interface EarlyKeyboardEvent {
  key: string;
  capturedAt: number;
}

interface EarlyKeyboardBuffer {
  events: EarlyKeyboardEvent[];
  pendingGAt: number | null;
  stop: () => void;
}

declare global {
  interface Window {
    __deltaEarlyKeyboard?: EarlyKeyboardBuffer;
  }
}

const EARLY_KEYBOARD_MAX_AGE_MS = 5000;
const EARLY_KEYBOARD_LEADER_TIMEOUT_MS = 1200;

export function consumeEarlyKeyboardEvents(
  now = Date.now(),
  maxAgeMs = EARLY_KEYBOARD_MAX_AGE_MS,
): EarlyKeyboardEvent[] {
  if (typeof window === "undefined") return [];
  const buffer = window.__deltaEarlyKeyboard;
  if (!buffer) return [];

  const events = [...buffer.events];
  if (
    buffer.pendingGAt !== null &&
    now - buffer.pendingGAt <= EARLY_KEYBOARD_LEADER_TIMEOUT_MS
  ) {
    events.push({ key: "g", capturedAt: buffer.pendingGAt });
  }

  buffer.stop();
  delete window.__deltaEarlyKeyboard;

  return events.filter((event) => now - event.capturedAt <= maxAgeMs);
}

export const EARLY_KEYBOARD_BUFFER_SCRIPT = `
(function () {
  if (window.__deltaEarlyKeyboard) return;

  var leaderTimeoutMs = ${EARLY_KEYBOARD_LEADER_TIMEOUT_MS};
  var maxEvents = 8;
  var leaderTimer = null;
  var buffer = {
    events: [],
    pendingGAt: null,
    stop: stop
  };

  function isEditable(element) {
    if (!element) return false;
    var tag = element.tagName;
    return tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      element.isContentEditable === true;
  }

  function hasModifier(event) {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  }

  function isLeaderTarget(key) {
    return key === "c" || key === "." || key === "?" || /^[1-9]$/.test(key);
  }

  function push(key, capturedAt) {
    buffer.events.push({ key: key, capturedAt: capturedAt });
    if (buffer.events.length > maxEvents) buffer.events.shift();
  }

  function clearLeader() {
    buffer.pendingGAt = null;
    if (leaderTimer !== null) {
      clearTimeout(leaderTimer);
      leaderTimer = null;
    }
  }

  function startLeader() {
    clearLeader();
    buffer.pendingGAt = Date.now();
    leaderTimer = setTimeout(clearLeader, leaderTimeoutMs);
  }

  function shouldIgnore(event) {
    return event.defaultPrevented ||
      hasModifier(event) ||
      isEditable(document.activeElement) ||
      document.querySelector("[role=dialog]") !== null;
  }

  function onKeyDown(event) {
    if (shouldIgnore(event)) return;

    if (buffer.pendingGAt !== null) {
      var startedAt = buffer.pendingGAt;
      var capturedAt = Date.now();
      clearLeader();

      if (
        capturedAt - startedAt <= leaderTimeoutMs &&
        isLeaderTarget(event.key)
      ) {
        push("g", startedAt);
        push(event.key, capturedAt);
        event.preventDefault();
      }
      return;
    }

    if (event.key === "g") startLeader();
  }

  function stop() {
    clearLeader();
    window.removeEventListener("keydown", onKeyDown, true);
  }

  window.__deltaEarlyKeyboard = buffer;
  window.addEventListener("keydown", onKeyDown, true);
})();
`;
