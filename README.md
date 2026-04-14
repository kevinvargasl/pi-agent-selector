# Session Agent Selector Extension for pi

A [pi](https://pi.dev) package that lets you select a local agent markdown file and apply it as the active profile for the current session.

## What it does
It adapts agent files into **session profiles**:

- `model` → applied to the current session when available
- `thinking` → applied to the current session
- `tools` → applied automatically when present
- markdown body → injected as an overlay into the system prompt for future turns

This extension does **not** run the selected file as a real sub-agent and does **not** replace pi's base system prompt.

## Supported directories
- `~/.pi/agent/agents/`
- `~/.pi/agents/`

## Discovery safety rules
- only regular `.md` files are loaded
- symlinked files are rejected
- files larger than 100 KB are rejected

## Supported frontmatter
```yaml
---
description: Security Code Reviewer
model: openrouter/openai/gpt-5.4
thinking: high
tools: read, bash, edit, write, grep, find, ls
---
```

### Example agent profile
```md
---
description: Security Code Reviewer
model: openrouter/openai/gpt-5.4
thinking: high
tools: read, bash, grep, find, ls
---

You are a security auditor. Review code for vulnerabilities and provide clear remediation advice.
```

Supported fields:
- `description`
- `model`
- `thinking`
- `tools`

Ignored fields:
- `prompt_mode`
- `max_turns`
- any unknown frontmatter fields

## Commands
- `/agent` → open the agent picker
- `/agent <name>` → activate an agent by name when unambiguous
- `/agent clear` → clear the active profile overlay
- `/agent show` → show active profile metadata and a short preview

### Example usage
```text
/agent
/agent auditor
/agent show
/agent clear
```

## Important behavior
### Clear semantics
`/agent clear` removes the active profile overlay and status indicator.

It restores the previous model and thinking level only if they are still using the agent-applied values at clear time. If you manually changed model or thinking after activating the agent, your newer values are preserved.

Tool selection is not automatically restored.

### Duplicate names
If multiple files share the same name, `/agent <name>` will fail clearly and ask you to use `/agent` to pick the intended profile.

### Discovery freshness
The extension re-scans the supported directories on every `/agent` invocation, so added or removed files are picked up without file watching.

## Install

```bash
pi install npm:pi-agent-selector
```