# Implementation Plan: Session Agent Selector Extension

## Goal
Implement a pi extension that adapts local agent markdown files into session profiles for the current pi session.

## Package Structure

```text
/
├─ PRD.md
├─ IMPLEMENTATION_PLAN.md
├─ package.json
├─ README.md
└─ src/
   ├─ index.ts
   ├─ types.ts
   ├─ discovery.ts
   ├─ parser.ts
   ├─ state.ts
   └─ ui.ts
```

## Core Data Model
- `AgentProfile`
  - `name`
  - `path`
  - `description?`
  - `model?`
  - `provider?`
  - `modelId?`
  - `thinking?`
  - `tools: string[]`
  - `body`
- `PersistedAgentState`
  - `action: "set" | "clear"`
  - `path?`
  - `name?`
  - `timestamp`
- `ActivationResult`
  - `appliedModel?`
  - `appliedThinking?`
  - `appliedTools`
  - `ignoredTools`
  - `warnings`

## Implementation Decisions
- Use pi's built-in `parseFrontmatter` helper for frontmatter parsing.
- Re-scan supported directories on every `/agent` invocation and before direct activation by name.
- Persist only the active agent path/name, then re-read the file on restore.
- Clearing an agent removes future overlay behavior only; it does not roll back model, thinking, or tool settings.
- If `/agent <name>` is ambiguous, fail clearly and direct the user to the picker.

## Discovery
Supported directories:
- `~/.pi/agent/agents/`
- `~/.pi/agents/`

Rules:
- include only top-level `*.md` files
- normalize absolute paths
- de-duplicate results
- sort by name, then path

## Parsing
Supported frontmatter:
- `description`
- `model`
- `thinking`
- `tools`

Ignored frontmatter:
- `prompt_mode`
- `max_turns`
- all unknown fields

Normalization:
- `model`: parse `provider/modelId`
- `thinking`: accept only pi-supported levels
- `tools`: accept comma-separated string or YAML array of strings
- `body`: trim outer whitespace, preserve internal formatting

## Commands
- `/agent` → open picker
- `/agent <name>` → activate by exact case-insensitive name when unambiguous
- `/agent clear` → clear active profile
- `/agent show` → show metadata plus short preview

## Session Flow
- `session_start`
  - scan profiles
  - restore active profile from branch state
  - apply model/thinking/tools again if needed
  - restore status
- `session_tree`
  - re-read branch state
  - restore matching active profile for current branch
- `before_agent_start`
  - inject active profile body as system prompt overlay

## MVP Task Order
1. Scaffold package files.
2. Implement discovery.
3. Implement parser.
4. Implement activation and clear logic.
5. Implement session restore.
6. Implement prompt overlay.
7. Implement `/agent <name>` and `/agent clear`.
8. Implement picker UI and `/agent show`.
9. Add README usage guidance.

## Manual Verification
- `/agent` lists profiles from both supported directories.
- selecting `auditor` applies model, thinking, tools, and overlay
- `/agent show` shows metadata and preview
- `/agent clear` removes overlay/status only
- session restore reactivates the profile
- invalid files are skipped safely
- duplicate names make `/agent <name>` fail clearly
