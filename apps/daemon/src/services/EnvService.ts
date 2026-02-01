import { readFile, writeFile, mkdir, chmod, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

type LoadEnvOptions = {
  repoRoot: string;
  files?: string[];
  overrideExisting?: boolean;
};

function stripQuotes(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const withoutExport = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    const value = stripQuotes(withoutExport.slice(eq + 1));
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

export async function loadRepoEnv(opts: LoadEnvOptions): Promise<{ loaded: string[] }>{
  const files = opts.files ?? ['.env.local', '.env'];
  const loaded: string[] = [];

  for (const name of files) {
    const path = join(opts.repoRoot, name);
    let raw: string;
    try {
      raw = await readFile(path, 'utf-8');
    } catch {
      continue;
    }
    const parsed = parseEnvText(raw);
    for (const [k, v] of Object.entries(parsed)) {
      if (!opts.overrideExisting && process.env[k] !== undefined) continue;
      process.env[k] = v;
    }
    loaded.push(name);
  }

  return { loaded };
}

type EnsureEnvOptions = {
  envPath: string;
  createIfMissing?: boolean;
  modeIfCreated?: number;
};

export async function ensureEnvFile(opts: EnsureEnvOptions): Promise<{ exists: boolean; content: string }>{
  try {
    const content = await readFile(opts.envPath, 'utf-8');
    return { exists: true, content };
  } catch {
    if (!opts.createIfMissing) return { exists: false, content: '' };
    await mkdir(dirname(opts.envPath), { recursive: true });
    await writeFile(opts.envPath, '', { encoding: 'utf-8', mode: opts.modeIfCreated ?? 0o600 });
    // If the file already existed but read failed for some reason, chmod may throw; ignore.
    try {
      const s = await stat(opts.envPath);
      if ((s.mode & 0o777) !== (opts.modeIfCreated ?? 0o600)) {
        await chmod(opts.envPath, opts.modeIfCreated ?? 0o600);
      }
    } catch {
      // ignore
    }
    return { exists: false, content: '' };
  }
}

export function upsertEnvVar(params: {
  content: string;
  key: string;
  value: string;
  overwrite?: boolean;
}): { next: string; changed: boolean } {
  const lines = params.content.split(/\r?\n/);
  let found = false;
  let changed = false;

  const re = new RegExp(`^\\s*(?:export\\s+)?${params.key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*=.*$`);
  const desired = `${params.key}="${params.value.replace(/"/g, '\\"')}"`;

  const out = lines.map((line) => {
    if (!re.test(line)) return line;
    found = true;
    if (!params.overwrite) return line;
    changed = true;
    return desired;
  });

  if (!found) {
    changed = true;
    const last = out.length > 0 ? out[out.length - 1] : undefined;
    if (last && last.trim() !== '') out.push('');
    out.push(desired);
    out.push('');
  }

  return { next: out.join('\n'), changed };
}
