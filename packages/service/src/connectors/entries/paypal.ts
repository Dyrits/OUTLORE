import { type CatalogEntry, hostedOAuthEntryOf } from "../catalog.ts";

/**
 * PayPal: the official remote MCP server at `mcp.paypal.com/mcp`.
 * Live-probed on 2026-11-26: returns HTTP 401 with RFC 9728 protected-resource metadata, RFC 8414 issuer `https://mcp.paypal.com`, PKCE `S256`, and RFC 7591 dynamic client registration.
 * PayPal publishes no complete static tool list without signing in, so `tools` stays empty and every runtime-discovered tool is Unclassified and asks the owner on each call until verified against a live listing.
 */
export const paypalEntry: CatalogEntry = hostedOAuthEntryOf({
  description: "Inspect and manage PayPal invoices, orders, transactions, and disputes.",
  id: "paypal",
  name: "PayPal",
  notice:
    "PayPal is a service run by another company. You sign in on PayPal's own page in your browser, where Outlore requests the permissions PayPal advertises, and Outlore keeps the OAuth session in the Vault on this computer. PayPal sees every request a thread makes and returns payment and invoice records from your account, which goes to the model provider of the thread. Because PayPal's hosted tool list is discovered at sign-in, Outlore asks before every call unless you grant a standing permission.",
  url: "https://mcp.paypal.com/mcp",
});
