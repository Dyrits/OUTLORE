import { type CatalogEntry, hostedServiceLicence } from "../catalog.ts";

/**
 * Datadog: the hosted MCP server of the US1 site at `mcp.datadoghq.com/v1/mcp`, reached with a personal or service access token as `Authorization: Bearer <token>` (Datadog docs, "Set Up the Datadog MCP Server", read 2026-11-25).
 * The docs give each site its own address (US3, US5, EU1, AP1, AP2, UK1 and others), so an organization on another site cannot use this entry; that limit is in the notice.
 * No token is held, so no live `tools/list` was read: the 23 names are the tools the docs' "Datadog MCP Server Tools" page puts in the `core` toolset, which is all the server offers without a `toolsets` parameter.
 * Datadog publishes no source for the hosted server, so the licence says so.
 * Every tool whose description only searches, lists, reads, queries or aggregates is `Read`; creating or changing a notebook or a dashboard is `Write`.
 */
export const datadogEntry: CatalogEntry = {
  apps: [],
  backend: { _tag: "Http", header: "authorization", prefix: "Bearer ", url: "https://mcp.datadoghq.com/v1/mcp" },
  description:
    "Search Datadog's logs, metrics, traces, monitors, incidents and dashboards, and, after a question, create notebooks and dashboards.",
  id: "datadog",
  licence: hostedServiceLicence,
  name: "Datadog",
  notice:
    "Datadog is a service run by another company. It sees every request a thread makes with your token and returns what the token can reach, including logs and traces that may hold customers' data, which then goes to the model provider of the thread. You need a Datadog personal or service access token, which Outlore keeps in the Vault on this computer. Give it only the permissions threads need, for example read-only ones. This connector works for organizations on Datadog's US1 site (datadoghq.com) only.",
  platform: "Any",
  secretKind: "Access token",
  tools: {
    aggregate_rum_events: {
      app: null,
      class: "Read",
      summary: "Counts and averages real user monitoring events, grouped by a field",
    },
    aggregate_spans: { app: null, class: "Read", summary: "Counts and averages APM spans, grouped by a field" },
    analyze_datadog_logs: { app: null, class: "Read", summary: "Runs a SQL query that counts and aggregates logs" },
    create_datadog_notebook: { app: null, class: "Write", summary: "Creates a notebook" },
    edit_datadog_notebook: { app: null, class: "Write", summary: "Changes a notebook" },
    get_datadog_dashboard: { app: null, class: "Read", summary: "Reads one dashboard and its widgets" },
    get_datadog_incident: { app: null, class: "Read", summary: "Reads one incident" },
    get_datadog_metric: { app: null, class: "Read", summary: "Queries metric data over a time range" },
    get_datadog_metric_context: {
      app: null,
      class: "Read",
      summary: "Reads the metadata, tags and tag values of a metric",
    },
    get_datadog_notebook: { app: null, class: "Read", summary: "Reads one notebook" },
    get_datadog_trace: { app: null, class: "Read", summary: "Reads a full APM trace by its id" },
    search_datadog_dashboards: { app: null, class: "Read", summary: "Lists and searches dashboards" },
    search_datadog_entities: {
      app: null,
      class: "Read",
      summary: "Searches the service catalog for services, owners and dependencies",
    },
    search_datadog_events: {
      app: null,
      class: "Read",
      summary: "Searches events such as monitor alerts, deployments and infrastructure changes",
    },
    search_datadog_hosts: { app: null, class: "Read", summary: "Lists and searches monitored hosts" },
    search_datadog_incidents: { app: null, class: "Read", summary: "Lists and searches incidents" },
    search_datadog_logs: { app: null, class: "Read", summary: "Searches logs and returns their details" },
    search_datadog_metrics: { app: null, class: "Read", summary: "Lists and searches metrics" },
    search_datadog_monitors: { app: null, class: "Read", summary: "Lists and searches monitors and their statuses" },
    search_datadog_notebooks: { app: null, class: "Read", summary: "Lists and searches notebooks" },
    search_datadog_rum_events: { app: null, class: "Read", summary: "Searches real user monitoring events" },
    search_datadog_spans: { app: null, class: "Read", summary: "Searches APM spans" },
    upsert_datadog_dashboard: { app: null, class: "Write", summary: "Creates or changes a dashboard" },
  },
};
