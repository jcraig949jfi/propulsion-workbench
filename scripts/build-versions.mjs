/**
 * Build every published version of the workbench into one static site.
 *
 * Mark liked different things about different versions, so rather than each release
 * overwriting the last, all three are published side by side and can be compared live:
 *
 *   /            the latest version (so the link already shared keeps opening the app)
 *   /v1/         the original MVP
 *   /v2/         the self-contained demo, with the mobile pass
 *   /v3/         same build as the root, addressable by name
 *
 * Each version is built from its own commit, with its own package.json and lockfile, via a
 * throwaway git worktree. Nothing is back-ported: v1 is v1 as it actually shipped, warts and
 * framing included. The only build-time edit is the localStorage key (see PATCHES below).
 *
 * Usage:  node scripts/build-versions.mjs [--out dist-all]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Newest last — the final entry is also copied to the site root. */
const VERSIONS = [
  {
    id: 'v1',
    ref: '8462813',
    name: 'v1 — original MVP',
    short: 'Original',
    blurb:
      'The first build. Physics engine, operating point, prop comparison, bench-test log. ' +
      'Desktop-first layout, and it presents itself as gated on reference data it does not have.',
  },
  {
    id: 'v2',
    ref: 'c48a061',
    name: 'v2 — self-contained demo',
    short: 'Demo + mobile',
    blurb:
      'Reframed as a working demonstration rather than a blocked milestone, with synthetic ' +
      'demo bench data on a button, and the mobile pass: sticky readout, scrolling charts, ' +
      'touch-sized controls.',
  },
  {
    id: 'v3',
    ref: 'HEAD',
    name: 'v3 — real hardware & range sweeps',
    short: 'Latest',
    blurb:
      'Seven real AXI motors from their datasheets, 44 APC sizes, diameter/pitch range ' +
      'sliders, and charts where you choose both axes plus a second quantity on a right-hand ' +
      'scale.',
  },
];

/**
 * Build-time edits applied to each checkout before building. Kept to the minimum that makes
 * parallel hosting behave, and listed here so it is obvious that nothing else was touched.
 *
 * All versions are served from one origin, so they would otherwise SHARE localStorage — and a
 * bench test recorded in v3 against an AXI motor would appear in v1, whose catalogue has no
 * such motor. Giving each version its own key keeps the three demos independent.
 */
const PATCHES = [
  {
    file: 'src/storage/persistence.ts',
    find: /const STORAGE_KEY = 'propulsion-workbench:v1';/,
    replace: (v) => `const STORAGE_KEY = 'propulsion-workbench:${v.id}';`,
  },
];

const outDir = path.join(
  repoRoot,
  process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'dist-all',
);

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * The version bar injected into every build.
 *
 * Deliberately a sticky strip across the top rather than a corner pill: the point is that a
 * visitor should not have to *discover* that other versions exist. It states the count, names
 * each version, and marks the one being viewed.
 *
 * It also nudges the app's own sticky readout down by its height, so the two do not overlap on
 * a phone (v3 pins an operating-point summary to top: 0).
 */
const BAR_H = 40;

function switcherHtml(currentId, prefix) {
  const links = VERSIONS.map((v) => {
    const current = v.id === currentId;
    return `<a class="vb-item${current ? ' vb-current' : ''}" href="${prefix}${v.id}/" title="${v.name}">` +
      `<b>${v.id}</b><span class="vb-name">${v.short}</span>` +
      `${current ? '<span class="vb-you">viewing</span>' : ''}</a>`;
  }).join('');
  return `
<div id="version-bar">
  <span class="vb-lead"><b>${VERSIONS.length} versions</b><span class="vb-lead-long"> of this app are live &mdash; try them</span>:</span>
  <span class="vb-items">${links}</span>
  <a class="vb-about" href="${prefix}versions.html">what changed?</a>
</div>
<style>
  :root{--vb-h:${BAR_H}px}
  #version-bar{position:sticky;top:0;z-index:9999;display:flex;align-items:center;gap:8px;
    min-height:var(--vb-h);padding:5px 12px;box-sizing:border-box;overflow-x:auto;
    scrollbar-width:none;white-space:nowrap;
    font:13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:#123a5e;color:#eaf2fa;border-bottom:2px solid #2f8fd8}
  #version-bar::-webkit-scrollbar{display:none}
  .vb-lead{opacity:.92;flex:0 0 auto}
  .vb-lead b{font-weight:700}
  .vb-items{display:flex;gap:6px;flex:0 0 auto}
  #version-bar a{display:inline-flex;align-items:center;gap:5px;text-decoration:none;
    color:#eaf2fa;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.28);
    border-radius:999px;padding:6px 11px;min-height:32px;flex:0 0 auto}
  #version-bar a:hover{background:rgba(255,255,255,.24)}
  #version-bar a b{font-weight:700}
  .vb-name{opacity:.85}
  .vb-current{background:#fff !important;color:#123a5e !important;border-color:#fff !important;
    font-weight:600}
  .vb-you{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;opacity:.7}
  .vb-about{background:none !important;border:0 !important;text-decoration:underline !important;
    opacity:.9;padding-left:4px !important}
  /* v3 pins its own summary to the top; keep it clear of this bar. */
  .sticky-summary{top:var(--vb-h) !important}
  @media (max-width:760px){
    #version-bar{gap:6px;padding:5px 10px}
    .vb-lead{font-size:12px}
    .vb-lead-long,.vb-name,.vb-you{display:none}
    #version-bar a{padding:6px 10px}
    .vb-about{font-size:12px;padding-left:2px !important}
  }
</style>
`;
}

