import { Layer } from "effect";
import { codeExecutorLayer } from "./codeExecutor.ts";
import { type ConnectorGateway, noConnectorsLayer } from "./gateway.ts";

/** The Code Mode executor and the service's connector gateway. */
export const connectorsLayer = (gateway?: Layer.Layer<ConnectorGateway>) =>
  Layer.mergeAll(codeExecutorLayer, gateway ?? noConnectorsLayer);
