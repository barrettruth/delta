export interface FilterValue {
  value: string;
  modifier?: string;
}

const KNOWN_KEYS = new Set(["status", "category"]);
const DATE_MODIFIERS = new Set(["before", "after"]);
const SORT_FIELDS = new Set(["due", "createdAt", "order"]);
const FILTER_PATTERN = /^([a-z]+)(?:\.([a-z]+))?:(.+)$/;

export function parseFilters(args: string[]): Record<string, FilterValue> {
  const filters: Record<string, FilterValue> = {};

  for (const arg of args) {
    const match = arg.match(FILTER_PATTERN);
    if (!match) continue;

    const [, key, modifier, value] = match;

    if (KNOWN_KEYS.has(key) && !modifier) {
      filters[key] = { value };
      continue;
    }

    if (key === "due" && modifier && DATE_MODIFIERS.has(modifier)) {
      const filterKey = `${key}.${modifier}`;
      filters[filterKey] = { value, modifier };
      continue;
    }

    if (key === "sort" && !modifier && SORT_FIELDS.has(value)) {
      filters[key] = { value };
    }
  }

  return filters;
}
