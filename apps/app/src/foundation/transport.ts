import type { OpenTransport } from "@outlore/controller";

export type { OpenTransport, Transport, TransportHandlers } from "@outlore/controller";

/** A WebSocket to `endpoint`: the desktop window's way to its local service. */
export const socketTransport =
  (endpoint: string): OpenTransport =>
  (handlers) => {
    const socket = new WebSocket(endpoint);
    socket.onopen = () => handlers.onOpen();
    socket.onerror = () => handlers.onError();
    socket.onmessage = (event) => handlers.onText(event.data);
    socket.onclose = (event) => handlers.onClose(event.code, event.reason);
    return {
      close: () => socket.close(),
      get isOpen() {
        return socket.readyState === WebSocket.OPEN;
      },
      send: (text) => socket.send(text),
    };
  };
