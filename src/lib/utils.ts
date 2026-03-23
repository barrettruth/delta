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
