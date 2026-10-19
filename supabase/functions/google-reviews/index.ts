// Supabase Edge Function : renvoie les avis Google (Places API New) de la fiche ATS.
// La clé Google est lue depuis le secret GOOGLE_PLACES_API_KEY — jamais dans le frontend.
// Cache mémoire 6h pour limiter les appels à l'API.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Fiche Google Business ATS (Point E) — fiche principale.
const DEFAULT_PLACE_ID = "ChIJXwRg7DBzwQ4Rn9doWBHa8sc";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 h
const cache = new Map<string, { at: number; data: unknown }>();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) return json({ error: "Missing GOOGLE_PLACES_API_KEY" }, 500);

  let placeId = DEFAULT_PLACE_ID;
  try {
    const u = new URL(req.url);
    if (u.searchParams.get("placeId")) placeId = u.searchParams.get("placeId")!;
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (b && b.placeId) placeId = b.placeId;
    }
  } catch { /* noop */ }

  const hit = cache.get(placeId);
  if (hit && Date.now() - hit.at < TTL_MS) return json(hit.data);

  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "displayName,rating,userRatingCount,googleMapsUri,reviews",
        },
      },
    );
    if (!r.ok) {
      const txt = await r.text();
      return json({ error: "Places API error", status: r.status, detail: txt.slice(0, 400) }, 502);
    }
    const p = await r.json();
    const reviews = (p.reviews ?? []).map((rv: any) => ({
      author: rv.authorAttribution?.displayName ?? "Client Google",
      photo: rv.authorAttribution?.photoUri ?? "",
      profile: rv.authorAttribution?.uri ?? "",
      rating: rv.rating ?? 5,
      text: rv.originalText?.text ?? rv.text?.text ?? "",
      lang: rv.originalText?.languageCode ?? rv.text?.languageCode ?? "",
      when: rv.relativePublishTimeDescription ?? "",
      time: rv.publishTime ?? "",
    }));
    const data = {
      rating: p.rating ?? null,
      count: p.userRatingCount ?? null,
      total: p.userRatingCount ?? null,
      mapsUri: p.googleMapsUri ?? "",
      writeReviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`,
      name: p.displayName?.text ?? "Africa Tourism Solutions",
      reviews,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(placeId, { at: Date.now(), data });
    return json(data);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
