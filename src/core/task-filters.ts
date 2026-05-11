import type { TaskFilters, TaskStatus } from "./types";

type FilterParamValue = string | string[] | null | undefined;

export interface TaskFilterParams {
  status?: FilterParamValue;
  category?: FilterParamValue;
  date?: FilterParamValue;
  dueBefore?: FilterParamValue;
  dueAfter?: FilterParamValue;
  from?: FilterParamValue;
  to?: FilterParamValue;
  sortBy?: FilterParamValue;
  sortOrder?: FilterParamValue;
}

export interface TaskFilterDefaults {
  status?: TaskFilters["status"];
  sortBy?: TaskFilters["sortBy"];
  sortOrder?: TaskFilters["sortOrder"];
}

export interface ParseTaskFiltersOptions {
  defaults?: TaskFilterDefaults;
}

const SORT_FIELDS = new Set(["due", "createdAt", "order"]);
const SORT_ORDERS = new Set(["asc", "desc"]);

function firstValue(value: FilterParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value.find((item) => item !== "");
  }

  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return value;
}

function parseStatus(
  value: FilterParamValue,
): TaskFilters["status"] | undefined {
  if (Array.isArray(value)) {
    const statuses = value.flatMap((item) =>
      item.includes(",") ? item.split(",") : item,
    );

    if (statuses.length === 0) return undefined;
    return statuses.length === 1
      ? (statuses[0] as TaskStatus)
      : (statuses as TaskStatus[]);
  }

  const status = firstValue(value);
  if (!status) return undefined;

  return status.includes(",")
    ? (status.split(",") as TaskStatus[])
    : (status as TaskStatus);
}

function parseSortBy(
  value: FilterParamValue,
): TaskFilters["sortBy"] | undefined {
  const sortBy = firstValue(value);
  if (!sortBy || !SORT_FIELDS.has(sortBy)) return undefined;
  return sortBy as TaskFilters["sortBy"];
}

function parseSortOrder(
  value: FilterParamValue,
): TaskFilters["sortOrder"] | undefined {
  const sortOrder = firstValue(value);
  if (!sortOrder || !SORT_ORDERS.has(sortOrder)) return undefined;
  return sortOrder as TaskFilters["sortOrder"];
}

function applyDefaults(
  filters: TaskFilters,
  defaults: TaskFilterDefaults | undefined,
): void {
  if (!defaults) return;

  if (!filters.status && defaults.status) filters.status = defaults.status;
  if (!filters.sortBy && defaults.sortBy) filters.sortBy = defaults.sortBy;
  if (!filters.sortOrder && defaults.sortOrder) {
    filters.sortOrder = defaults.sortOrder;
  }
}

export function parseTaskFilters(
  params: TaskFilterParams,
  options: ParseTaskFiltersOptions = {},
): TaskFilters {
  const filters: TaskFilters = {};

  const category = firstValue(params.category);
  if (category) filters.category = category;

  const status = parseStatus(params.status);
  if (status) filters.status = status;

  const date = firstValue(params.date);
  if (date) {
    filters.dueAfter = `${date}T00:00:00.000Z`;
    filters.dueBefore = `${date}T23:59:59.999Z`;
  } else {
    const dueAfter = firstValue(params.dueAfter) ?? firstValue(params.from);
    if (dueAfter) filters.dueAfter = dueAfter;

    const dueBefore = firstValue(params.dueBefore) ?? firstValue(params.to);
    if (dueBefore) filters.dueBefore = dueBefore;
  }

  const sortBy = parseSortBy(params.sortBy);
  if (sortBy) filters.sortBy = sortBy;

  const sortOrder = parseSortOrder(params.sortOrder);
  if (sortOrder) filters.sortOrder = sortOrder;

  applyDefaults(filters, options.defaults);

  return filters;
}

export function taskFilterParamsFromSearchParams(
  searchParams: URLSearchParams,
): TaskFilterParams {
  return {
    category: searchParams.get("category"),
    status: searchParams.get("status"),
    dueBefore: searchParams.get("due_before"),
    dueAfter: searchParams.get("due_after"),
    sortBy: searchParams.get("sort_by"),
    sortOrder: searchParams.get("sort_order"),
  };
}
