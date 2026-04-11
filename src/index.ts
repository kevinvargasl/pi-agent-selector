import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { discoverAgentProfiles } from "./discovery.js";
import { getLastPersistedAgentState } from "./state.js";
import { formatProfileDetails, registerAgentProfileMessageRenderer, showAgentPicker } from "./ui.js";
import {
	AGENT_STATE_ENTRY,
	CLEAR_SELECTION_VALUE,
	type ActivationResult,
	type AgentProfile,
	type PersistedAgentState,
	type ThinkingLevel,
} from "./types.js";

function persistState(pi: ExtensionAPI, data: PersistedAgentState) {
	pi.appendEntry<PersistedAgentState>(AGENT_STATE_ENTRY, data);
}

function updateStatus(ctx: ExtensionContext, profile?: AgentProfile) {
	ctx.ui.setStatus("session-agent", profile ? `agent: ${profile.name}` : undefined);
}

function summarizeWarnings(warnings: string[]): string | undefined {
	if (warnings.length === 0) return undefined;
	if (warnings.length === 1) return warnings[0];
	return `Encountered ${warnings.length} agent profile warning(s). See console for details.`;
}

function reportWarnings(ctx: ExtensionContext, warnings: string[], source: "scan" | "activation" | "restore") {
	if (warnings.length === 0) return;
	for (const warning of warnings) console.warn(`[session-agent-selector:${source}] ${warning}`);
	const summary = summarizeWarnings(warnings);
	if (summary) ctx.ui.notify(summary, "warning");
}

function findProfilesByName(profiles: AgentProfile[], input: string): AgentProfile[] {
	const normalized = input.trim().toLowerCase();
	return profiles.filter((profile) => profile.name.toLowerCase() === normalized);
}

function buildProviderSuggestion(profile: AgentProfile): string | undefined {
	if (!profile.model) return undefined;
	return "If you intend to use this model through a different provider or proxy, specify that provider's exact model identifier in the agent file.";
}

function buildMissingModelWarning(profile: AgentProfile): string {
	const parts = [
		`Model not found in pi's registry: ${profile.model}. Agent model values must match pi provider/model identifiers exactly.`,
	];
	const suggestion = buildProviderSuggestion(profile);
	if (suggestion) parts.push(suggestion);
	return parts.join(" ");
}

function buildCredentialWarning(profile: AgentProfile): string {
	const parts = [
		`Model ${profile.model} resolved to provider \"${profile.provider}\", but no credentials were available for that provider in this session.`,
	];
	const suggestion = buildProviderSuggestion(profile);
	if (suggestion) parts.push(suggestion);
	return parts.join(" ");
}

function getModelRef(model: { provider: string; id: string } | undefined): string | undefined {
	if (!model) return undefined;
	return `${model.provider}/${model.id}`;
}

function buildActivationSummary(profile: AgentProfile, result: ActivationResult): string {
	const lines = [`Activated agent: ${profile.name}`];
	if (result.appliedModel) lines.push(`Model: ${result.appliedModel}`);
	if (result.appliedThinking) lines.push(`Thinking: ${result.appliedThinking}`);
	if (profile.tools) {
		lines.push(`Tools: ${result.appliedTools.length > 0 ? result.appliedTools.join(", ") : "(none)"}`);
	}
	if (result.ignoredTools.length > 0) lines.push(`Ignored tools: ${result.ignoredTools.join(", ")}`);
	if (result.warnings.length > 0) lines.push(...result.warnings);
	return lines.join("\n");
}