function injectSwitcher(dir, currentId, prefix) {
  const indexPath = path.join(dir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const bar = switcherHtml(currentId, prefix);
  html = html.includes('<body>')
    ? html.replace('<body>', `<body>${bar}`)
    : html.replace('</body>', `${bar}</body>`);
  fs.writeFileSync(indexPath, html);
}

function versionsPage() {
  const rows = VERSIONS.map(
    (v) => `
    <li>
      <a href="${v.id}/"><strong>${v.name}</strong></a>
      <span class="ref">${v.ref}</span>
      <p>${v.blurb}</p>
    </li>`,
  ).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Propulsion Workbench — versions</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;padding:28px 20px 60px;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;
    max-width:760px;margin:0 auto;background:#14181d;color:#e7ebef}
  @media (prefers-color-scheme: light){body{background:#f5f6f7;color:#14181d}}
  h1{font-size:22px;margin:0 0 4px}
  .sub{opacity:.7;font-size:14px;margin:0 0 24px}
  ul{list-style:none;padding:0;margin:0}
  li{border:1px solid rgba(128,128,128,.35);border-radius:8px;padding:14px 16px;margin-bottom:14px}
  li a{color:#58a6ff;text-decoration:none;font-size:17px}
  @media (prefers-color-scheme: light){li a{color:#0b5fa5}}
  .ref{opacity:.55;font:12px ui-monospace,Consolas,monospace;margin-left:8px}
  p{margin:6px 0 0;font-size:14.5px;opacity:.85}
  footer{margin-top:26px;font-size:13px;opacity:.65}
</style></head>
<body>
  <h1>Propulsion Workbench — all versions</h1>
  <p class="sub">Each version is the build as it actually shipped, from its own commit. They run
  independently: each keeps its own saved bench tests, so trying one will not disturb another.</p>
  <ul>${rows}</ul>
  <footer>The site root always serves the newest version. Source:
    <a href="https://github.com/jcraig949jfi/propulsion-workbench">github.com/jcraig949jfi/propulsion-workbench</a>
  </footer>
</body></html>
`;
}

// ---------------------------------------------------------------------------------------------

rmrf(outDir);
fs.mkdirSync(outDir, { recursive: true });

const worktreeBase = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-versions-'));
let lastBuilt = null;

for (const version of VERSIONS) {
  const wt = path.join(worktreeBase, version.id);
  console.log(`\n=== ${version.name}  (${version.ref}) ===`);

  run('git', ['worktree', 'add', '--detach', wt, version.ref], repoRoot);

  for (const patch of PATCHES) {
    const file = path.join(wt, patch.file);
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace(patch.find, patch.replace(version));
    if (after === before) {
      console.warn(`  ! patch did not apply to ${patch.file} — versions may share storage`);
    }
    fs.writeFileSync(file, after);
  }

  run('npm', ['ci', '--no-audit', '--no-fund'], wt);
  run('npm', ['run', 'build'], wt);

  const dest = path.join(outDir, version.id);
  copyDir(path.join(wt, 'dist'), dest);
  injectSwitcher(dest, version.id, '../');

  // The newest version is ALSO served from the root. Copy it from the freshly built dist, not
  // from the copy above — that one already has the bar injected, and injecting into it again
  // produced two stacked bars at the root.
  if (version === VERSIONS[VERSIONS.length - 1]) {
    copyDir(path.join(wt, 'dist'), outDir);
    injectSwitcher(outDir, version.id, '');
    lastBuilt = dest;
  }

  run('git', ['worktree', 'remove', '--force', wt], repoRoot);
  console.log(`  -> ${path.relative(repoRoot, dest)}`);
}

fs.writeFileSync(path.join(outDir, 'versions.html'), versionsPage());
rmrf(worktreeBase);

console.log(`\nBuilt ${VERSIONS.length} versions into ${path.relative(repoRoot, outDir)}/`);
console.log('  /            ->', VERSIONS[VERSIONS.length - 1].name);
for (const v of VERSIONS) console.log(`  /${v.id}/         ->`, v.name);
console.log('  /versions.html');
