// Supabase Edge Function : emet une FACTURE (ATS Logistics SARL) apres paiement valide.
// Lue/declenchee serveur-a-serveur par confirm-payment et paydunya-ipn.
// Numerotation serie WEB (FAC/ANNEE/Wxxxx) via RPC next_invoice_no — ne croise jamais la compta.
// Secrets requis : RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Optionnel : MAIL_FROM.
// Deployer :  supabase functions deploy send-invoice --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Boites agence en copie (CC) de chaque facture.
const AGENCY_CC = [
  "logistics@africatourismsolutions.com",
  "travel2@africatourismsolutions.com",
  "k.mboup@africatourismsolutions.com",
  "chaker@africatourismsolutions.com",
  "adiouf@africatourismsolutions.com",
];
const LOGO = "https://vnhupxlvexlkgxhntdrs.supabase.co/storage/v1/object/public/tour-photos/site/logo.png";
const cfa = (n: number) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " CFA";
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // Garde: appel serveur-a-serveur uniquement (service role).
  const auth = req.headers.get("authorization") || "";
  if (!key || !auth.includes(key)) return json({ error: "unauthorized" }, 401);

  try {
    const { bookingId } = await req.json();
    if (!bookingId) return json({ error: "no bookingId" }, 400);
    const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

    const rowRes = await fetch(`${url}/rest/v1/bookings?id=eq.${bookingId}&select=data,status`, { headers: h });
    const rows = await rowRes.json();
    const d = (rows && rows[0] && rows[0].data) || null;
    if (!d) return json({ error: "booking not found" }, 404);
    if (d.invoiceNo) return json({ ok: true, already: true, invoiceNo: d.invoiceNo });

    const to = d.contact?.email || "";
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "invalid client email" }, 400);

    // ----- Montants -----
    const pax = (Number(d.adults) || 0) + (Number(d.children) || 0);
    const addons = (Array.isArray(d.addons) ? d.addons : []).filter((a: any) => a && Number(a.amount) > 0);
    const extrasHT = addons.reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
    const totalTTC = Number(d.total) || 0;
    const htTotal = Math.round(totalTTC / 1.18);
    const tva = totalTTC - htTotal;
    const mainHT = Math.max(0, htTotal - extrasHT);

    // ----- Lignes -----
    const tourName = d.tour?.name || "Prestation touristique";
    const dte = d.dateFrom || d.date || "";
    const sub1: string[] = [];
    if (dte) sub1.push(String(dte));
    if (pax) sub1.push(pax + " voyageur(s)");
    if (Array.isArray(d.vehicles) && d.vehicles.length) sub1.push("transport inclus");
    const lines: Array<{ desc: string; sub: string; qty: number; price: number; montant: number }> = [
      { desc: tourName, sub: sub1.join(" · "), qty: 1, price: mainHT, montant: mainHT },
    ];
    for (const a of addons) {
      const q = a.per === "person" && pax ? pax : 1;
      lines.push({ desc: a.name || "Option", sub: "", qty: q, price: Math.round(Number(a.amount) / q), montant: Number(a.amount) });
    }

    // ----- Numero de facture (serie WEB) -----
    const year = new Date().getFullYear();
    const rpc = await fetch(`${url}/rest/v1/rpc/next_invoice_no`, { method: "POST", headers: h, body: JSON.stringify({ p_series: `W-${year}` }) });
    const no = await rpc.json();
    if (typeof no !== "number") return json({ error: "counter failed", raw: no }, 500);
    const invNo = `FAC/${year}/W${String(no).padStart(4, "0")}`;

    const today = new Date().toLocaleDateString("fr-FR");
    const source = d.ref || String(bookingId).slice(0, 8);
    const methodLabel = d.payMethod === "stripe" ? "Carte bancaire (Stripe)" : d.payMethod === "paydunya" ? "PayDunya (Wave / Orange Money / carte)" : "Paiement en ligne";
    const paidAmt = Number(d.paidAmount ?? totalTTC);
    const fullyPaid = paidAmt >= totalTTC - 1;
    const paidNote = fullyPaid ? "Payée intégralement" : `Acompte reçu : ${cfa(paidAmt)} — reste : ${cfa(totalTTC - paidAmt)}`;

    const rowsHtml = lines.map((l) => `
      <tr>
        <td style="padding:12px 4px;border-bottom:1px solid #EDEDED;vertical-align:top">
          <div style="font-weight:600;color:#1A1A1A">${esc(l.desc)}</div>
          ${l.sub ? `<div style="font-size:12px;color:#6B7A72;margin-top:3px">${esc(l.sub)}</div>` : ""}
        </td>
        <td style="padding:12px 4px;border-bottom:1px solid #EDEDED;text-align:right;white-space:nowrap">${l.qty.toLocaleString("fr-FR")},00 Unité(s)</td>
        <td style="padding:12px 4px;border-bottom:1px solid #EDEDED;text-align:right;white-space:nowrap">${l.price.toLocaleString("fr-FR").replace(/[  ]/g, " ")},00</td>
        <td style="padding:12px 4px;border-bottom:1px solid #EDEDED;text-align:right;white-space:nowrap;font-weight:600">${cfa(l.montant)}</td>
      </tr>`).join("");

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#1A1A1A;padding:8px">
      <table style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:top"><img src="${LOGO}" alt="ATS Logistics" style="height:64px"></td>
        <td style="vertical-align:top;text-align:right;font-size:13px;line-height:1.55;color:#1A1A1A">
          <strong>ATS Logistics SARL</strong><br>Hann Maristes<br>2 Villa 094<br>Dakar<br>Senegal<br>www.logistics-ats.com
        </td>
      </tr></table>

      <div style="margin-top:22px;font-size:14px;color:#1A1A1A">${esc(d.contact?.name || to)}</div>

      <div style="margin-top:14px;display:flex;align-items:baseline;gap:12px">
        <h1 style="font-size:26px;font-weight:800;margin:0;color:#1A1A1A">Facture ${invNo}</h1>
        <span style="background:#009245;color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:4px 11px">Payée</span>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:13px">
        <tr>
          <td style="color:#009245;font-weight:700;padding-bottom:2px">Date de facturation</td>
          <td style="color:#009245;font-weight:700;padding-bottom:2px">Date d'échéance</td>
          <td style="color:#009245;font-weight:700;padding-bottom:2px">Source</td>
        </tr>
        <tr>
          <td>${today}</td><td>${today}</td><td>${esc(source)}</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
        <thead><tr style="border-bottom:2px solid #009245">
          <th style="text-align:left;padding:8px 4px;color:#6B7A72;font-weight:700">DESCRIPTION</th>
          <th style="text-align:right;padding:8px 4px;color:#6B7A72;font-weight:700">QUANTITÉ</th>
          <th style="text-align:right;padding:8px 4px;color:#6B7A72;font-weight:700">PRIX</th>
          <th style="text-align:right;padding:8px 4px;color:#6B7A72;font-weight:700">MONTANT</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:13.5px">
        <tr><td></td><td style="width:260px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:7px 0;color:#1A1A1A">Montant hors taxes</td><td style="padding:7px 0;text-align:right;white-space:nowrap">${cfa(htTotal)}</td></tr>
            <tr style="border-top:1px solid #EDEDED"><td style="padding:7px 0;color:#1A1A1A">T.V.A. 18% sur ${cfa(htTotal)}</td><td style="padding:7px 0;text-align:right;white-space:nowrap">${cfa(tva)}</td></tr>
            <tr style="border-top:2px solid #009245"><td style="padding:9px 0;font-weight:800">Total</td><td style="padding:9px 0;text-align:right;white-space:nowrap;font-weight:800">${cfa(totalTTC)}</td></tr>
          </table>
        </td></tr>
      </table>

      <div style="margin-top:18px;background:#F4F9F6;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.6">
        <strong>Règlement reçu</strong> — ${paidNote}.<br>
        Mode de paiement : ${methodLabel}. Communication : <strong>${invNo}</strong>.
      </div>

      <div style="margin-top:14px;font-size:12px;color:#6B7A72;line-height:1.6">
        BANK : BANK OF AFRICA · IBAN : SN08 SN10 0010 1200 3875 1300 0838 · Swift : AFRISNDAXXX<br>
        Chèque ou virement au nom de ATS LOGISTICS SARL.
      </div>

      <div style="margin-top:20px;border-top:1px solid #E3E9E5;padding-top:12px;font-size:12px;color:#6B7A72;line-height:1.6">
        N.I.N.E.A : 009520885 &nbsp; RCCM : SN.DKR.2022.B.22348<br>
        +221 33 825 12 79 · logistics@africatourismsolutions.com · https://logistics-ats.com/
      </div>
    </div>`;

    const from = Deno.env.get("MAIL_FROM_INVOICE") ?? "ATS Logistics SARL <noreply@africatourismsolutions.com>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") ?? ""}` },
      body: JSON.stringify({
        from, to: [to], cc: AGENCY_CC,
        reply_to: "logistics@africatourismsolutions.com",
        subject: `Votre facture ${invNo} — ATS Logistics SARL`,
        html,
      }),
    });
    const sent = await res.json();
    if (!res.ok) return json({ error: sent?.message || "send failed", raw: sent }, 400);

    // Marque la reservation (idempotence) + stocke le numero.
    await fetch(`${url}/rest/v1/bookings?id=eq.${bookingId}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ data: { ...d, invoiceNo: invNo, invoiceDate: new Date().toISOString() } }),
    });

    return json({ ok: true, invoiceNo: invNo, id: sent?.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
