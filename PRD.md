# PRD: Session Agent Selector Extension for pi

## Status
Draft v1

## Summary
Build a pi extension that lets the user select an agent profile from local markdown files in:

- `~/.pi/agent/agents/`
- `~/.pi/agents/`

When an agent is selected, the extension applies the compatible parts of that file to the **current session**:

- `model` → switch the session model when available
- `thinking` → apply the thinking level
- `tools` → apply the active tool set when present
- markdown body → inject as additional system guidance for future turns

This extension treats agent files as **session profiles**, not as full sub-agent definitions.

---

## Problem
Users may already have useful agent definitions in local `.md` files, but there is no simple way to activate one as the current session persona.

Today, users must manually:

- inspect agent files
- switch models manually
- set thinking manually
- mentally copy persona instructions into the conversation

This is repetitive, error-prone, and inconsistent.

---

## Goals
1. Let users browse and activate local agent profiles quickly.
2. Apply `model` and `thinking` automatically.
3. Reuse the agent body as current-session behavior guidance.
4. Show the active agent clearly in the UI.
5. Restore the active selection when the session resumes.
6. Preserve pi's existing runtime, tool, and safety instructions.

---

## Non-Goals
1. Full replacement of pi's base system prompt.
2. Running the selected file as a true autonomous sub-agent.
3. Supporting `prompt_mode` semantics.
4. Supporting `max_turns` semantics.
5. Editing, creating, or syncing agent files.
6. Live file watching in v1.

---

## Product Principle
**Agent files are adapted into session profiles, not executed as native sub-agents.**

This means the extension reuses the parts that map cleanly to the current interactive session and ignores sub-agent-only semantics.

---

## Users
- power users with multiple persona files
- teams with shared agent profiles like `auditor`, `architect`, or `implementer`
- users who want fast mode switching without copying prompts manually

---

## Scope
### In scope for v1
- discover agent files from the two supported directories
- parse frontmatter and markdown body
- activate an agent via command or picker
- apply model, thinking, and tools when present
- inject agent body as a session overlay prompt
- persist and restore the active agent for the session
- display the active agent in the UI

### Out of scope for v1
- keyboard shortcuts
- file watching
- agent file editing
- exact parity with sub-agent behavior
- prompt replacement modes

---

## User Stories
### Story 1: Select an agent interactively
As a user, I want to run `/agent` and choose from available agent files so I can activate one quickly.

### Story 2: Activate by name
As a user, I want to run `/agent auditor` so I can switch directly without opening the picker.

### Story 3: Apply model and thinking automatically
As a user, when I activate an agent, I want its model and thinking level applied automatically so I do not configure them manually.

### Story 4: Reuse the agent instructions
As a user, I want the body of the agent file to influence the current session so the assistant behaves according to that profile.

### Story 5: See what is active
As a user, I want a visible status indicator showing the current active agent.

### Story 6: Restore on resume
As a user, I want the selected agent profile restored when I resume the session.

---

## UX

### Commands
- `/agent` → open selector UI
- `/agent <name>` → activate by name
- `/agent clear` → clear active profile
- `/agent show` → show current profile and resolved settings

### Picker item display
Each item should show:
- agent name (filename without `.md`)
- description from frontmatter, when available
- model, when available
- thinking level, when available
- source path, when needed to disambiguate name collisions

### Status bar
Display the current active agent in the footer/status area:

- `agent: auditor`

---

## Functional Requirements

### FR1 — Agent discovery
The extension SHALL discover `.md` files from:
- `~/.pi/agent/agents/*.md`
- `~/.pi/agents/*.md`

The extension SHALL normalize paths and de-duplicate duplicate results.

The extension SHALL only accept regular files for discovery. It SHALL reject symlinked files.

The extension SHALL reject oversized files above the configured safety limit for agent profiles.

### FR2 — Frontmatter parsing
The extension SHALL parse YAML frontmatter and markdown body from each file.

Supported frontmatter fields in v1:
- `description`
- `model`
- `thinking`
- `tools`

Ignored frontmatter fields in v1:
- `prompt_mode`
- `max_turns`
- any unknown field

### FR3 — Activation
When the user activates an agent, the extension SHALL:
- store the selected agent in session state
- apply compatible settings immediately
- update the UI status indicator

### FR4 — Model application
If the agent defines `model`, the extension SHALL attempt to switch to that model.

If the model is unavailable or lacks credentials, the extension SHALL:
- keep the current model unchanged
- notify the user with a warning
- continue applying other compatible settings

### FR5 — Thinking application
If the agent defines `thinking`, the extension SHALL apply it to the current session.

### FR6 — Tool application
If the agent defines `tools`, the extension SHALL:
- apply them automatically on activation
- enable valid tools
- ignore invalid or unknown tools
- notify the user if any tools were ignored

### FR7 — Prompt injection
If the agent body is non-empty, the extension SHALL inject it into the effective system prompt for each future turn using `before_agent_start`.

### FR8 — Prompt safety
The extension SHALL preserve pi's built-in system, runtime, and tool instructions.

The extension SHALL NOT replace the entire system prompt.

### FR9 — Session restore
On session resume or reload, the extension SHALL restore the active agent selection from session state.

### FR10 — Clear/reset
The user SHALL be able to clear the active agent, removing the overlay prompt and active-agent status.

Clearing the active agent SHALL NOT automatically restore or roll back previously applied model, thinking, or tool settings.

### FR11 — Direct activation ambiguity
If `/agent <name>` matches multiple agent files with the same name, the extension SHALL NOT guess.

In that case, it SHALL:
- refuse direct activation by ambiguous name
- notify the user that multiple matches exist
- instruct the user to use `/agent` to pick the intended profile

---

