import { defineTopic } from '../../../events/event-bus.js';

// The state of a connection's upstream client in this server process.
// OFF: the connection should have no client (disabled, not READY, or an
// auth type without a client yet). FAILED: the last connect failed; it
// stays FAILED until the next change to the connection or a restart.
export const ConnectionStatus = {
  OFF: 'OFF',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  FAILED: 'FAILED',
} as const;
export type ConnectionStatus =
  (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

// Published on the EventBus when a connection's status changes. It carries
// ids only; subscribers load the connection.
export interface ConnectionStatusChanged {
  connectionId: string;
  ownerId: string;
}

export const CONNECTION_STATUS_CHANGED = defineTopic<ConnectionStatusChanged>(
  'connection-status-changed',
);
