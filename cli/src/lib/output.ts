import pc from "picocolors";

let colorEnabled = true;
let jsonMode = false;
let quietMode = false;
let jsonFields: string[] | undefined;
let jqExpression: string | undefined;

export function configure(opts: {
  color?: boolean;
  json?: boolean | string;
  quiet?: boolean;
  jq?: string;
}): void {
  if (opts.color === false || process.env.NO_COLOR !== undefined) {
    colorEnabled = false;
    pc.createColors(false);
  }

  if (opts.json !== undefined && opts.json !== false) {
    jsonMode = true;
    if (typeof opts.json === "string") {
      jsonFields = opts.json.split(",").map((f) => f.trim());
    }
  }

  if (opts.jq) {
    jsonMode = true;
    jqExpression = opts.jq;
  }

  if (opts.quiet) {
    quietMode = true;
  }
}

export function isColor(): boolean {
  return colorEnabled;
}

export function formatTable(
  rows: Record<string, unknown>[],
  columns: string[],
): string {
  if (rows.length === 0) return "";

  const widths = columns.map((col) =>
    Math.max(...rows.map((row) => String(row[col] ?? "").length)),
  );

  return rows
    .map((row) =>
      columns
        .map((col, i) => {
          const val = String(row[col] ?? "");
          return val.padEnd(widths[i]);
        })
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

export function formatJson(
  data: unknown,
  fields?: string[],
  jqExpr?: string,
): string {
  let output = data;

  if (fields && Array.isArray(output)) {
    output = (output as Record<string, unknown>[]).map((item) => {
      const filtered: Record<string, unknown> = {};
      for (const field of fields) {
        if (field in (item as Record<string, unknown>)) {
          filtered[field] = (item as Record<string, unknown>)[field];
        }
      }
      return filtered;
    });
  }

  if (jqExpr) {
    process.stderr.write("--jq filtering requires the jq binary in PATH\n");
  }

  return JSON.stringify(output, null, 2);
}

export function formatQuiet(ids: (string | number)[]): string {
  return ids.join("\n");
}

export interface PrintOptions {
  columns?: string[];
  idField?: string;
}

export function print(data: unknown, opts?: PrintOptions): void {
  if (quietMode) {
    if (Array.isArray(data)) {
      const field = opts?.idField ?? "id";
      const ids = (data as Record<string, unknown>[]).map(
        (item) => item[field] as string | number,
      );
      process.stdout.write(`${formatQuiet(ids)}\n`);
    }
    return;
  }

  if (jsonMode) {
    process.stdout.write(`${formatJson(data, jsonFields, jqExpression)}\n`);
    return;
  }

  if (Array.isArray(data) && opts?.columns) {
    const output = formatTable(data as Record<string, unknown>[], opts.columns);
    if (output) {
      process.stdout.write(`${output}\n`);
    }
    return;
  }

  if (typeof data === "string") {
    process.stdout.write(`${data}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
