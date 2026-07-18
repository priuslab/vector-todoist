import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPocketBaseClient } from './pocketbase/client.js';
import { createBrainDumpRepository } from './repositories/brainDumpRepository.js';
import { createCaptureService } from './modules/capture/captureService.js';
import { createAnalysisSessionRepository, createAnalysisService } from './modules/ai/analyzeBrainDump.js';
import { createGeminiClient } from './modules/ai/geminiClient.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const pocketBase = createPocketBaseClient({ baseUrl: config.pocketbaseUrl });
  const brainDumpRepository = createBrainDumpRepository(pocketBase);
  const app = await buildApp({ config, services: {
    pocketBase,
    brainDumpRepository,
    captureService: createCaptureService(brainDumpRepository, { maxTextLength: config.brainDumpMaxTextLength }),
    analysisSessionRepository: createAnalysisSessionRepository(pocketBase),
    aiClient: createGeminiClient({ apiKey: config.geminiApiKey, model: config.geminiModel, timeoutMs: config.aiTimeoutMs }),
  } });

  await app.listen({ host: config.host, port: config.port });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
