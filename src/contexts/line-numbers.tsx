export function getLineNumber(index: number, cursorIndex: number): string {
  const cur = cursorIndex < 0 ? 0 : cursorIndex;
  if (index === cur) return String(index + 1);
  return String(Math.abs(index - cur));
}
