import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const targets = [
  { target: "bun-linux-x64", output: "delta-linux-x64" },
  { target: "bun-linux-arm64", output: "delta-linux-arm64" },
  { target: "bun-darwin-x64", output: "delta-darwin-x64" },
  { target: "bun-darwin-arm64", output: "delta-darwin-arm64" },
];

const distDir = join(import.meta.dirname, "dist");

function clean() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function build(
  target: string,
  output: string,
): Promise<{ ok: boolean; name: string }> {
  const outfile = join(distDir, output);
  const proc = Bun.spawn(
    [
      "bun",
      "build",
      join(import.meta.dirname, "src", "index.ts"),
      "--compile",
      "--target",
      target,
      "--outfile",
      outfile,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const code = await proc.exited;
  return { ok: code === 0, name: output };
}

function printSizes() {
  const entries = readdirSync(distDir);
  const maxName = Math.max(...entries.map((e) => e.length));
  for (const entry of entries.sort()) {
    const size = statSync(join(distDir, entry)).size;
    console.log(`  ${entry.padEnd(maxName)}  ${formatSize(size)}`);
  }
}

async function main() {
  const requested = process.argv[2];
  const selected = requested
    ? targets.filter((t) => t.target === requested || t.output === requested)
    : targets;

  if (selected.length === 0) {
    console.error(`Unknown target: ${requested}`);
    console.error(`Available: ${targets.map((t) => t.target).join(", ")}`);
    process.exit(1);
  }

  clean();

  console.log(`Building ${selected.length} target(s)...\n`);

  const results = [];
  for (const { target, output } of selected) {
    console.log(`-> ${target}`);
    results.push(await build(target, output));
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\nFailed: ${failed.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }

  console.log("\nBuild artifacts:");
  printSizes();
}

main();
