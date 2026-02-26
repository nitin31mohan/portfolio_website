export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

export const GET: APIRoute = async () => {
  try {
    const redis = new Redis({
      url: import.meta.env.UPSTASH_REDIS_REST_URL,
      token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Get all visit keys
    const keys = await redis.keys('visit:*');
    const stats: Record<string, number> = {};

    if (keys.length > 0) {
      const values = await redis.mget<number[]>(...keys);
      keys.forEach((key, i) => {
        stats[key] = values[i] || 0;
      });
    }

    // Get QA total
    const qaTotal = await redis.get<number>('qa:total');
    if (qaTotal !== null) {
      stats['qa:total'] = qaTotal;
    }

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('dashboard-data error:', err);
    return new Response(JSON.stringify({}), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
