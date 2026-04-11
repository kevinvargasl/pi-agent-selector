import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Box, Container, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";
import type { AgentProfile } from "./types.js";
import { CLEAR_SELECTION_VALUE } from "./types.js";

function formatProfileSummary(profile: AgentProfile, includePath: boolean): string {
	const parts: string[] = [];
	if (profile.description) parts.push(profile.description);
	if (profile.model) parts.push(profile.model);
	if (profile.thinking) parts.push(`thinking:${profile.thinking}`);
	if (includePath) parts.push(profile.path);
	return parts.length > 0 ? parts.join(" | ") : profile.path;
}

export function buildDuplicateNameSet(profiles: AgentProfile[]): Set<string> {
	const counts = new Map<string, number>();
	for (const profile of profiles) {
		const key = profile.name.toLowerCase();
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	const duplicates = new Set<string>();
	for (const [name, count] of counts) {
		if (count > 1) duplicates.add(name);
	}
	return duplicates;
}

export async function showAgentPicker(
	ctx: ExtensionContext,
	profiles: AgentProfile[],
	activeProfilePath?: string,
): Promise<string | null> {
	const duplicateNames = buildDuplicateNameSet(profiles);
	const items: SelectItem[] = profiles.map((profile) => ({
		value: profile.path,
		label: profile.path === activeProfilePath ? `${profile.name} (active)` : profile.name,
		description: formatProfileSummary(profile, duplicateNames.has(profile.name.toLowerCase())),
	}));

	items.push({
		value: CLEAR_SELECTION_VALUE,
		label: "(clear active agent)",
		description: "Remove the active profile overlay from this session",
	});

	const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Select Session Agent"))));

		const selectList = new SelectList(items, Math.min(items.length, 10), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		selectList.onSelect = (item) => done(item.value);
		selectList.onCancel = () => done(null);

		container.addChild(selectList);
		container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

		return {
			render(width: number) {
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
			},
			handleInput(data: string) {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	});

	return result ?? null;
}

export function buildBodyPreview(body: string, maxLines = 10, maxChars = 500): string {
	const trimmed = body.trim();
	if (!trimmed) return "(no body content)";

	const allLines = trimmed.split(/\r?\n/);
	const lines = allLines.slice(0, maxLines);
	let preview = lines.join("\n");
	if (preview.length > maxChars) {
		preview = `${preview.slice(0, maxChars - 3)}...`;
	}

	if (lines.length < allLines.length || preview.length < trimmed.length) {
		preview += "\n...";
	}

	return preview;
}

export function formatProfileDetails(profile: AgentProfile): string {
	const lines = [
		`Name: ${profile.name}`,
		`Path: ${profile.path}`,
		`Description: ${profile.description ?? "(none)"}`,
		`Model: ${profile.model ?? "(none)"}`,
		`Thinking: ${profile.thinking ?? "(none)"}`,
		`Tools: ${profile.tools && profile.tools.length > 0 ? profile.tools.join(", ") : "(none)"}`,
		"",
		"Preview:",
		buildBodyPreview(profile.body),
	];

	return lines.join("\n");
}

export function registerAgentProfileMessageRenderer(pi: {
	registerMessageRenderer: (customType: string, renderer: (message: { content: string }, options: { expanded: boolean }, theme: any) => any) => void;
}) {
	pi.registerMessageRenderer("session-agent-profile", (message, _options, theme) => {
		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		box.addChild(new Text(message.content, 0, 0));
		return box;
	});
}
