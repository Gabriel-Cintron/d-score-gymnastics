import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

/** A real origin outage exercises the worker without WebKit's broken setOffline navigation. */
export async function staticReleaseServer() {
  const root = resolve(import.meta.dirname, '../dist');
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
  };
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const path = resolve(
        root,
        `.${decodeURIComponent(url.pathname)}${url.pathname.endsWith('/') ? 'index.html' : ''}`,
      );
      if (relative(root, path).startsWith('..')) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(path);
      response.writeHead(200, {
        'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      response.end(body);
    })().catch(() => response.writeHead(404).end());
  });
  const listen = (port: number) =>
    new Promise<void>((resolve, reject) => {
      const error = (cause: Error) => reject(cause);
      server.once('error', error);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', error);
        resolve();
      });
    });
  const stop = () =>
    new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  await listen(0);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Test server unavailable');
  return {
    url: `http://127.0.0.1:${address.port}/app/`,
    stop,
    restart: () => listen(address.port),
  };
}
