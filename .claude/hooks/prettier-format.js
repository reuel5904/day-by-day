// PostToolUse hook: formats each file an agent writes or edits with Prettier, so
// `npm run format:check` stops failing on formatting alone. Runs Prettier from the checkout that
// holds the file (the main one or a worktree), so that checkout's .prettierignore applies.
// Never blocks: a file Prettier can't parse is left for format:check to report.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

try {
  const file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path;
  let root = file && dirname(file);
  while (root && !existsSync(join(root, 'node_modules/.bin/prettier'))) {
    root = root === dirname(root) ? undefined : dirname(root);
  }
  if (root) {
    execFileSync(join(root, 'node_modules/.bin/prettier'), ['--write', '--ignore-unknown', file], {
      cwd: root,
      stdio: 'ignore',
    });
  }
} catch {}
