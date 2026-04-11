import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";
import type { AgentProfile, ParseAgentFileResult, ThinkingLevel } from "./types.js";

const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

function parseModelRef(model: string): { provider: string; modelId: string } | undefined {
	const slash = model.indexOf("/");
	if (slash <= 0 || slash === model.length - 1) return undefined;

	const provider = model.slice(0, slash).trim();
	const modelId = model.slice(slash + 1).trim();
	if (!provider || !modelId) return undefined;

	return { provider, modelId };
}

function normalizeThinking(value: unknown, warnings: string[], agentName: string): ThinkingLevel | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string") {
		warnings.push(`Ignored invalid thinking value in ${agentName}: expected string.`);
		return undefined;
	}

	const normalized = value.trim() as ThinkingLevel;
	if (!THINKING_LEVELS.includes(normalized)) {
		warnings.push(`Ignored invalid thinking value in ${agentName}: ${value}.`);
		return undefined;
	}

	return normalized;
}

function normalizeTools(value: unknown, warnings: string[], agentName: string): string[] | undefined {
	if (value === undefined) return undefined;

	let tools: string[] = [];

	if (typeof value === "string") {
		tools = value
			.split(",")
			.map((tool) => tool.trim())
			.filter(Boolean);
	} else if (Array.isArray(value)) {
		tools = value.filter((tool): tool is string => typeof tool === "string").map((tool) => tool.trim()).filter(Boolean);
		if (tools.length !== value.length) {
			warnings.push(`Ignored non-string tool entries in ${agentName}.`);
		}
	} else {
		warnings.push(`Ignored invalid tools value in ${agentName}: expected string or list.`);
		return undefined;
	}

	const uniqueTools = Array.from(new Set(tools));
	return uniqueTools.length > 0 ? uniqueTools : undefined;
}

export async function parseAgentFile(path: string): Promise<ParseAgentFileResult> {
	const warnings: string[] = [];
	const absolutePath = resolve(path);
	const fileName = basename(absolutePath, extname(absolutePath));

	try {
		const source = await readFile(absolutePath, "utf8");
		const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(source);
		const data = frontmatter ?? {};
		const model = typeof data.model === "string" && data.model.trim() ? data.model.trim() : undefined;
		const modelRef = model ? parseModelRef(model) : undefined;

		if (model && !modelRef) {
			warnings.push(`Ignored invalid model value in ${fileName}: ${model}. Expected provider/model.`);
		}

		const description =
			typeof data.description === "string" && data.description.trim() ? data.description.trim() : undefined;

		const profile: AgentProfile = {
			name: fileName,
			path: absolutePath,
			description,
			model,
			provider: modelRef?.provider,
			modelId: modelRef?.modelId,
			thinking: normalizeThinking(data.thinking, warnings, fileName),
			tools: normalizeTools(data.tools, warnings, fileName),
			body: body.trim(),
		};

		return { profile, warnings };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			warnings: [`Skipped invalid agent file ${absolutePath}: ${message}`],
		};
	}
}
