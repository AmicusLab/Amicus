interface TestServer {
  close(): void;
}

let serverInstance: TestServer | null = null;

export async function startTestServer(port = 3001): Promise<TestServer> {
  if (serverInstance) {
    return serverInstance;
  }

  const { serve } = await import('@hono/node-server');
  const { createApp, setupWebSocket } = await import('../src/server.js');
  const { setupEventBroadcasting } = await import('../src/ws/events.js');
  
  const app = createApp();
  const { injectWebSocket } = setupWebSocket(app);
  setupEventBroadcasting();

  serverInstance = serve({ fetch: app.fetch, port }) as TestServer;
  injectWebSocket(serverInstance);

  await waitForServer(port);
  return serverInstance;
}

export async function stopTestServer(): Promise<void> {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

async function waitForServer(port: number, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Server did not start on port ${port}`);
}

export function getTestURL(path = '', port = 3001): string {
  return `http://localhost:${port}${path}`;
}
