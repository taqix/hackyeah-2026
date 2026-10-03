const { execFileSync } = require('node:child_process');
const { mkdtempSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const appDirectory = path.resolve(__dirname, '..');
const output = mkdtempSync(path.join(tmpdir(), 'hackyeah-calendar-tests-'));

try {
  execFileSync(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '-p', path.join(appDirectory, 'tests/tsconfig.json'),
    '--outDir', output,
  ], { cwd: appDirectory, stdio: 'inherit' });
  const tests = readdirSync(path.join(output, 'tests'))
    .filter((file) => file.endsWith('.test.js'))
    .map((file) => path.join(output, 'tests', file));
  // Exercise both sides of UTC, including daylight saving transitions.
  for (const timeZone of ['Europe/Warsaw', 'America/Los_Angeles']) {
    console.log(`Calendar tests: ${timeZone}`);
    execFileSync(process.execPath, ['--test', ...tests], {
      env: { ...process.env, TZ: timeZone },
      stdio: 'inherit',
    });
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
