// Vercel Cron llama a esta ruta una vez al día (ver vercel.json).
// Dispara un nuevo deploy; el build descarga el CSV más reciente y regenera synergies.json.
//
// Variables de entorno en Vercel (Settings → Environment Variables):
//   VERCEL_DEPLOY_HOOK_URL  URL del Deploy Hook (Settings → Git → Deploy Hooks)
//   CRON_SECRET             texto aleatorio (16+ caracteres); Vercel lo envía como Bearer
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return Response.json({ ok: false, error: 'Falta VERCEL_DEPLOY_HOOK_URL' }, { status: 500 });
  }

  const res = await fetch(hookUrl, { method: 'POST' });
  if (!res.ok) {
    return Response.json({ ok: false, error: `Deploy hook respondió ${res.status}` }, { status: 502 });
  }

  return Response.json({ ok: true, triggeredAt: new Date().toISOString() });
}
