import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function blendColors(hexColors: string[]): string | null {
  if (hexColors.length === 0) return null;
  if (hexColors.length === 1) return hexColors[0];
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (const hex of hexColors) {
    const [r, g, b] = hexToRgb(hex);
    rSum += r * r;
    gSum += g * g;
    bSum += b * b;
  }
  const n = hexColors.length;
  return rgbToHex(
    Math.sqrt(rSum / n),
    Math.sqrt(gSum / n),
    Math.sqrt(bSum / n),
  );
}

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

const MEETING_PATTERNS = [
  { name: "Zoom", pattern: /https?:\/\/[\w.-]*zoom\.us\/(j|my)\/[\w.-]+/i },
  { name: "Meet", pattern: /https?:\/\/meet\.google\.com\/[\w-]+/i },
  {
    name: "Teams",
    pattern: /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[\w%.-]+/i,
  },
  {
    name: "Webex",
    pattern: /https?:\/\/[\w.-]*\.webex\.com\/(meet|join)\/[\w.-]+/i,
  },
];

export function detectMeetingPlatform(url: string): string | null {
  for (const { name, pattern } of MEETING_PATTERNS) {
    if (pattern.test(url)) return name;
  }
  return null;
}

export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return `!${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "tdy";
  if (diffDays === 1) return "tmr";
  if (diffDays <= 7) return `${diffDays}d`;
  if (diffDays <= 28) return `${Math.ceil(diffDays / 7)}w`;
  if (diffDays <= 365) return `${Math.ceil(diffDays / 30)}mo`;
  return `${Math.ceil(diffDays / 365)}y`;
}

export function isOverdue(due: string): boolean {
  return new Date(due) < new Date(new Date().toDateString());
}

const BROWSER_CTRL_KEYS = new Set([
  "-",
  "=",
  "+",
  "0",
  "t",
  "w",
  "n",
  "l",
  "r",
  "f",
  "p",
  "Tab",
]);

const BROWSER_CTRL_SHIFT_KEYS = new Set(["I", "R", "Tab", "J", "T", "N"]);

export function isBrowserShortcut(e: KeyboardEvent): boolean {
  if (e.altKey && ["ArrowLeft", "ArrowRight"].includes(e.key)) return true;
  if (e.key === "F5" || e.key === "F11" || e.key === "F12") return true;
  if (!e.ctrlKey && !e.metaKey) return false;
  if (e.shiftKey && BROWSER_CTRL_SHIFT_KEYS.has(e.key)) return true;
  return BROWSER_CTRL_KEYS.has(e.key);
}
