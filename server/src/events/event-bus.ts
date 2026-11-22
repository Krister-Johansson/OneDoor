// A named stream of events with one payload type. Payloads are plain JSON
// and carry ids, not rows (server/AGENTS.md, GraphQL): a subscriber loads
// what it needs.
export interface Topic<Payload> {
  readonly name: string;
  // Only for type inference; never set.
  readonly payload?: Payload;
}

export function defineTopic<Payload>(name: string): Topic<Payload> {
  return { name };
}

// Publishes events to every subscriber of a topic, in every server instance.
// Feature code injects this abstract class; the implementation is chosen by
// EVENT_BUS in EventsModule.
//
// Delivery is at most once: a subscriber that is not connected when an
// event is published does not get it.
export abstract class EventBus {
  // Identifies the implementation, for logs.
  abstract readonly id: string;

  // Resolves once the event is handed to the bus. Throws when the bus cannot
  // be reached; the caller decides whether that matters.
  abstract publish<Payload>(
    topic: Topic<Payload>,
    payload: Payload,
  ): Promise<void>;

  // The topic's events that pass `filter`, until the iterator's return() is
  // called. Resolves once the subscription is live, so no event published
  // after that is missed. Throws when the bus cannot subscribe.
  abstract subscribe<Payload>(
    topic: Topic<Payload>,
    filter?: (payload: Payload) => boolean,
  ): Promise<AsyncIterableIterator<Payload>>;
}
