import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ensureEnvFile, upsertEnvVar } from './services/EnvService.js';

function getRepoRootFromCwd(cwd = process.cwd()): string {
  return join(cwd, '..', '..');
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function genSecret(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  force: boolean;
  envFile: string;
  password: string | undefined;
  noPassword: boolean;
} {
  const out = {
    dryRun: false,
    force: false,
    envFile: '.env',
    password: undefined as string | undefined,
    noPassword: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--force') out.force = true;
    else if (a === '--no-password') out.noPassword = true;
    else if (a === '--env-file') {
      const next = argv[i + 1];
      if (next) {
        out.envFile = next;
        i++;
      }
    } else if (a === '--password') {
      const next = argv[i + 1];
      if (next) {
        out.password = next;
        i++;
      }
    }
  }

  return out;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = getRepoRootFromCwd();
  const envPath = join(repoRoot, args.envFile);

  const existing = await ensureEnvFile({ envPath, createIfMissing: !args.dryRun, modeIfCreated: 0o600 });
  let content = existing.content;

  const created: string[] = [];
  const generated: Record<string, string> = {};

  // Always ensure a session signing secret is available.
  if (!process.env.AMICUS_ADMIN_SESSION_SECRET) {
    generated.AMICUS_ADMIN_SESSION_SECRET = genSecret(32);
  }

  // Encryption key is required for persisting secrets (and used as a fallback for session signing).
  if (!process.env.CONFIG_ENCRYPTION_KEY) {
    generated.CONFIG_ENCRYPTION_KEY = genSecret(32);
  }

  if (!args.noPassword && !process.env.AMICUS_ADMIN_PASSWORD) {
    generated.AMICUS_ADMIN_PASSWORD = args.password ?? genSecret(18);
  }

  for (const [key, value] of Object.entries(generated)) {
    const res = upsertEnvVar({ content, key, value, overwrite: args.force });
    content = res.next;
    if (res.changed) created.push(key);
  }

  if (created.length === 0) {
    console.log('[init] Nothing to do (all required env vars already set).');
    console.log(`[init] Env file: ${envPath}`);
    return 0;
  }

  if (args.dryRun) {
    console.log('[init] Dry run. Would write:');
    console.log(`- ${envPath}`);
    console.log(`- keys: ${created.join(', ')}`);
    return 0;
  }

  await writeFile(envPath, content, { encoding: 'utf-8', mode: existing.exists ? undefined : 0o600 });
  console.log('[init] Wrote env file.');
  console.log(`- ${envPath}`);
  console.log(`- keys: ${created.join(', ')}`);
  if (created.includes('AMICUS_ADMIN_PASSWORD')) {
    console.log('[init] Admin password generated. Store it safely:');
    console.log(`- AMICUS_ADMIN_PASSWORD=${generated.AMICUS_ADMIN_PASSWORD}`);
  }
  console.log('[init] Restart the daemon after this to pick up env changes.');
  return 0;
}

void main().then((code) => process.exit(code)).catch((err: unknown) => {
  console.error('[init] Failed:', err);
  process.exit(1);
});
