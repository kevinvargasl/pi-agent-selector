import type { PersistedAgentState } from "./types.js";
import { AGENT_STATE_ENTRY } from "./types.js";

interface SessionEntryLike {
	type?: string;
	customType?: string;
	data?: unknown;
}

export function getLastPersistedAgentState(entries: SessionEntryLike[]): PersistedAgentState | undefined {
	let latest: PersistedAgentState | undefined;

	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== AGENT_STATE_ENTRY) continue;
		const data = entry.data as PersistedAgentState | undefined;
		if (!data || (data.action !== "set" && data.action !== "clear")) continue;
		latest = data;
	}

	return latest;
}
