/** A thread tool's answer before it is wrapped for MCP. */
export type ToolAnswer = {
  readonly isError: boolean;
  readonly text: string;
};

/** A successful tool answer. */
export const toolText = (text: string): ToolAnswer => ({ isError: false, text });

/** A refused or failed tool answer. */
export const toolRefusal = (text: string): ToolAnswer => ({ isError: true, text });
