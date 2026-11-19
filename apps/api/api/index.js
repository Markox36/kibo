// Vercel serverless entrypoint. Requires `pnpm --filter @kibo/api build` first (imports dist/).
import { buildApp } from '../dist/app.js';

// Vercel always sits behind a proxy; without this, rate limiting sees one shared IP.
process.env.TRUST_PROXY ??= 'true';

let ready;

export default async function handler(req, res) {
  // Cached across warm invocations so the Mongo connection is reused.
  ready ??= buildApp()
    .then(async (app) => {
      await app.ready();
      return app;
    })
    .catch((err) => {
      ready = undefined; // retry on next request instead of caching a failed boot
      throw err;
    });
  const app = await ready;
  app.server.emit('request', req, res);
}
