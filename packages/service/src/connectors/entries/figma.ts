import { type CatalogEntry, hostedServiceLicence, oauthSecretKind } from "../catalog.ts";

/**
 * Figma: the official remote MCP server at `mcp.figma.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://api.figma.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * Documented tool names are read from Figma's official MCP server documentation on 2026-11-26; any additional tool the hosted server lists at runtime is Unclassified and asks on every call.
 */
export const figmaEntry: CatalogEntry = {
  apps: [],
  backend: {
    _tag: "Http",
    header: "authorization",
    oauth: { clientName: "Outlore" },
    prefix: "Bearer ",
    shouldUseSession: true,
    url: "https://mcp.figma.com/mcp",
  },
  description: "Inspect Figma designs, variables, screenshots, comments, and Code Connect mappings.",
  id: "figma",
  licence: hostedServiceLicence,
  name: "Figma",
  notice:
    "Figma is a service run by another company. You sign in on Figma's own page in your browser, and Outlore keeps the OAuth session in the Vault on this computer. Figma sees every request a thread makes and returns design data, comments, and screenshots from your files, which goes to the model provider of the thread. Outlore asks before every write or unclassified tool.",
  platform: "Any",
  secretKind: oauthSecretKind,
  tools: {
    download_assets: { app: null, class: "Read", summary: "Reads exported assets and images from a Figma file" },
    export_video: { app: null, class: "Read", summary: "Exports animated frames from a Figma file as video" },
    generate_figma_design: {
      app: null,
      class: "Write",
      summary: "Creates editable Figma layouts from rendered UI context",
    },
    get_code_connect_map: {
      app: null,
      class: "Read",
      summary: "Reads Code Connect component mappings for a selection",
    },
    get_code_connect_suggestions: {
      app: null,
      class: "Read",
      summary: "Reads suggested Code Connect mappings for a selection",
    },
    get_comments: { app: null, class: "Read", summary: "Reads comment threads from a Figma design file" },
    get_context_for_code_connect: {
      app: null,
      class: "Read",
      summary: "Reads component metadata for Code Connect templates",
    },
    get_design_context: {
      app: null,
      class: "Read",
      summary: "Reads layout, hierarchy, and code context for a Figma node",
    },
    get_figjam: { app: null, class: "Read", summary: "Reads a FigJam diagram in structured XML form" },
    get_generative_plugin: { app: null, class: "Read", summary: "Reads source data for a Figma generative plugin" },
    get_libraries: { app: null, class: "Read", summary: "Lists available Figma design system libraries" },
    get_metadata: { app: null, class: "Read", summary: "Reads a lightweight structural outline of a Figma selection" },
    get_motion_context: { app: null, class: "Read", summary: "Reads keyframe animation and motion data for a node" },
    get_screenshot: { app: null, class: "Read", summary: "Captures a rendered screenshot of a Figma selection" },
    get_shader: { app: null, class: "Read", summary: "Reads source code for a Figma shader" },
    get_variable_defs: {
      app: null,
      class: "Read",
      summary: "Lists design variables and tokens used in a Figma selection",
    },
    use_figma: { app: null, class: "Write", summary: "Programmatically creates or edits layers in a Figma file" },
  },
};
