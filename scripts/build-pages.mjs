/**
 * Builds the GitHub Pages site into dist/pages:
 *
 *   index.html, assets/  the landing page (apps/website)
 *   phone/               a phone-sized preview of that same app
 *   app/                 the Expo web app (apps/mobile), exported for <base>/app
 *   404.html             the app's page again: Pages serves it for any path without a file,
 *                        so app deep links and reloads (app/session/<id>) start the app
 *   .nojekyll
 *
 * PAGES_BASE_PATH is the site's path on its host (default /hackyeah-2026). The app's
 * Supabase values come from the environment or apps/mobile/.env; EXPO_PUBLIC_API_MODE=mock
 * builds the offline demo instead.
 */
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobileDir = join(root, 'apps/mobile');
const websiteDist = join(root, 'apps/website/dist');
const appDist = join(mobileDir, 'dist');
const out = join(root, 'dist/pages');

const sitePath = (process.env.PAGES_BASE_PATH ?? '/hackyeah-2026').replace(/^\/+|\/+$/g, '');
const base = sitePath ? `/${sitePath}` : '';
const appBase = `${base}/app`;

function run(command, args, options) {
  console.log(`\n> ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.signal}`);
}

/** The .env reader `expo export` itself uses, so the check sees what the bundle will inline. */
function expoEnvFiles() {
  const fromExpo = createRequire(createRequire(join(mobileDir, 'package.json')).resolve('expo/package.json'));
  const { parseProjectEnv } = createRequire(fromExpo.resolve('@expo/cli/package.json'))('@expo/env');
  return parseProjectEnv(mobileDir, { mode: 'production', silent: true }).env;
}

/** sb_secret_ keys and legacy service_role JWTs bypass RLS; every EXPO_PUBLIC_ value ships in the bundle. */
function isSecretKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()).role === 'service_role';
  } catch {
    return false;
  }
}

/** Fails before building a site that would open on the setup screen or ship a secret. Never prints values. */
function checkBackendEnv() {
  const files = expoEnvFiles();
  const value = (name) => (process.env[name] ?? files[name] ?? '').trim();
  const mode = value('EXPO_PUBLIC_API_MODE').toLowerCase() || 'supabase';
  if (mode !== 'supabase' && mode !== 'mock') throw new Error('EXPO_PUBLIC_API_MODE must be supabase or mock');
  console.log(`App backend: ${mode}`);
  if (mode === 'mock') return;

  const problems = [];
  if (!/^https?:\/\/\S+$/i.test(value('EXPO_PUBLIC_SUPABASE_URL'))) problems.push('EXPO_PUBLIC_SUPABASE_URL is missing');
  const key = value('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!key) problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
  else if (isSecretKey(key)) problems.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a secret key; use the publishable one');
  if (problems.length > 0) {
    throw new Error(`${problems.join('; ')}. Set them in the environment or apps/mobile/.env.`);
  }
}

function exportApp() {
  // A fresh Metro cache: a production export inlines EXPO_PUBLIC_ values into each module it
  // transforms and Metro's cache key ignores them, so a cache warmed by another build (mock mode,
  // other keys) would leak its values. It also keeps running dev servers' cache untouched.
  const metroTmp = mkdtempSync(join(tmpdir(), 'movo-pages-'));
  try {
    run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'], {
      cwd: mobileDir,
      env: { ...process.env, EXPO_WEB_BASE_URL: appBase, TMPDIR: metroTmp },
    });
  } finally {
    rmSync(metroTmp, { recursive: true, force: true });
  }
}

/**
 * The launch background from app.json's splash settings as the theme colour and first paint,
 * so the browser chrome and the page match the app (light or dark) before its bundle runs.
 */
function launchHead() {
  const { expo } = JSON.parse(readFileSync(join(mobileDir, 'app.json'), 'utf8'));
  const splash = expo.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')?.[1];
  const light = splash?.backgroundColor;
  if (!light) return '';
  const dark = splash.dark?.backgroundColor ?? light;
  return (
    `<meta name="theme-color" content="${light}" media="(prefers-color-scheme: light)">` +
    `<meta name="theme-color" content="${dark}" media="(prefers-color-scheme: dark)">` +
    `<style>html,body{background:${light}}@media (prefers-color-scheme:dark){html,body{background:${dark}}}</style>`
  );
}

/** For 404.html: paths under the app are its routes (it reads the URL); any other unknown path goes to the landing page. */
function landingRedirect() {
  return (
    `<script>(function(p,a){if(p!==a&&p.indexOf(a+"/")!==0)location.replace(${JSON.stringify(`${base}/`)})})` +
    `(location.pathname,${JSON.stringify(appBase)})</script>`
  );
}

function assemble() {
  rmSync(out, { recursive: true, force: true });
  cpSync(websiteDist, out, { recursive: true });
  for (const path of ['app', '404.html']) {
    if (existsSync(join(out, path))) throw new Error(`apps/website/dist has its own ${path}, which the app needs`);
  }
  cpSync(appDist, join(out, 'app'), { recursive: true });

  const appHtmlPath = join(out, 'app/index.html');
  const appHtml = readFileSync(appHtmlPath, 'utf8').replace('</head>', `${launchHead()}</head>`);
  if (!appHtml.includes(`src="${appBase}/_expo/static/js/web/`)) {
    throw new Error(`app/index.html doesn't load its bundle from ${appBase}/_expo/; is experiments.baseUrl applied?`);
  }
  writeFileSync(appHtmlPath, appHtml);
  writeFileSync(join(out, '404.html'), appHtml.replace('<head>', `<head>${landingRedirect()}`));
  writeFileSync(join(out, '.nojekyll'), '');
}

function summary() {
  const files = readdirSync(join(out, 'app'), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  const bytes = files.reduce((total, entry) => total + statSync(join(entry.parentPath, entry.name)).size, 0);
  const rows = [
    [`${base}/`, 'landing page'],
    [`${base}/phone/`, 'phone-sized preview of the web app'],
    [`${appBase}/`, `web app (${files.length} files, ${(bytes / 1e6).toFixed(1)} MB)`],
    ['404.html', 'the app again, for deep links; other unknown paths go to the landing page'],
  ];
  const width = Math.max(...rows.map(([path]) => path.length)) + 2;
  console.log('\nPages site ready in dist/pages:');
  for (const [path, what] of rows) console.log(`  ${path.padEnd(width)}${what}`);
}

try {
  checkBackendEnv();
  run('npm', ['run', 'build', '--workspace=@hackyeah/website'], { cwd: root });
  exportApp();
  assemble();
  summary();
} catch (error) {
  console.error(`\nbuild:pages failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
