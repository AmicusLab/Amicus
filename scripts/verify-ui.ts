import { spawnSync } from 'node:child_process';

function run(cmd: string, args: string[]): { code: number; stdout: string } {
  const res = spawnSync(cmd, args, { encoding: 'utf-8' });
  return { code: res.status ?? 1, stdout: res.stdout ?? '' };
}

function gitAvailable(): boolean {
  return run('git', ['rev-parse', '--is-inside-work-tree']).code === 0;
}

function getChangedFilesLocal(): string[] {
  const a = run('git', ['diff', '--name-only']).stdout;
  const b = run('git', ['diff', '--name-only', '--cached']).stdout;
  const u = run('git', ['ls-files', '--others', '--exclude-standard']).stdout;
  return [...new Set((a + '\n' + b + '\n' + u).split('\n').map((s) => s.trim()).filter(Boolean))];
}

function remoteRefExists(ref: string): boolean {
  return run('git', ['show-ref', '--verify', '--quiet', `refs/remotes/${ref}`]).code === 0;
}

function localRefExists(ref: string): boolean {
  return run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${ref}`]).code === 0;
}

function resolveCiBaseRef(): string | null {
  const ghBaseRef = process.env.GITHUB_BASE_REF;
  if (ghBaseRef && remoteRefExists(`origin/${ghBaseRef}`)) return `origin/${ghBaseRef}`;

  if (remoteRefExists('origin/main')) return 'origin/main';
  if (localRefExists('main')) return 'main';
  if (remoteRefExists('origin/master')) return 'origin/master';
  if (localRefExists('master')) return 'master';

  return null;
}

function getChangedFilesCi(): { files: string[]; mode: 'sha' | 'ref' | 'none' } {
  const base = process.env.AMICUS_VERIFY_UI_BASE_SHA;
  const head = process.env.AMICUS_VERIFY_UI_HEAD_SHA;
  if (base && head) {
    const out = run('git', ['diff', '--name-only', base, head]).stdout;
    return { files: out.split('\n').map((s) => s.trim()).filter(Boolean), mode: 'sha' };
  }

  const baseRef = resolveCiBaseRef();
  if (baseRef) {
    const out = run('git', ['diff', '--name-only', `${baseRef}...HEAD`]).stdout;
    return { files: out.split('\n').map((s) => s.trim()).filter(Boolean), mode: 'ref' };
  }

  return { files: [], mode: 'none' };
}

function main(): number {
  if (!gitAvailable()) {
    console.log('[verify:ui] git not available; skipping UI E2E');
    return 0;
  }

  const changed = process.env.CI ? getChangedFilesCi() : { files: getChangedFilesLocal(), mode: 'none' as const };
  const files = changed.files;
  if (files.length === 0) {
    if (process.env.CI && changed.mode === 'none') {
      console.log('[verify:ui] cannot determine changed files in CI; skipping UI E2E');
      console.log('[verify:ui] set AMICUS_VERIFY_UI_BASE_SHA and AMICUS_VERIFY_UI_HEAD_SHA to enable conditional UI verify');
      return 0;
    }

    console.log('[verify:ui] no changes detected; skipping UI E2E');
    return 0;
  }

  const dashboardFiles = files.filter((f) => f.startsWith('apps/dashboard/'));
  if (dashboardFiles.length === 0) {
    console.log('[verify:ui] no dashboard changes; skipping UI E2E');
    return 0;
  }

  console.log(`[verify:ui] dashboard changes detected (${dashboardFiles.length}); running Playwright E2E`);

  // Local machines often don't have browsers installed. In CI we install explicitly.
  if (!process.env.CI) {
    const install = spawnSync('bunx', ['playwright', 'install', 'chromium'], {
      stdio: 'inherit',
      cwd: 'apps/dashboard',
    });
    if ((install.status ?? 1) !== 0) {
      console.log('[verify:ui] playwright browser install failed');
      return install.status ?? 1;
    }
  }

  const testRes = spawnSync('bun', ['run', '--cwd', 'apps/dashboard', 'test:e2e'], {
    stdio: 'inherit',
  });
  return testRes.status ?? 1;
}

process.exit(main());
