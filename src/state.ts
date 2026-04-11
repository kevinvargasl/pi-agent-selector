import type { PersistedAgentState } from "./types.js";
import { AGENT_STATE_ENTRY } from "./types.js";

interface SessionEntryLike {
	type?: string;
	customType?: string;
	data?: unknown;
}

export function getLastPersistedAgentState(entries: SessionEntryLike[]): PersistedAgentState | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "custom" || entry.customType !== AGENT_STATE_ENTRY) continue;
		const data = entry.data as PersistedAgentState | undefined;
		if (!data || (data.action !== "set" && data.action !== "clear")) continue;
		return data;
	}

	return undefined;
}
