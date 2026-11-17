/** The server name Claude Code prefixes to tool names (`mcp__outlore__…`). */
export const toolServerName = "outlore";
/** A tool's qualified name in Claude Code. */
export const qualifiedToolNameOf = (server: string, tool: string) => `mcp__${server}__${tool}`;
/** The tool name Claude Code's `--permission-prompt-tool` takes. */
export const promptToolName = qualifiedToolNameOf(toolServerName, "answer_prompt");
/** The approval tool's name as Claude Code lists it. */
export const approvalToolName = qualifiedToolNameOf(toolServerName, "request_approval");
