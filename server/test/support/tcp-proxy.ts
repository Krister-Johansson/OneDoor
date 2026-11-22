import { type AddressInfo, connect, createServer, type Socket } from 'node:net';

export interface TcpProxy {
  host: string;
  port: number;
  // Stops listening and drops every connection, so clients that reconnect
  // are refused. Safe to call more than once.
  cut(): void;
}

// A TCP forwarder on 127.0.0.1 between the app and a container. Stopping a
// container is not enough to take a service away: Docker Desktop can still
// accept a connection on the freed host port and route it to a container
// that another test file started since, and clients such as ioredis
// reconnect on their own. Cut the proxy first. Its port belongs to the test
// process, so Docker routes nothing through it.
export async function startTcpProxy(target: {
  host: string;
  port: number;
}): Promise<TcpProxy> {
  const sockets = new Set<Socket>();
  let isCut = false;

  const server = createServer((client) => {
    if (isCut) {
      client.destroy();
      return;
    }
    const upstream = connect(target.port, target.host);
    sockets.add(client);
    sockets.add(upstream);
    const drop = () => {
      client.destroy();
      upstream.destroy();
      sockets.delete(client);
      sockets.delete(upstream);
    };
    client.on('error', drop).on('close', drop);
    upstream.on('error', drop).on('close', drop);
    client.pipe(upstream).pipe(client);
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );

  return {
    host: '127.0.0.1',
    port: (server.address() as AddressInfo).port,
    cut() {
      if (isCut) return;
      isCut = true;
      server.close();
      for (const socket of sockets) socket.destroy();
      sockets.clear();
    },
  };
}
