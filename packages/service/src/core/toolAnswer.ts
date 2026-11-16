/** A thread tool's answer before it is wrapped for MCP. */
export type ToolAnswer = {
  readonly isError: boolean;
  readonly text: string;
};
