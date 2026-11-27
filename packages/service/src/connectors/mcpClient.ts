// How the host introduces itself to a remote MCP server, shared by the OAuth sign-in probe and the Streamable-HTTP adapter so the two never disagree.

/** The version of MCP the host speaks to remote servers, told to the server with every request, as Streamable HTTP asks. */
export const protocolVersion = "2025-06-18";

/** Client identity sent during MCP Streamable HTTP session initialization and the OAuth sign-in probe. */
export const clientInfo = { name: "outlore", version: "0.2.7" } as const;
