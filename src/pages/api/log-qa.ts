export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { question, matched, score } = body;

    const redis = new Redis({
      url: import.meta.env.UPSTASH_REDIS_REST_URL,
      token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Increment total interactions
    await redis.incr('qa:total');

    // Log recent query (capped list of last 50)
    const entry = JSON.stringify({
      question,
      matched,
      score: Math.round((score || 0) * 100) / 100,
      ts: Date.now(),
    });
    await redis.lpush('qa:recent', entry);
    await redis.ltrim('qa:recent', 0, 49);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('log-qa error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
