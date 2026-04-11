import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { parseAgentFile } from "./parser.js";
import type { AgentProfile, DiscoverAgentProfilesResult } from "./types.js";

const MAX_AGENT_FILE_BYTES = 100 * 1024;

function normalizeExistingPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

export function getSupportedAgentDirectories(): string[] {
	const agentDir = getAgentDir();
	const candidateDirs = [join(agentDir, "agents"), join(agentDir, "..", "agents")];

	return Array.from(new Set(candidateDirs.map((dir) => normalizeExistingPath(dir)).filter((dir) => isDirectory(dir))));
}

export async function discoverAgentProfiles(): Promise<DiscoverAgentProfilesResult> {
	const uniqueFiles = new Set<string>();
	const warnings: string[] = [];

	for (const dir of getSupportedAgentDirectories()) {
		if (!existsSync(dir)) continue;

		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (!entry.name.endsWith(".md")) continue;

			const filePath = join(dir, entry.name);

			if (entry.isSymbolicLink()) {
				warnings.push(`Skipped symlinked agent profile ${filePath}: symlinks are not allowed.`);
				continue;
			}

			if (!entry.isFile()) continue;

			try {
				const stats = statSync(filePath);
				if (stats.size > MAX_AGENT_FILE_BYTES) {
					warnings.push(
						`Skipped oversized agent profile ${filePath}: ${stats.size} bytes exceeds ${MAX_AGENT_FILE_BYTES} byte limit.`,
					);
					continue;
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				warnings.push(`Skipped unreadable agent profile ${filePath}: ${message}`);
				continue;
			}

			uniqueFiles.add(normalizeExistingPath(filePath));
		}
	}

	const profiles: AgentProfile[] = [];

	for (const path of uniqueFiles) {
		const result = await parseAgentFile(path);
		warnings.push(...result.warnings);
		if (result.profile) profiles.push(result.profile);
	}

	profiles.sort((left, right) => {
		const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
		if (nameCompare !== 0) return nameCompare;
		return left.path.localeCompare(right.path, undefined, { sensitivity: "base" });
	});

	return { profiles, warnings };
}
