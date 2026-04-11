export const AGENT_STATE_ENTRY = "session-agent-selector";
export const CLEAR_SELECTION_VALUE = "__clear_active_agent__";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface AgentProfile {
	name: string;
	path: string;
	description?: string;
	model?: string;
	provider?: string;
	modelId?: string;
	thinking?: ThinkingLevel;
	tools?: string[];
	body: string;
}

export interface PersistedAgentState {
	action: "set" | "clear";
	path?: string;
	name?: string;
	previousModel?: string;
	agentAppliedModel?: string;
	previousThinking?: ThinkingLevel;
	agentAppliedThinking?: ThinkingLevel;
	timestamp: number;
}

export interface ActivationResult {
	appliedModel?: string;
	appliedThinking?: ThinkingLevel;
	appliedTools: string[];
	ignoredTools: string[];
	warnings: string[];
}

export interface ParseAgentFileResult {
	profile?: AgentProfile;
	warnings: string[];
}

export interface DiscoverAgentProfilesResult {
	profiles: AgentProfile[];
	warnings: string[];
}
