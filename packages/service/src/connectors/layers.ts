import { Layer } from "effect";
import { connectorCallsLayer } from "./calls.ts";
import { codeExecutorLayer } from "./codeExecutor.ts";

/** What the connectors share before any thread runs: the Code Mode executor and the registry of calls underway. */
export const connectorsLayer = Layer.mergeAll(codeExecutorLayer, connectorCallsLayer);
