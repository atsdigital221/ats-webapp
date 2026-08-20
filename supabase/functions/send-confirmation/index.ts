// Supabase Edge Function : envoie au CLIENT un email de confirmation (via Resend).
// Secret requis :  RESEND_API_KEY   (compte resend.com, domaine vérifié)
// Optionnel     :  MAIL_FROM        (défaut: "Africa Tourism Solutions <noreply@africatourismsolutions.com>")
// Déploiement   :  supabase functions deploy send-confirmation

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
    const { to, name, kind, summary } = await req.json();
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "invalid recipient" }, 400);

    const kindLabel = kind === "flight" ? "flight request" : kind === "itinerary" ? "custom itinerary request" : "request";
    const rows = Array.isArray(summary)
      ? summary.map(([k, v]: [string, string]) => `<tr><td style="padding:7px 4px;color:#6B7A72;font-size:13px;width:38%">${k}</td><td style="padding:7px 4px;font-weight:600;font-size:13px">${v}</td></tr>`).join("")
      : "";

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2E1B">
      <div style="background:#009245;border-radius:14px 14px 0 0;padding:22px 26px">
        <div style="color:#fff;font-size:19px;font-weight:800">Africa Tourism Solutions</div>
        <div style="color:#F8D815;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px">Request received</div>
      </div>
      <div style="border:1px solid #E3E9E5;border-top:none;border-radius:0 0 14px 14px;padding:24px 26px">
        <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Hello ${name || "traveler"},</p>
        <p style="font-size:14.5px;line-height:1.65;margin:0 0 16px">
          Thank you — your <strong>${kindLabel}</strong> has been received. An ATS advisor is reviewing it
          and will get back to you shortly with availability and the best options.
        </p>
        ${rows ? `<table style="width:100%;border-collapse:collapse;background:#F4F9F6;border-radius:10px">${rows}</table>` : ""}
        <p style="font-size:13px;line-height:1.6;color:#6B7A72;margin:18px 0 0">
          Need to add something? Just reply to this email or reach us on WhatsApp at +221 77 480 78 78.
        </p>
        <p style="font-size:12px;color:#9AA6A0;margin:18px 0 0">
          Africa Tourism Solutions · Immeuble SICAP, Point E, Lot 8 · Dakar, Senegal<br>
          infos@africatourismsolutions.com · africatourismsolutions.com
        </p>
      </div>
    </div>`;

    const from = Deno.env.get("MAIL_FROM") ?? "Africa Tourism Solutions <noreply@africatourismsolutions.com>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") ?? ""}` },
      body: JSON.stringify({
        from, to: [to],
        reply_to: "adiouf@africatourismsolutions.com",
        subject: "Your request has been received — Africa Tourism Solutions",
        html,
      }),
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data?.message || "send failed", raw: data }, 400);
    return json({ ok: true, id: data?.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
