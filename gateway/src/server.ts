import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPocketBaseClient } from './pocketbase/client.js';
import { createBrainDumpRepository } from './repositories/brainDumpRepository.js';
import { createCaptureService } from './modules/capture/captureService.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const pocketBase = createPocketBaseClient({ baseUrl: config.pocketbaseUrl });
  const brainDumpRepository = createBrainDumpRepository(pocketBase);
  const app = await buildApp({ config, services: {
    pocketBase,
    brainDumpRepository,
    captureService: createCaptureService(brainDumpRepository, { maxTextLength: config.brainDumpMaxTextLength }),
  } });

  await app.listen({ host: config.host, port: config.port });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
