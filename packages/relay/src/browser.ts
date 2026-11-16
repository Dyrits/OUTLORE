// What a browser needs from the relay package: the client's connection and the close codes, with nothing that needs
// Node (no `ws`, no server). The app imports this entry, never the package's main one.
export { type ClientConnection, ConnectFailure, connectClient } from "./client.ts";
export { closeCodes, readClosingFrame } from "./roomCore.ts";
