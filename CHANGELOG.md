# Changelog

All notable changes to this package will be documented in this file.

## [0.1.1] - 2026-04-11
### Changed
- Reverse iteration in state lookup for faster session restore.
- Remove redundant `existsSync` check and unused import in discovery.
- Eliminate duplicate `trim`/`split` calls in body preview builder.
- Replace intermediate array allocations with direct loop in duplicate name detection.

## [0.1.0] - 2026-04-11
### Added
- Initial release of the Session Agent Selector pi extension.
- Agent discovery from `~/.pi/agent/agents/` and `~/.pi/agents/`.
- Activation of agent profile `model`, `thinking`, and `tools` settings.
- Session prompt overlay using agent markdown body.
- `/agent`, `/agent <name>`, `/agent clear`, and `/agent show` commands.
- Session restore support for active agent selection.
- Safe clear behavior that restores prior model and thinking when still using agent-applied values.
- Discovery safeguards for symlinks and oversized files.
- Provider-aware model warnings.
