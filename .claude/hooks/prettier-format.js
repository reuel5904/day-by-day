// PostToolUse hook: formats each file an agent writes or edits with Prettier, so
// `npm run format:check` stops failing on formatting alone. Runs the Prettier of the checkout that
// holds the file (the main one or a worktree, found by its package.json), so that checkout's
// .prettierignore applies; a checkout without node_modules yet, or a file outside any, is skipped.
// Never blocks: a file Prettier can't parse is left for format:check to report.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

try {
  const file = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path;
  let root = file && dirname(file);
  while (root && !existsSync(join(root, 'package.json'))) {
    root = root === dirname(root) ? undefined : dirname(root);
  }
  const prettier = root && join(root, 'node_modules/.bin/prettier');
  if (prettier && existsSync(prettier)) {
    execFileSync(prettier, ['--write', '--ignore-unknown', file], { cwd: root, stdio: 'ignore' });
  }
} catch {}
