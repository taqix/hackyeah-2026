import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = new URL("../.test-dist/", import.meta.url);

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: backendDirectory,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Nest decorators require TypeScript's metadata emit, which tsx does not provide.
await rm(outputDirectory, { recursive: true, force: true });
run([require.resolve("typescript/bin/tsc"), "-p", "tsconfig.test.json"]);
await mkdir(new URL("test/", outputDirectory), { recursive: true });
await cp(
  new URL("../test/fixtures/", import.meta.url),
  new URL("test/fixtures/", outputDirectory),
  {
    recursive: true,
  },
);
await cp(
  new URL("../src/ai/prompts/", import.meta.url),
  new URL("src/ai/prompts/", outputDirectory),
  {
    recursive: true,
  },
);
const tests = (await readdir(new URL("test/", outputDirectory)))
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => fileURLToPath(new URL(`test/${name}`, outputDirectory)));
if (tests.length === 0)
  throw new Error("No compiled backend tests were found.");
run(["--test", ...tests]);
