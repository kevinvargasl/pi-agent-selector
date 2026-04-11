# Session Agent Selector Extension for pi

A shareable pi package that lets you select a local agent markdown file and apply it as the active profile for the current session.

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

### Discovery trust boundary
The extension intentionally rejects symlinked agent files and oversized files. This keeps profile discovery constrained to regular markdown files that physically live in the approved directories.

## Install

### Prerequisites
- pi installed and working
- Node.js 20.6+ if you are developing or installing from a local checkout

### Use as a local package during development

```bash
npm install
pi install /absolute/path/to/pi-agent-selector
```

You can also try it without installing:

```bash
pi -e /absolute/path/to/pi-agent-selector
```

### Use as a published pi package
Once published to npm or a git repository, install it with pi package sources such as:

```bash
pi install npm:pi-agent-selector@0.1.0
# or
pi install git:github.com/kevinvargasl/pi-agent-selector@v0.1.0
```

### Add it directly to `~/.pi/agent/settings.json`
You can also register it as a package source in your global pi settings:

```json
{
  "packages": [
    "npm:pi-agent-selector@0.1.0"
  ]
}
```

Or from git:

```json
{
  "packages": [
    "git:github.com/kevinvargasl/pi-agent-selector@v0.1.0"
  ]
}
```

## Troubleshooting
- If a model from an agent file does not activate, make sure the `model` field uses pi's exact provider/model identifier.
- If you use a proxy or alternate provider, specify that provider explicitly in the agent file.
- If VS Code reports missing Node or pi package types while developing, run `npm install` in the repo root.

## Package entry
This repo is structured as a shareable pi package.

The extension entry point is:
- `src/index.ts`

Configured in `package.json` under:

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

## Release notes
See [CHANGELOG.md](./CHANGELOG.md) for package version history.
