// Supabase Edge Function : callback IPN PayDunya.
// PayDunya appelle cette URL après un paiement. On re-confirme le statut via
// l'API PayDunya (source de vérité), puis on passe la réservation en "paid".
// Déployer SANS vérification JWT : PayDunya n'envoie pas de token Supabase.
//   supabase functions deploy paydunya-ipn --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    let token: string | null = null;
    let bookingId: string | null = null;

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      const d = body.data || body;
      token = d?.invoice?.token || d?.token || null;
      bookingId = d?.custom_data?.bookingId || null;
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (k === "token" || k.endsWith("[token]")) token = String(v);
        if (k === "bookingId" || k.endsWith("[bookingId]")) bookingId = String(v);
      }
    }

    if (!token) return new Response("no token", { status: 200 });

    // Re-confirm with PayDunya (authoritative)
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
    const bId = bookingId || cd.bookingId || null;
    const kind = cd.kind || "full";

    if (paid && bId) {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const h = { apikey: key ?? "", Authorization: `Bearer ${key ?? ""}`, "Content-Type": "application/json" };

      // Read current booking (for idempotency + counter)
      const rowRes = await fetch(`${url}/rest/v1/bookings?id=eq.${bId}&select=data,status`, { headers: h });
      const rows = await rowRes.json();
      const d = (rows && rows[0] && rows[0].data) || {};
      const seen = Array.isArray(d.paidTokens) ? d.paidTokens : [];

      // Idempotency: never apply the same PayDunya invoice twice
      if (seen.includes(token)) return new Response("already processed", { status: 200 });

      const months = d.months || 1;
      let body: Record<string, unknown>;
      if (kind === "installment") {
        const already = (d.paid || 0) + 1;
        const done = already >= months;
        body = { data: { ...d, paid: already, paidTokens: [...seen, token] }, status: done ? "settled" : "confirmed" };
      } else if (kind === "deposit") {
        body = { data: { ...d, paidTokens: [...seen, token] }, status: "confirmed" }; // deposit received, instalments remaining
      } else {
        body = { data: { ...d, paidTokens: [...seen, token] }, status: "paid" }; // full payment
      }

      await fetch(`${url}/rest/v1/bookings?id=eq.${bId}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
    }

    // Always 200 so PayDunya doesn't keep retrying
    return new Response("ok", { status: 200 });
  } catch (_e) {
    return new Response("ok", { status: 200 });
  }
});
