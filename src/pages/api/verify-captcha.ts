export const prerender = false;

import type { APIRoute } from 'astro';

const BLOCKED_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'trashmail.com', 'dispostable.com', 'yopmail.com',
];

export const POST: APIRoute = async ({ request }) => {
  try {
    const { token, email } = await request.json();

    // Email domain check (if email provided)
    if (email) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && BLOCKED_DOMAINS.includes(domain)) {
        return new Response(JSON.stringify({ success: false, error: 'Disposable email not allowed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Turnstile verification
    if (token) {
      const formData = new FormData();
      formData.append('secret', import.meta.env.TURNSTILE_SECRET_KEY || '');
      formData.append('response', token);

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });

      const data = await verifyRes.json() as { success: boolean };

      if (!data.success) {
        return new Response(JSON.stringify({ success: false, error: 'CAPTCHA failed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('verify-captcha error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
