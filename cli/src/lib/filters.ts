export interface FilterValue {
  value: string;
  modifier?: string;
}

const KNOWN_KEYS = new Set(["status", "category", "priority", "sort", "limit"]);
const DATE_KEYS = new Set(["due", "created", "updated"]);
const FILTER_PATTERN = /^([a-z]+)(?:\.([a-z]+))?:(.+)$/;

export function parseFilters(args: string[]): Record<string, FilterValue> {
  const filters: Record<string, FilterValue> = {};

  for (const arg of args) {
    const match = arg.match(FILTER_PATTERN);
    if (!match) continue;

    const [, key, modifier, value] = match;

    if (KNOWN_KEYS.has(key)) {
      filters[key] = { value };
      continue;
    }

    if (DATE_KEYS.has(key)) {
      const filterKey = modifier ? `${key}.${modifier}` : key;
      filters[filterKey] = { value, modifier };
    }
  }

  return filters;
}
