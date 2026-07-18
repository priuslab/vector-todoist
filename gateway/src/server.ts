import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config, services: {} });

  await app.listen({ host: config.host, port: config.port });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