## Prompt Semantics
The agent body is treated as an **additional behavioral overlay**.

Conceptually:

```text
[pi base system prompt]
+ [runtime and developer instructions]
+ [active session agent profile]
```

Recommended wrapper for injection:

```md
## Active Session Agent Profile

The following profile is active for this session.
Follow it unless it conflicts with higher-priority runtime, safety, or tool instructions.

[agent body]
```

This makes priority explicit and avoids unsafe prompt replacement behavior.

---

## Supported Agent File Mapping

| Field | v1 behavior |
|---|---|
| `description` | show in picker and `/agent show` |
| `model` | apply via `pi.setModel()` when possible |
| `thinking` | apply via `pi.setThinkingLevel()` |
| `tools` | apply via `pi.setActiveTools()` |
| markdown body | inject as active session overlay |
| `prompt_mode` | ignored |
| `max_turns` | ignored |
| unknown fields | ignored |

---

## State Model
Persist the following session-specific state:
- active agent path
- active agent name

On restore, the extension SHOULD re-read the file from disk and re-parse it rather than storing a full content snapshot.

### Runtime Setting Ownership
Activating an agent applies compatible session settings immediately.

Clearing an agent removes future profile influence only. It does not rewind the session back to a prior model, thinking level, or tool set snapshot.

### Tradeoff
- **Pro:** changes to the underlying profile file are reflected automatically
- **Con:** restored behavior may not be perfectly historically reproducible

This tradeoff is acceptable for v1.

---

## Error Handling
### Invalid frontmatter
- skip the file from selection if it cannot be parsed safely
- notify the user with a concise warning

### Rejected files
- reject symlinked files during discovery
- reject oversized files during discovery
- warn the user without breaking extension behavior

### Duplicate names
- show path context in the picker and in `/agent show`
- if `/agent <name>` resolves to multiple matches, fail clearly and ask the user to use the picker

### Missing or unavailable model
- keep current model
- warn user
- still apply other settings and prompt overlay

### Invalid tools
- apply valid tools only
- warn user about ignored tool names

### Empty body
- allow the profile to function as a configuration-only agent

### Missing file on restore
- clear the active agent state
- notify the user that the file no longer exists

---

## Technical Design Notes

### Extension placement
Recommended location:
- `~/.pi/agent/extensions/session-agent-selector.ts`

### pi APIs to use
- `pi.registerCommand()`
- `ctx.ui.select()` or `ctx.ui.custom()`
- `pi.setModel()`
- `pi.setThinkingLevel()`
- `pi.setActiveTools()`
- `pi.on("before_agent_start", ...)`
- `pi.appendEntry()`
- `ctx.ui.setStatus()`

### Discovery approach
Use the user's home directory and check both supported folders.

The extension SHOULD:
- scan on `session_start` for bootstrap and restore
- re-scan on every `/agent` invocation
- re-scan before direct activation via `/agent <name>`

This avoids stale state without requiring file watching.

### Session behavior
Apply model, thinking, and tools at selection time. Inject the body on every future turn while the profile is active.

### `/agent show` behavior
`/agent show` SHOULD display:
- active agent name
- source path
- description
- model
- thinking
- tools
- a short preview of the body

It SHOULD NOT display the full body by default.

---

## Acceptance Criteria
1. Running `/agent` shows available agent files from the supported directories.
2. Running `/agent <name>` activates a matching profile by name when the name is unambiguous.
3. If `/agent <name>` matches multiple profiles, activation fails with a clear message directing the user to the picker.
4. Selecting an agent with `model` changes the current model when available.
5. Selecting an agent with `thinking` applies the configured thinking level.
6. Selecting an agent with `tools` applies valid tools automatically and warns about invalid ones.
7. The selected agent body affects future turns.
8. pi's base system prompt remains intact.
9. The active agent is visible in the UI.
10. `/agent clear` removes the profile and overlay behavior without rolling back model, thinking, or tools.
11. Session resume restores the active agent when its file still exists.
12. `prompt_mode` has no effect.
13. Invalid files fail gracefully without breaking the extension.
14. `/agent show` displays metadata and a short preview rather than the full body.
15. Agent discovery reflects newly added or removed files when `/agent` is invoked.

---

## Risks and Mitigations

### Risk: users expect true sub-agent behavior
**Mitigation:** document clearly that this is a session-profile adapter, not sub-agent execution.

### Risk: tool switching surprises users
**Mitigation:** notify users when tools are changed and show ignored tools.

### Risk: future frontmatter expansion creates ambiguity
**Mitigation:** keep supported field mapping explicit and ignore unknown fields.

### Risk: profile body conflicts with system behavior
**Mitigation:** inject a wrapper that explicitly gives priority to runtime, safety, and tool instructions.

---

## Alternatives Considered

### Option A: Full system prompt replacement
- **Pros:** closest to literal file semantics
- **Cons:** unsafe, brittle, likely breaks pi runtime behavior
- **Decision:** reject

### Option B: Overlay prompt injection
- **Pros:** safe, compatible, simple, aligns with extension APIs
- **Cons:** not exact parity with sub-agents
- **Decision:** accept

### Option C: Preset-only mapping without body injection
- **Pros:** simplest implementation
- **Cons:** loses most of the behavioral value of agent files
- **Decision:** reject

---

## Product Decisions
1. **Tools are applied automatically by default** when defined by the selected profile.
2. **`/agent show` displays metadata plus a short preview** of the body, not the full content.
3. **Agent discovery refreshes on every `/agent` command** and before direct activation by name.
4. **Project-local agent directories are out of scope for v1** and may be considered in a future version.

---

## Recommendation
Implement v1 as a **safe session-profile adapter** that reuses existing agent markdown files while preserving pi's core runtime behavior.