export default function sessionAgentSelector(pi: ExtensionAPI) {
	let activeProfile: AgentProfile | undefined;
	let previousModelBeforeActivation: string | undefined;
	let agentAppliedModel: string | undefined;
	let previousThinkingBeforeActivation: ThinkingLevel | undefined;
	let agentAppliedThinking: ThinkingLevel | undefined;

	registerAgentProfileMessageRenderer(pi);

	async function refreshProfiles(ctx: ExtensionContext): Promise<AgentProfile[]> {
		const result = await discoverAgentProfiles();
		reportWarnings(ctx, result.warnings, "scan");
		return result.profiles;
	}

	async function clearActiveProfile(ctx: ExtensionContext, options?: { persist?: boolean; notify?: boolean }) {
		const clearWarnings: string[] = [];
		const currentModelRef = getModelRef(ctx.model);
		const currentThinking = pi.getThinkingLevel();

		if (agentAppliedModel && previousModelBeforeActivation && currentModelRef === agentAppliedModel) {
			const slashIndex = previousModelBeforeActivation.indexOf("/");
			if (slashIndex > 0 && slashIndex < previousModelBeforeActivation.length - 1) {
				const provider = previousModelBeforeActivation.slice(0, slashIndex);
				const modelId = previousModelBeforeActivation.slice(slashIndex + 1);
				const previousModel = ctx.modelRegistry.find(provider, modelId);
				if (previousModel) {
					const restored = await pi.setModel(previousModel);
					if (!restored) {
						clearWarnings.push(`Could not restore previous model ${previousModelBeforeActivation}: credentials unavailable.`);
					}
				} else {
					clearWarnings.push(`Could not restore previous model ${previousModelBeforeActivation}: model not found.`);
				}
			}
		}

		if (
			agentAppliedThinking !== undefined &&
			previousThinkingBeforeActivation !== undefined &&
			currentThinking === agentAppliedThinking
		) {
			pi.setThinkingLevel(previousThinkingBeforeActivation);
		}

		activeProfile = undefined;
		previousModelBeforeActivation = undefined;
		agentAppliedModel = undefined;
		previousThinkingBeforeActivation = undefined;
		agentAppliedThinking = undefined;
		updateStatus(ctx, undefined);

		if (options?.persist !== false) {
			persistState(pi, { action: "clear", timestamp: Date.now() });
		}

		if (options?.notify !== false) {
			const lines = ["Active agent cleared."];
			if (clearWarnings.length === 0) {
				lines.push("Model and thinking were restored only if they were still using the agent-applied values.");
			} else {
				lines.push(...clearWarnings);
			}
			ctx.ui.notify(lines.join("\n"), clearWarnings.length > 0 ? "warning" : "info");
		}
	}

	function showProfileMessage(content: string, details?: Record<string, unknown>) {
		pi.sendMessage({
			customType: "session-agent-profile",
			content,
			display: true,
			details,
		});
	}

	async function activateProfile(
		profile: AgentProfile,
		ctx: ExtensionContext,
		options?: { persist?: boolean; notify?: boolean; source?: "user" | "restore" },
	): Promise<ActivationResult> {
		const warnings: string[] = [];
		const result: ActivationResult = {
			appliedTools: [],
			ignoredTools: [],
			warnings,
		};

		const currentModelRef = getModelRef(ctx.model);
		const currentThinking = pi.getThinkingLevel();

		if (profile.provider && profile.modelId) {
			const model = ctx.modelRegistry.find(profile.provider, profile.modelId);
			if (!model) {
				warnings.push(buildMissingModelWarning(profile));
			} else {
				const success = await pi.setModel(model);
				if (success) {
					result.appliedModel = `${profile.provider}/${profile.modelId}`;
				} else {
					warnings.push(buildCredentialWarning(profile));
				}
			}
		} else if (profile.model) {
			warnings.push(`Ignored invalid model value: ${profile.model}`);
		}

		if (profile.thinking) {
			pi.setThinkingLevel(profile.thinking);
			result.appliedThinking = profile.thinking;
		}

		if (profile.tools) {
			const allToolNames = new Set(pi.getAllTools().map((tool) => tool.name));
			const validTools = profile.tools.filter((tool) => allToolNames.has(tool));
			const invalidTools = profile.tools.filter((tool) => !allToolNames.has(tool));
			result.appliedTools = validTools;
			result.ignoredTools = invalidTools;
			if (invalidTools.length > 0) {
				warnings.push(`Ignored unknown tools: ${invalidTools.join(", ")}`);
			}

			if (profile.tools.length === 0 || validTools.length > 0) {
				pi.setActiveTools(validTools);
			} else {
				warnings.push("No valid tools were found in the profile. Current active tools were left unchanged.");
			}
		}

		activeProfile = profile;
		previousModelBeforeActivation = currentModelRef;
		agentAppliedModel = result.appliedModel;
		previousThinkingBeforeActivation = currentThinking;
		agentAppliedThinking = result.appliedThinking;
		updateStatus(ctx, profile);

		if (options?.persist !== false) {
			persistState(pi, {
				action: "set",
				path: profile.path,
				name: profile.name,
				previousModel: previousModelBeforeActivation,
				agentAppliedModel,
				previousThinking: previousThinkingBeforeActivation,
				agentAppliedThinking,
				timestamp: Date.now(),
			});
		}

		if (options?.source === "restore") {
			reportWarnings(ctx, warnings, "restore");
		}

		if (options?.notify !== false) {
			ctx.ui.notify(buildActivationSummary(profile, result), warnings.length > 0 ? "warning" : "info");
		}

		return result;
	}

	async function restoreActiveProfileFromBranch(ctx: ExtensionContext, profiles?: AgentProfile[]) {
		const state = getLastPersistedAgentState(ctx.sessionManager.getBranch() as Array<{
			type?: string;
			customType?: string;
			data?: unknown;
		}>);
		if (!state || state.action === "clear") {
			activeProfile = undefined;
			previousModelBeforeActivation = undefined;
			agentAppliedModel = undefined;
			previousThinkingBeforeActivation = undefined;
			agentAppliedThinking = undefined;
			updateStatus(ctx, undefined);
			return;
		}

		const availableProfiles = profiles ?? (await refreshProfiles(ctx));
		const profile = state.path ? availableProfiles.find((item) => item.path === state.path) : undefined;
		if (!profile) {
			activeProfile = undefined;
			previousModelBeforeActivation = undefined;
			agentAppliedModel = undefined;
			previousThinkingBeforeActivation = undefined;
			agentAppliedThinking = undefined;
			updateStatus(ctx, undefined);
			persistState(pi, { action: "clear", timestamp: Date.now() });
			ctx.ui.notify(`Previously selected agent is no longer available: ${state.path ?? state.name ?? "unknown"}`, "warning");
			return;
		}

		const restoredActivation = await activateProfile(profile, ctx, { persist: false, notify: false, source: "restore" });
		previousModelBeforeActivation = state.previousModel;
		agentAppliedModel = state.agentAppliedModel ?? restoredActivation.appliedModel;
		previousThinkingBeforeActivation = state.previousThinking;
		agentAppliedThinking = state.agentAppliedThinking ?? restoredActivation.appliedThinking;
	}

	pi.on("session_start", async (_event, ctx) => {
		const profiles = await refreshProfiles(ctx);
		await restoreActiveProfileFromBranch(ctx, profiles);
	});

	pi.on("session_tree", async (_event, ctx) => {
		await restoreActiveProfileFromBranch(ctx);
	});

	pi.on("before_agent_start", async (event) => {
		if (!activeProfile?.body.trim()) return;

		const descriptionLine = activeProfile.description ? `Description: ${activeProfile.description}\n\n` : "";
		return {
			systemPrompt:
				`${event.systemPrompt}\n\n## Active Session Agent Profile\n\n` +
				`The following profile is active for this session. ` +
				`Follow it unless it conflicts with higher-priority runtime, safety, or tool instructions.\n\n` +
				`Profile name: ${activeProfile.name}\n` +
				descriptionLine +
				activeProfile.body,
		};
	});

	pi.registerCommand("agent", {
		description: "Select or inspect the active session agent profile",
		handler: async (args, ctx) => {
			const input = args?.trim() ?? "";
			const profiles = await refreshProfiles(ctx);

			if (!input) {
				if (profiles.length === 0) {
					ctx.ui.notify("No agent profiles found in ~/.pi/agent/agents or ~/.pi/agents", "warning");
					return;
				}

				if (!ctx.hasUI) {
					const names = profiles.map((profile) => `- ${profile.name}`).join("\n");
					showProfileMessage(`Available agent profiles:\n${names}`);
					return;
				}

				const selection = await showAgentPicker(ctx, profiles, activeProfile?.path);
				if (!selection) return;
				if (selection === CLEAR_SELECTION_VALUE) {
					await clearActiveProfile(ctx);
					return;
				}

				const selectedProfile = profiles.find((profile) => profile.path === selection);
				if (!selectedProfile) {
					ctx.ui.notify("Selected agent profile could not be resolved. Please try again.", "error");
					return;
				}

				await activateProfile(selectedProfile, ctx, { source: "user" });
				return;
			}

			if (input.toLowerCase() === "clear") {
				await clearActiveProfile(ctx);
				return;
			}

			if (input.toLowerCase() === "show") {
				if (!activeProfile) {
					ctx.ui.notify("No active agent profile.", "info");
					return;
				}

				showProfileMessage(formatProfileDetails(activeProfile), { path: activeProfile.path });
				return;
			}

			const matches = findProfilesByName(profiles, input);
			if (matches.length === 0) {
				ctx.ui.notify(`Unknown agent profile: ${input}`, "error");
				return;
			}

			if (matches.length > 1) {
				const collisionList = matches.map((profile) => `- ${profile.name} (${profile.path})`).join("\n");
				showProfileMessage(
					`Multiple agent profiles named "${input}" were found. Use /agent to select one explicitly.\n\n${collisionList}`,
				);
				return;
			}

			await activateProfile(matches[0], ctx, { source: "user" });
		},
	});
}
