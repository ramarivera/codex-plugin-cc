import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureAbsolutePath } from "./fs.mjs";
import { getConfig } from "./state.mjs";
import { resolveWorkspaceRoot } from "./workspace.mjs";

export const TRANSCRIPT_PATH_ENV = "CODEX_COMPANION_TRANSCRIPT_PATH";

// Honor CLAUDE_CONFIG_DIR so non-default config dir installations work correctly.
const CLAUDE_PROJECTS_DIR = process.env.CLAUDE_CONFIG_DIR
  ? path.join(process.env.CLAUDE_CONFIG_DIR, "projects")
  : path.join(os.homedir(), ".claude", "projects");

function resolveUserPath(cwd, value) {
  if (value === "~") {
    return os.homedir();
  }
  if (String(value).startsWith("~/")) {
    return path.join(os.homedir(), String(value).slice(2));
  }
  return ensureAbsolutePath(cwd, value);
}

// Fallback: read the transcript path persisted to the plugin state file by the
// SessionStart hook. This covers resumed sessions where CLAUDE_ENV_FILE injection
// may not re-run, or Claude Code versions that do not honour CLAUDE_ENV_FILE at all.
function readStoredTranscriptPath(cwd) {
  try {
    const workspaceRoot = resolveWorkspaceRoot(cwd);
    return getConfig(workspaceRoot).lastTranscriptPath ?? null;
  } catch {
    return null;
  }
}

// Last-resort heuristic: Claude Code slugifies the project cwd by replacing every
// path separator with "-" (e.g. /Users/foo/dev/proj → -Users-foo-dev-proj).
// Scan that directory for the most recently modified .jsonl and use it.
function findNewestProjectTranscript(cwd) {
  try {
    const slug = cwd.replace(/[/\\]/g, "-");
    const projectDir = path.join(CLAUDE_PROJECTS_DIR, slug);
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    const jsonlFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => {
        const full = path.join(projectDir, e.name);
        return { full, mtimeMs: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return jsonlFiles.length > 0 ? jsonlFiles[0].full : null;
  } catch {
    return null;
  }
}

export function resolveClaudeSessionPath(cwd, options = {}) {
  // Precedence: explicit --source > env var > state file > newest-jsonl heuristic.
  const requestedPath =
    options.source ||
    process.env[TRANSCRIPT_PATH_ENV] ||
    readStoredTranscriptPath(cwd) ||
    findNewestProjectTranscript(cwd);

  if (!requestedPath) {
    throw new Error("Could not identify the current Claude transcript. Retry with --source <path-to-claude-jsonl>.");
  }

  const sourcePath = resolveUserPath(cwd, requestedPath);
  if (path.extname(sourcePath) !== ".jsonl") {
    throw new Error(`Claude session source must be a JSONL file: ${sourcePath}`);
  }

  let source;
  let projects;
  try {
    source = fs.realpathSync(sourcePath);
    projects = fs.realpathSync(CLAUDE_PROJECTS_DIR);
  } catch {
    throw new Error(`Claude session file not found: ${sourcePath}`);
  }
  const relative = path.relative(projects, source);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Codex can import Claude sessions only from ${CLAUDE_PROJECTS_DIR}: ${source}`);
  }
  return source;
}
