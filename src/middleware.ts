import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Password-protect the dashboard
  if (context.url.pathname.startsWith('/dashboard')) {
    const authCookie = context.cookies.get('dashboard_auth');
    const password = import.meta.env.DASHBOARD_PASSWORD;

    // Allow access if no password is set (dev mode) or cookie matches
    if (password && authCookie?.value !== password) {
      // Check for password in query param (login flow)
      const paramPassword = context.url.searchParams.get('p');
      if (paramPassword === password) {
        // Set auth cookie and redirect clean
        const response = await next();
        response.headers.append(
          'Set-Cookie',
          `dashboard_auth=${password}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`
        );
        return response;
      }

      // Return password gate HTML
      return new Response(dashboardGateHtml(), {
        status: 401,
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  return next();
});

function dashboardGateHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Access Required</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@700;900&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0D0D12;
      color: #FAF8F5;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      width: 100%;
      max-width: 360px;
      background: rgba(250,248,245,0.03);
      border: 1px solid rgba(250,248,245,0.08);
      border-radius: 2rem;
      padding: 2.5rem;
      text-align: center;
    }
    .label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      color: rgba(250,248,245,0.3);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 900;
      letter-spacing: -0.04em;
      margin-bottom: 2rem;
      color: #FAF8F5;
    }
    input {
      width: 100%;
      background: rgba(250,248,245,0.04);
      border: 1px solid rgba(250,248,245,0.1);
      border-radius: 1rem;
      padding: 0.875rem 1.25rem;
      color: #FAF8F5;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875rem;
      outline: none;
      margin-bottom: 1rem;
      letter-spacing: 0.1em;
    }
    input:focus { border-color: rgba(212,148,60,0.5); }
    button {
      width: 100%;
      background: #D4943C;
      color: #0D0D12;
      border: none;
      border-radius: 9999px;
      padding: 0.875rem;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 0.875rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      cursor: pointer;
    }
    button:hover { background: #FAF8F5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="label">Private</div>
    <h1>Dashboard Access</h1>
    <form onsubmit="go(event)">
      <input id="pw" type="password" placeholder="Enter password" autofocus />
      <button type="submit">Enter</button>
    </form>
  </div>
  <script>
    function go(e) {
      e.preventDefault();
      const pw = document.getElementById('pw').value;
      window.location.href = '/dashboard?p=' + encodeURIComponent(pw);
    }
  </script>
</body>
</html>`;
}
