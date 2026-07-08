# Changelog

## 1.0.9

- Fix `/codex:transfer` against Codex app-server imports that report thread IDs and failures through completion notifications, including Claude installs under `CLAUDE_CONFIG_DIR` when the real `HOME/.claude` path is a file.
- Add Claude 2.x space-form `Bash(...)` permission matchers to slash commands so deterministic companion invocations do not fall back to auto-mode classification.
- Pin `/codex:transfer` to Haiku for its command turn so using it from a Fable session does not spend the command response on Fable.
- Report structured `[codex-rescue] FAILED: ...` diagnostics instead of silently returning nothing when the rescue forwarder cannot invoke Codex.
- Forward oversized or wrong-shaped rescue requests to the companion instead of implementing or rejecting them inline.
- Guide forwarded prompts to fetch large canonical verbatim texts through shell into files instead of generating them token-by-token.

## 1.0.0

- Initial version of the Codex plugin for Claude Code
