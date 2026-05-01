import { runCron } from './cron.js'
import type { Env } from './types.js'

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(env))
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Manual trigger for testing
    if (url.pathname === '/run' && request.method === 'POST') {
      await runCron(env)
      return Response.json({ ok: true })
    }

    // Health check
    if (url.pathname === '/health') {
      const lastBlock = await env.STATE.get('lastProcessedBlock')
      return Response.json({ ok: true, lastProcessedBlock: lastBlock })
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
