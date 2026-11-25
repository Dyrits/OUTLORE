import { type CatalogEntry, hostedServiceLicence } from "../catalog.ts";

/**
 * Stripe: the hosted MCP server at `mcp.stripe.com`, reached with an agent API key as `Authorization: Bearer <key>` (Stripe docs, "Stripe MCP", read 2026-11-25).
 * No key is held, so no live `tools/list` was read: the sixteen names are those of the docs' "Tools" table that day, and Stripe publishes no source for the hosted server, so the licence says so.
 * Per the docs, from 2027-01-11 the server no longer accepts full-access secret keys or restricted keys that are not agent keys, so the entry asks for an agent key.
 * `stripe_api_read` and `stripe_api_write` run any Stripe API method that reads, or that changes, so the first is `Read` and the second `Write`, and the same split holds for the rest: every tool that moves money, creates or changes an object, or sends feedback is `Write`.
 */
export const stripeEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: "authorization", prefix: "Bearer ", url: "https://mcp.stripe.com" },
  description:
    "Look up and change payments, customers, invoices and subscriptions on your Stripe account, and read Stripe's documentation.",
  id: "stripe",
  licence: hostedServiceLicence,
  name: "Stripe",
  notice:
    "Stripe is a service run by another company. It sees every request a thread makes with your key and returns what the key can reach, including customers' names, emails and payments, which then goes to the model provider of the thread. You need a Stripe agent API key, which Outlore keeps in the Vault on this computer. Create it in your Stripe Dashboard with only the permissions threads need, for example read-only ones: Outlore asks before each tool that changes something, but the key's own permissions are the stronger guard. Stripe may also ask you to confirm sensitive actions in its Dashboard.",
  platform: "Any",
  secretKind: "Agent API key",
  tools: {
    atlas_company_formation: {
      app: null,
      class: "Write",
      summary: "Prepares or resumes a Stripe Atlas company registration form",
    },
    convert_currency: { app: null, class: "Write", summary: "Converts funds between currencies in a Treasury account" },
    get_balance_summary: {
      app: null,
      class: "Read",
      summary: "Shows a summary of the Stripe balance and Treasury accounts",
    },
    get_stripe_account_info: { app: null, class: "Read", summary: "Reads the Stripe account" },
    search_stripe_documentation: { app: null, class: "Read", summary: "Searches the Stripe documentation" },
    send_money: { app: null, class: "Write", summary: "Sends money from a Treasury account to a recipient" },
    send_stripe_feedback: { app: null, class: "Write", summary: "Sends Stripe feedback on its products" },
    setup_recipient: {
      app: null,
      class: "Write",
      summary: "Sets up a recipient for sending money from a Treasury account",
    },
    stripe_analytics: {
      app: null,
      class: "Read",
      summary: "Finds metrics and reports and runs analytics queries on the account's data",
    },
    stripe_api_details: { app: null, class: "Read", summary: "Reads the parameters of one Stripe API method" },
    stripe_api_read: { app: null, class: "Read", summary: "Reads data with any Stripe API method that only reads" },
    stripe_api_search: { app: null, class: "Read", summary: "Finds Stripe API methods by keyword" },
    stripe_api_write: {
      app: null,
      class: "Write",
      summary: "Changes data with any Stripe API method that creates, updates or deletes",
    },
    stripe_directory_search: {
      app: null,
      class: "Read",
      summary: "Searches companies and service providers on the Stripe network",
    },
    stripe_implementation_planner: { app: null, class: "Read", summary: "Guides which Stripe products fit a plan" },
    transfer_money: { app: null, class: "Write", summary: "Transfers money between Stripe balances" },
  },
};
