// Supabase Edge Function : crée une facture PayDunya et renvoie l'URL de paiement.
// Les clés PayDunya sont lues depuis les secrets Supabase — jamais dans le frontend.
//
// Secrets à définir (voir instructions) :
//   PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN, PAYDUNYA_MODE (test|live)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { amount, description, bookingId, customer, siteUrl, meta } = await req.json();
    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);

    const mode = (Deno.env.get("PAYDUNYA_MODE") ?? "test").toLowerCase();
    const base = mode === "live"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";

    const site = siteUrl || "https://ats-webapp-two.vercel.app";
    const supaUrl = Deno.env.get("SUPABASE_URL");

    const payload = {
      invoice: {
        total_amount: Math.round(amount),
        description: description || "Réservation Africa Tourism Solutions",
      },
      store: {
        name: "Africa Tourism Solutions",
        tagline: "Tours · Transferts · DMC — Sénégal",
        website_url: site,
      },
      actions: {
        return_url: `${site}/?payment=success${bookingId ? `&booking=${bookingId}` : ""}`,
        cancel_url: `${site}/?payment=cancel`,
        callback_url: supaUrl ? `${supaUrl}/functions/v1/paydunya-ipn` : undefined,
      },
      custom_data: { bookingId: bookingId || null, kind: (meta && meta.kind) || "full", ...(meta || {}), customer: customer || {} },
    };

    const res = await fetch(`${base}/checkout-invoice/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": Deno.env.get("PAYDUNYA_MASTER_KEY") ?? "",
        "PAYDUNYA-PRIVATE-KEY": Deno.env.get("PAYDUNYA_PRIVATE_KEY") ?? "",
        "PAYDUNYA-TOKEN": Deno.env.get("PAYDUNYA_TOKEN") ?? "",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.response_code === "00") {
      // response_text = URL de la page de paiement PayDunya
      return json({ url: data.response_text, token: data.token });
    }
    return json({ error: data.response_text || "PayDunya error", raw: data }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
