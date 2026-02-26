export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slug } = await request.json();

    if (!slug || typeof slug !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid slug' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const redis = new Redis({
      url: import.meta.env.UPSTASH_REDIS_REST_URL,
      token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
    });

    await redis.incr(`visit:${slug}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('log-visit error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
