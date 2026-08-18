// Supabase Edge Function : confirmation de paiement appelée au RETOUR sur le site.
// Filet de sécurité si l'IPN PayDunya n'arrive pas : on re-confirme le statut
// auprès de PayDunya (source de vérité) puis on met à jour la réservation.
// Idempotent (paidTokens) : ne compte jamais un paiement deux fois.
//   supabase functions deploy confirm-payment

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token } = await req.json();
    if (!token) return json({ error: "no token" }, 400);

    const mode = (Deno.env.get("PAYDUNYA_MODE") ?? "test").toLowerCase();
    const base = mode === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";

    const conf = await fetch(`${base}/checkout-invoice/confirm/${token}`, {
      headers: {
        "PAYDUNYA-MASTER-KEY": Deno.env.get("PAYDUNYA_MASTER_KEY") ?? "",
        "PAYDUNYA-PRIVATE-KEY": Deno.env.get("PAYDUNYA_PRIVATE_KEY") ?? "",
        "PAYDUNYA-TOKEN": Deno.env.get("PAYDUNYA_TOKEN") ?? "",
      },
    });
    const data = await conf.json();
    const paid = data?.status === "completed";
    const cd = data?.custom_data || {};
    const bId = cd.bookingId || null;
    const kind = cd.kind || "full";
    if (!paid || !bId) return json({ ok: false, status: data?.status || "unknown" });

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const h = { apikey: key ?? "", Authorization: `Bearer ${key ?? ""}`, "Content-Type": "application/json" };

    const rowRes = await fetch(`${url}/rest/v1/bookings?id=eq.${bId}&select=data,status`, { headers: h });
    const rows = await rowRes.json();
    const d = (rows && rows[0] && rows[0].data) || {};
    const seen = Array.isArray(d.paidTokens) ? d.paidTokens : [];
    if (seen.includes(token)) return json({ ok: true, already: true });

    const months = d.months || 1;
    let body: Record<string, unknown>;
    if (kind === "installment") {
      const already = (d.paid || 0) + 1;
      body = { data: { ...d, paid: already, paidTokens: [...seen, token] }, status: already >= months ? "settled" : "confirmed" };
    } else if (kind === "deposit") {
      body = { data: { ...d, paidTokens: [...seen, token] }, status: "confirmed" };
    } else {
      body = { data: { ...d, paidTokens: [...seen, token] }, status: "paid" };
    }

    await fetch(`${url}/rest/v1/bookings?id=eq.${bId}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
