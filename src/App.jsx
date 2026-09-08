import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import landTopo from "world-atlas/land-110m.json";
import { supabase } from "./lib/supabase";

const LAND = feature(landTopo, landTopo.objects.land);
import {
  Landmark, PawPrint, Leaf, TreePalm, Mountain, Utensils, Palette, Route, Bird, Music,
  Compass, Map as MapIcon, Car, Plane, Bus, Clock, Users, Luggage, Fuel, Settings2, MapPin,
  Calendar, Check, X, Star, MessageCircle, Bot, ChevronLeft, ChevronRight, ChevronDown, Heart,
  Menu, Search, Shield, ArrowRight, Package, Globe, Sparkles, Hotel, UserRound, Gift, Trophy,
  Mic, Dumbbell, Languages, CircleCheck, Building2, Ship, Waves,
  CalendarCheck, Newspaper, Video, ConciergeBell, PenTool, Info, Play,
} from "lucide-react";

// Category icon for a tour / booking record (replaces per-item emojis)
const TAG_ICON = { Heritage: Landmark, Safari: PawPrint, Nature: Leaf, Beach: TreePalm, Adventure: Mountain, Gastronomy: Utensils, Culture: Palette, Circuit: Route, Wildlife: Bird, Nightlife: Music };
const POLE_ICON = { Transfer: Car, "Car rental": Car, "ATS Logistics": Car, "Trip Builder": MapIcon, MICE: Mic };
const catIcon = (tour) => (tour?.tag && TAG_ICON[tour.tag]) || (tour?.pole && POLE_ICON[tour.pole]) || Compass;
function CatIcon({ tour, size = 28, color, strokeWidth = 1.7 }) { const I = catIcon(tour); return <I size={size} color={color} strokeWidth={strokeWidth} />; }
function Stars({ size = 14, n = 5 }) { return <span style={{ display: "inline-flex", gap: 1, color: "#E6B800", verticalAlign: "middle" }}>{Array.from({ length: n }).map((_, i) => <Star key={i} size={size} fill="#E6B800" strokeWidth={0} />)}</span>; }

// ============================================================
// AFRICA TOURISM SOLUTIONS — Platform Preview v5 (full programs, one-line vehicle selectors, ATS Logistics quick-book)
// Every button works: pages, booking flow, trip builder, portals,
// flights/events/corporate/agent forms, About Us, sign-in, AI chat.
// Content sources: ATS Senegal Operations Manual v15 +
// africatourismsolutions.com (team, prices, Ma Tontine Voyage).
// Demo only — no real payments. Prices from the live site where
// published; otherwise sample rates.
// ============================================================

// Charte graphique ATS: primary #009245, secondary #F8D815, white supports,
// Century Gothic (web substitute: Poppins), dotted-map brand motif.
const T = {
  ink: "#0B2E1B", paper: "#FFFFFF", paperDark: "#EAF4EC",
  gold: "#F8D815", indigo: "#006B33", laterite: "#006B33",
  green: "#009245", line: "rgba(11,46,27,0.14)",
};
const XOF_USD = 590;       // 1 USD ≈ 590 XOF
const XOF_EUR = 655.957;   // fixed CFA peg
// Active display currency — reassigned by the app on each render from state.
let ACTIVE_CUR = "XOF";
const setActiveCurrency = (c) => { ACTIVE_CUR = c || "XOF"; };
// Corporate preferential discount (%) for the signed-in corporate member — set by the app.
let CORP_DISCOUNT = 0;
const setCorpDiscount = (n) => { CORP_DISCOUNT = Number(n) || 0; };
// True when the signed-in member is an ACTIVE corporate account → checkout uses
// "Book now, pay later" (invoiced) instead of upfront payment.
let IS_CORPORATE = false;
const setIsCorporate = (v) => { IS_CORPORATE = !!v; };
const nf = (loc) => new Intl.NumberFormat(loc);
// All prices are stored in XOF; fmtXOF renders them in the active currency.
const fmtXOF = (n) => {
  const v = Math.round(n || 0);
  if (ACTIVE_CUR === "USD") return "$" + nf("en-US").format(Math.round(v / XOF_USD));
  if (ACTIVE_CUR === "EUR") return "€" + nf("fr-FR").format(Math.round(v / XOF_EUR));
  return nf("fr-FR").format(v) + " XOF";
};
// Secondary international USD reference next to a main price. Hidden when USD is the active currency (would be redundant).
const fmtUSD = (n) => ACTIVE_CUR === "USD" ? "" : "≈ $" + Math.round((n || 0) / XOF_USD);

// ---- Ma Tontine Voyage : flexible-instalment state for a deposit booking ----
// Model: paidAmount = cumulative XOF paid (incl. deposit); payCount = number of
// payments made incl. the deposit. `months` = number of instalments planned at
// booking (deposit excluded). Legacy records (paid/months only) are supported.
function tontineState(b) {
  const total = Number(b.total) || 0;
  const deposit = Number(b.deposit) || 0;
  const months = Math.max(1, Number(b.months) || 1);
  const legacyPer = (total - deposit) / months;
  const paidAmount = b.paidAmount != null
    ? Number(b.paidAmount)
    : deposit + legacyPer * (Number(b.paid) || 0);
  const payCount = b.payCount != null
    ? Number(b.payCount)
    : 1 + (Number(b.paid) || 0);
  const plannedTotal = months + 1;              // deposit + planned instalments
  const remaining = Math.max(0, Math.round(total - paidAmount));
  const settled = b._status === "settled" || remaining <= 1;
  const pct = total ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0;
  // instalments still planned (excludes payments already made)
  const leftPlanned = Math.max(1, plannedTotal - payCount);
  const minNext = Math.min(remaining, Math.max(1, Math.ceil(remaining / leftPlanned)));
  return { total, deposit, months, paidAmount, payCount, plannedTotal, remaining, settled, pct, minNext };
}

// ---------------- DATA ----------------
// ---- DATA generated from ATS Senegal Operations Manual v15 (price & rate tables) ----
// Child rate ages 3–12 · under 3 free. Pricing tier by number of paying travelers.
const TOURS = [{"id": "goree", "pole": "Dakar", "name": "Goree Island — Memory & Heritage", "dur": "Half day", "tag": "Heritage", "emoji": "🏛️", "zone": "dakar", "desc": "Ferry crossing to the UNESCO island: House of Slaves, colonial lanes, artists' quarter. Senegal's #1 site.", "quote": false, "grid": {"p12": {"a": 25000, "c": 17000}, "p34": {"a": 20000, "c": 15000}, "grp": {"a": 17000, "c": 10000}}, "sub": "Standard departure from client hotel · Dakar port ferry terminal · sea crossing 3.5 km / ~25 min · total 3h30–4h", "steps": ["Pick-up at hotel, transfer to Port Autonome ferry terminal (Liaison Maritime Dakar-Gorée)  ·  5–10 km / 20–30 min", "Check-in and boarding (tickets pre-purchased by ATS; verify current timetable weekly)", "Ferry crossing to Goree  ·  3.5 km / 25 min", "Guided walk: harbour square → House of Slaves & Door of No Return (interior visit)| Colonial quarter walk: Saint-Charles church |Sand painting demonstration | Artists' village and baobab square  |Guns of Navarone  ·  90 min", "Return ferry  ·  25 min", "Transfer back to hotel — end of service  ·  20–30 min"], "addons": [{"name": "Seafront lunch on Goree (menu, per person)", "price": 12000, "per": "person"}, {"name": "Goree museums entry (IFAN Historical / Fort d’Estrées)", "price": 3000, "per": "booking"}, {"name": "Extended night stay", "price": null, "per": "booking"}]}, {"id": "city", "pole": "Dakar", "name": "Dakar City Tour", "dur": "Half Day", "tag": "Culture", "emoji": "🌆", "zone": "dakar", "desc": "Plateau, Medina, Soumbédioune and the corniche in a private vehicle — Dakar decoded in an afternoon.", "quote": false, "grid": {"p12": {"a": 65000, "c": 30000}, "p34": {"a": 30000, "c": 15000}, "grp": {"a": 20000, "c": 10000}}, "sub": "Departure 09:00 or 14:30 · private vehicle · ~30 km urban loop · 3h30–4h", "steps": ["Pick-up; Place de l'Indépendance and colonial administrative quarter (drive + short walk)  ·  3 km / 30 min", "Cathedrale church  ·  15 min", "Soumbedioune fishing beach and craft market  ·  30 min", "Corniche Ouest: Mosque of the Divinity photo stop  ·  45 min", "African Renaissance Monument outdoor  ·  45 min", "Corniche viewpoints → drop-off at hotel or restaurant  ·  5 km / 30 min"], "addons": [{"name": "Craft-market shopping assistant (negotiation support)", "price": 10000, "per": "booking"}, {"name": "Lunch at a Senegalese restaurant (reservation + menu)", "price": 10000, "per": "booking"}, {"name": "Iconic ‘car rapide’ rental for the tour (per vehicle)", "price": 35000, "per": "booking"}, {"name": "Extension: Renaissance Monument exterior photo stop", "price": 6000, "per": "booking"}]}, {"id": "monument", "pole": "Dakar", "name": "African Renaissance Monument", "dur": "2–3 h visit", "tag": "Heritage", "emoji": "🗿", "zone": "dakar", "desc": "Africa's tallest statue at Ouakam — a short, high-impact visit with panoramic city views.", "quote": false, "grid": {"p12": {"a": 10000, "c": 6000}, "p34": {"a": 8000, "c": 5000}, "grp": {"a": 7000, "c": 4000}}, "sub": "Departure 09:00 or 15:30 · Ouakam, 10 km / 25 min from Plateau hotels · sold separately or combined with the Museum of Black Civilizations", "steps": ["Pick-up; drive to Ouakam  ·  10 km / 25 min", "Exterior approach and history briefing at the foot of the 52 m monument  ·  20 min", "Inside visit of the monument, Panoramic view of Ouakam  ·  45 min"], "addons": [{"name": "Combine with the Museum of Black Civilisations (combined half-day rate)", "price": 5000, "per": "booking"}, {"name": "Ouakam fishing village", "price": null, "per": "booking"}]}, {"id": "museum", "pole": "Dakar", "name": "Museum of Black Civilizations", "dur": "2–3 h visit", "tag": "Heritage", "emoji": "🖼️", "zone": "dakar", "desc": "The landmark Museum of Black Civilizations on the Plateau (closed Mondays).", "quote": true, "grid": {"p12": {"a": null, "c": 5000}, "p34": {"a": null, "c": 4000}, "grp": {"a": null, "c": 3000}}, "sub": "Departure 09:30 or 14:30 · Plateau · closed Mondays (verify) · sold separately or combined with the Renaissance Monument", "steps": ["Pick-up; drive to the museum (Plateau)  ·  3–10 km / 15–25 min", "Curated guided route : origins of humankind, African civilizations, contemporary works.  ·  90 min"], "addons": [{"name": "Combine with the Renaissance Monument (combined half-day rate)", "price": 6000, "per": "booking"}, {"name": "IFAN Museum extension (+1 h)", "price": 5000, "per": "booking"}]}, {"id": "monmus", "pole": "Dakar", "name": "Combined: Monument + Museum of Black Civilizations", "dur": "Half day", "tag": "Heritage", "emoji": "🗿", "zone": "dakar", "desc": "The Monument and the Museum of Black Civilizations combined at one rate in a single half day.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Departure 09:00 · ~25 km total · 4 h · the combined option of Monument + Museum at one rate", "steps": ["Renaissance Monument program: visit and panoramic deck  ·  10 km / 100 min on site", "Drive Ouakam → Plateau  ·  12 km / 30 min", "Museum of Black Civilisations  ·  90 min", "Return transfer — end of service  ·  15–25 min"], "addons": [{"name": "IFAN Museum extension (+1 h)", "price": 5000, "per": "booking"}, {"name": "Lunch downtown after the museum", "price": 12000, "per": "booking"}]}, {"id": "ngor", "pole": "Dakar", "name": "Ngor Island Escape", "dur": "Half day", "tag": "Beach", "emoji": "🛶", "zone": "dakar", "desc": "A 5-minute pirogue crossing to a car-free island of coves, surf and grilled fish.", "quote": false, "grid": {"p12": {"a": 20000, "c": 15000}, "p34": {"a": 18000, "c": 10000}, "grp": {"a": 15000, "c": 7000}}, "sub": "Departure 09:30 or 14:00 · pirogue crossing 400 m / 5 min · 3h30–4h", "steps": ["Pick-up; drive to Ngor village beach  ·  14 km / 30–40 min", "Traditional pirogue crossing to the island  ·  5 min", "Guided island loop: lanes, art houses, ocean-side viewpoint over the surf break  ·  60 min", "Free time: swim on the sheltered beach / café  ·  60–90 min", "Pirogue return + transfer to hotel  ·  45 min"], "addons": [{"name": "Seafood lunch on the island (per person)", "price": 0, "per": "person"}, {"name": "Jet-ski session", "price": 0, "per": "booking"}, {"name": "Canoe / kayak hire", "price": 0, "per": "booking"}, {"name": "Combine with the Dakar City Tour into a full day", "price": 20000, "per": "booking"}]}, {"id": "lacrose", "pole": "Dakar", "name": "Lac Rose (Pink Lake) Discovery", "dur": "Half or full day", "tag": "Nature", "emoji": "🌸", "zone": "dakar", "desc": "Salt harvesters, dunes and the famous pink water, 40 km from Dakar by toll road.", "quote": false, "grid": {"p12": {"a": 40000, "c": 25000}, "p34": {"a": 35000, "c": 20000}, "grp": {"a": 30000, "c": 15000}}, "sub": "Departure 08:30 (half) / 09:00 (full) · 40 km via toll road · 1h–1h15 each way", "steps": ["Pick-up; drive to Lac Rose via toll motorway  ·  40 km / 1h–1h15", "Lakeshore: salt harvesters, cooperative visit, salt-mound landscape  ·  60 min", "Boat tour on the lake  ·  25 min", "Quad excursion: dune belt crossing to the Atlantic beach (old Dakar Rally finish)  ·  12 km loop / 45–60 min", "Full-day: return to Dakar — end of service  ·  35 km / 1h"], "addons": [{"name": "Camel ride on the dunes (per person)", "price": 5000, "per": "person"}, {"name": "Horse ride", "price": 5000, "per": "booking"}, {"name": "4x4 / buggy upgrade instead of shared 4x4", "price": 40000, "per": "booking"}, {"name": "Lakeside lunch (per person)", "price": 10000, "per": "person"}, {"name": "Noflaye Turtle Village entry", "price": 3500, "per": "booking"}]}, {"id": "boat", "pole": "Dakar", "name": "Dakar Boat Party Tour — Oceane Cruise Senegal", "dur": "Half day or sunset", "tag": "Nightlife", "emoji": "⛵", "zone": "dakar", "desc": "Modern comfort boats off Ngor beach with catering, drinks and music — partner rated 4.9/5.", "quote": false, "grid": {"p12": {"a": 45000, "c": null}, "p34": {"a": 40000, "c": null}, "grp": {"a": 37000, "c": null}}, "sub": "Departs Plage de Ngor · partner: OCEANE CRUISE Sénégal (+221 77 801 98 98, daily 10:00–23:00, rated 4.9/5) · modern comfort boats · music, catering & drinks INCLUDED", "steps": ["Pick-up; transfer to Ngor beach; welcome by the Océane Cruise crew  ·  14 km / 30–40 min from Plateau", "Boarding; safety briefing; welcome drinks; music on board (DJ/sound system)  ·  20 min", "Cruise along the Dakar coastline: Ngor island, Almadies point, corniche cliffs and viewpoints  ·  90 min", "Anchor stop: swimming from the boat (conditions permitting); catering service on board — food & drinks included in the rate  ·  60–75 min", "Party cruise return leg with music; disembark at Ngor beach  ·  45 min", "Transfer back to hotel — end of service (sunset format: shift the whole program to 16:30–20:30)  ·  30–40 min"], "addons": [{"name": "Private full-boat charter (birthdays, bachelor(ette) parties, corporate)", "price": 190000, "per": "booking"}, {"name": "Event extras via Océane Cruise: decoration, photographer, cake, beach-dinner add-on", "price": null, "per": "booking"}, {"name": "Premium drinks upgrade", "price": null, "per": "booking"}]}, {"id": "food", "pole": "Dakar", "name": "Dakar Food Tour — Teranga on a Plate", "dur": "2h30", "tag": "Gastronomy", "emoji": "🍲", "zone": "dakar", "desc": "Medina, Soumbédioune and beach grills: thieboudienne, grilled fish, café Touba — eat like a Dakarois.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Departure 10:00 (morning) or 17:30 (evening) · Medina + Soumbédioune + beach grills · walking + vehicle · groups 2–8 · max 2h30", "steps": ["Departure from the hotel", "Medina: authentic atmosphere; taste grilled meat with local sauces  ·  40 min", "Soumbédioune Fishing Port and its lively fish market  ·  35 min", "Magic Land / Cassation Beach: grilled-fish outdoor restaurants — taste fresh grilled fish and seafood  ·  10 min transfer + 60 min", "Return to hotel — end of service (~12:30–13:00)  ·  20–30 min"], "addons": [{"name": "Evening variant: dibiterie + live-music venue (cover + drinks)", "price": null, "per": "booking"}, {"name": "Pointe des Almadies extension: grilled squid & lobster at Africa’s westernmost point", "price": null, "per": "booking"}, {"name": "Fast-food / quick-bite variant for time-limited clients", "price": null, "per": "booking"}, {"name": "Cooking-class upgrade: shop the market then cook with the host (3 pax)", "price": 25000, "per": "booking"}, {"name": "Vegetarian / dietary-adapted track (flag at booking)", "price": null, "per": "booking"}]}, {"id": "market", "pole": "Dakar", "name": "Dakar Market Experience", "dur": "Half day", "tag": "Culture", "emoji": "🧺", "zone": "dakar", "desc": "The shopping-focused Dakar: fabric, crafts and market energy with a negotiation-savvy guide.", "quote": false, "grid": {"p12": {"a": 25000, "c": 12500}, "p34": {"a": 15000, "c": 7500}, "grp": {"a": 10000, "c": 5000}}, "sub": "Departure 09:30 · vehicle + walking · 3–4 h · shopping-focused variant of the city tour", "steps": ["Pick-up; Soumbedioune craft market: woodwork, textiles, jewellery (fixed-price orientation first)  ·  45–60 min", "Sandaga or Tilène market: fabrics (wax, bazin), tailors' quarter — order same-day tailoring  ·  60 min", "HLM market: Senegal’s fabric capital — wax prints, brocades, trims  ·  60 min", "Drop-off at hotel or restaurant — end of service  ·  20–30 min"], "addons": [{"name": "Lunch after the markets (per person)", "price": 12000, "per": "person"}, {"name": "Shopping-porter / negotiation assistant", "price": 15000, "per": "booking"}]}, {"id": "galleries", "pole": "Dakar", "name": "Dakar Museums & Galleries Circuit", "dur": "Half or full day", "tag": "Culture", "emoji": "🎨", "zone": "dakar", "desc": "Museums and galleries circuit for art lovers — verify opening days, several close Mondays.", "quote": false, "grid": {"p12": {"a": 32000, "c": 20000}, "p34": {"a": 27000, "c": 15000}, "grp": {"a": 25000, "c": 12000}}, "sub": "Departure 09:30 · verify opening days (several close Mondays) · art-lover product", "steps": ["Museum of Black Civilizations — curated route  ·  90 min", "IFAN Museum of African Arts (masks, statuary, textiles of West Africa)  ·  60 min", "Lunch break downtown  ·  75 min", "Léopold Sédar Senghor Museum (presidential residence-museum)  ·  60 min", "Return transfer — end of service  ·  20–30 min"], "addons": [{"name": "Half-day version (MCN + IFAN only)", "price": 10000, "per": "booking"}, {"name": "Contemporary loop: Ousmane Sow Museum (sculptor’s house), OH Gallery and/or National Gallery of Art", "price": 5000, "per": "booking"}]}, {"id": "bandia", "pole": "Petite Côte", "name": "Bandia Wildlife Reserve Safari", "dur": "From Dakar dep. 07:30 or from Saly dep. ", "tag": "Safari", "emoji": "🦒", "zone": "bandia", "desc": "Rhinos, giraffes, buffalo and antelope in open 4x4 — Senegal's classic morning safari, 1h from Dakar.", "quote": false, "grid": {"p12": {"a": 73500, "c": 36750}, "p34": {"a": 35000, "c": 17500}, "grp": {"a": 35000, "c": 17500}}, "sub": "From Dakar dep. 07:30 or from Saly dep. 08:30 · 2–3 h on site · morning strongly preferred", "steps": ["Pick-up Dakar (or 08:30 Saly); drive to Bandia gate  ·  65 km / 1h (Saly: 15 km / 20 min)", "Reserve formalities; board open safari truck (or client 4x4 + ranger)  ·  15 min", "Game drive: rhino & giraffe sectors, eland, zebra, antelope plains  ·  90 min", "Griot burial baobab and monumental baobabs; short walk  ·  20 min", "Waterhole restaurant deck: crocodiles, drinks stop  ·  10 min", "Return"], "addons": [{"name": "Waterhole drinks package", "price": null, "per": "booking"}, {"name": "Combo with Accrobaobab same day (combo rate)", "price": null, "per": "booking"}]}, {"id": "lions", "pole": "Petite Côte", "name": "Ranch of Lions — Lion Safari", "dur": "adjacent to Bandia", "tag": "Safari", "emoji": "🦁", "zone": "bandia", "desc": "4x4 drive in the lion enclosure adjacent to Bandia (~30 min) — clearly-labelled opt-in experience.", "quote": false, "grid": {"p12": {"a": 73500, "c": 36750}, "p34": {"a": 35000, "c": 17500}, "grp": {"a": 35000, "c": 17500}}, "sub": "Same access as Bandia/Ranch complex · 4x4 lion-enclosure drive ~30 min · opt-in product", "steps": ["Arrival at the lion park  ·  1–2 km from reserve gate", "Briefing; board dedicated 4x4 for the lion-enclosure safari  ·  15 min", "Drive among the lions with ranger commentary  ·  30 min", "Exit and return"], "addons": [{"name": "Lunch at Bandia reserve", "price": null, "per": "booking"}]}, {"id": "accro", "pole": "Petite Côte", "name": "Accrobaobab Adventure Park", "dur": "Sindia", "tag": "Adventure", "emoji": "🌳", "zone": "bandia", "desc": "Ziplines and rope courses strung between giant baobabs at Sindia. Height/weight limits apply.", "quote": false, "grid": {"p12": {"a": 25000, "c": 20000}, "p34": {"a": 22000, "c": 17000}, "grp": {"a": 20000, "c": 15000}}, "sub": "Sindia · 2–3 h on site · dep. Dakar 08:00 / Saly 09:00 or afternoon 15:00 slot · height/weight limits apply", "steps": ["Arrival; waivers, harness fitting, safety briefing  ·  30 min", "Course rotation by ability: children's circuit / discovery / sport / black course between giant baobabs  ·  90–120 min", "Debrief, photos, refreshments; depart"], "addons": [{"name": "Photo/video package by park staff", "price": null, "per": "booking"}, {"name": "Group team-building format (MICE, with facilitator)", "price": null, "per": "booking"}]}, {"id": "somone", "pole": "Petite Côte", "name": "Somone Lagoon Pirogue & Bird Sanctuary", "dur": "Tide-dependent — schedule around high wa", "tag": "Nature", "emoji": "🦩", "zone": "dakar", "desc": "Glide the lagoon at high tide among herons, pelicans and mangroves. Tide-dependent scheduling.", "quote": false, "grid": {"p12": {"a": 30000, "c": 20000}, "p34": {"a": 25000, "c": 17000}, "grp": {"a": 20000, "c": 15000}}, "sub": "Tide-dependent — schedule around high water · best 07:30–10:00 or 16:30–sunset · 2–3 h on water", "steps": ["Pick-up Dakar/Somone hotels; transfer to lagoon jetty  ·  12 km / 20 min", "Board pirogue; mangrove channels of the community reserve  ·  45 min", "Sandbank stop: pelicans, herons, terns (flamingos seasonal); mangrove-reforestation point  ·  30 min", "Lunch at CHEZ RASTA  ·  75 min", "Return"], "addons": [{"name": "Oyster-gathering demonstration + tasting", "price": 3000, "per": "booking"}, {"name": "Jet-ski or quad session after the pirogue", "price": 25000, "per": "booking"}, {"name": "Sunset honeymoon private pirogue with drinks", "price": null, "per": "booking"}]}, {"id": "joal", "pole": "Petite Côte", "name": "Joal-Fadiouth Shell Island", "dur": "From Saly dep. 09:00", "tag": "Heritage", "emoji": "🐚", "zone": "joal", "desc": "Fadiouth, the island built of clam shells, its stilt granaries and the shared Christian-Muslim cemetery.", "quote": false, "grid": {"p12": {"a": 35000, "c": 30000}, "p34": {"a": 30000, "c": 25000}, "grp": {"a": 25000, "c": 20000}}, "sub": "From Saly dep. 09:00 · 45 km / 50 min · half day (full day when combined with Somone)", "steps": ["Pick-up; coastal drive via Nguékokh–Joal  ·  45 km / 50 min", "Fadial giant baobab stop en route (one of Senegal’s largest)  ·  20 min", "Joal: Senghor family home / heritage points (exterior visits)  ·  30 min", "Cross the 800 m wooden footbridge to Fadiouth (no vehicles)  ·  15 min", "Guided walk: shell streets, church and mosque, granaries on stilts viewpoint  ·  60 min", "Second bridge / pirogue to the interfaith shell cemetery  ·  45 min", "Pirogue loop around granary islets or lunch in Joal  ·  45–75 min", "Return to Dakar — end of service  ·  45 km / 50 min"], "addons": [{"name": "Seafood lunch in Joal (per person)", "price": null, "per": "person"}, {"name": "Combo day with Somone Lagoon (sunset on return)", "price": null, "per": "booking"}]}, {"id": "ndangane", "pole": "Sine Saloum", "name": "Ndangane Activity Day — ‘Aventuriers du Saloum’ base", "dur": "Day format from Dakar (dep.8:30) or Saly", "tag": "Adventure", "emoji": "🚣", "zone": "ndangane", "desc": "'Aventuriers du Saloum' activity base: kayak, quad and pirogue days on the northern delta.", "quote": false, "grid": {"p12": {"a": 39900, "c": 35000}, "p34": {"a": 35000, "c": 30000}, "grp": {"a": 32500, "c": 25000}}, "sub": "Day format from Dakar (dep.8:30) or Saly (dep. 09:00) · partner activity base at Ndangane · family/group product", "steps": ["Depart Dakar or Saly  ·  2 h", "Visit of the giant baobab of Fadial — one of the largest and oldest baobabs in Senegal  ·  30 min", "Arrive Ndangane base; welcome and program briefing  ·  20 min", "Boat ride through the mangrove channels  ·  45 min", "Buffet lunch at the base  ·  90 min", "Aquatic & beach activities: water basketball, canoe, games (equipment on site)  ·  2h", "Return drive  ·  2h"], "addons": [{"name": "Overnight at hotel", "price": null, "per": "booking"}]}, {"id": "keurpapaye", "pole": "Sine Saloum", "name": "Keur Papaye Island Day", "dur": "from Djifer", "tag": "Nature", "emoji": "🏝️", "zone": "palmarin", "desc": "Motor-pirogue from Djifer to Keur Papaye island — delta sandbanks, birds and a castaway lunch.", "quote": false, "grid": {"p12": {"a": 70000, "c": null}, "p34": {"a": 47000, "c": null}, "grp": {"a": 35000, "c": null}}, "sub": "Dep. Dakar or Saly 09:00 → Djifer / 2h", "steps": ["Depart to Djifer  ·  2h", "Boat ride departure  ·  30 min", "Arrive Keur Papaye, welcome cocktail and lunch  ·  90 min", "Free time: beach, swimming pool (towels provided), or horse-cart ride to the village  ·  2h", "Return boat + drive — end of service Saly ~18:30  ·  2h boat + 1h30 drive"], "addons": [{"name": "Private pirogue upgrade", "price": 40000, "per": "booking"}, {"name": "Overnight at hotel", "price": null, "per": "booking"}]}, {"id": "grandsaloum", "pole": "Sine Saloum", "name": "Grand Saloum Islands Boat Tour — Palmarin · Djifere · Falia", "dur": "Dep. Palmarin/Djifer by motor-pirogue", "tag": "Nature", "emoji": "⛵", "zone": "palmarin", "desc": "Full day on the water from Palmarin/Djifer: the grand tour of the Saloum shell islands.", "quote": false, "grid": {"p12": {"a": 80000, "c": null}, "p34": {"a": 70000, "c": null}, "grp": {"a": 60000, "c": null}}, "sub": "Dep. Palmarin/Djifer by motor-pirogue · full day on the water · the ‘Great Islands Tour’", "steps": ["Board in a motorized pirogue for the Great Sine Saloum Islands Tour", "Traditional salt wells of Palmarin: harvest explanation  ·  30 min", "Djifere: fishermen’s return and the lively fish-landing market  ·  60 min", "Cruise to ‘No Stress’ island; picnic on the sandbank  ·  2h incl. picnic", "Falia village walk: shell mounds, Serer-Niominka life  ·  30 min", "Paddle through the mangroves in a traditional canoe  ·  30 min", "Return  ·  -"], "addons": [{"name": "Overnight at Palmarin or Keur Papaye", "price": null, "per": "booking"}]}, {"id": "toubacouta", "pole": "Sine Saloum", "name": "Toubacouta — Mangroves, Bird Roost & Shell Islands", "dur": "core, 1–3 days", "tag": "Nature", "emoji": "🌿", "zone": "toubacouta", "desc": "The delta at its purest: bolongs by pirogue, the sunset bird roost and islands built of shells.", "quote": false, "grid": {"p12": {"a": 70000, "c": 65000}, "p34": {"a": 59500, "c": 54500}, "grp": {"a": 55000, "c": 50000}}, "sub": "Dep. Dakar 07:00 · 250 km / 4h30 · minimum 1 night (roost is at dusk) · lodge tiers: eco / mid / premium", "steps": ["Departure Dakar  ·  250 km / 4h30", "Lion walk  ·  25 min", "Lunch at hotel  ·  90 min", "Boat tour in the mangrove and visit of seashell island  ·  2h", "Return"], "addons": [{"name": "Oyster & seafood tasting platter", "price": null, "per": "booking"}, {"name": "Fishing with local pirogue crew", "price": null, "per": "booking"}, {"name": "Visit village of Toubacouta", "price": null, "per": "booking"}, {"name": "Overnight stay at hotel", "price": null, "per": "booking"}]}, {"id": "ziguinchor", "pole": "Casamance", "name": "Ziguinchor City & River", "dur": "half or full day", "tag": "Culture", "emoji": "🛖", "zone": "ziguinchor", "desc": "Casamance's river capital: markets, craft village and a bolong pirogue on the north bank.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Dep. 09:00 from Ziguinchor hotels · walking + vehicle + pirogue", "steps": ["Colonial riverfront and Escale quarter walk; cathedral  ·  30 min", "Marché Saint-Maur guided walk (crafts, produce)  ·  30 min", "Artisan village workshops  ·  30 min", "Lunch break  ·  25 min", "Pirogue on the Casamance river to Îlot aux Oiseaux (pelicans, mangrove birds)  ·  2h", "Return — end of service / connect to circuit"], "addons": [{"name": "River-fish lunch on the quay (per person)", "price": null, "per": "person"}, {"name": "Extended pirogue to Affiniam (links the Affiniam bolongs day)", "price": null, "per": "booking"}, {"name": "Diola-culture briefing session with historian", "price": null, "per": "booking"}]}, {"id": "capskirring", "pole": "Casamance", "name": "Cap Skirring Beach Base", "dur": "1–7 days", "tag": "Beach", "emoji": "🏖️", "zone": "capskirring", "desc": "Casamance's palm-lined beaches as your base for island and village excursions, 1–7 days.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Transfer airport→hotels 5–10 km / 15 min · activity menu within 45 min radius", "steps": ["Day 1: Airport meet & greet, hotel check-in, beach orientation walk  ·  15 min transfer", "Daily am: Beach / pool free time (activities available as add-ons)  ·  flexible", "Daily pm: One cultural or nature excursion (Oussouye & Mlomp, Carabane or Affiniam) every other day  ·  per module", "Sunset: Kabrousse fishing-pirogue landing or Diembéring dune viewpoint  ·  10–15 km / 20 min"], "addons": [{"name": "Golf green fee (per round)", "price": null, "per": "booking"}, {"name": "Fishing charter (per boat, half day)", "price": null, "per": "booking"}, {"name": "Kayak hire (per hour)", "price": null, "per": "booking"}, {"name": "Seafood beach-grill dinner (per person)", "price": null, "per": "person"}, {"name": "Diembéring viewpoint & giant fromagers sunset trip", "price": null, "per": "booking"}]}, {"id": "oussouye", "pole": "Casamance", "name": "Oussouye Kingdom & Mlomp", "dur": "full day", "tag": "Culture", "emoji": "👑", "zone": "capskirring", "desc": "The animist kingdom of Oussouye and Mlomp's two-storey mud houses — sacred Casamance.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Dep. Cap Skirring 09:00 · 20 km / 30 min to Oussouye · sacred-site protocol briefing mandatory", "steps": ["Depart Cap Skirring; palm-wine tapping demonstration en route  ·  20 km / 40 min", "Oussouye: royal quarter surroundings, protocol explanation (audience only if granted)  ·  45 min", "Drive to Mlomp  ·  10 km / 15 min", "Mlomp: two-storey banco houses, case à impluvium, small museum, monumental fromagers  ·  45 min", "Lunch break (village host-family lunch available as add-on)  ·  25 min", "Return to Cap Skirring — end of service  ·  30 km / 45 min"], "addons": [{"name": "Host-family village lunch (per person)", "price": null, "per": "person"}, {"name": "Edioungou pottery workshop with purchase credit", "price": null, "per": "booking"}, {"name": "King's-audience protocol gift (customary, handled by guide)", "price": null, "per": "booking"}]}, {"id": "capdiscovery", "pole": "Casamance", "name": "Cap Skirring Discovery Day — Cap Saint-Georges, Elinkine & Wenday Island", "dur": "Dep. Cap Skirring 08:30", "tag": "Beach", "emoji": "🌅", "zone": "capskirring", "desc": "Cap Saint-Georges and Elinkine in one full day — Casamance's coast by vehicle and boat.", "quote": false, "grid": {"p12": {"a": 63000, "c": null}, "p34": {"a": 35000, "c": null}, "grp": {"a": 25000, "c": null}}, "sub": "Dep. Cap Skirring 08:30 · vehicle + boat combination · full day · combines coast, king’s domain and islands", "steps": ["Depart Cap Skirring; Cap Saint-Georges viewpoint and fishing beach  ·  10 km / 25 min", "Oussouye: royal domain surroundings and protocol visit (audience if granted — see Oussouye & Mlomp protocol rules)  ·  20 km / 40 min + 60 min", "Elinkine fishing village: pirogue port life  ·  15 km / 25 min + 45 min", "Boat tour of the bolongs; landing on Wenday island (beach + village)  ·  2h incl. stop", "Return to Cap Skirring — end of service ~17:00  ·  35 km / 55 min"], "addons": [{"name": "Late seafood lunch at Elinkine or island picnic", "price": null, "per": "booking"}, {"name": "Carabane Island extension instead of Wenday", "price": null, "per": "booking"}]}, {"id": "carabane", "pole": "Casamance", "name": "Carabane Island", "dur": "full day or overnight", "tag": "Heritage", "emoji": "⚓", "zone": "capskirring", "desc": "The historic island trading post at the mouth of the Casamance river — full day or overnight.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Dep. Cap Skirring 08:30 → Elinkine 35 km / 55 min → pirogue 30 min", "steps": ["Depart Cap Skirring via Oussouye to Elinkine fishing village  ·  35 km / 55 min", "Pirogue crossing (estuary dolphins frequent)  ·  6 km / 30 min", "Guided walk: mission church ruins, colonial cemetery, village lanes  ·  90 min", "Beach / hammock time; seafood lunch at guesthouse  ·  2h", "Mangrove-edge walk or second swim  ·  60 min", "Return pirogue + drive — end of service (or overnight in guesthouse)  ·  1h30 total"], "addons": [{"name": "Guesthouse overnight (per person half-board)", "price": null, "per": "person"}, {"name": "Private sunset pirogue return", "price": null, "per": "booking"}, {"name": "Dolphin-watching extended loop", "price": null, "per": "booking"}]}, {"id": "bolongs", "pole": "Casamance", "name": "Bolongs, Oyster Villages & Affiniam", "dur": "full day", "tag": "Nature", "emoji": "🦪", "zone": "ziguinchor", "desc": "Bolongs, oyster villages and Affiniam by pirogue, with a village lunch on the north bank.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Dep. Ziguinchor 08:30 · pirogue north bank · village lunch centrepiece", "steps": ["Board pirogue at Ziguinchor; cross to north-bank bolongs  ·  45–60 min", "Affiniam: giant case à impluvium, village walk, women's processing cooperative  ·  2h", "Mangrove oyster culture demonstration + tasting  ·  45 min", "Village lunch with family (rice-paddy landscape)  ·  90 min", "Return pirogue via smaller bolongs, birdlife  ·  60–75 min", "End of service Ziguinchor"], "addons": [{"name": "Cooperative products purchase pack (fruit, cashew, pottery)", "price": null, "per": "booking"}, {"name": "Extended birding loop with specialist guide", "price": null, "per": "booking"}]}, {"id": "ferry", "pole": "Casamance", "name": "Casamance Ferry Experience", "dur": "Dakar ⇄ Ziguinchor", "tag": "Adventure", "emoji": "🚢", "zone": "", "desc": "The legendary overnight ferry Dakar ⇄ Ziguinchor via Carabane — cabins and sea sunset.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Overnight sailing ~15–16 h via Carabane · cabins 2/4 berth + seats · verify weekly schedule & book early", "steps": ["Day 1: ATS transfer to Dakar ferry terminal; check-in, cabin allocation  ·  20–30 min", "17:00 (typ.): Departure — sunset past Gorée from deck (confirm current sailing time)", "Night: At sea along the coast; dinner on board", "Day 2 dawn: Entry into the Casamance river; Carabane call; mangrove approach  ·  2–3 h river leg", "Day 2 ~: Arrive Ziguinchor; ATS meet & greet at the quay"], "addons": [{"name": "Cabin class upgrade (4-berth → 2-berth)", "price": null, "per": "booking"}, {"name": "On-board dinner package", "price": null, "per": "booking"}, {"name": "Carabane disembark option (start circuit on the island)", "price": null, "per": "booking"}]}, {"id": "stlouis", "pole": "Saint-Louis", "name": "Saint-Louis Island Heritage Tour", "dur": "half day", "tag": "Heritage", "emoji": "🌉", "zone": "stlouis", "desc": "The UNESCO former capital by calèche and on foot: Faidherbe bridge, colonial island, Guet Ndar.", "quote": false, "grid": {"p12": {"a": 20000, "c": 15000}, "p34": {"a": 15000, "c": 10000}, "grp": {"a": 10000, "c": 7500}}, "sub": "Dep. 09:00 or 15:30 from Saint-Louis hotels · calèche + walking · UNESCO island", "steps": ["Faidherbe bridge crossing on foot: history and engineering  ·  30 min", "Calèche (horse-cart) circuit: colonial grid, balconied houses, Governor's quarter, cathedral  ·  75 min", "Walking: signares heritage, Museum of Photography (MuPho), craft galleries, riverfront  ·  60 min", "Guet Ndar fishing quarter: pirogue landing beach (small groups, local guide, ask-before-photo)  ·  60 min", "End of service on the island"], "addons": [{"name": "Island lunch (colonial-house restaurant, per person)", "price": 10000, "per": "person"}, {"name": "Photography-focused sunset variant (dep. 15:30, ends at Guet Ndar landing)", "price": null, "per": "booking"}, {"name": "Jazz-history walk (festival season)", "price": null, "per": "booking"}]}, {"id": "djoudj", "pole": "Saint-Louis", "name": "Djoudj National Bird Sanctuary", "dur": "Nov–Apr", "tag": "Wildlife", "emoji": "🦜", "zone": "stlouis", "desc": "One of the world's great bird sanctuaries — pelican colonies by boat safari (Nov–Apr).", "quote": false, "grid": {"p12": {"a": 35000, "c": null}, "p34": {"a": 30000, "c": null}, "grp": {"a": 25000, "c": null}}, "sub": "Dep. Saint-Louis 07:00 · 60 km / 1h15 · boat safari ~2h · park fee + boat fee", "steps": ["Depart Saint-Louis (early = best light and bird activity)  ·  60 km / 1h15", "Park formalities; board boat at the quay  ·  30 min", "Boat safari to the great white-pelican breeding colony; flamingos, cormorants, spoonbills; crocodiles and warthogs on banks  ·  2h", "Observation tower / short drive circuit in the park  ·  45 min", "Return to Saint-Louis — end of service ~12:45  ·  60 km / 1h15"], "addons": [{"name": "Private boat (photographers)", "price": null, "per": "booking"}, {"name": "Picnic in the park", "price": null, "per": "booking"}]}, {"id": "barbarie", "pole": "Saint-Louis", "name": "Langue de Barbarie", "dur": "Dep. Saint-Louis 08:30 or 15:30", "tag": "Nature", "emoji": "🐢", "zone": "stlouis", "desc": "Langue de Barbarie national park: pirogue between river and ocean, birds and turtle beaches.", "quote": false, "grid": {"p12": {"a": 25000, "c": null}, "p34": {"a": 20000, "c": null}, "grp": {"a": 15000, "c": null}}, "sub": "Dep. Saint-Louis 08:30 or 15:30 · 20 km / 40 min · pirogue + 4x4", "steps": ["Depart Saint-Louis south along the Langue de Barbarie  ·  20 km / 40 min", "Pirogue between river and ocean: tern/gull colonies (strongest in nesting season)  ·  90 min", "Return — end of service ~12:30  ·  40 min"], "addons": [{"name": "Geumbeul reserve", "price": 10000, "per": "booking"}]}, {"id": "lompoul", "pole": "Saint-Louis", "name": "Lompoul Desert Overnight", "dur": "en-route module", "tag": "Adventure", "emoji": "🏜️", "zone": "lompoul", "desc": "Orange dunes, camel rides and a night in a desert camp between Dakar and Saint-Louis.", "quote": false, "grid": {"p12": {"a": 50000, "c": null}, "p34": {"a": 45000, "c": null}, "grp": {"a": 40000, "c": null}}, "sub": "Dep. Dakar → camp for sunset · 150 km / 2h30–3h · continue to Saint-Louis next morning (115 km / 1h45)", "steps": ["Depart Dakar (or 09:00 if sold as day 1 standalone)  ·  150 km / 2h30", "4x4 shuttle from village to the dune camp  ·  4 km / 15 min", "Camel ride in the dunes and sandboarding  ·  90 min", "Dinner and cultural night  ·  evening", "Day 2: Breakfast and check out  ·  90 min", "Depart to Saint-Louis  ·  115 km / 1h45"], "addons": [{"name": "Quad tour in the dunes", "price": 35000, "per": "booking"}, {"name": "Paintball session (camp-dependent)", "price": 10000, "per": "booking"}, {"name": "Private dune dinner (honeymoon)", "price": null, "per": "booking"}]}, {"id": "kedafia", "pole": "Kédougou", "name": "Weekend Discovery — Afia Shea Workshop + Dindéfélo Falls", "dur": "3 days · fly-in", "tag": "Circuit", "emoji": "💧", "zone": "kedougou", "desc": "Fly to Senegal's far east: shea workshop in Afia, Bassari country and the 100 m Dindéfélo waterfall.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Day-by-day operating plan in the ATS manual — priced per departure", "steps": ["Day 1: flight Dakar → Kédougou, hotel", "Day 2: Afia shea workshop + Bassari country", "Day 3: Dindéfélo falls & return flight"], "addons": []}, {"id": "kediwol", "pole": "Kédougou", "name": "Weekend Discovery — Iwol Village + Dindéfélo Falls", "dur": "3 days · fly-in", "tag": "Circuit", "emoji": "⛰️", "zone": "kedougou", "desc": "Bedik hilltop village of Iwol, sacred baobabs and the Dindéfélo waterfall on a fly-in weekend.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Day-by-day operating plan in the ATS manual — priced per departure", "steps": ["Day 1: flight Dakar → Kédougou, hotel", "Day 2: Iwol village hike (Bassari country)", "Day 3: Dindéfélo falls & return flight"], "addons": []}, {"id": "wild12", "pole": "Grand Tours", "name": "Wild Senegal — The Flagship Circuit", "dur": "12 days · Nov–May", "tag": "Circuit", "emoji": "🌍", "zone": "", "desc": "North & Delta + Casamance: the cross-country flagship combining Saint-Louis, Lompoul, the Saloum and Casamance.", "quote": true, "grid": {"p12": {"a": null, "c": null}, "p34": {"a": null, "c": null}, "grp": {"a": null, "c": null}}, "sub": "Day-by-day operating plan in the ATS manual — priced per departure", "steps": ["Saint-Louis & Djoudj", "Lompoul desert", "Sine Saloum delta", "Casamance by air or ferry"], "addons": []}];
const POLES = ["All", "Dakar", "Petite Côte", "Sine Saloum", "Casamance", "Saint-Louis", "Kédougou", "Grand Tours"];
const VEHICLES = [
  { name: "Standard Sedan", cap: 3, bags: 2, type: "Berline", slug: "standard-sedan" }, { name: "Premium Sedan", cap: 3, bags: 2, type: "Berline", slug: "premium-sedan" }, { name: "Luxury Sedan", cap: 3, bags: 3, type: "Berline", slug: "luxury-sedan" },
  { name: "Standard SUV", cap: 4, bags: 3, type: "SUV", slug: "standard-suv" }, { name: "Premium SUV", cap: 4, bags: 3, type: "SUV", slug: "premium-suv" }, { name: "Luxury SUV", cap: 4, bags: 4, type: "SUV", slug: "luxury-suv" },
  { name: "Standard Minivan (14)", cap: 14, bags: 8, type: "Van", slug: "standard-minivan" }, { name: "Premium Minivan (7)", cap: 7, bags: 5, type: "Van", slug: "premium-minivan" }, { name: "Luxury Minivan (7)", cap: 7, bags: 5, type: "Van", slug: "luxury-minivan" },
  { name: "Coaster coach (22)", cap: 22, bags: 15, type: "Bus", slug: "coaster-22" }, { name: "Minicoach (33)", cap: 33, bags: 20, type: "Bus", slug: "minicoach-33" }, { name: "Motorcoach (50)", cap: 50, bags: 30, type: "Bus", slug: "motorcoach-50" },
];
const RATES = {"airport": [30000, 50000, 100000, 50000, 75000, 200000, 110000, 100000, 150000, 65000, 90000, 180000], "dakar": [85000, 100000, 250000, 95000, 150000, 350000, 150000, 180000, 250000, 115000, 170000, 325000], "bandia": [85000, 100000, 250000, 95000, 150000, 350000, 150000, 180000, 250000, 115000, 170000, 325000], "joal": [110000, 125000, 315000, 120000, 190000, 445000, 190000, 230000, 315000, 150000, 215000, 410000], "ndangane": [150000, 180000, 445000, 170000, 265000, 620000, 265000, 320000, 445000, 210000, 300000, 580000], "palmarin": [145000, 170000, 430000, 165000, 260000, 605000, 260000, 310000, 430000, 200000, 290000, 560000], "toubacouta": [235000, 280000, 695000, 265000, 415000, 970000, 415000, 500000, 695000, 325000, 470000, 905000], "lompoul": [115000, 135000, 335000, 125000, 200000, 465000, 200000, 240000, 335000, 155000, 230000, 435000], "stlouis": [165000, 195000, 490000, 185000, 295000, 690000, 295000, 355000, 490000, 230000, 330000, 635000], "kedougou": [375000, 440000, 1095000, 415000, 660000, 1535000, 660000, 790000, 1095000, 515000, 740000, 1425000], "ziguinchor": [255000, 300000, 750000, 285000, 450000, 1050000, 450000, 540000, 750000, 350000, 505000, 975000], "capskirring": [290000, 340000, 845000, 320000, 510000, 1185000, 510000, 610000, 845000, 395000, 570000, 1100000]};
const tierOf = (pax) => (pax <= 2 ? "p12" : pax <= 4 ? "p34" : "grp");
const tierLabel = { p12: "Private 1–2 pax", p34: "Private 3–4 pax", grp: "Group (5+ pax)" };
const fromPrice = (t) => t.grid.grp.a;

const COUNTRIES = [
  { id: "sn", name: "Senegal", live: true, ll: [-14.5, 14.5], x: 14.6, y: 29.9, count: "35+ experiences" },
  { id: "rw", name: "Rwanda", live: true, ll: [29.9, -1.9], x: 71.2, y: 50.8, count: "Packages available" },
  { id: "cv", name: "Cape Verde", live: false, ll: [-23.6, 16.0], x: 3.1, y: 28.6 },
  { id: "gm", name: "Gambia", live: false, ll: [-15.3, 13.4], x: 13.4, y: 31.3 },
  { id: "gn", name: "Guinea", live: false, ll: [-11.0, 9.9], x: 19.1, y: 35.0 },
  { id: "ma", name: "Morocco", live: false, ll: [-7.0, 31.8], x: 24.5, y: 7.6 },
  { id: "ci", name: "Ivory Coast", live: false, ll: [-5.5, 7.5], x: 26.1, y: 38.9 },
  { id: "gh", name: "Ghana", live: false, ll: [-1.0, 7.9], x: 31.6, y: 38.3 },
  { id: "et", name: "Ethiopia", live: false, ll: [40.5, 9.1], x: 83.4, y: 37.6 },
  { id: "ke", name: "Kenya", live: false, ll: [37.9, 0.2], x: 80.9, y: 48.0 },
  { id: "tz", name: "Tanzania & Zanzibar", live: false, ll: [34.9, -6.4], x: 81.5, y: 55.6 },
];
// [name, role, photo-slug] — photos live in bucket site/team/<slug>.webp
const TEAM = [
  ["Aminata Mbaye Thiam", "Managing Director", "aminata-mbaye-thiam"],
  ["Mouhamed Bachir Lô", "Co-founder", "mouhamed-bachir-lo"],
  ["Abdoulaye Chaker Diouf", "Logistics Manager", "abdoulaye-chaker-diouf"],
  ["Khady Mboup", "Head of Finance (DAF)", "khady-mboup"],
  ["Salamat Athie", "Marketing Manager", "salamat-athie"],
  ["Elizabeth Dior Sy", "Customer Relations Manager", "elizabeth-dior-sy"],
  ["Ousmane Doudou Faye", "Travel Coordinator", "ousmane-doudou-faye"],
  ["Fatoumata Binetou Diallo", "Ticketing Agent", "fatoumata-binetou-diallo"],
  ["Fatou Kane Wathie", "Sales & Marketing Assistant", "fatou-kane-wathie"],
  ["Abdou Karim Dieng", "Parking & Fleet Manager", "abdou-karim-dieng"],
  ["Seydou Traoré", "Graphic Designer", "seydou-traore"],
  ["Cheikh Faye", "Client Relations Officer", "cheikh-faye"],
  ["Yaram Kane", "Administrative & Logistics Assistant", "yaram-kane"],
  ["Abdou Diouf", "Web Developer", "abdou-diouf"],
];
// Team member photo (bucket site/team/<slug>.webp) with initials fallback.
function TeamPhoto({ slug, name, ratio = "4 / 5", radius = 0 }) {
  const [ok, setOk] = useState(!!slug);
  const url = slug ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`site/team/${slug}.webp`).data.publicUrl : null;
  return (
    <div style={{ aspectRatio: ratio, width: "100%", height: "100%", borderRadius: radius, overflow: "hidden", background: "linear-gradient(140deg,#EFF3EF,#fff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {ok && url
        ? <img src={url} alt={name} loading="lazy" onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <span className="disp" style={{ fontWeight: 800, fontSize: 24, color: "#9AA79F" }}>{name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}
    </div>
  );
}
const DOTS=[[57.3,92.3],[59.2,92.3],[61.2,92.3],[57.3,90.3],[59.2,90.3],[61.2,90.3],[63.2,90.3],[65.2,90.3],[67.1,90.3],[69.1,90.3],[55.3,88.3],[57.3,88.3],[59.2,88.3],[61.2,88.3],[63.2,88.3],[65.2,88.3],[67.1,88.3],[69.1,88.3],[71.1,88.3],[55.3,86.4],[57.3,86.4],[59.2,86.4],[61.2,86.4],[63.2,86.4],[65.2,86.4],[67.1,86.4],[69.1,86.4],[71.1,86.4],[73.1,86.4],[53.3,84.4],[55.3,84.4],[57.3,84.4],[59.2,84.4],[61.2,84.4],[63.2,84.4],[65.2,84.4],[67.1,84.4],[69.1,84.4],[71.1,84.4],[73.1,84.4],[75.0,84.4],[53.3,82.4],[55.3,82.4],[57.3,82.4],[59.2,82.4],[61.2,82.4],[63.2,82.4],[65.2,82.4],[67.1,82.4],[69.1,82.4],[71.1,82.4],[73.1,82.4],[75.0,82.4],[51.3,80.4],[53.3,80.4],[55.3,80.4],[57.3,80.4],[59.2,80.4],[61.2,80.4],[63.2,80.4],[65.2,80.4],[67.1,80.4],[69.1,80.4],[71.1,80.4],[73.1,80.4],[75.0,80.4],[77.0,80.4],[88.9,80.4],[90.8,80.4],[92.8,80.4],[51.3,78.5],[53.3,78.5],[55.3,78.5],[57.3,78.5],[59.2,78.5],[61.2,78.5],[63.2,78.5],[65.2,78.5],[67.1,78.5],[69.1,78.5],[71.1,78.5],[73.1,78.5],[75.0,78.5],[77.0,78.5],[79.0,78.5],[88.9,78.5],[90.8,78.5],[92.8,78.5],[51.3,76.5],[53.3,76.5],[55.3,76.5],[57.3,76.5],[59.2,76.5],[61.2,76.5],[63.2,76.5],[65.2,76.5],[67.1,76.5],[69.1,76.5],[71.1,76.5],[73.1,76.5],[75.0,76.5],[77.0,76.5],[79.0,76.5],[88.9,76.5],[90.8,76.5],[92.8,76.5],[94.8,76.5],[49.4,74.5],[51.3,74.5],[53.3,74.5],[55.3,74.5],[57.3,74.5],[59.2,74.5],[61.2,74.5],[63.2,74.5],[65.2,74.5],[67.1,74.5],[69.1,74.5],[71.1,74.5],[73.1,74.5],[75.0,74.5],[77.0,74.5],[88.9,74.5],[90.8,74.5],[92.8,74.5],[94.8,74.5],[49.4,72.5],[51.3,72.5],[53.3,72.5],[55.3,72.5],[57.3,72.5],[59.2,72.5],[61.2,72.5],[63.2,72.5],[65.2,72.5],[67.1,72.5],[69.1,72.5],[71.1,72.5],[73.1,72.5],[75.0,72.5],[77.0,72.5],[79.0,72.5],[88.9,72.5],[90.8,72.5],[92.8,72.5],[94.8,72.5],[47.4,70.6],[49.4,70.6],[51.3,70.6],[53.3,70.6],[55.3,70.6],[57.3,70.6],[59.2,70.6],[61.2,70.6],[63.2,70.6],[65.2,70.6],[67.1,70.6],[69.1,70.6],[71.1,70.6],[73.1,70.6],[75.0,70.6],[77.0,70.6],[79.0,70.6],[81.0,70.6],[82.9,70.6],[88.9,70.6],[90.8,70.6],[92.8,70.6],[94.8,70.6],[96.8,70.6],[49.4,68.6],[51.3,68.6],[53.3,68.6],[55.3,68.6],[57.3,68.6],[59.2,68.6],[61.2,68.6],[63.2,68.6],[65.2,68.6],[67.1,68.6],[69.1,68.6],[71.1,68.6],[73.1,68.6],[75.0,68.6],[77.0,68.6],[79.0,68.6],[81.0,68.6],[82.9,68.6],[84.9,68.6],[90.8,68.6],[92.8,68.6],[94.8,68.6],[96.8,68.6],[49.4,66.6],[51.3,66.6],[53.3,66.6],[55.3,66.6],[57.3,66.6],[59.2,66.6],[61.2,66.6],[63.2,66.6],[65.2,66.6],[67.1,66.6],[69.1,66.6],[71.1,66.6],[73.1,66.6],[75.0,66.6],[77.0,66.6],[79.0,66.6],[81.0,66.6],[82.9,66.6],[84.9,66.6],[94.8,66.6],[96.8,66.6],[49.4,64.6],[51.3,64.6],[53.3,64.6],[55.3,64.6],[57.3,64.6],[59.2,64.6],[61.2,64.6],[63.2,64.6],[65.2,64.6],[67.1,64.6],[69.1,64.6],[71.1,64.6],[73.1,64.6],[75.0,64.6],[77.0,64.6],[79.0,64.6],[81.0,64.6],[82.9,64.6],[84.9,64.6],[94.8,64.6],[96.8,64.6],[51.3,62.7],[53.3,62.7],[55.3,62.7],[57.3,62.7],[59.2,62.7],[61.2,62.7],[63.2,62.7],[65.2,62.7],[67.1,62.7],[69.1,62.7],[71.1,62.7],[73.1,62.7],[75.0,62.7],[77.0,62.7],[79.0,62.7],[81.0,62.7],[82.9,62.7],[84.9,62.7],[49.4,60.7],[51.3,60.7],[53.3,60.7],[55.3,60.7],[57.3,60.7],[59.2,60.7],[61.2,60.7],[63.2,60.7],[65.2,60.7],[67.1,60.7],[69.1,60.7],[71.1,60.7],[73.1,60.7],[75.0,60.7],[77.0,60.7],[79.0,60.7],[81.0,60.7],[82.9,60.7],[49.4,58.7],[51.3,58.7],[53.3,58.7],[55.3,58.7],[57.3,58.7],[59.2,58.7],[61.2,58.7],[63.2,58.7],[65.2,58.7],[67.1,58.7],[69.1,58.7],[71.1,58.7],[73.1,58.7],[75.0,58.7],[77.0,58.7],[79.0,58.7],[81.0,58.7],[82.9,58.7],[49.4,56.8],[51.3,56.8],[53.3,56.8],[55.3,56.8],[57.3,56.8],[59.2,56.8],[61.2,56.8],[63.2,56.8],[65.2,56.8],[67.1,56.8],[69.1,56.8],[71.1,56.8],[73.1,56.8],[75.0,56.8],[77.0,56.8],[79.0,56.8],[81.0,56.8],[82.9,56.8],[47.4,54.8],[49.4,54.8],[51.3,54.8],[53.3,54.8],[55.3,54.8],[57.3,54.8],[59.2,54.8],[61.2,54.8],[63.2,54.8],[65.2,54.8],[67.1,54.8],[69.1,54.8],[71.1,54.8],[73.1,54.8],[75.0,54.8],[77.0,54.8],[79.0,54.8],[81.0,54.8],[82.9,54.8],[47.4,52.8],[49.4,52.8],[51.3,52.8],[53.3,52.8],[55.3,52.8],[57.3,52.8],[59.2,52.8],[61.2,52.8],[63.2,52.8],[65.2,52.8],[67.1,52.8],[69.1,52.8],[71.1,52.8],[73.1,52.8],[75.0,52.8],[77.0,52.8],[79.0,52.8],[81.0,52.8],[82.9,52.8],[45.4,50.8],[47.4,50.8],[49.4,50.8],[51.3,50.8],[53.3,50.8],[55.3,50.8],[57.3,50.8],[59.2,50.8],[61.2,50.8],[63.2,50.8],[65.2,50.8],[67.1,50.8],[69.1,50.8],[71.1,50.8],[73.1,50.8],[75.0,50.8],[77.0,50.8],[79.0,50.8],[81.0,50.8],[82.9,50.8],[84.9,50.8],[45.4,48.9],[47.4,48.9],[49.4,48.9],[51.3,48.9],[53.3,48.9],[55.3,48.9],[57.3,48.9],[59.2,48.9],[61.2,48.9],[63.2,48.9],[65.2,48.9],[67.1,48.9],[69.1,48.9],[71.1,48.9],[73.1,48.9],[75.0,48.9],[77.0,48.9],[79.0,48.9],[81.0,48.9],[82.9,48.9],[84.9,48.9],[86.9,48.9],[45.4,46.9],[47.4,46.9],[49.4,46.9],[51.3,46.9],[53.3,46.9],[55.3,46.9],[57.3,46.9],[59.2,46.9],[61.2,46.9],[63.2,46.9],[65.2,46.9],[67.1,46.9],[69.1,46.9],[71.1,46.9],[73.1,46.9],[75.0,46.9],[77.0,46.9],[79.0,46.9],[81.0,46.9],[82.9,46.9],[84.9,46.9],[86.9,46.9],[88.9,46.9],[45.4,44.9],[47.4,44.9],[49.4,44.9],[51.3,44.9],[53.3,44.9],[55.3,44.9],[57.3,44.9],[59.2,44.9],[61.2,44.9],[63.2,44.9],[65.2,44.9],[67.1,44.9],[69.1,44.9],[71.1,44.9],[73.1,44.9],[75.0,44.9],[77.0,44.9],[79.0,44.9],[81.0,44.9],[82.9,44.9],[84.9,44.9],[86.9,44.9],[88.9,44.9],[90.8,44.9],[92.8,44.9],[21.7,42.9],[23.7,42.9],[41.5,42.9],[43.4,42.9],[45.4,42.9],[47.4,42.9],[49.4,42.9],[51.3,42.9],[53.3,42.9],[55.3,42.9],[57.3,42.9],[59.2,42.9],[61.2,42.9],[63.2,42.9],[65.2,42.9],[67.1,42.9],[69.1,42.9],[71.1,42.9],[73.1,42.9],[75.0,42.9],[77.0,42.9],[79.0,42.9],[81.0,42.9],[82.9,42.9],[84.9,42.9],[86.9,42.9],[88.9,42.9],[90.8,42.9],[92.8,42.9],[94.8,42.9],[19.7,41.0],[21.7,41.0],[23.7,41.0],[25.7,41.0],[27.6,41.0],[29.6,41.0],[31.6,41.0],[33.6,41.0],[35.5,41.0],[37.5,41.0],[39.5,41.0],[41.5,41.0],[43.4,41.0],[45.4,41.0],[47.4,41.0],[49.4,41.0],[51.3,41.0],[53.3,41.0],[55.3,41.0],[57.3,41.0],[59.2,41.0],[61.2,41.0],[63.2,41.0],[65.2,41.0],[67.1,41.0],[69.1,41.0],[71.1,41.0],[73.1,41.0],[75.0,41.0],[77.0,41.0],[79.0,41.0],[81.0,41.0],[82.9,41.0],[84.9,41.0],[86.9,41.0],[88.9,41.0],[90.8,41.0],[92.8,41.0],[94.8,41.0],[17.8,39.0],[19.7,39.0],[21.7,39.0],[23.7,39.0],[25.7,39.0],[27.6,39.0],[29.6,39.0],[31.6,39.0],[33.6,39.0],[35.5,39.0],[37.5,39.0],[39.5,39.0],[41.5,39.0],[43.4,39.0],[45.4,39.0],[47.4,39.0],[49.4,39.0],[51.3,39.0],[53.3,39.0],[55.3,39.0],[57.3,39.0],[59.2,39.0],[61.2,39.0],[63.2,39.0],[65.2,39.0],[67.1,39.0],[69.1,39.0],[71.1,39.0],[73.1,39.0],[75.0,39.0],[77.0,39.0],[79.0,39.0],[81.0,39.0],[82.9,39.0],[84.9,39.0],[86.9,39.0],[88.9,39.0],[90.8,39.0],[92.8,39.0],[94.8,39.0],[96.8,39.0],[15.8,37.0],[17.8,37.0],[19.7,37.0],[21.7,37.0],[23.7,37.0],[25.7,37.0],[27.6,37.0],[29.6,37.0],[31.6,37.0],[33.6,37.0],[35.5,37.0],[37.5,37.0],[39.5,37.0],[41.5,37.0],[43.4,37.0],[45.4,37.0],[47.4,37.0],[49.4,37.0],[51.3,37.0],[53.3,37.0],[55.3,37.0],[57.3,37.0],[59.2,37.0],[61.2,37.0],[63.2,37.0],[65.2,37.0],[67.1,37.0],[69.1,37.0],[71.1,37.0],[73.1,37.0],[75.0,37.0],[77.0,37.0],[79.0,37.0],[81.0,37.0],[82.9,37.0],[84.9,37.0],[86.9,37.0],[88.9,37.0],[90.8,37.0],[94.8,37.0],[96.8,37.0],[13.8,35.0],[15.8,35.0],[17.8,35.0],[19.7,35.0],[21.7,35.0],[23.7,35.0],[25.7,35.0],[27.6,35.0],[29.6,35.0],[31.6,35.0],[33.6,35.0],[35.5,35.0],[37.5,35.0],[39.5,35.0],[41.5,35.0],[43.4,35.0],[45.4,35.0],[47.4,35.0],[49.4,35.0],[51.3,35.0],[53.3,35.0],[55.3,35.0],[57.3,35.0],[59.2,35.0],[61.2,35.0],[63.2,35.0],[65.2,35.0],[67.1,35.0],[69.1,35.0],[71.1,35.0],[73.1,35.0],[75.0,35.0],[77.0,35.0],[79.0,35.0],[81.0,35.0],[82.9,35.0],[84.9,35.0],[86.9,35.0],[94.8,35.0],[96.8,35.0],[98.7,35.0],[11.8,33.1],[13.8,33.1],[15.8,33.1],[17.8,33.1],[19.7,33.1],[21.7,33.1],[23.7,33.1],[25.7,33.1],[27.6,33.1],[29.6,33.1],[31.6,33.1],[33.6,33.1],[35.5,33.1],[37.5,33.1],[39.5,33.1],[41.5,33.1],[43.4,33.1],[45.4,33.1],[47.4,33.1],[49.4,33.1],[51.3,33.1],[53.3,33.1],[55.3,33.1],[57.3,33.1],[59.2,33.1],[61.2,33.1],[63.2,33.1],[65.2,33.1],[67.1,33.1],[69.1,33.1],[71.1,33.1],[73.1,33.1],[75.0,33.1],[77.0,33.1],[79.0,33.1],[81.0,33.1],[82.9,33.1],[84.9,33.1],[86.9,33.1],[88.9,33.1],[96.8,33.1],[98.7,33.1],[11.8,31.1],[13.8,31.1],[15.8,31.1],[17.8,31.1],[19.7,31.1],[21.7,31.1],[23.7,31.1],[25.7,31.1],[27.6,31.1],[29.6,31.1],[31.6,31.1],[33.6,31.1],[35.5,31.1],[37.5,31.1],[39.5,31.1],[41.5,31.1],[43.4,31.1],[45.4,31.1],[47.4,31.1],[49.4,31.1],[51.3,31.1],[53.3,31.1],[55.3,31.1],[57.3,31.1],[59.2,31.1],[61.2,31.1],[63.2,31.1],[65.2,31.1],[67.1,31.1],[69.1,31.1],[71.1,31.1],[73.1,31.1],[75.0,31.1],[77.0,31.1],[79.0,31.1],[81.0,31.1],[82.9,31.1],[84.9,31.1],[86.9,31.1],[11.8,29.1],[13.8,29.1],[15.8,29.1],[17.8,29.1],[19.7,29.1],[21.7,29.1],[23.7,29.1],[25.7,29.1],[27.6,29.1],[29.6,29.1],[31.6,29.1],[33.6,29.1],[35.5,29.1],[37.5,29.1],[39.5,29.1],[41.5,29.1],[43.4,29.1],[45.4,29.1],[47.4,29.1],[49.4,29.1],[51.3,29.1],[53.3,29.1],[55.3,29.1],[57.3,29.1],[59.2,29.1],[61.2,29.1],[63.2,29.1],[65.2,29.1],[67.1,29.1],[69.1,29.1],[71.1,29.1],[73.1,29.1],[75.0,29.1],[77.0,29.1],[79.0,29.1],[81.0,29.1],[82.9,29.1],[84.9,29.1],[11.8,27.1],[13.8,27.1],[15.8,27.1],[17.8,27.1],[19.7,27.1],[21.7,27.1],[23.7,27.1],[25.7,27.1],[27.6,27.1],[29.6,27.1],[31.6,27.1],[33.6,27.1],[35.5,27.1],[37.5,27.1],[39.5,27.1],[41.5,27.1],[43.4,27.1],[45.4,27.1],[47.4,27.1],[49.4,27.1],[51.3,27.1],[53.3,27.1],[55.3,27.1],[57.3,27.1],[59.2,27.1],[61.2,27.1],[63.2,27.1],[65.2,27.1],[67.1,27.1],[69.1,27.1],[71.1,27.1],[73.1,27.1],[75.0,27.1],[77.0,27.1],[79.0,27.1],[81.0,27.1],[82.9,27.1],[11.8,25.2],[13.8,25.2],[15.8,25.2],[17.8,25.2],[19.7,25.2],[21.7,25.2],[23.7,25.2],[25.7,25.2],[27.6,25.2],[29.6,25.2],[31.6,25.2],[33.6,25.2],[35.5,25.2],[37.5,25.2],[39.5,25.2],[41.5,25.2],[43.4,25.2],[45.4,25.2],[47.4,25.2],[49.4,25.2],[51.3,25.2],[53.3,25.2],[55.3,25.2],[57.3,25.2],[59.2,25.2],[61.2,25.2],[63.2,25.2],[65.2,25.2],[67.1,25.2],[69.1,25.2],[71.1,25.2],[73.1,25.2],[75.0,25.2],[77.0,25.2],[79.0,25.2],[81.0,25.2],[11.8,23.2],[13.8,23.2],[15.8,23.2],[17.8,23.2],[19.7,23.2],[21.7,23.2],[23.7,23.2],[25.7,23.2],[27.6,23.2],[29.6,23.2],[31.6,23.2],[33.6,23.2],[35.5,23.2],[37.5,23.2],[39.5,23.2],[41.5,23.2],[43.4,23.2],[45.4,23.2],[47.4,23.2],[49.4,23.2],[51.3,23.2],[53.3,23.2],[55.3,23.2],[57.3,23.2],[59.2,23.2],[61.2,23.2],[63.2,23.2],[65.2,23.2],[67.1,23.2],[69.1,23.2],[71.1,23.2],[73.1,23.2],[75.0,23.2],[77.0,23.2],[79.0,23.2],[81.0,23.2],[11.8,21.2],[13.8,21.2],[15.8,21.2],[17.8,21.2],[19.7,21.2],[21.7,21.2],[23.7,21.2],[25.7,21.2],[27.6,21.2],[29.6,21.2],[31.6,21.2],[33.6,21.2],[35.5,21.2],[37.5,21.2],[39.5,21.2],[41.5,21.2],[43.4,21.2],[45.4,21.2],[47.4,21.2],[49.4,21.2],[51.3,21.2],[53.3,21.2],[55.3,21.2],[57.3,21.2],[59.2,21.2],[61.2,21.2],[63.2,21.2],[65.2,21.2],[67.1,21.2],[69.1,21.2],[71.1,21.2],[73.1,21.2],[75.0,21.2],[77.0,21.2],[79.0,21.2],[81.0,21.2],[11.8,19.2],[13.8,19.2],[15.8,19.2],[17.8,19.2],[19.7,19.2],[21.7,19.2],[23.7,19.2],[25.7,19.2],[27.6,19.2],[29.6,19.2],[31.6,19.2],[33.6,19.2],[35.5,19.2],[37.5,19.2],[39.5,19.2],[41.5,19.2],[43.4,19.2],[45.4,19.2],[47.4,19.2],[49.4,19.2],[51.3,19.2],[53.3,19.2],[55.3,19.2],[57.3,19.2],[59.2,19.2],[61.2,19.2],[63.2,19.2],[65.2,19.2],[67.1,19.2],[69.1,19.2],[71.1,19.2],[73.1,19.2],[75.0,19.2],[77.0,19.2],[79.0,19.2],[13.8,17.3],[15.8,17.3],[17.8,17.3],[19.7,17.3],[21.7,17.3],[23.7,17.3],[25.7,17.3],[27.6,17.3],[29.6,17.3],[31.6,17.3],[33.6,17.3],[35.5,17.3],[37.5,17.3],[39.5,17.3],[41.5,17.3],[43.4,17.3],[45.4,17.3],[47.4,17.3],[49.4,17.3],[51.3,17.3],[53.3,17.3],[55.3,17.3],[57.3,17.3],[59.2,17.3],[61.2,17.3],[63.2,17.3],[65.2,17.3],[67.1,17.3],[69.1,17.3],[71.1,17.3],[73.1,17.3],[75.0,17.3],[77.0,17.3],[13.8,15.3],[15.8,15.3],[17.8,15.3],[19.7,15.3],[21.7,15.3],[23.7,15.3],[25.7,15.3],[27.6,15.3],[29.6,15.3],[31.6,15.3],[33.6,15.3],[35.5,15.3],[37.5,15.3],[39.5,15.3],[41.5,15.3],[43.4,15.3],[45.4,15.3],[47.4,15.3],[49.4,15.3],[51.3,15.3],[53.3,15.3],[55.3,15.3],[57.3,15.3],[59.2,15.3],[61.2,15.3],[63.2,15.3],[65.2,15.3],[67.1,15.3],[69.1,15.3],[71.1,15.3],[73.1,15.3],[75.0,15.3],[77.0,15.3],[15.8,13.3],[17.8,13.3],[19.7,13.3],[21.7,13.3],[23.7,13.3],[25.7,13.3],[27.6,13.3],[29.6,13.3],[31.6,13.3],[33.6,13.3],[35.5,13.3],[37.5,13.3],[39.5,13.3],[41.5,13.3],[43.4,13.3],[45.4,13.3],[47.4,13.3],[49.4,13.3],[51.3,13.3],[53.3,13.3],[55.3,13.3],[57.3,13.3],[59.2,13.3],[61.2,13.3],[63.2,13.3],[65.2,13.3],[67.1,13.3],[69.1,13.3],[71.1,13.3],[73.1,13.3],[75.0,13.3],[77.0,13.3],[19.7,11.3],[21.7,11.3],[23.7,11.3],[25.7,11.3],[27.6,11.3],[29.6,11.3],[31.6,11.3],[33.6,11.3],[35.5,11.3],[37.5,11.3],[39.5,11.3],[41.5,11.3],[43.4,11.3],[45.4,11.3],[47.4,11.3],[49.4,11.3],[51.3,11.3],[53.3,11.3],[55.3,11.3],[57.3,11.3],[59.2,11.3],[61.2,11.3],[63.2,11.3],[65.2,11.3],[67.1,11.3],[69.1,11.3],[71.1,11.3],[73.1,11.3],[75.0,11.3],[77.0,11.3],[21.7,9.4],[23.7,9.4],[25.7,9.4],[27.6,9.4],[29.6,9.4],[31.6,9.4],[33.6,9.4],[35.5,9.4],[37.5,9.4],[39.5,9.4],[41.5,9.4],[43.4,9.4],[45.4,9.4],[47.4,9.4],[49.4,9.4],[51.3,9.4],[53.3,9.4],[55.3,9.4],[57.3,9.4],[59.2,9.4],[61.2,9.4],[63.2,9.4],[65.2,9.4],[67.1,9.4],[69.1,9.4],[71.1,9.4],[73.1,9.4],[75.0,9.4],[77.0,9.4],[21.7,7.4],[23.7,7.4],[25.7,7.4],[27.6,7.4],[29.6,7.4],[31.6,7.4],[33.6,7.4],[35.5,7.4],[37.5,7.4],[39.5,7.4],[41.5,7.4],[43.4,7.4],[45.4,7.4],[47.4,7.4],[49.4,7.4],[51.3,7.4],[53.3,7.4],[59.2,7.4],[61.2,7.4],[63.2,7.4],[65.2,7.4],[23.7,5.4],[25.7,5.4],[27.6,5.4],[29.6,5.4],[31.6,5.4],[33.6,5.4],[35.5,5.4],[37.5,5.4],[39.5,5.4],[41.5,5.4],[43.4,5.4],[45.4,5.4],[47.4,5.4],[25.7,3.4],[27.6,3.4],[29.6,3.4],[31.6,3.4],[33.6,3.4],[35.5,3.4],[37.5,3.4],[39.5,3.4],[41.5,3.4],[43.4,3.4],[45.4,3.4],[47.4,3.4],[35.5,1.5],[37.5,1.5],[39.5,1.5],[41.5,1.5],[43.4,1.5],[45.4,1.5],[47.4,1.5],[1.1,26.6],[2.0,27.3],[3.1,29.2],[3.6,28.9],[1.7,29.4],[3.9,27.9],[88.3,63.3],[88.9,63.9],[83.2,56.2],[83.8,55.0],[41.5,48.0],[42.5,46.4],[12.9,34.0]];

// ---------------- SHARED UI ----------------
const btnCircle = { width: 30, height: 30, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 15, color: T.ink, display: "inline-flex", alignItems: "center", justifyContent: "center" };
const btnGold = { background: T.gold, color: T.ink, border: "none", borderRadius: 999, padding: "11px 22px", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const btnGreen = { ...btnGold, background: T.green, color: "#fff" };
const input = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 10, border: `1px solid ${T.line}`, background: "#fff", fontSize: 14.5, fontFamily: "inherit", color: T.ink };
const label = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#1A1A1A", display: "block", marginTop: 14, marginBottom: 7 };
// ---------------- RANGE DATE PICKER (single calendar, from → to, past disabled) ----------------
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function RangeDate({ from, to, onChange, triggerStyle, minDate, wide, align = "left", single, up }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const todayStr = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const minStr = minDate || todayStr; // earliest selectable day
  const start = from ? new Date(from + "T00:00:00") : new Date(minStr + "T00:00:00");
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const minD = new Date(minStr + "T00:00:00");
  const canPrev = new Date(view.y, view.m, 1) > new Date(minD.getFullYear(), minD.getMonth(), 1);

  const pick = (ds) => {
    if (single) { onChange(ds, ds); setOpen(false); return; } // one date, pick & close
    if (!from || (from && to)) { onChange(ds, ""); return; }
    if (ds < from) { onChange(ds, ""); return; }
    onChange(from, ds); // wait for "Done" — do not auto-close
  };
  const label = single ? (from || "dd/mm/yyyy") : from ? (to ? `${from} → ${to}` : `${from} → …`) : "dd/mm/yyyy";

  const renderMonth = (y, m) => {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return (
      <div key={`${y}-${m}`} style={{ flex: 1, minWidth: wide ? 244 : 0 }}>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: wide ? 15 : 14, marginBottom: 8, textTransform: "capitalize" }}>{MONTHS[m]} {y}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, fontSize: 11.5, opacity: 0.55, marginBottom: 6 }}>
          {WD.map((w) => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: wide ? 3 : 2 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = iso(y, m, d);
            const past = ds < minStr;
            const isFrom = ds === from, isTo = ds === to;
            const inRange = from && to && ds > from && ds < to;
            const sel = isFrom || isTo;
            return (
              <button key={i} type="button" disabled={past} onClick={() => pick(ds)}
                style={{ border: "none", borderRadius: 9, padding: wide ? "11px 0" : "7px 0", fontSize: wide ? 14 : 13, cursor: past ? "not-allowed" : "pointer",
                  background: sel ? T.green : inRange ? "#E3F3E9" : "transparent", color: past ? "#C7CFCA" : sel ? "#fff" : T.ink, fontWeight: sel ? 700 : 500 }}>
                {d}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ ...(triggerStyle || {}), display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", cursor: "pointer", color: T.ink }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: from ? T.ink : "rgba(0,0,0,.8)" }}>{label}</span>
        <Calendar size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "absolute", top: up ? "auto" : "calc(100% + 6px)", bottom: up ? "calc(100% + 6px)" : "auto", left: align === "right" ? "auto" : 0, right: align === "right" ? 0 : "auto", zIndex: 91, background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 18px 40px rgba(0,0,0,.22)", padding: wide ? 20 : 14, width: wide ? "min(346px, calc(100vw - 28px))" : "min(290px, calc(100vw - 32px))", maxWidth: "94vw" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <button type="button" disabled={!canPrev} onClick={() => setView((v) => ({ y: v.m === 0 ? v.y - 1 : v.y, m: v.m === 0 ? 11 : v.m - 1 }))}
                style={{ ...btnCircle, opacity: canPrev ? 1 : 0.3, cursor: canPrev ? "pointer" : "not-allowed" }}>‹</button>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setView((v) => ({ y: v.m === 11 ? v.y + 1 : v.y, m: v.m === 11 ? 0 : v.m + 1 }))} style={btnCircle}>›</button>
            </div>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
              {renderMonth(view.y, view.m)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => { onChange("", ""); }} style={{ flex: 1, background: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Clear</button>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, background: T.green, color: "#fff", border: "none", borderRadius: 10, padding: "9px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- LIVE ADDRESS AUTOCOMPLETE (OpenStreetMap / Nominatim, Senegal) ----------------
function AddressInput({ value, onChange, placeholder, bare }) {
  const [q, setQ] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { setQ(value || ""); }, [value]);
  useEffect(() => {
    if (!q || q.trim().length < 3) { setResults([]); return; }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=sn&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { setResults([]); }
    }, 350);
    return () => clearTimeout(id);
  }, [q]);
  const preciseOf = (r) => r.name || (r.display_name || "").split(",")[0].trim();
  const contextOf = (r) => (r.display_name || "").split(",").slice(1).join(",").trim();
  const choose = (r) => { const p = preciseOf(r); onChange(p); setQ(p); setOpen(false); setResults([]); };
  return (
    <div style={{ position: "relative" }}>
      <input style={bare ? { border: "none", outline: "none", background: "transparent", fontSize: 14.5, fontFamily: "inherit", color: T.ink, width: "100%", padding: 0 } : input} value={q} placeholder={placeholder} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); }}
        onFocus={() => results.length && setOpen(true)} />
      {open && results.length > 0 && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 41, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 14px 34px rgba(0,0,0,.18)", overflow: "hidden", maxHeight: 260, overflowY: "auto", minWidth: bare ? 340 : 0 }}>
            {results.map((r, i) => (
              <button key={i} onClick={() => choose(r)} style={{ display: "flex", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${T.line}`, padding: "10px 12px", cursor: "pointer", lineHeight: 1.35, color: T.ink, alignItems: "flex-start" }}>
                <MapPin size={15} style={{ flexShrink: 0, marginTop: 2, color: T.green }} />
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{preciseOf(r)}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contextOf(r)}</div>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- LIVE AIRPORT AUTOCOMPLETE (worldwide, keyless — TravelPayouts) ----------------
function AirportInput({ value, onChange, placeholder, wide, Icon }) {
  const [q, setQ] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { setQ(value || ""); }, [value]);
  useEffect(() => {
    if (!q || q.trim().length < 2) { setResults([]); return; }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`https://autocomplete.travelpayouts.com/places2?locale=fr&types[]=airport&types[]=city&term=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
        const data = await res.json();
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);
  const labelOf = (r) => `${r.city_name || r.name} (${r.code})`;
  const contextOf = (r) => [r.name && r.name !== r.city_name ? r.name : null, r.country_name].filter(Boolean).join(" · ");
  const choose = (r) => { const p = labelOf(r); onChange(p); setQ(p); setOpen(false); setResults([]); };
  const short = !q || q.trim().length < 2;
  const inputEl = (
    <input value={q} placeholder={placeholder} autoComplete="off"
      style={Icon ? { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14.5, fontFamily: "inherit", color: T.ink, padding: "11px 0" } : input}
      onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)} />
  );
  return (
    <div style={{ position: "relative" }}>
      {Icon ? (
        <div style={{ ...input, display: "flex", alignItems: "center", gap: 9, padding: "0 13px" }}>
          <Icon size={18} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
          {inputEl}
        </div>
      ) : inputEl}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 41, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 18px 44px rgba(0,0,0,.22)", overflow: "hidden", width: wide ? "min(430px, calc(100vw - 28px))" : "100%", minWidth: wide ? 360 : 0, maxHeight: 340, overflowY: "auto" }}>
            {short ? (
              <div style={{ padding: "34px 20px", textAlign: "center", color: "rgba(0,0,0,.8)" }}>
                <Search size={30} style={{ opacity: 0.55, marginBottom: 10 }} />
                <div style={{ fontSize: 14.5 }}>Search by city or airport</div>
              </div>
            ) : results.length > 0 ? results.map((r, i) => (
              <button key={i} onClick={() => choose(r)} style={{ display: "flex", gap: 12, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${T.line}`, padding: "13px 16px", cursor: "pointer", lineHeight: 1.4, color: T.ink, alignItems: "flex-start" }}>
                <Plane size={18} style={{ flexShrink: 0, marginTop: 2, color: T.ink }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{r.city_name || r.name} <span style={{ color: T.ink }}>({r.code})</span></div>
                  <div style={{ fontSize: 13, opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contextOf(r)}</div>
                </span>
              </button>
            )) : (
              <div style={{ padding: "22px 20px", textAlign: "center", color: "rgba(0,0,0,.8)", fontSize: 13.5 }}>No results</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- TERMS & CANCELLATION POLICY (from ATS General Terms of Sale) ----------------
const TERMS_SECTIONS = [
  { h: "Payment terms", items: [
    "A minimum deposit of 30% of the total amount is required to confirm any reservation.",
    "The balance must be paid no later than 7 days before the start of the service. Beyond this deadline the reservation may be automatically cancelled without notice, unless otherwise agreed.",
    "For reservations made less than 7 days before departure, full payment is required.",
    "Ma Tontine Voyage (installment plan): available through our internal system. The reservation is only confirmed once the full agreed amount has been paid. If the payment deadlines are not met, ATS reserves the right to cancel the reservation without refunding the amounts already paid.",
  ] },
  { h: "Accepted payment methods", items: [
    "Bank transfer.",
    "Credit card (Visa, MasterCard, etc.) — 3.75% bank fee (applicable to payments made via foreign payment methods).",
    "Mobile payments (Wave, Orange Money).",
    "Secure online payment solutions (PayPal, Stripe, Zelle…) for specific cases.",
    "Cash payment — 1% fee in accordance with Law No. 2025-17 of 27 September 2025, for any payment exceeding 20,000 FCFA.",
    "All transactions are processed through secure platforms compliant with data-protection standards.",
  ] },
  { h: "Cancellation policy (strict)", note: "The following applies unless otherwise specified by a third-party product or supplier:", items: [
    "Less than 30 days before departure: 10% retained.",
    "Less than 10 days before departure: 30% retained.",
    "Less than 7 days before departure: 50% retained.",
    "Less than 3 days before departure: 100% retained (no refund).",
    "Refunds are processed within 3 to 5 days.",
    "Airfare: subject to airline fare conditions — some tickets are non-refundable and non-changeable after issuance.",
    "Other activities (hotels, tours, excursions, visa assistance, events): the partner providers' penalties apply in full.",
  ] },
  { h: "Force majeure", items: [
    "In the event of force majeure (natural disaster, government decision, health crisis, social unrest…), ATS will, together with the client, reschedule the service or offer a voucher valid for 6 months.",
    "No immediate refund can be required if the service providers impose restrictions.",
  ] },
  { h: "Liability", items: [
    "Africa Tourism Solutions acts as an intermediary between the client and airlines, hotels and other providers, and cannot be held responsible for delays, cancellations or changes attributable to those providers. ATS remains committed to quality service and continuous customer satisfaction.",
  ] },
];

function TermsContent() {
  return (
    <div>
      <p style={{ fontSize: 13.5, color: "#6B7A72", marginTop: 0 }}>General Terms & Conditions of Sale, Payment and Cancellation.</p>
      {TERMS_SECTIONS.map((s) => (
        <div key={s.h} style={{ marginTop: 18 }}>
          <h4 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: T.green, margin: "0 0 8px" }}>{s.h}</h4>
          {s.note && <p style={{ fontSize: 13.5, color: "rgba(0,0,0,.8)", margin: "0 0 8px" }}>{s.note}</p>}
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 }}>
            {s.items.map((it, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>{it}</li>)}
          </ul>
        </div>
      ))}
      <div style={{ marginTop: 20, background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>
        By making a reservation with Africa Tourism Solutions, the client acknowledges having read, understood and accepted these payment and cancellation terms.
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "#8A968E" }}>Africa Tourism Solutions · Immeuble SICAP, Point E, Lot 8 Apt A, Dakar, Senegal · +221 33 825 12 79 · infos@africatourismsolutions.com</div>
    </div>
  );
}

// Inline link that opens the terms in a modal (keeps the current form intact).
function TermsLink({ style, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: T.green, fontWeight: 700, textDecoration: "underline", fontSize: "inherit", fontFamily: "inherit", ...style }}>
        {children || "Terms & Cancellation Policy"}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(20,32,26,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", padding: "24px 26px", color: T.ink }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, margin: 0, flex: 1 }}>Terms & Cancellation Policy</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ ...btnCircle }}><X size={16} /></button>
            </div>
            <TermsContent />
            <button onClick={() => setOpen(false)} style={{ ...btnGold, width: "100%", marginTop: 18 }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

function TermsPage() {
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  return (
    <Wrap style={{ maxWidth: 820 }}>
      <Eyebrow>Africa Tourism Solutions</Eyebrow>
      <H2>Terms & Cancellation Policy</H2>
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: "24px 26px" }}>
        <TermsContent />
      </div>
    </Wrap>
  );
}

// Mandatory acceptance checkbox — must be ticked before a paid booking can proceed.
const TermsCheck = ({ checked, onChange }) => (
  <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, color: "rgba(0,0,0,.8)", marginTop: 12, lineHeight: 1.5, cursor: "pointer" }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 17, height: 17, accentColor: T.green, flexShrink: 0, marginTop: 1, cursor: "pointer" }} />
    <span>I have read and accept the <TermsLink /> (payment & cancellation conditions).</span>
  </label>
);

// ---- Promo / ambassador code (shared) — server validates the discount % ----
function usePromo(total) {
  const [code, setCode] = useState(() => { try { return (localStorage.getItem("ats_ref") || "").toUpperCase(); } catch { return ""; } });
  const [promo, setPromo] = useState(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const c = code.trim();
    if (!c || !total) { setPromo(null); setChecking(false); return; }
    setChecking(true);
    const id = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("validate-promo", { body: { code: c, amount: total } });
        setPromo(data && data.valid ? data : { valid: false });
      } catch { setPromo({ valid: false }); }
      finally { setChecking(false); }
    }, 400);
    return () => clearTimeout(id);
  }, [code, total]);
  const valid = !!(promo && promo.valid);
  const corporate = CORP_DISCOUNT > 0;          // corporate rate takes priority over codes
  const pct = corporate ? CORP_DISCOUNT : (valid ? Number(promo.discount_percent) || 0 : 0);
  const payTotal = Math.round((total || 0) * (1 - pct / 100));
  const label = corporate ? "Corporate rate" : (valid ? `Promo ${promo.code}` : "");
  return { code, setCode, promo, checking, valid, corporate, pct, payTotal, label, active: corporate || valid };
}

function PromoField({ p }) {
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ ...label, marginTop: 0 }}>Promo / ambassador code (optional)</label>
      <input style={input} value={p.code} onChange={(e) => p.setCode(e.target.value.toUpperCase())} placeholder="e.g. AWA10" autoComplete="off" />
      {p.code.trim() && (
        p.checking
          ? <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 6 }}>Checking…</div>
          : p.valid
            ? <div style={{ fontSize: 12.5, color: T.green, fontWeight: 700, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}><Check size={14} /> Code applied — {p.pct}% off</div>
            : <div style={{ fontSize: 12.5, color: "#B3261E", marginTop: 6 }}>Invalid or expired code.</div>
      )}
    </div>
  );
}

const Eyebrow = ({ children }) => <p style={{ color: T.laterite, fontWeight: 600, letterSpacing: ".14em", fontSize: 12, textTransform: "uppercase", margin: 0 }}>{children}</p>;
const H2 = ({ children }) => <h2 className="disp" style={{ fontSize: "clamp(22px,3.2vw,30px)", fontWeight: 700, letterSpacing: "-0.01em", margin: "8px 0 14px" }}>{children}</h2>;
const Wrap = ({ children, style }) => <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 20px", ...style }}>{children}</div>;
const Section = ({ title, children }) => (
  <section style={{ marginTop: 30 }}>
    <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.01em" }}>{title}</h2>
    {children}
  </section>
);
function Row({ l, v }) { return <div style={{ display: "flex", padding: "4px 0" }}><span style={{ opacity: 0.75 }}>{l}</span><span style={{ marginLeft: "auto", fontWeight: 600 }}>{v}</span></div>; }

// Corporate preferential price on cards: shows the base struck-through + the discounted price.
const corpPrice = (n) => Math.round((n || 0) * (1 - CORP_DISCOUNT / 100));
function PrefPrice({ base, prefix = "from ", pp = true }) {
  if (base == null) return null;
  const disc = CORP_DISCOUNT > 0;
  return (
    <span>
      {prefix}
      {disc && <span style={{ textDecoration: "line-through", opacity: 0.45, fontWeight: 500, marginRight: 5 }}>{fmtXOF(base)}</span>}
      <span style={{ color: disc ? T.green : "inherit" }}>{fmtXOF(disc ? corpPrice(base) : base)}</span>
      {pp && <span style={{ fontWeight: 500, fontSize: 11.5, color: "rgba(0,0,0,.8)" }}> pp</span>}
    </span>
  );
}

// ============================================================
export default function ATSPlatformPreview() {
  const [page, setPage] = useState(() => {
    try { const s = sessionStorage.getItem("ats_page"); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return { name: "home" };
  });
  useEffect(() => { try { sessionStorage.setItem("ats_page", JSON.stringify(page)); } catch { /* ignore */ } }, [page]);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [favorites, setFavorites] = useState([]); // array of tour_id strings (per signed-in user)
  const [booking, setBooking] = useState(null);
  const [signin, setSignin] = useState(false);
  const [chat, setChat] = useState(false);
  const [filters, setFilters] = useState({ pole: "All", tag: "All" });

  // ---- Display currency (XOF | USD | EUR). Prices are stored in XOF. ----
  const [currency, setCurrency] = useState(() => { try { return localStorage.getItem("ats_cur") || null; } catch { return null; } });
  setActiveCurrency(currency); // apply on every render so all price formatters use it
  useEffect(() => { if (currency) { try { localStorage.setItem("ats_cur", currency); } catch { /* */ } } }, [currency]);
  // Auto-detect default currency by geolocation on first visit (no stored choice).
  useEffect(() => {
    if (currency) return;
    let alive = true;
    const XOF_CC = ["SN", "CI", "ML", "BF", "BJ", "NE", "TG", "GW"];
    const EUR_CC = ["FR", "BE", "DE", "ES", "IT", "PT", "NL", "LU", "IE", "AT", "FI", "GR", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"];
    fetch("https://ipwho.is/?fields=country_code")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const cc = (d && d.country_code) || "";
        setCurrency(XOF_CC.includes(cc) ? "XOF" : EUR_CC.includes(cc) ? "EUR" : cc ? "USD" : "XOF");
      })
      .catch(() => { if (alive) setCurrency("XOF"); });
    return () => { alive = false; };
  }, []);

  const notify = (msg) => { setToast(msg); };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  // ---- Supabase auth session ----
  const mapUser = (sUser) => {
    if (!sUser) return null;
    const m = sUser.user_metadata || {};
    const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.full_name || m.name || (sUser.email ? sUser.email.split("@")[0] : "Traveler");
    return { id: sUser.id, email: sUser.email, name };
  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(mapUser(data.session?.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(mapUser(session?.user)));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- Account role (client | agent | corporate | admin) + corporate rate ----
  const [role, setRole] = useState(null);
  const [corpDiscount, setCorpDiscountState] = useState(0);
  const [corpActive, setCorpActive] = useState(false); // active corporate account → pay-later
  useEffect(() => {
    if (!user?.id) { setRole(null); setCorpDiscountState(0); setCorpActive(false); return; }
    let alive = true;
    supabase.from("profiles").select("role, org_id").eq("id", user.id).single()
      .then(async ({ data }) => {
        if (!alive) return;
        setRole(data?.role || "client");
        if (data?.role === "corporate" && data?.org_id) {
          const { data: org } = await supabase.from("organizations").select("discount_percent, active").eq("id", data.org_id).single();
          if (alive) { setCorpActive(!!(org && org.active)); setCorpDiscountState(org && org.active ? (Number(org.discount_percent) || 0) : 0); }
        } else if (alive) { setCorpActive(false); setCorpDiscountState(0); }
      });
    return () => { alive = false; };
  }, [user?.id]);
  setCorpDiscount(role === "corporate" ? corpDiscount : 0);
  const isCorporate = role === "corporate" && corpActive;
  setIsCorporate(isCorporate);

  // ---- Load this user's bookings from the database (and save any made before sign-in) ----
  const [pending, setPending] = useState([]);
  const mapRow = (r) => ({ ...r.data, _id: r.id, _status: r.status || "pending", _created: r.created_at });
  const reloadBookings = async (uid) => {
    const { data, error } = await supabase.from("bookings").select("id, data, status, created_at").eq("user_id", uid).order("created_at", { ascending: false });
    if (!error && data) setBookings(data.map(mapRow));
  };
  // ---- Favorites (per user) ----
  const reloadFavorites = async (uid) => {
    const { data, error } = await supabase.from("favorites").select("tour_id").eq("user_id", uid);
    if (!error && data) setFavorites(data.map((r) => r.tour_id));
  };
  const toggleFavorite = async (tourId) => {
    if (!user) { setSignin(true); notify("Sign in to save your favorites."); return; }
    const isFav = favorites.includes(tourId);
    setFavorites((f) => (isFav ? f.filter((x) => x !== tourId) : [...f, tourId])); // optimistic
    if (isFav) await supabase.from("favorites").delete().eq("user_id", user.id).eq("tour_id", tourId);
    else await supabase.from("favorites").insert({ user_id: user.id, tour_id: tourId });
    notify(isFav ? "Removed from favorites" : "Saved to favorites");
  };
  useEffect(() => {
    if (!user) { setBookings([]); setFavorites([]); return; }
    const sync = async () => {
      if (pending.length) {
        await supabase.from("bookings").insert(pending.map((b) => ({ user_id: user.id, data: b })));
        setPending([]);
      }
      await reloadBookings(user.id);
      await reloadFavorites(user.id);
    };
    sync();
  }, [user?.id]);

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); setBookings([]); setFavorites([]); go("home"); notify("Signed out"); };

  // ---- Persist a record (booking / quote / itinerary request) ----
  // Remember guest bookings in this browser so the client can find them again
  const rememberGuest = (entry) => {
    try {
      const list = JSON.parse(localStorage.getItem("ats_guest_bookings") || "[]");
      localStorage.setItem("ats_guest_bookings", JSON.stringify([entry, ...list.filter((x) => x.id !== entry.id)].slice(0, 20)));
    } catch { /* ignore */ }
  };
  const bookingSummary = (b) => {
    const rows = [];
    if (b.tour?.name) rows.push(["Item", b.tour.name]);
    const d = b.dateFrom || b.date; if (d) rows.push(["Date", String(d)]);
    const pax = (b.adults || 0) + (b.children || 0); if (pax) rows.push(["Travelers", String(pax)]);
    if (b.total) rows.push(["Total", fmtXOF(b.total)]);
    rows.push(["Plan", planLabel(b.plan)]);
    return rows;
  };
  const saveRecord = async (b) => {
    if (user) {
      const { data, error } = await supabase.from("bookings").insert({ user_id: user.id, data: b, status: b.status || "pending" }).select("id, data, status, created_at").single();
      if (error) { console.error("Save failed:", error.message); return null; }
      const rec = mapRow(data);
      setBookings((x) => [rec, ...x]);
      return rec;
    }
    // Guest booking — persist server-side, keyed by email + reference + magic token
    const email = b.contact?.email || "";
    if (email) {
      try {
        const { data, error } = await supabase.functions.invoke("guest-booking", { body: { data: { ...b, status: b.status || "pending" }, email } });
        if (!error && data?.id) {
          const rec = { ...b, _id: data.id, _status: b.status || "pending", _ref: data.ref, _token: data.manageToken, _guest: true };
          setBookings((x) => [rec, ...x]);
          rememberGuest({ id: data.id, ref: data.ref, token: data.manageToken, email, created: Date.now() });
          const manageUrl = `${window.location.origin}/?manage=${data.manageToken}`;
          const kind = b.plan === "quote" ? "quote" : b.plan === "itinerary" ? "itinerary" : "booking";
          supabase.functions.invoke("send-confirmation", { body: { to: email, name: b.contact?.name || "", kind, reference: data.ref, manageUrl, summary: bookingSummary(b) } }).catch(() => {});
          return rec;
        }
      } catch { /* fall through to local */ }
    }
    const local = { ...b, _status: b.status || "pending" };
    setBookings((x) => [local, ...x]);
    setPending((p) => [...p, b]);
    return local;
  };

  // ---- PayDunya : create invoice + redirect ----
  const startPayment = async (b) => {
    const amount = b.plan === "deposit" ? Math.round(b.deposit) : Math.round(b.total);
    if (!amount || amount <= 0) { notify("Nothing to pay for this item."); return; }
    notify("Redirecting to secure payment…");
    const rec = await saveRecord({ ...b, status: "pending" });
    const fn = b.payMethod === "stripe" ? "create-stripe-checkout" : "create-payment";
    const { data, error } = await supabase.functions.invoke(fn, {
      body: {
        amount,
        description: `${b.tour?.name || "ATS booking"}${b.plan === "deposit" ? " — 20% deposit" : ""}`,
        bookingId: rec?._id || null,
        customer: b.contact || {},
        siteUrl: window.location.origin,
        meta: { kind: b.plan === "deposit" ? "deposit" : "full" },
        promoCode: b.promoCode || "",
      },
    });
    if (error || !data?.url) { notify("Payment could not be started. Please try again."); return; }
    window.location.href = data.url;
  };

  // ---- Pay one Ma Tontine instalment via PayDunya (client-chosen amount) ----
  const payInstallment = async (rec, amountArg, payMethod = "paydunya") => {
    if (!rec._id) { notify("This booking can't be paid online yet."); return; }
    const st = tontineState(rec);
    const amount = Math.round(amountArg != null ? amountArg : st.minNext);
    if (!amount || amount <= 0) { notify("Nothing left to pay on this booking."); return; }
    const nextNo = st.payCount + 1;
    notify("Redirecting to secure payment…");
    const fn = payMethod === "stripe" ? "create-stripe-checkout" : "create-payment";
    const { data, error } = await supabase.functions.invoke(fn, {
      body: {
        amount,
        description: `${rec.tour?.name || "ATS booking"} — payment ${nextNo}/${st.plannedTotal}`,
        bookingId: rec._id,
        customer: rec.contact || {},
        siteUrl: window.location.origin,
        meta: { kind: "installment", amount },
      },
    });
    if (error || !data?.url) { notify("Payment could not be started. Please try again."); return; }
    window.location.href = data.url;
  };

  // ---- Update / cancel a record ----
  const patchBooking = async (rec, changes) => {
    const merged = { ...rec, ...changes };
    setBookings((list) => list.map((x) => (x === rec ? merged : x)));
    if (user && rec._id) {
      const { _id, _status, _created, ...data } = merged;
      await supabase.from("bookings").update({ data, status: changes._status || rec._status }).eq("id", rec._id);
    }
  };
  const cancelBooking = async (rec) => {
    await patchBooking(rec, { _status: "cancelled" });
    notify("Request cancelled.");
  };

  // ---- Client self-service (modify / cancel) — rules & refund enforced server-side ----
  // For a signed-in owner we pass the booking id (JWT proves ownership); for a guest, the
  // manage_token from the magic link. Returns the authoritative updated booking view.
  const manageBooking = async (action, { id, token, change } = {}) => {
    const { data, error } = await supabase.functions.invoke("manage-booking", { body: { action, id, token, change } });
    if (error || !data?.booking) {
      let msg = "Something went wrong — please try again.";
      try { msg = (await error?.context?.json())?.error || msg; } catch { /* ignore */ }
      return { error: data?.error || msg };
    }
    const v = data.booking;
    // Reflect the change in the in-memory list (matched by id)
    setBookings((list) => list.map((x) => (x._id === v.id ? { ...x, ...v.data, _status: v.status, _id: v.id } : x)));
    return { booking: v };
  };

  const [pendingPay, setPendingPay] = useState(null);
  const go = (name, params = {}) => {
    const p = { name, ...params };
    setBooking(null); // close the checkout modal if it's open, so the new page is visible
    try { window.history.pushState({ atsPage: p }, ""); } catch { /* ignore */ }
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  // Browser back/forward: keep in-app navigation in the history stack so the
  // back button steps through pages instead of leaving the site.
  useEffect(() => {
    try { window.history.replaceState({ atsPage: page }, ""); } catch { /* ignore */ }
    const onPop = (e) => {
      const p = (e.state && e.state.atsPage) || { name: "home" };
      setBooking(null); // never leave the checkout modal stuck over a changed page
      setPage(p);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Corporate "Book now, pay later": record the booking as an invoice (owed), no payment now.
  const bookCorporate = async (b) => {
    const { data, error } = await supabase.functions.invoke("corporate-booking", { body: { data: { ...b, status: "invoiced" } } });
    if (error || !data?.id) {
      let msg = "Could not record your corporate booking.";
      try { msg = (await error?.context?.json())?.error || msg; } catch { /* ignore */ }
      notify(msg);
      return;
    }
    setBookings((x) => [{ ...data.booking, _id: data.id, _status: "invoiced" }, ...x]);
    if (b.contact?.email) {
      supabase.functions.invoke("send-confirmation", { body: { to: b.contact.email, name: b.contact.name || "", kind: "booking", summary: [["Item", b.tour?.name || "Booking"], ["Amount due", fmtXOF(data.owed)], ["Billing", `${data.orgName} · pay later`]] } }).catch(() => {});
    }
    notify(`Booked on your corporate account — ${fmtXOF(data.owed)} added to your ATS invoice.`);
    go("account");
  };

  const confirmBooking = (b) => {
    setBooking(null);
    // Corporate members book without paying now (invoiced) — for any paid item
    if (isCorporate && b.plan !== "quote" && b.plan !== "itinerary") {
      bookCorporate(b);
      return;
    }
    // Ma Tontine Voyage — a free account is mandatory (instalments must be traced)
    if (b.plan === "deposit" && !user) {
      setPendingPay(b); setSignin(true);
      notify("Create a free account to book with Ma Tontine Voyage — it lets us track your instalments.");
      return;
    }
    // Quote / itinerary requests: no payment, just save + notify
    if (b.plan === "quote" || b.plan === "itinerary") {
      saveRecord(b);
      notify(user ? "Request sent — an ATS advisor will reply with a personalised price." : "Request sent — your reference is on its way by email. An ATS advisor will reply shortly.");
      if (user) go("account");
      return;
    }
    // Paid booking — full payment works for guests too (deposit handled above)
    startPayment(b);
  };

  // Resume payment right after the user signs in
  useEffect(() => {
    if (user && pendingPay) { const b = pendingPay; setPendingPay(null); startPayment(b); }
  }, [user?.id]);

  // Capture an ambassador referral link (?ref=CODE) → remember it to prefill the promo field
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      try { localStorage.setItem("ats_ref", ref.toUpperCase()); } catch { /* ignore */ }
      params.delete("ref");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  // Guest booking magic link (?manage=<token>) → open the self-service management page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mt = params.get("manage");
    if (!mt) return;
    params.delete("manage");
    const qs = params.toString();
    window.history.replaceState({ atsPage: { name: "manage", token: mt } }, "", window.location.pathname + (qs ? `?${qs}` : ""));
    setPage({ name: "manage", token: mt });
    window.scrollTo({ top: 0 });
  }, []);

  // Handle return from PayDunya (?payment=success|cancel[&token=…]) → confirm + show page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("payment");
    const token = params.get("token");
    const provider = params.get("provider");
    if (!p) return;
    // Leave a "home" entry behind the payment page and push the payment page on top,
    // so the browser back button returns to the app instead of bouncing to the payment provider.
    window.history.replaceState({ atsPage: { name: "home" } }, "", window.location.pathname);
    window.history.pushState({ atsPage: { name: "payment", status: p } }, "", window.location.pathname);
    setPage({ name: "payment", status: p });
    window.scrollTo({ top: 0 });
    if (p === "success" && token) {
      // PayDunya safety net: confirm server-side even if the async IPN didn't arrive
      supabase.functions.invoke("confirm-payment", { body: { token } })
        .then(() => supabase.auth.getSession())
        .then(({ data }) => { const uid = data.session?.user?.id; if (uid) reloadBookings(uid); });
    } else if (p === "success" && provider === "stripe") {
      // Stripe: the webhook confirms authoritatively; refresh bookings so the paid status shows.
      supabase.auth.getSession()
        .then(({ data }) => { const uid = data.session?.user?.id; if (uid) reloadBookings(uid); });
    }
  }, []);

  const ctx = { go, notify, setBooking, user, setUser, role, isCorporate, corpDiscount: isCorporate ? corpDiscount : 0, isAdmin: role === "admin" || role === "super_admin", isSuper: role === "super_admin", bookings, favorites, toggleFavorite, filters, setFilters, setSignin, setChat, signOut, saveRecord, patchBooking, cancelBooking, manageBooking, payInstallment, currency, setCurrency };

  return (
    <div style={{ background: T.paper, color: T.ink, fontFamily: "'Century Gothic','Poppins',system-ui,sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        .disp{font-family:'Century Gothic','Poppins',sans-serif;letter-spacing:0}
        .card-hover{transition:transform .25s ease,box-shadow .25s ease}
        .card-hover:hover{transform:translateY(-4px);box-shadow:0 16px 32px rgba(20,32,26,.14)}
        .pulse{animation:pulse 2.2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes slideup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
        .toast{animation:slideup .25s ease}
        @media (prefers-reduced-motion:reduce){.card-hover,.pulse,.toast{transition:none;animation:none}}
        button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid ${T.gold};outline-offset:2px}
      `}</style>

      <Nav {...ctx} page={page} overHero={page.name === "home"} />
      {page.name !== "home" && <div style={{ height: 60 }} />}
      {booking ? (
        <BookingModal tour={booking} user={user} onClose={() => setBooking(null)} onConfirm={confirmBooking} />
      ) : (
        <>
          {page.name === "home" && <Home {...ctx} addBookingHome={confirmBooking} />}
          {page.name === "tours" && <ToursPage {...ctx} />}
          {page.name === "tour" && <TourDetail {...ctx} tourId={page.id} initialDate={page.date} initialPax={page.pax} />}
          {page.name === "builder" && <TripBuilder {...ctx} />}
          {page.name === "flights" && <FlightsPage {...ctx} initial={page.fp} initialLegs={page.flegs} />}
          {page.name === "transport" && <TransportPage addBooking={confirmBooking} notify={notify} user={user} go={go} initialRental={page.rental} />}
          {page.name === "transferCheckout" && <TransferCheckoutPage detail={page.detail} user={user} go={go} onConfirm={confirmBooking} />}
          {page.name === "events" && <EventsPage {...ctx} />}
          {page.name === "micework" && <MiceWorkPage {...ctx} service={page.service} />}
          {page.name === "corporate" && <CorporatePage {...ctx} />}
          {page.name === "agents" && <AgentsPage {...ctx} />}
          {page.name === "agent" && <AgentPortal {...ctx} />}
          {page.name === "admin" && <AdminConsole {...ctx} />}
          {page.name === "blog" && <BlogPage go={go} />}
          {page.name === "article" && <ArticlePage slug={page.slug} go={go} />}
          {page.name === "about" && <AboutPage {...ctx} />}
          {page.name === "account" && <AccountPage {...ctx} />}
          {page.name === "payment" && <PaymentResult status={page.status} {...ctx} />}
          {page.name === "manage" && <ManageBookingPage token={page.token} {...ctx} />}
          {page.name === "terms" && <TermsPage />}
        </>
      )}
      <Footer {...ctx} />
      {signin && <SignInModal onClose={() => setSignin(false)} notify={notify} onDone={(msg) => { setSignin(false); if (msg) notify(msg); }} />}
      {chat && <AIChat onClose={() => setChat(false)} go={go} />}

      {/* Floating WhatsApp + AI */}
      <div style={{ position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 10, zIndex: 50 }}>
        <a href="https://wa.me/221774807878?text=Bonjour%20ATS%2C%20j'aimerais%20plus%20d'informations." target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "#25D366", color: "#fff", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
        <button onClick={() => setChat(true)} aria-label="AI assistant" style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: T.indigo, color: "#fff", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={20} /></button>
      </div>

      {toast && (
        <div className="toast" role="status" style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: T.ink, color: T.paper, padding: "12px 20px", borderRadius: 12, fontSize: 14, zIndex: 90, maxWidth: "90vw", boxShadow: "0 10px 26px rgba(0,0,0,.3)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------- NAV ----------------
const GLASS = { background: "rgba(255,255,255,.45)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.55)", boxShadow: "0 6px 22px rgba(11,46,27,.12)" };

// Compact custom dropdown for the nav (language / currency)
// Small country flag (via flagcdn) — used for the language selector.
const LANG_FLAG = { EN: "gb", FR: "fr" };
const Flag = ({ lang, size = 22 }) => (
  <img src={`https://flagcdn.com/w40/${LANG_FLAG[lang] || "gb"}.png`} alt={lang} loading="lazy"
    style={{ width: size, height: Math.round(size * 0.68), objectFit: "cover", borderRadius: 3, display: "block", boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }} />
);

function NavSelect({ value, options, onChange, trigger, full, ghost, ink, optionRender }) {
  const [open, setOpen] = useState(false);
  const c = ghost ? (ink || "#fff") : T.ink;
  return (
    <div style={{ position: "relative", width: full ? "100%" : "auto" }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 41 }} />}
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: full ? "space-between" : "center", gap: 6, width: full ? "100%" : "auto", background: ghost ? "transparent" : "#fff", border: `1px solid ${ghost ? "rgba(255,255,255,.45)" : T.line}`, borderRadius: 999, padding: "7px 10px 7px 12px", cursor: "pointer", color: c, fontFamily: "inherit" }}>
        {trigger}
        <ChevronDown size={15} color={c} style={{ marginLeft: 2, flexShrink: 0 }} />
      </button>
      {open && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, left: full ? 0 : "auto", zIndex: 42, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 14px 34px rgba(0,0,0,.16)", overflow: "hidden", minWidth: 130 }}>
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "10px 16px", border: "none", background: value === o ? T.paperDark : "#fff", color: T.ink, fontWeight: value === o ? 700 : 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{optionRender ? optionRender(o) : o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// 3×3 dots menu icon (Tourm style)
const NineDots = ({ color = "#111", size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill={color} aria-hidden="true">
    {[3, 11, 19].map((y) => [3, 11, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />))}
  </svg>
);

function Nav({ go, page, user, setSignin, bookings, currency, setCurrency, setChat, overHero }) {
  const [open, setOpen] = useState(false);
  const [prefOpen, setPrefOpen] = useState(false);
  const [servOpen, setServOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const logoDark = supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/logo.png").data.publicUrl;
  const logoWhite = supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/logo-white.png").data.publicUrl;
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const transparent = overHero && !scrolled && !open;
  const ink = transparent ? "#fff" : T.ink;

  const links = [
    ["home", "Home"], ["tours", "Tours"], ["builder", "Trip Builder"], ["transport", "Transports"], ["flights", "Flights"],
    ["events", "MICE"], ["corporate", "Corporate"], ["agents", "Agents"], ["blog", "Blog"], ["about", "About Us"],
  ];
  const leftLinks = [["tours", "Tours"], ["transport", "Transports"]];
  const rightLinks = [["builder", "Trip Builder"], ["events", "MICE"]];
  const nav = (k) => { go(k); setOpen(false); };
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("ats_lang") || "EN"; } catch { return "EN"; } });
  useEffect(() => { try { localStorage.setItem("ats_lang", lang); } catch { /* */ } }, [lang]);
  const cur = currency || "XOF";
  const prefs = (full) => (
    <div style={{ display: "flex", alignItems: "center", gap: full ? 10 : 8, flexWrap: "wrap", width: full ? "100%" : "auto" }}>
      <NavSelect full={full} value={lang} options={["EN", "FR"]} onChange={setLang} trigger={<Globe size={17} color="#111" strokeWidth={2} />} />
      <NavSelect full={full} value={cur} options={["XOF", "USD", "EUR"]} onChange={setCurrency} trigger={<span style={{ fontWeight: 700, fontSize: 12.5 }}>{cur}</span>} />
    </div>
  );
  const accountBtn = (full) => user ? (
    <button onClick={() => nav("account")} style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center", color: "#fff", background: T.green, padding: "11px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, width: full ? "100%" : "auto" }}>
      <UserRound size={17} strokeWidth={2.2} /> {user.name.split(" ")[0]} {bookings.length > 0 && `· ${bookings.length}`}
    </button>
  ) : (
    <button onClick={() => { setSignin(true); setOpen(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center", color: "#fff", background: T.green, padding: "11px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, width: full ? "100%" : "auto" }}><UserRound size={17} strokeWidth={2.2} /> Sign in</button>
  );
  const topNav = [["tours", "Tours", MapIcon], ["transport", "Transport", Car], ["flights", "Flights", Plane], ["builder", "Trip Builder", Sparkles]];
  const TopLink = ({ k, l, Ico }) => {
    const active = page.name === k;
    return (
      <button onClick={() => nav(k)} className={`nav-top-link${transparent ? " nav-top-link--hero" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: `1.5px solid ${active ? (transparent ? "rgba(255,255,255,.9)" : T.ink) : "transparent"}`, borderRadius: 999, cursor: "pointer", color: ink, fontWeight: active ? 700 : 600, fontSize: 14.5, padding: "8px 16px", whiteSpace: "nowrap", fontFamily: "inherit", transition: "border-color .15s ease, background .15s ease" }}>
        {Ico && <Ico size={18} strokeWidth={2} />} {l}
      </button>
    );
  };

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: transparent ? "linear-gradient(to bottom, rgba(0,0,0,.42) 0%, rgba(0,0,0,.12) 65%, rgba(0,0,0,0) 100%)" : "#fff", borderBottom: transparent ? "none" : `1px solid ${T.line}`, boxShadow: transparent ? "none" : "0 4px 18px rgba(11,46,27,.06)", transition: "background .25s ease" }}>
      <style>{`
        .nav-desktop{display:flex}
        .nav-top-link{transition:background .15s ease}
        .nav-top-link:hover{background:rgba(11,46,27,.07) !important}
        .nav-top-link--hero:hover{background:rgba(255,255,255,.20) !important}
        @media(max-width:980px){ .nav-desktop{display:none !important} }
        @media(max-width:760px){ .nav-hide-sm{display:none !important} }
        .nav-menu-link{position:relative;transition:background .18s ease,transform .18s ease}
        .nav-menu-link:hover{background:rgba(0,146,69,.10) !important;transform:translateX(4px)}
        .nav-menu-link::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:0;background:${T.green};border-radius:3px;transition:height .2s ease}
        .nav-menu-link:hover::before{height:60%}
        @media(prefers-reduced-motion:reduce){.nav-menu-link,.nav-menu-link::before,.nav-top-link{transition:none}.nav-menu-link:hover{transform:none}}
        .ats-drawer{animation:ats-slidein .3s cubic-bezier(.22,.8,.3,1)}
        @keyframes ats-slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .ats-overlay{animation:ats-fadein .28s ease}
        @keyframes ats-fadein{from{opacity:0}to{opacity:1}}
        .ats-row{transition:background .16s ease}
        .ats-row:hover{background:#F4F6F5}
        .ats-row:hover .ats-ico{background:${T.green};color:#fff}
        @media(prefers-reduced-motion:reduce){.ats-drawer,.ats-overlay{animation:none}}
      `}</style>
      <div style={{ padding: "10px 20px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Left: logo */}
        <button onClick={() => nav("home")} aria-label="Africa Tourism Solutions — home" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
          {logoOk
            ? <img src={transparent ? logoWhite : logoDark} alt="Africa Tourism Solutions" onError={() => setLogoOk(false)} style={{ height: 40, display: "block" }} />
            : <span className="disp" style={{ fontWeight: 800, fontSize: 20, color: ink }}>ATS</span>}
        </button>

        {/* Other services — dropdown next to the logo */}
        <div className="nav-hide-sm" style={{ position: "relative" }}>
          <button onClick={() => setServOpen((o) => !o)} aria-haspopup="menu" aria-expanded={servOpen}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", color: ink, fontFamily: "inherit", fontSize: 15, fontWeight: 700, padding: "8px 4px", whiteSpace: "nowrap" }}>
            Other services
            <ChevronDown size={17} style={{ transition: "transform .2s ease", transform: servOpen ? "rotate(180deg)" : "none" }} />
          </button>
          {servOpen && (
            <>
              <div onClick={() => setServOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 41 }} />
              <div role="menu" style={{ position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 42, background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 18, boxShadow: "0 20px 48px rgba(0,0,0,.18)", padding: "10px", width: 320, animation: "ats-fadein .18s ease" }}>
                {[[Plane, "Flights", "flights"], [Compass, "Tours & Experiences", "tours"], [Car, "Vehicles", "transport"], [Sparkles, "Trip Builder", "builder"], [Mic, "MICE", "events"]].map(([Ico, label, route]) => (
                  <button key={route} role="menuitem" onClick={() => { nav(route); setServOpen(false); }} className="ats-row"
                    style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "transparent", border: "1px solid transparent", cursor: "pointer", padding: "11px 12px", borderRadius: 14, textAlign: "left", fontFamily: "inherit" }}>
                    <span className="ats-ico" style={{ width: 40, height: 40, borderRadius: 12, background: "#F2F5F3", color: T.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .16s ease, color .16s ease" }}><Ico size={20} strokeWidth={2} /></span>
                    <span style={{ fontWeight: 700, fontSize: 15.5, color: T.ink }}>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right cluster (Skyscanner-style) */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <button className="nav-hide-sm" onClick={() => setChat(true)} style={{ background: "none", border: "none", cursor: "pointer", color: ink, fontWeight: 600, fontSize: 14, fontFamily: "inherit" }}>Help</button>

          {/* Language + currency pill */}
          <div className="nav-hide-sm" style={{ position: "relative" }}>
            <button onClick={() => setPrefOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 9, background: transparent ? "rgba(255,255,255,.13)" : "#F2F5F3", border: `1px solid ${transparent ? "rgba(255,255,255,.26)" : T.line}`, borderRadius: 8, padding: "8px 13px", cursor: "pointer", color: ink, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>
              <Flag lang={lang} size={20} />
              <span>{lang === "FR" ? "Français (FR)" : "English (EN)"}</span>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{cur === "XOF" ? "F XOF" : cur === "USD" ? "$ USD" : "€ EUR"}</span>
              <ChevronDown size={15} style={{ opacity: 0.85 }} />
            </button>
            {prefOpen && (
              <>
                <div onClick={() => setPrefOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 41 }} />
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 42, background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.2)", padding: 16, width: 250 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(0,0,0,.8)", margin: "0 0 8px" }}>Language</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {["FR", "EN"].map((o) => (
                      <button key={o} onClick={() => setLang(o)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 8px", borderRadius: 10, border: `1px solid ${lang === o ? T.green : T.line}`, background: lang === o ? "rgba(0,146,69,.08)" : "#fff", color: lang === o ? T.green : T.ink, fontWeight: lang === o ? 700 : 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><Flag lang={o} size={18} /> {o}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(0,0,0,.8)", margin: "0 0 8px" }}>Currency</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["XOF", "USD", "EUR"].map((o) => (
                      <button key={o} onClick={() => setCurrency(o)} style={{ flex: 1, padding: "9px 8px", borderRadius: 10, border: `1px solid ${cur === o ? T.green : T.line}`, background: cur === o ? "rgba(0,146,69,.08)" : "#fff", color: cur === o ? T.green : T.ink, fontWeight: cur === o ? 700 : 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{o}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Favorites heart */}
          <button onClick={() => { if (user) nav("account"); else setSignin(true); }} aria-label="Favorites" style={{ background: "none", border: "none", cursor: "pointer", color: ink, display: "flex", alignItems: "center", padding: 4 }}>
            <Heart size={21} strokeWidth={2} />
          </button>

          {/* Sign in */}
          <button onClick={() => { if (user) nav("account"); else { setSignin(true); setOpen(false); } }}
            style={{ background: transparent ? "#fff" : T.green, color: transparent ? T.ink : "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
            <UserRound size={16} strokeWidth={2.1} /> {user ? user.name.split(" ")[0] : "Sign in"}{user && bookings.length > 0 ? ` · ${bookings.length}` : ""}
          </button>

          {/* Full menu */}
          <button aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", color: ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
            {open ? <X size={24} /> : <NineDots color={ink} size={22} />}
          </button>
        </div>
      </div>
      </div>

      {/* Full-height slide-in drawer */}
      {open && createPortal((() => {
        const mainMenu = [
          ["home", "Home", Compass], ["tours", "Tours", MapIcon], ["builder", "Trip Builder", Sparkles],
          ["transport", "Transports", Car], ["flights", "Flights", Plane], ["events", "MICE", Mic],
          ["corporate", "Corporate", Building2], ["agents", "Agents", Users],
        ];
        const resources = [
          ["about", "About Us", Info], ["blog", "Blog", Newspaper], ["terms", "Terms & Cancellation", Shield],
        ];
        const secLabel = { fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(0,0,0,.8)", margin: "0 4px 8px" };
        const Row = ({ k, l, Ico, active, badge, onClick, chevron = true }) => (
          <button onClick={onClick} className="ats-row" style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: active ? "rgba(0,146,69,.09)" : "transparent", border: active ? "1px solid rgba(0,146,69,.25)" : "1px solid transparent", cursor: "pointer", padding: "9px 10px", borderRadius: 14, textAlign: "left", fontFamily: "inherit" }}>
            <span className="ats-ico" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: active ? T.green : "#F1F3F2", color: active ? "#fff" : T.ink, transition: "background .16s ease, color .16s ease" }}><Ico size={17} strokeWidth={2} /></span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 700 : 500, color: active ? T.green : T.ink }}>{l}</span>
            {badge && <span style={{ fontSize: 12, fontWeight: 700, color: T.green, background: "rgba(0,146,69,.12)", borderRadius: 999, padding: "3px 9px" }}>{badge}</span>}
            {chevron && <ChevronRight size={18} color="#B7C1BB" />}
          </button>
        );
        return (
        <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <div className="ats-overlay" onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(9,20,15,.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
          <aside className="ats-drawer" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(384px, 90vw)", background: "#fff", boxShadow: "-18px 0 50px rgba(9,20,15,.22)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
              <button onClick={() => nav("home")} aria-label="ATS — home" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                {logoOk ? <img src={logoDark} alt="Africa Tourism Solutions" onError={() => setLogoOk(false)} style={{ height: 34, display: "block" }} /> : <span className="disp" style={{ fontWeight: 800, fontSize: 20 }}>ATS</span>}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NavSelect value={lang} options={["EN", "FR"]} onChange={setLang} trigger={<Flag lang={lang} size={26} />} optionRender={(o) => <><Flag lang={o} size={22} /> {o === "FR" ? "Français" : "English"}</>} />
                <NavSelect value={cur} options={["XOF", "USD", "EUR"]} onChange={setCurrency} trigger={<span style={{ fontWeight: 700, fontSize: 13 }}>{cur}</span>} />
                <button aria-label="Close menu" onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink, display: "flex", padding: 6 }}><X size={24} /></button>
              </div>
            </div>
            {/* Scroll body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 14px 28px" }}>
              <div style={secLabel}>Main menu</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {mainMenu.map(([k, l, Ico]) => <Row key={k} k={k} l={l} Ico={Ico} active={page.name === k} onClick={() => nav(k)} />)}
              </div>

              <div style={{ height: 1, background: T.line, margin: "18px 6px" }} />
              <div style={secLabel}>Your account</div>
              {user ? (
                <button onClick={() => nav("account")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", color: "#fff", background: T.green, padding: "13px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                  <UserRound size={18} strokeWidth={2.2} /> {user.name.split(" ")[0]}{bookings.length > 0 ? ` · ${bookings.length}` : ""}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setSignin(true); setOpen(false); }} style={{ flex: 1, color: "#fff", background: T.green, padding: "13px 12px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>Sign in</button>
                  <button onClick={() => { setSignin(true); setOpen(false); }} style={{ flex: 1, color: T.ink, background: "#F1F3F2", padding: "13px 12px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>Register</button>
                </div>
              )}

              <div style={{ height: 1, background: T.line, margin: "18px 6px" }} />
              <div style={secLabel}>Resources</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {resources.map(([k, l, Ico]) => <Row key={k} k={k} l={l} Ico={Ico} active={page.name === k} onClick={() => nav(k)} />)}
                <a href="https://wa.me/221774807878?text=Bonjour%20ATS%2C%20je%20souhaite%20une%20consultation." target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="ats-row" style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "transparent", border: "1px solid transparent", cursor: "pointer", padding: "9px 10px", borderRadius: 14, textDecoration: "none" }}>
                  <span className="ats-ico" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F3F2", color: T.ink, transition: "background .16s ease, color .16s ease" }}><CalendarCheck size={17} strokeWidth={2} /></span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: T.ink }}>Book a consultation</span>
                  <ChevronRight size={18} color="#B7C1BB" />
                </a>
              </div>

              <div style={{ height: 1, background: T.line, margin: "18px 6px" }} />
              <div style={secLabel}>Follow us</div>
              <div style={{ display: "flex", gap: 10 }}>
                {ATS_SOCIALS.map(([s, url]) => (
                  <a key={s} href={url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", background: "#F1F3F2", color: T.ink, borderRadius: 12, padding: "11px 6px", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>{s}</a>
                ))}
              </div>

              <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "rgba(0,0,0,.8)" }}>Africa Tourism Solutions · Dakar, Senegal</div>
            </div>
          </aside>
        </div>
        );
      })(), document.body)}
    </nav>
  );
}

// Official ATS social media links (used in nav drawer + footer).
const ATS_SOCIALS = [
  ["Facebook", "https://www.facebook.com/africatourismsolutions"],
  ["Instagram", "https://www.instagram.com/africatourismsolutions/?hl=en"],
  ["LinkedIn", "https://sn.linkedin.com/company/africa-tourism-solutions"],
  ["TikTok", "https://www.tiktok.com/@africatourismsolutions1"],
];

// Featured trips shown in the hero slider (edit this list to change which trips appear).
const HOME_POPULAR = ["goree", "bandia", "lompoul", "toubacouta", "stlouis", "food"];

function HeroCard({ t, go, setBooking, w = 300 }) {
  const img = useCoverUrl(t.id);
  return (
    <div style={{ width: w, flexShrink: 0, boxSizing: "border-box", background: "rgba(255,255,255,.14)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 16, padding: 12, display: "flex", gap: 12, color: "#fff" }}>
      <button onClick={() => go("tour", { id: t.id })} aria-label={t.name} style={{ width: 96, height: 100, borderRadius: 12, overflow: "hidden", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, background: `linear-gradient(140deg, ${T.green}, ${T.indigo})` }}>
        {img && <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="disp" style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name.split(" — ")[0]}</div>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 3 }}>from {fmtXOF(fromPrice(t))} <span style={{ fontWeight: 500, opacity: .8, fontSize: 11.5 }}>/ person · 5+ pax</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, opacity: .85, marginTop: 5 }}><Clock size={13} /> {t.dur}</div>
        <button onClick={() => go("tour", { id: t.id })} style={{ marginTop: "auto", alignSelf: "flex-start", background: "transparent", border: "1px solid rgba(255,255,255,.65)", color: "#fff", borderRadius: 999, padding: "6px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Book Now</button>
      </div>
    </div>
  );
}

function HeroSlider({ go, setBooking }) {
  const tours = HOME_POPULAR.map((id) => TOURS.find((t) => t.id === id)).filter(Boolean);
  const CARD = 300, GAP = 24;
  const [perPage, setPerPage] = useState(() => (typeof window !== "undefined" && window.innerWidth < 760 ? 1 : 2));
  useEffect(() => {
    const onR = () => setPerPage(window.innerWidth < 760 ? 1 : 2);
    onR(); window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const positions = Math.max(1, tours.length - perPage + 1); // slide 1 card at a time, keep perPage cards fully visible
  const [i, setI] = useState(0);
  useEffect(() => { setI((x) => Math.min(x, positions - 1)); }, [positions]);
  const prev = () => setI((x) => (x - 1 + positions) % positions);
  const next = () => setI((x) => (x + 1) % positions);
  useEffect(() => {
    if (positions < 2) return;
    const id = setTimeout(() => setI((x) => (x + 1) % positions), 4500);
    return () => clearTimeout(id);
  }, [i, positions]);
  const arrow = (solid) => ({ width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${solid ? "#fff" : "rgba(255,255,255,.7)"}`, background: solid ? "#fff" : "transparent", color: solid ? T.ink : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });
  const mobile = perPage === 1;
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    const m = () => { if (wrapRef.current) setWrapW(wrapRef.current.clientWidth); };
    m(); window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, [perPage]);
  const cardW = mobile ? (wrapW || 300) : CARD;
  const gap = mobile ? 0 : GAP;
  const step = mobile ? (wrapW || 300) : 350;
  const headerW = mobile ? "100%" : perPage * CARD + (perPage - 1) * GAP;
  const PEEK = perPage > 1 ? 100 : 0;                    // extra sliver of the next card, clipped at the hero edge
  const trackW = mobile ? "100%" : perPage * CARD + (perPage - 1) * GAP + PEEK;
  return (
    <div ref={wrapRef} className="hero-slider" style={{ width: trackW, maxWidth: "100%", margin: "0 auto" }}>
      <div style={{ width: headerW, maxWidth: "100%" }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 12, opacity: 0.9 }}>Popular Tours</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, paddingRight: 4 }}>
          <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,.35)", borderRadius: 2, position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${((i + 1) / positions) * 100}%`, background: "#fff", borderRadius: 2, transition: "width .3s ease" }} />
          </div>
          <button onClick={prev} style={arrow(false)} aria-label="Previous"><ChevronLeft size={18} /></button>
          <button onClick={next} style={arrow(true)} aria-label="Next"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div style={{ overflow: "hidden", width: trackW, maxWidth: "100%" }}>
        <div style={{ display: "flex", gap, transform: `translateX(-${i * step}px)`, transition: "transform .4s ease" }}>
          {tours.map((t) => <HeroCard key={t.id} t={t} go={go} setBooking={setBooking} w={cardW} />)}
        </div>
      </div>
    </div>
  );
}

// Full ATS ecosystem — original cards on a single scrollable row.
function EcoServices({ go }) {
  const ref = useRef(null);
  const items = [
    [Plane, "Flights", "IATA-accredited ticketing: domestic, international, multi-city and corporate.", "flights"],
    [Hotel, "Accommodation", "Hotels, resorts, villas, eco-lodges and camps — vetted and contracted by ATS.", "builder"],
    [Car, "Transport", "Airport transfers and vehicle hire at fixed rates — book instantly, no quote needed.", "transport"],
    [Mic, "MICE", "Conferences, incentives, team building, destination weddings, government events.", "events"],
    [Package, "ATS Logistics", "Event logistics, group movement and corporate transport coordination.", "transport"],
    [UserRound, "Concierge", "Meet & greet, visa assistance, VIP services, private guides, translation.", "corporate"],
  ];
  const nudge = (d) => ref.current && ref.current.scrollBy({ left: d * 272, behavior: "smooth" });
  const arrow = (side) => ({ position: "absolute", top: -46, [side]: 0, zIndex: 3, width: 38, height: 38, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", color: T.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(11,46,27,.12)" });
  return (
    <div style={{ position: "relative" }}>
      <style>{`.eco-strip::-webkit-scrollbar{display:none}`}</style>
      <button aria-label="Previous" onClick={() => nudge(-1)} style={arrow("left")}><ChevronLeft size={19} /></button>
      <button aria-label="Next" onClick={() => nudge(1)} style={{ ...arrow("right"), right: 44 }}><ChevronRight size={19} /></button>
      <div ref={ref} className="eco-strip" style={{ display: "flex", gap: 16, overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none", padding: "4px 0 10px" }}>
        {items.map(([Icon, name, body, dest]) => (
          <button key={name} className="card-hover" onClick={() => go(dest)} style={{ flex: "0 0 auto", width: 256, scrollSnapAlign: "start", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 20, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: T.ink, display: "flex", flexDirection: "column" }}>
            <Icon size={30} color={T.green} strokeWidth={1.7} />
            <h3 className="disp" style={{ fontWeight: 700, fontSize: 18, margin: "10px 0 6px" }}>{name}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.8, margin: 0, flex: 1 }}>{body}</p>
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 13, color: T.laterite, display: "flex", alignItems: "center", gap: 4 }}>Open <ArrowRight size={14} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Interactive Africa-focused globe: drag to rotate (clamped to Africa), click a marker to recenter.
function AfricaGlobe({ country, setCountry }) {
  const SIZE = 480;
  const CLAMP = { lamMin: -46, lamMax: 26, phiMin: -34, phiMax: 12 };
  const clampRot = ([l, p]) => [Math.max(CLAMP.lamMin, Math.min(CLAMP.lamMax, l)), Math.max(CLAMP.phiMin, Math.min(CLAMP.phiMax, p))];
  const [rot, setRot] = useState([-20, -3]);
  const [zoom, setZoom] = useState(1);
  const drag = useRef(null);
  const anim = useRef(0);
  const firstRun = useRef(true);
  const rotRef = useRef(rot); rotRef.current = rot;

  const R = (SIZE / 2 - 6) * zoom;
  const projection = geoOrthographic().scale(R).translate([SIZE / 2, SIZE / 2]).rotate([rot[0], rot[1], 0]).clipAngle(90);
  const path = geoPath(projection);
  const centerLngLat = [-rot[0], -rot[1]];

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y, k = 0.32 / zoom;
      setRot(clampRot([drag.current.rot[0] + dx * k, drag.current.rot[1] - dy * k]));
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [zoom]);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const dest = clampRot([-country.ll[0], -country.ll[1]]);
    const start = rotRef.current.slice(); const t0 = performance.now(); const dur = 700;
    cancelAnimationFrame(anim.current);
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setRot([start[0] + (dest[0] - start[0]) * e, start[1] + (dest[1] - start[1]) * e]);
      if (k < 1) anim.current = requestAnimationFrame(tick);
    };
    anim.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(anim.current);
  }, [country.id]); // eslint-disable-line

  const zbtn = { width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", color: T.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, boxShadow: "0 4px 12px rgba(11,46,27,.10)" };

  return (
    <div style={{ position: "relative", background: "transparent", padding: 6 }}>
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 8, zIndex: 2 }}>
        <button aria-label="Zoom in" style={zbtn} onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.25).toFixed(2)))}>+</button>
        <button aria-label="Zoom out" style={zbtn} onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}>−</button>
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Interactive globe of Africa with ATS destinations"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, rot: rot.slice() }; }}
        style={{ width: "100%", display: "block", cursor: "grab", touchAction: "pan-y" }}>
        <defs>
          <radialGradient id="glb" cx="40%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="72%" stopColor="#F0F4F1" />
            <stop offset="100%" stopColor="#E4EAE6" />
          </radialGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="url(#glb)" stroke="rgba(11,46,27,.14)" strokeWidth="1" />
        <path d={path(geoGraticule10())} fill="none" stroke="rgba(11,46,27,.09)" strokeWidth="0.6" />
        <path d={path(LAND)} fill="rgba(11,46,27,.58)" stroke="rgba(11,46,27,.35)" strokeWidth="0.4" />
        {COUNTRIES.map((c) => {
          const p = projection(c.ll);
          if (!p || geoDistance(c.ll, centerLngLat) > Math.PI / 2) return null;
          const on = country.id === c.id;
          const col = c.live ? T.gold : "#9AA79F";
          return (
            <g key={c.id} style={{ cursor: "pointer" }} onPointerDown={(e) => e.stopPropagation()} onClick={() => setCountry(c)}>
              {on && <circle cx={p[0]} cy={p[1]} r={11} fill="none" stroke={col} strokeWidth="1.6" opacity="0.9" />}
              <circle cx={p[0]} cy={p[1]} r={on ? 6 : c.live ? 5 : 4} fill={col} stroke="#fff" strokeWidth="1.6" className={c.live ? "pulse" : ""} />
              {on && (
                <text x={p[0]} y={p[1] - 16} textAnchor="middle" fontSize="14" fontWeight="800" fill={T.ink} stroke="#fff" strokeWidth="3.4" paintOrder="stroke" style={{ pointerEvents: "none" }}>{c.name}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <span style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)" }}>Drag to rotate · tap a marker · Cape Verde, Zanzibar, Comoros &amp; Madagascar included</span>
      </div>
    </div>
  );
}

// Service categories shown as a fanned arc of clickable cards.
function CategoryCard({ id, label, dest, desc, go, offset, mobile }) {
  const img = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`site/services/${id}.webp`).data.publicUrl;
  const isC = offset === 0;
  const rot = mobile ? 0 : offset * 4.5;
  const ty = mobile ? 0 : Math.abs(offset) * 22;
  return (
    <button onClick={() => go(dest)} className="cat-card" aria-label={label}
      style={{ flex: "0 0 auto", width: 210, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
        transform: `translateY(${ty}px) rotate(${rot}deg)${isC && !mobile ? " scale(1.05)" : ""}`, transformOrigin: "center bottom", zIndex: isC ? 3 : 2 }}>
      <div style={{ aspectRatio: "3 / 4", borderRadius: 22, overflow: "hidden", background: `linear-gradient(150deg, ${T.green}, ${T.indigo})`, boxShadow: isC ? "0 26px 52px rgba(11,46,27,.26)" : "0 16px 34px rgba(11,46,27,.16)" }}>
        {img && <img src={img} alt={label} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      </div>
      <div className="disp" style={{ fontWeight: 800, fontSize: 18, color: T.ink, textAlign: "center", marginTop: 14 }}>{label}</div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(0,0,0,.8)", textAlign: "center", margin: "5px 4px 0" }}>{desc}</p>
    </button>
  );
}

function ServicesFan({ go }) {
  const items = [
    ["transport", "Transport", "transport", "Airport transfers or vehicle hire at fixed rates. Pick your dates and pay instantly — no quote needed."],
    ["trip-builder", "Trip Builder", "builder", "Assemble your own trip — destination, hotel, transport, experiences — then reserve with a 20% deposit."],
    ["tour", "Tours", "tours", "Browse 35+ guided experiences. Pick a date, pay in full or via Ma Tontine, and you're booked."],
    ["flights", "Flights", "flights", "Domestic & international flights. Our IATA-accredited team handles booking, changes and group fares."],
    ["mice", "MICE", "events", "Conferences, incentives, team building and events — send your brief, ATS handles logistics end to end."],
  ];
  const center = 2;
  const [mobile, setMobile] = useState(typeof window !== "undefined" && window.innerWidth < 900);
  useEffect(() => {
    const f = () => setMobile(window.innerWidth < 900);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return (
    <div>
      <style>{`.cat-card{transition:transform .3s ease,filter .2s ease}.cat-card:hover{filter:brightness(1.04)}.cat-row::-webkit-scrollbar{display:none}`}</style>
      <div className="cat-row" style={mobile
        ? { display: "flex", gap: 18, overflowX: "auto", padding: "12px 4px 8px", scrollbarWidth: "none", msOverflowStyle: "none" }
        : { display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 10, paddingTop: 8 }}>
        {items.map(([id, label, dest, desc], i) => (
          <CategoryCard key={dest} id={id} label={label} dest={dest} desc={desc} go={go} offset={i - center} mobile={mobile} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 9, marginTop: 22 }}>
        {items.map((_, i) => <span key={i} style={{ width: i === center ? 22 : 9, height: 9, borderRadius: 999, background: i === center ? T.green : "rgba(11,46,27,.18)" }} />)}
      </div>
    </div>
  );
}

// "Plan your trip with us" — image collage + features, decorative.
function PlanTripSection({ go }) {
  const img1 = useCoverUrl("city");
  const img2 = useCoverUrl("goree");
  const img3 = useCoverUrl("boat");
  const grad = `linear-gradient(150deg, ${T.green}, ${T.indigo})`;
  const features = [
    [Sparkles, "Tailor-made trips", "Design your own itinerary from ATS's real catalogue of experiences."],
    [CalendarCheck, "Reserve with 20%", "Secure your trip now and pay the balance in instalments — Ma Tontine Voyage."],
  ];
  return (
    <section style={{ background: "#fff", position: "relative", overflow: "hidden", minHeight: "60vh", display: "flex", alignItems: "center", paddingBottom: 48 }}>
      <style>{`
        .plan-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center;position:relative;z-index:1}
        .plan-collage{position:relative;height:clamp(360px,50vh,500px)}
        .plan-collage .a{position:absolute;left:0;top:4%;width:44%;height:92%;border-radius:170px 170px 26px 26px}
        .plan-collage .b{position:absolute;left:48%;top:2%;width:46%;aspect-ratio:1;border-radius:48% 52% 52% 48% / 52% 48% 52% 48%;border:6px solid #fff}
        .plan-collage .c{position:absolute;left:36%;top:50%;width:44%;aspect-ratio:1;border-radius:50%;border:6px solid #fff;z-index:2}
        @media(max-width:900px){
          .plan-grid{grid-template-columns:1fr;gap:30px}
          .plan-collage{height:360px}
        }
      `}</style>
      <Wrap style={{ width: "100%" }}>
        <div className="plan-grid">
          <div className="plan-collage">
            {[["a", img1], ["b", img2], ["c", img3]].map(([cls, im]) => (
              <div key={cls} className={cls} style={{ overflow: "hidden", boxShadow: "0 10px 24px rgba(11,46,27,.14)", background: grad }}>
                {im && <img src={im} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
              </div>
            ))}
          </div>
          <div>
            <div className="about-script" style={{ fontSize: 26, fontWeight: 600, color: T.green, lineHeight: 1 }}>Let's go together</div>
            <h2 className="disp" style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.02em", color: T.ink, lineHeight: 1.08, margin: "4px 0 16px" }}>Plan your trip with us</h2>
            <p style={{ color: "rgba(0,0,0,.8)", lineHeight: 1.7, fontSize: 15.5, maxWidth: 460, margin: "0 0 26px" }}>
              Build a fully custom trip — destination, hotel, transport and experiences — then confirm it with just a 20% deposit and pay the balance in instalments before departure.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 30 }}>
              {features.map(([Ico, title, desc]) => (
                <div key={title} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <span style={{ width: 52, height: 52, flexShrink: 0, borderRadius: "50%", background: "rgba(0,146,69,.10)", color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico size={22} strokeWidth={2} /></span>
                  <div>
                    <div className="disp" style={{ fontWeight: 700, fontSize: 18, color: T.ink }}>{title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(0,0,0,.8)", marginTop: 3, maxWidth: 340 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => go("builder")} style={{ display: "inline-flex", alignItems: "center", gap: 12, background: T.ink, color: "#fff", border: "none", borderRadius: 999, padding: "15px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Learn More <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

// ---------------- HOME ----------------
// Custom hero-tab icons (from site/icons) — fill inherits the tab color
const IconBeach = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23,22c-.415,0-.92-.207-1.455-.426-.658-.269-1.404-.574-2.212-.574s-1.554,.305-2.212,.574c-.535,.219-1.041,.426-1.455,.426s-.92-.207-1.455-.426c-.658-.269-1.404-.574-2.212-.574s-1.554,.305-2.212,.574c-.388,.159-.76,.311-1.093,.383l3.752-8.471,7.186,3.276c.391,.179,.807,.268,1.223,.268,.464,0,.927-.111,1.355-.331,.815-.419,1.384-1.179,1.56-2.083,1.108-5.695-1.6-11.261-6.587-13.535C12.049-1.26,5.913,.356,2.592,4.926c-.549,.756-.728,1.71-.489,2.618,.233,.886,.837,1.608,1.658,1.982l6.865,3.13-3.919,8.849c-.615-.249-1.302-.505-2.041-.505-.808,0-1.554,.305-2.212,.574-.535,.219-1.04,.426-1.455,.426-.552,0-1,.448-1,1s.448,1,1,1c.808,0,1.554-.305,2.212-.574,.535-.219,1.04-.426,1.455-.426s.92,.207,1.455,.426c.658,.269,1.404,.574,2.212,.574s1.554-.305,2.212-.574c.535-.219,1.04-.426,1.455-.426s.92,.207,1.455,.426c.658,.269,1.404,.574,2.212,.574s1.554-.305,2.212-.574c.535-.219,1.041-.426,1.455-.426s.92,.207,1.455,.426c.658,.269,1.404,.574,2.212,.574,.552,0,1-.448,1-1s-.448-1-1-1Z"/></svg>
);
const IconCarP = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M240,112H211.31L168,68.69A15.86,15.86,0,0,0,156.69,64H44.28A16,16,0,0,0,31,71.12L1.34,115.56A8.07,8.07,0,0,0,0,120v48a16,16,0,0,0,16,16H33a32,32,0,0,0,62,0h66a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V128A16,16,0,0,0,240,112ZM44.28,80H156.69l32,32H23ZM64,192a16,16,0,1,1,16-16A16,16,0,0,1,64,192Zm128,0a16,16,0,1,1,16-16A16,16,0,0,1,192,192Zm48-24H223a32,32,0,0,0-62,0H95a32,32,0,0,0-62,0H16V128H240Z"/></svg>
);
const IconPlane2 = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 13.5a2.5 2.5 0 0 1-2.5 2.5h-4.036l-4.226 6.487A2.97 2.97 0 0 1 10.633 24a2.63 2.63 0 0 1-2.462-3.553L10.019 16H6a4 4 0 0 1-3.473-2.015L.2 10.16a1.443 1.443 0 0 1 .525-2 1.41 1.41 0 0 1 1.652.25l1.417 1.418A4 4 0 0 0 6.622 11H21.5a2.5 2.5 0 0 1 2.5 2.5M17.731 9l-4.5-7.487A2.97 2.97 0 0 0 10.629 0a2.63 2.63 0 0 0-2.462 3.553L10.285 9Z"/></svg>
);
// Filled car (from site/icons/car-icon.svg) — fill inherits the tab colour (white active, dark inactive)
const IconCarFilled = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 128 128" fill="currentColor" aria-hidden="true">
    <path d="M12.25,53.01c1.13-1.09,2.83-1.93,4.43-2.06l59.64-.09c5.01-4.43-5.92-10.09-9.84-11.49-18.65-6.65-38.61,1.57-56.51,6.32-1.78-.71-2.87-2.59-2.25-4.48.87-2.67,20.43-7.98,24.15-8.77,15.99-3.37,31.04-4.1,45.14,5.07,4.4,2.86,10.65,9.76,14.37,11.55,3.22,1.55,11.76,1.98,16.48,3.42,4.98,1.52,13.24,4.68,15.97,9.1,3.21,5.2,4.77,24.79-2.54,26.31-6.28,1.3-5.18-4.62-7.63-8.42-5.38-8.33-18.1-9.74-24.98-2.54-2.97,3.11-2.81,7.12-5.4,10.14l-37.09.1c-3.67-.77-3.51-5.03-5.25-7.7-5.35-8.2-18.13-9.64-25.07-2.63-2.83,2.86-3.85,10.42-6.23,11.1-5.99,1.7-8.63-10.66-8-14.91.27-1.84,9.33-18.75,10.64-20.02Z"/>
    <path d="M97.42,77.05c15.48-3.14,17,17.6,6.52,20.27-15.86,4.05-18.82-17.77-6.52-20.27Z"/>
    <path d="M24.7,77.05c18.65-3.79,16.5,26.01-1.45,20.01-8.49-2.83-8.28-18.04,1.45-20.01Z"/>
  </svg>
);

// ---------------- HERO SEARCH (Expedia-style tabbed search card) ----------------
// Stable, module-level pieces (defining components inside HeroSearch would remount
// the inputs on every keystroke and make them lose focus).
const heroBox = { display: "flex", alignItems: "center", gap: 11, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: "9px 14px", flex: 1, minWidth: 0 };
const heroLab = { fontSize: 11, color: "rgba(0,0,0,.8)", fontWeight: 600, marginBottom: 1 };
const heroInp = { border: "none", outline: "none", background: "transparent", fontSize: 14.5, fontFamily: "inherit", color: T.ink, width: "100%", padding: 0 };
const heroSwapBtn = { flexShrink: 0, width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: T.green };
const SwapIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
);
function HField({ Ico, label, children }) {
  return (
    <div style={heroBox}>
      <Ico size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={heroLab}>{label}</div>
        {children}
      </div>
    </div>
  );
}

const FLIGHT_CLS = ["Économique", "Premium", "Affaires", "Première"];
const FLIGHT_CLS_MAP = { "Économique": "Economy", "Premium": "Premium", "Affaires": "Business", "Première": "First" };

// Times every 15 min, "10 h 30" style
const TIME_OPTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")} h ${String((i % 4) * 15).padStart(2, "0")}`);
const CAR_AGENCIES = ["Avis", "Hertz", "Europcar", "Sixt", "Budget", "Enterprise", "Alamo", "National"];
const DISC_TYPES = ["Code entreprise", "Code promotionnel", "Programme de fidélité", "Tarif contractuel"];

const heroSearchBtnStyle = { background: T.green, color: "#fff", border: "none", borderRadius: 12, padding: "0 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0, minHeight: 54 };

// Custom white-popover select (replaces native selects so every field shares the same UI)
function HSelect({ Ico, label, value, options, onChange, flex = 1, minWidth = 0, popWidth = 300 }) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.v === value);
  return (
    <div style={{ ...heroBox, position: "relative", cursor: "pointer", flex, minWidth }} onClick={() => setOpen((o) => !o)} role="button" aria-haspopup="listbox" aria-expanded={open}>
      <Ico size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={heroLab}>{label}</div>
        <div style={{ fontSize: 14.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel ? sel.label : "—"}</div>
      </div>
      <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div onClick={(e) => e.stopPropagation()} role="listbox" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 91, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 18px 44px rgba(0,0,0,.22)", overflow: "hidden auto", maxHeight: 330, width: `min(${popWidth}px, calc(100vw - 28px))`, padding: "6px 0", cursor: "default" }}>
            {options.map((o) => (
              <button key={o.v} onClick={() => { onChange(o.v); setOpen(false); }} role="option" aria-selected={o.v === value} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: o.v === value ? "rgba(0,146,69,.06)" : "none", border: "none", padding: "11px 18px", cursor: "pointer", color: T.ink, fontFamily: "inherit" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: o.v === value ? 700 : 500 }}>{o.label}</div>
                  {o.sub && <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)" }}>{o.sub}</div>}
                </span>
                {o.v === value && <Check size={17} color={T.green} style={{ flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TimeField({ label, value, onChange }) {
  return <HSelect Ico={Clock} label={label} value={value} onChange={onChange} options={TIME_OPTS.map((t) => ({ v: t, label: t }))} flex="0 0 auto" minWidth={148} popWidth={190} />;
}

// ---------------- CAR / TRANSFER SEARCH (Voitures module: location + transfert) ----------------
function CarSearch({ go }) {
  const [sub, setSub] = useState("rental"); // rental | transfer
  const todayStr = new Date().toISOString().slice(0, 10);
  // rental
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");
  const [pickTime, setPickTime] = useState("10 h 30");
  const [retTime, setRetTime] = useState("10 h 30");
  // transfer — fixed directional routes
  const [routeI, setRouteI] = useState(0);
  const [vehI, setVehI] = useState(0);
  const [vehPicker, setVehPicker] = useState(false);
  const [tDate, setTDate] = useState("");
  const [tTime, setTTime] = useState("10 h 30");
  const [pax, setPax] = useState(2);
  const [paxOpen, setPaxOpen] = useState(false);
  const vmap = useVehiclePhotoMap();

  const dirRoute = TRANSFER_DIRECTIONS[routeI];
  const prices = TRANSFER_ROUTES.find((r) => r.id === dirRoute.pricesId).prices;
  const price = prices[vehI];
  const veh = VEHICLES[vehI];
  const capOk = veh.cap >= pax;
  const transferReady = !!tDate && capOk && pax > 0;

  const bookTransfer = () => {
    if (!transferReady) return;
    const routeLabel = `${dirRoute.from} → ${dirRoute.to}`;
    go("transferCheckout", {
      detail: {
        title: "Confirm your transfer",
        total: price,
        routeLabel,
        vehicleName: veh.name,
        vehicleSlug: veh.slug,
        vehicleMeta: `${veh.type} · ${veh.cap} passengers · ${veh.bags} bags`,
        rows: [["Route", routeLabel], ["Vehicle", veh.name], ["Date", tDate], ["Pick-up", tTime], ["Passengers", pax]],
        record: {
          tour: { emoji: "🚙", name: `${veh.name} — ${routeLabel}`, pole: "Transfer", dur: `${tDate} · ${tTime}`, thumb: vmap[veh.slug] || null },
          route: routeLabel, vehicle: veh.name, unit: "transfer", date: tDate, time: tTime, pax,
          adults: pax, children: 0, infants: 0, transfer: { time: tTime, unit: "transfer" },
        },
      },
    });
  };

  return (
    <div style={{ marginTop: 14 }}>
      {/* sub-tabs */}
      <div style={{ display: "flex", gap: 24, borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
        {[["rental", "Car rental"], ["transfer", "Airport transfer"]].map(([k, l]) => {
          const on = sub === k;
          return <button key={k} onClick={() => setSub(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${on ? T.green : "transparent"}`, marginBottom: -1, padding: "4px 2px 9px", cursor: "pointer", color: on ? T.green : "rgba(0,0,0,.8)", fontWeight: on ? 700 : 600, fontSize: 14, fontFamily: "inherit" }}>{l}</button>;
        })}
      </div>

      {sub === "rental" ? (
        /* -------- Location de voiture — real Dakar addresses (Nominatim, Senegal) -------- */
        <div className="hero-fields" style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <HField Ico={MapPin} label="Pick-up">
            <AddressInput bare value={pickup} onChange={setPickup} placeholder="Address in Dakar…" />
          </HField>
          <HField Ico={MapPin} label="Drop-off">
            <AddressInput bare value={dropoff} onChange={setDropoff} placeholder="Same drop-off" />
          </HField>
          <HField Ico={Calendar} label="Dates">
            <RangeDate from={rFrom} to={rTo} onChange={(f, t) => { setRFrom(f); setRTo(t); }} triggerStyle={{ background: "transparent", border: "none", padding: 0 }} wide />
          </HField>
          <TimeField label="Pick-up time" value={pickTime} onChange={setPickTime} />
          <TimeField label="Drop-off time" value={retTime} onChange={setRetTime} />
          <button onClick={() => go("transport", { rental: { pickup, dropoff, dateFrom: rFrom, dateTo: rTo, puTime: pickTime.replace(" h ", ":"), doTime: retTime.replace(" h ", ":") } })} className="hero-search-btn" style={heroSearchBtnStyle}><Search size={18} /> Search</button>
        </div>
      ) : (
        /* -------- Transfert — 6 routes fixes · véhicule · date · heure · passagers -------- */
        <>
          <div className="hero-fields" style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            <HSelect Ico={Route} label="Route" value={routeI} onChange={setRouteI} popWidth={240}
              options={TRANSFER_DIRECTIONS.map((d, i) => ({ v: i, label: `${d.from} → ${d.to}` }))} />
            {/* Vehicle — opens the photo picker popup */}
            <div style={{ ...heroBox, position: "relative", cursor: "pointer", flex: 1.2, minWidth: 0 }} onClick={() => setVehPicker(true)} role="button" aria-haspopup="dialog" aria-expanded={vehPicker}>
              {vmap[veh.slug]
                ? <img src={vmap[veh.slug]} alt="" style={{ width: 48, height: 32, objectFit: "contain", flexShrink: 0 }} />
                : <Car size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={heroLab}>Vehicle</div>
                <div style={{ fontSize: 14.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{veh.name}</div>
              </div>
              <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
            </div>
            {vehPicker && <VehiclePickerModal prices={prices} vmap={vmap} pax={pax} onSelect={(i) => { setVehI(i); setVehPicker(false); }} onClose={() => setVehPicker(false)} />}
            <HField Ico={Calendar} label="Transfer date">
              <RangeDate from={tDate} to={tDate} onChange={(f) => setTDate(f)} triggerStyle={{ background: "transparent", border: "none", padding: 0 }} wide single minDate={todayStr} />
            </HField>
            <TimeField label="Pick-up time" value={tTime} onChange={setTTime} />
            {/* Passagers */}
            <div style={{ ...heroBox, position: "relative", cursor: "pointer", flex: "0 0 auto", minWidth: 148 }} onClick={() => setPaxOpen((o) => !o)} role="button" aria-haspopup="dialog" aria-expanded={paxOpen}>
              <Users size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={heroLab}>Passengers</div>
                <div style={{ fontSize: 14.5, color: T.ink }}>{pax} passenger{pax > 1 ? "s" : ""}</div>
              </div>
              <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
              {paxOpen && (
                <>
                  <div onClick={(e) => { e.stopPropagation(); setPaxOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
                  <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 91, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 18px 44px rgba(0,0,0,.22)", padding: 20, width: "min(300px, calc(100vw - 28px))", cursor: "default" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, color: T.ink }}>Passengers</div>
                        <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)" }}>Up to {veh.cap} for this vehicle</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <button onClick={() => setPax((p) => Math.max(1, p - 1))} disabled={pax <= 1} aria-label="Moins" style={{ ...btnCircle, width: 44, height: 44, fontSize: 20, opacity: pax <= 1 ? 0.4 : 1, cursor: pax <= 1 ? "not-allowed" : "pointer" }}>−</button>
                        <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center", fontSize: 15 }}>{pax}</span>
                        <button onClick={() => setPax((p) => Math.min(50, p + 1))} aria-label="Plus" style={{ ...btnCircle, width: 44, height: 44, fontSize: 20 }}>+</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                      <button onClick={() => setPaxOpen(false)} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 999, padding: "11px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button onClick={bookTransfer} className="hero-search-btn" style={{ ...heroSearchBtnStyle, opacity: transferReady ? 1 : 0.55, cursor: transferReady ? "pointer" : "not-allowed" }}><Search size={18} /> Book</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
            <span className="disp" style={{ fontWeight: 800, fontSize: 17, color: T.ink }}>{fmtXOF(price)} <span style={{ fontWeight: 500, fontSize: 12, color: "rgba(0,0,0,.8)" }}>/ vehicle · fixed rate</span></span>
            {!capOk && <span style={{ fontSize: 12.5, color: "#B3261E", fontWeight: 600 }}>This vehicle seats up to {veh.cap} passengers — pick a larger category.</span>}
            {capOk && !tDate && <span style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)" }}>Choose a date to book.</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- TOUR SEARCH (Destination · Expérience autosuggest · Dates · Voyageurs) ----------------
const heroPop = { position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 91, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 18px 44px rgba(0,0,0,.22)", overflow: "hidden", cursor: "default", animation: "flashIn .18s ease" };
const heroRow = { display: "flex", alignItems: "flex-start", gap: 14, width: "100%", textAlign: "left", background: "none", border: "none", padding: "13px 18px", cursor: "pointer", color: T.ink, fontFamily: "inherit" };

function TourSearch({ go }) {
  const [dest, setDest] = useState("Senegal");
  const [destOpen, setDestOpen] = useState(false);
  const [expQ, setExpQ] = useState("");
  const [expSel, setExpSel] = useState(null); // selected tour id
  const [expOpen, setExpOpen] = useState(false);
  const [date, setDate] = useState("");
  const minDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); // same rule as the tour detail page
  const [trav, setTrav] = useState({ adults: 2, children: 0 });
  const [travOpen, setTravOpen] = useState(false);
  const total = trav.adults + trav.children;
  const setT = (k, d) => setTrav((t) => ({ ...t, [k]: Math.max(k === "adults" ? 1 : 0, t[k] + d) }));

  // Recent experience searches (kept in this browser)
  const [recents, setRecents] = useState(() => { try { return JSON.parse(localStorage.getItem("ats_recent_tours") || "[]"); } catch { return []; } });
  const persistRecents = (next) => { try { localStorage.setItem("ats_recent_tours", JSON.stringify(next)); } catch { /* ignore */ } return next; };
  const addRecent = (id) => setRecents((r) => persistRecents([id, ...r.filter((x) => x !== id)].slice(0, 5)));
  const removeRecent = (id) => setRecents((r) => persistRecents(r.filter((x) => x !== id)));
  const recentTours = recents.map((id) => TOURS.find((t) => t.id === id)).filter(Boolean);
  const popularTours = ["goree", "bandia", "lacrose", "toubacouta", "stlouis", "lompoul"].map((id) => TOURS.find((t) => t.id === id)).filter(Boolean);

  const q = expQ.trim().toLowerCase();
  const matches = q
    ? TOURS.filter((t) => [t.name, t.pole, t.tag, t.desc].filter(Boolean).some((s) => s.toLowerCase().includes(q))).slice(0, 7)
    : [];
  const pickTour = (t) => { setExpQ(t.name); setExpSel(t.id); setExpOpen(false); addRecent(t.id); };
  const doSearch = () => { if (expSel) go("tour", { id: expSel, date, pax: total }); else go("tours"); };

  return (
    <div className="hero-fields" style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "stretch" }}>
      {/* Destination */}
      <div style={{ ...heroBox, position: "relative", cursor: "pointer", flex: 1 }} onClick={() => setDestOpen((o) => !o)} role="button" aria-haspopup="listbox" aria-expanded={destOpen}>
        <MapPin size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={heroLab}>Destination</div>
          <div style={{ fontSize: 14.5, color: T.ink }}>{dest}</div>
        </div>
        <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
        {destOpen && (
          <>
            <div onClick={(e) => { e.stopPropagation(); setDestOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
            <div onClick={(e) => e.stopPropagation()} role="listbox" style={{ ...heroPop, width: "min(340px, calc(100vw - 28px))", padding: "8px 0" }}>
              <button onClick={() => { setDest("Senegal"); setDestOpen(false); }} style={heroRow} role="option" aria-selected={dest === "Senegal"}>
                <MapPin size={20} color={T.green} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Senegal</div>
                  <div style={{ fontSize: 13, color: "rgba(0,0,0,.8)" }}>Available · 35+ experiences</div>
                </span>
                {dest === "Senegal" && <Check size={18} color={T.green} style={{ flexShrink: 0, marginTop: 4 }} />}
              </button>
              <div style={{ ...heroRow, cursor: "not-allowed", opacity: 0.45 }} role="option" aria-disabled="true" aria-selected="false">
                <MapPin size={20} color={T.ink} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Rwanda</div>
                  <div style={{ fontSize: 13, color: "rgba(0,0,0,.8)" }}>Coming soon</div>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Expérience — autosuggest over the tours catalogue */}
      <div style={{ ...heroBox, position: "relative", flex: 1.3 }}>
        <Search size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={heroLab}>Experience</div>
          <input style={heroInp} value={expQ} placeholder="Search an experience" autoComplete="off" aria-label="Experience"
            onChange={(e) => { setExpQ(e.target.value); setExpSel(null); setExpOpen(true); }}
            onFocus={() => setExpOpen(true)} />
        </div>
        {expQ && (
          <button onClick={() => { setExpQ(""); setExpSel(null); }} aria-label="Clear" style={{ background: T.ink, color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0 }}><X size={12} strokeWidth={3} /></button>
        )}
        {expOpen && (
          <>
            <div onClick={() => setExpOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
            <div role="listbox" style={{ ...heroPop, width: "min(460px, calc(100vw - 28px))", maxHeight: 400, overflowY: "auto" }}>
              {q ? (
                matches.length ? matches.map((t) => (
                  <button key={t.id} onClick={() => pickTour(t)} style={heroRow} role="option" aria-selected={expSel === t.id}>
                    <Compass size={20} color={T.ink} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: 13, color: "rgba(0,0,0,.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[t.pole, t.tag, t.dur].filter(Boolean).join(" · ")}</div>
                    </span>
                  </button>
                )) : (
                  <div style={{ padding: "24px 18px", color: "rgba(0,0,0,.8)", fontSize: 13.5 }}>No experience found for “{expQ}”</div>
                )
              ) : recentTours.length ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, padding: "16px 18px 4px", color: T.ink }}>Recent searches</div>
                  {recentTours.map((t) => (
                    <button key={t.id} onClick={() => pickTour(t)} style={heroRow} role="option" aria-selected={expSel === t.id}>
                      <Clock size={20} color={T.ink} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 13, color: "rgba(0,0,0,.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[t.pole, t.tag, t.dur].filter(Boolean).join(" · ")}</div>
                      </span>
                      <span role="button" tabIndex={0} aria-label={`Remove ${t.name}`} onClick={(e) => { e.stopPropagation(); removeRecent(t.id); }} style={{ flexShrink: 0, marginTop: 4, color: T.ink, display: "flex", cursor: "pointer" }}><X size={17} /></span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, padding: "16px 18px 4px", color: T.ink }}>Popular destinations</div>
                  {popularTours.map((t) => (
                    <button key={t.id} onClick={() => pickTour(t)} style={heroRow} role="option" aria-selected={expSel === t.id}>
                      <MapPin size={20} color={T.ink} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 13, color: "rgba(0,0,0,.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[t.pole, t.tag, t.dur].filter(Boolean).join(" · ")}</div>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Date — single date, dual-month calendar popover */}
      <HField Ico={Calendar} label="Date">
        <RangeDate from={date} to={date} onChange={(f) => setDate(f)} triggerStyle={{ background: "transparent", border: "none", padding: 0 }} wide single minDate={minDate} />
      </HField>

      {/* Voyageurs — occupancy stepper */}
      <div style={{ ...heroBox, position: "relative", cursor: "pointer", flex: "0 0 auto", minWidth: 186 }} onClick={() => setTravOpen((o) => !o)} role="button" aria-haspopup="dialog" aria-expanded={travOpen}>
        <Users size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={heroLab}>Travelers</div>
          <div style={{ fontSize: 14.5, color: T.ink }}>{total} traveler{total > 1 ? "s" : ""}</div>
        </div>
        <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
        {travOpen && (
          <>
            <div onClick={(e) => { e.stopPropagation(); setTravOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
            <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ ...heroPop, left: "auto", right: 0, width: "min(340px, calc(100vw - 28px))", padding: 20 }}>
              {[["adults", "Adults", ""], ["children", "Children", "Ages 0 to 17"]].map(([k, l, sub], i) => {
                const min = k === "adults" ? 1 : 0;
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${T.line}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, color: T.ink }}>{l}</div>
                      {sub && <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)" }}>{sub}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <button onClick={() => setT(k, -1)} disabled={trav[k] <= min} aria-label={`Fewer ${l}`} style={{ ...btnCircle, width: 44, height: 44, fontSize: 20, opacity: trav[k] <= min ? 0.4 : 1, cursor: trav[k] <= min ? "not-allowed" : "pointer" }}>−</button>
                      <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center", fontSize: 15 }}>{trav[k]}</span>
                      <button onClick={() => setT(k, 1)} aria-label={`More ${l}`} style={{ ...btnCircle, width: 44, height: 44, fontSize: 20 }}>+</button>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                <button onClick={() => setTravOpen(false)} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 999, padding: "12px 30px", fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
              </div>
            </div>
          </>
        )}
      </div>

      <button onClick={doSearch} className="hero-search-btn" style={{ ...heroSearchBtnStyle, background: T.gold, color: T.ink }}><Search size={18} /> Search</button>
    </div>
  );
}

function HeroSearch({ go }) {
  const [tab, setTab] = useState("tours");
  const tabs = [["tours", "Tours", IconBeach, 16], ["cars", "Vehicles", IconCarFilled, 19]]; // Flights: on request only, removed from the wizard
  const todayStr = new Date().toISOString().slice(0, 10);

  // Flights state
  const [ftype, setFtype] = useState("round"); // round | one | multi
  const [ffrom, setFfrom] = useState("");
  const [fto, setFto] = useState("");
  const [fdep, setFdep] = useState("");
  const [fret, setFret] = useState("");
  const [ftrav, setFtrav] = useState({ adults: 1, children: 0, infants: 0, young: 0 });
  const ftotal = ftrav.adults + ftrav.children + ftrav.infants + ftrav.young;
  const setTrav = (k, d) => setFtrav((t) => ({ ...t, [k]: Math.max(k === "adults" ? 1 : 0, t[k] + d) }));
  const [fcls, setFcls] = useState("Économique");
  const [vcOpen, setVcOpen] = useState(false);
  const [flegs, setFlegs] = useState([{ from: "", to: "", dep: "" }, { from: "", to: "", dep: "" }]);
  const swapMain = () => { setFfrom(fto); setFto(ffrom); };
  const setLeg = (i, k, v) => setFlegs((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const swapLeg = (i) => setFlegs((ls) => ls.map((l, j) => (j === i ? { from: l.to, to: l.from, dep: l.dep } : l)));

  const doSearch = () => {
    if (tab === "cars") { go("transport"); return; }
    if (tab === "tours") { go("tours"); return; }
    if (ftype === "multi") go("flights", { fp: { type: "Multi-city", pax: ftotal, cls: FLIGHT_CLS_MAP[fcls] }, flegs });
    else go("flights", { fp: { type: ftype === "round" ? "Round trip" : "One way", from: ffrom, to: fto, dep: fdep, ret: ftype === "round" ? fret : "", pax: ftotal, cls: FLIGHT_CLS_MAP[fcls] } });
  };

  // Voyageurs + classe pill (flights) — full Skyscanner-style breakdown
  const travRows = [
    ["adults", "Adultes", ""],
    ["children", "Enfants", "De 2 à 17 ans"],
    ["infants", "Bébés sur les genoux", "Moins de 2 ans"],
    ["young", "Jeunes enfants sur siège", "Moins de 2 ans"],
  ];
  const vcPill = (
    <div style={{ ...heroBox, position: "relative", cursor: "pointer", flex: "0 0 auto", minWidth: 214 }} onClick={() => setVcOpen((o) => !o)}>
      <Users size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={heroLab}>Voyageurs et classe</div>
        <div style={{ fontSize: 14.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ftotal} personne{ftotal > 1 ? "s" : ""}, {fcls}</div>
      </div>
      <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
      {vcOpen && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setVcOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 91, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 18px 44px rgba(0,0,0,.22)", padding: 20, width: "min(360px, calc(100vw - 28px))", cursor: "default" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 14 }}>Voyageurs et classe</div>
            {travRows.map(([k, l, sub]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: k === "adults" ? "none" : `1px solid ${T.line}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: T.ink }}>{l}</div>
                  {sub && <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)" }}>{sub}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setTrav(k, -1)} disabled={ftrav[k] <= (k === "adults" ? 1 : 0)} style={{ ...btnCircle, width: 36, height: 36, fontSize: 18, opacity: ftrav[k] <= (k === "adults" ? 1 : 0) ? 0.4 : 1, cursor: ftrav[k] <= (k === "adults" ? 1 : 0) ? "not-allowed" : "pointer" }} aria-label="Moins">−</button>
                  <span style={{ fontWeight: 600, minWidth: 18, textAlign: "center", fontSize: 15 }}>{ftrav[k]}</span>
                  <button onClick={() => setTrav(k, 1)} style={{ ...btnCircle, width: 36, height: 36, fontSize: 18 }} aria-label="Plus">+</button>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <div style={{ ...heroBox, cursor: "default", padding: "8px 14px" }}>
                <div style={{ flex: 1 }}>
                  <div style={heroLab}>Classe</div>
                  <select value={fcls} onChange={(e) => setFcls(e.target.value)} style={{ ...heroInp, cursor: "pointer" }}>
                    {FLIGHT_CLS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <ChevronDown size={15} style={{ opacity: 0.5 }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setVcOpen(false)} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 999, padding: "10px 26px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const searchBtn = (
    <button onClick={doSearch} className="hero-search-btn" style={{ background: T.green, color: "#fff", border: "none", borderRadius: 12, padding: "0 28px", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0, minHeight: 54 }}>
      <Search size={18} /> Rechercher
    </button>
  );

  return (
    <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 24px 60px rgba(9,20,15,.24)", padding: "8px 16px 18px", maxWidth: 1120, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* main tabs — pills, centered */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "4px 0 6px" }}>
        {tabs.map(([k, l, Ico, sz]) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: on ? T.green : "transparent", border: `1px solid ${on ? T.green : T.ink}`, borderRadius: 999, cursor: "pointer", color: on ? "#fff" : T.ink, fontWeight: on ? 700 : 600, fontSize: 14, padding: "9px 22px", fontFamily: "inherit", transition: "background .15s ease, color .15s ease, border-color .15s ease" }}>
              <Ico size={sz || 19} strokeWidth={1.9} />
              <span>{l}</span>
            </button>
          );
        })}
      </div>

      {tab === "flights" ? (
        <div style={{ marginTop: 14 }}>
          {/* flight sub-tabs */}
          <div style={{ display: "flex", gap: 22, borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
            {[["round", "Aller-retour"], ["one", "Aller simple"], ["multi", "Multidestination"]].map(([k, l]) => {
              const on = ftype === k;
              return <button key={k} onClick={() => setFtype(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${on ? T.green : "transparent"}`, marginBottom: -1, padding: "4px 2px 9px", cursor: "pointer", color: on ? T.green : "rgba(0,0,0,.8)", fontWeight: on ? 700 : 600, fontSize: 14, fontFamily: "inherit" }}>{l}</button>;
            })}
          </div>

          {ftype === "multi" ? (
            <div>
              <div style={{ maxWidth: 280, marginBottom: 16 }}>{vcPill}</div>
              {flegs.map((l, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.ink, marginBottom: 6 }}>Vol {i + 1}</div>
                  <div className="hero-fields" style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                    <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><AirportInput value={l.from} onChange={(v) => setLeg(i, "from", v)} placeholder="Lieu de départ" wide Icon={MapPin} /></div>
                      <button onClick={() => swapLeg(i)} style={heroSwapBtn} aria-label="Inverser"><SwapIcon /></button>
                      <div style={{ flex: 1, minWidth: 0 }}><AirportInput value={l.to} onChange={(v) => setLeg(i, "to", v)} placeholder="Destination" wide Icon={MapPin} /></div>
                    </div>
                    <HField Ico={Calendar} label="Date">
                      <input type="date" min={todayStr} style={heroInp} value={l.dep} onChange={(e) => setLeg(i, "dep", e.target.value)} />
                    </HField>
                    {flegs.length > 2 ? <button onClick={() => setFlegs((ls) => ls.filter((_, j) => j !== i))} style={{ ...btnCircle, alignSelf: "center", flexShrink: 0 }} aria-label="Retirer ce vol"><X size={14} /></button> : null}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
                {flegs.length < 6
                  ? <button onClick={() => setFlegs((ls) => [...ls, { from: ls[ls.length - 1].to || "", to: "", dep: "" }])} style={{ background: "none", border: "none", color: T.green, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}><Plane size={16} /> Ajouter un autre vol</button>
                  : <span />}
                {searchBtn}
              </div>
            </div>
          ) : (
            <div className="hero-fields" style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
              <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}><AirportInput value={ffrom} onChange={setFfrom} placeholder="Lieu de départ" wide Icon={MapPin} /></div>
                <button onClick={swapMain} style={heroSwapBtn} aria-label="Inverser"><SwapIcon /></button>
                <div style={{ flex: 1, minWidth: 0 }}><AirportInput value={fto} onChange={setFto} placeholder="Destination" wide Icon={MapPin} /></div>
              </div>
              {ftype === "round" ? (
                <HField Ico={Calendar} label="Dates">
                  <RangeDate from={fdep} to={fret} onChange={(f, t) => { setFdep(f); setFret(t); }} triggerStyle={{ background: "transparent", border: "none", padding: 0 }} wide align="right" />
                </HField>
              ) : (
                <HField Ico={Calendar} label="Date">
                  <input type="date" min={todayStr} style={heroInp} value={fdep} onChange={(e) => setFdep(e.target.value)} />
                </HField>
              )}
              {vcPill}
              {searchBtn}
            </div>
          )}
        </div>
      ) : tab === "cars" ? (
        <CarSearch go={go} />
      ) : (
        <TourSearch go={go} />
      )}
    </div>
  );
}

function Home({ go, notify, setBooking, filters, setFilters, setChat, addBookingHome, user, favorites, toggleFavorite }) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [search, setSearch] = useState({ dest: "Senegal", exp: "All", dateFrom: "", dateTo: "", pax: 2 });
  const featured = ["goree","bandia","lacrose","toubacouta","stlouis","lompoul","food","boat"].map((id) => TOURS.find((t) => t.id === id));
  // Featured section theme tabs — "Featured" is the curated set, then the ATS themes (tour tags)
  const FEAT_THEMES = ["Heritage", "Nature", "Culture", "Adventure", "Beach", "Safari", "Circuit", "Gastronomy", "Nightlife", "Wildlife"].filter((tg) => TOURS.some((t) => t.tag === tg));
  const [featTab, setFeatTab] = useState("Featured");
  const featList = featTab === "Featured" ? featured : TOURS.filter((t) => t.tag === featTab).slice(0, 12);
  const todayStr = new Date().toISOString().slice(0, 10);
  const heroUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/hero.jpg").data.publicUrl;

  return (
    <>
      <header style={{ background: T.ink }}>
        <style>{`
          @media(max-width:760px){
            .hero-fields{flex-direction:column !important}
            .hero-search-btn{padding:13px !important}
          }
        `}</style>
        <div style={{
          width: "100%", position: "relative", zIndex: 6,
          height: "clamp(420px,50vw,620px)",
          background: `linear-gradient(rgba(0,0,0,.62), rgba(0,0,0,.62)), url("${heroUrl}") center/cover no-repeat, linear-gradient(160deg, #006B33 0%, ${T.green} 65%, #00A84F 100%)`,
        }}>
          {/* Overlay pinned to the hero top — grows downward and may overflow the hero without stretching it */}
          <div style={{ position: "absolute", top: "clamp(80px,15vw,185px)", left: 0, right: 0, padding: "0 clamp(20px,4vw,54px)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ textAlign: "center", color: "#fff", marginBottom: "clamp(14px,2vw,20px)" }}>
              <h1 className="about-script" style={{ fontSize: "clamp(28px,4vw,46px)", lineHeight: 1.02, fontWeight: 700, margin: 0, textShadow: "0 2px 22px rgba(0,0,0,.4)" }}>Discover the beauty of Africa</h1>
            </div>
            <HeroSearch go={go} />
          </div>
        </div>
      </header>

      {/* CHOOSE YOUR AFRICA — moved to 2nd position, right after the hero */}
      <section style={{ background: "#fff" }}>
        <style>{`
          @media(max-width:760px){
            .africa-grid{gap:26px !important}
            .africa-globe-wrap{margin:0 auto !important;max-width:400px !important;order:-1}
          }
        `}</style>
        <Wrap>
          <div className="africa-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 48, alignItems: "center" }}>
            <div>
              <div className="about-script" style={{ fontSize: 24, fontWeight: 600, color: T.green, lineHeight: 1, marginBottom: 2 }}>One platform · one continent</div>
              <H2>Choose your Africa</H2>
              <p style={{ lineHeight: 1.6, opacity: 0.85, marginBottom: 24, maxWidth: 460 }}>
                Senegal is live with 35+ documented experiences across six regions; Rwanda packages are available. New destinations open progressively.
              </p>
              <div style={{ display: "flex", gap: 30, marginBottom: 28, flexWrap: "wrap" }}>
                {[["35+", "Experiences"], ["6", "Regions"], ["4", "Islands"]].map(([n, l]) => (
                  <div key={l}>
                    <div className="disp" style={{ fontWeight: 800, fontSize: 28, color: T.green, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)", marginTop: 5 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(0,0,0,.8)", marginBottom: 10 }}>Available now</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
                {COUNTRIES.filter((c) => c.live).map((c) => {
                  const on = country.id === c.id;
                  return (
                    <button key={c.id} onClick={() => setCountry(c)} style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", border: `1.5px solid ${on ? T.green : T.line}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "border-color .2s ease" }}>
                      <span style={{ width: 11, height: 11, borderRadius: "50%", background: T.green, flexShrink: 0 }} />
                      <span>
                        <span className="disp" style={{ display: "block", fontWeight: 800, fontSize: 16, color: T.ink }}>{c.name}</span>
                        <span style={{ fontSize: 12.5, color: T.green, fontWeight: 600 }}>Live now · {c.count}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(0,0,0,.8)", margin: "6px 0 10px" }}>Coming soon</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                {COUNTRIES.filter((c) => !c.live).map((c) => {
                  const on = country.id === c.id;
                  return <button key={c.id} onClick={() => setCountry(c)} style={{ background: on ? "rgba(0,107,51,.10)" : "#fff", border: `1px solid ${on ? T.indigo : T.line}`, color: on ? T.indigo : "rgba(0,0,0,.8)", borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{c.name}</button>;
                })}
              </div>
              {country.live && (
                <button style={{ ...btnGold, fontSize: 14, padding: "12px 24px" }} onClick={() => go("tours")}>Explore {country.name} →</button>
              )}
            </div>
            <div className="africa-globe-wrap" style={{ maxWidth: 500, margin: "0 0 0 auto", width: "100%" }}>
              <svg viewBox="0 0 100 100" role="img" aria-label="Dotted map of Africa with ATS destinations, islands included" style={{ width: "100%", maxWidth: 470, margin: "0 auto", display: "block" }}>
                {DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.62" fill={T.green} opacity="0.55" />)}
                {COUNTRIES.map((c) => (
                  <g key={c.id} style={{ cursor: "pointer" }} onClick={() => setCountry(c)}>
                    <circle cx={c.x} cy={c.y} r={c.live ? 2.6 : 1.8} fill={c.live ? T.gold : T.indigo} stroke="#fff" strokeWidth="0.5" className={c.live ? "pulse" : ""} />
                    <circle cx={c.x} cy={c.y} r="5.5" fill="transparent" />
                    {country.id === c.id && <circle cx={c.x} cy={c.y} r="4.4" fill="none" stroke={T.gold} strokeWidth="0.9" />}
                  </g>
                ))}
                <text x="50" y="98" textAnchor="middle" fontSize="2.8" fill={T.ink} opacity="0.55">Tap a marker — Cape Verde, Zanzibar, Comoros &amp; Madagascar included</text>
              </svg>
            </div>
          </div>
        </Wrap>
      </section>

      {/* FEATURED TOURS — right after the Africa map, with theme tabs */}
      <section style={{ background: "#fff", borderTop: `1px solid ${T.line}` }}>
        <Wrap>
          <div style={{ display: "flex", alignItems: "end", flexWrap: "wrap", gap: 12 }}>
            <div><Eyebrow>Senegal · from the ATS catalogue</Eyebrow><H2>Featured tours & experiences</H2></div>
            <button onClick={() => go("tours")} style={{ ...btnGreen, marginLeft: "auto", fontSize: 14 }}>See all tours →</button>
          </div>
          {/* Theme tabs — reference-style underlined tabs (card template unchanged) */}
          <div style={{ display: "flex", gap: 26, borderBottom: `1px solid ${T.line}`, overflowX: "auto", margin: "8px 0 22px", WebkitOverflowScrolling: "touch" }}>
            {["Featured", ...FEAT_THEMES].map((tg) => {
              const on = featTab === tg;
              return (
                <button key={tg} onClick={() => setFeatTab(tg)} style={{ background: "none", border: "none", borderBottom: `2px solid ${on ? T.green : "transparent"}`, marginBottom: -1, padding: "8px 2px", cursor: "pointer", color: on ? T.ink : "rgba(0,0,0,.6)", fontWeight: on ? 700 : 600, fontSize: 15, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>{tg}</button>
              );
            })}
          </div>
          <TourGrid tours={featList} go={go} setBooking={setBooking} favorites={favorites} toggleFavorite={toggleFavorite} slider />
        </Wrap>
      </section>

      {/* PLAN YOUR TRIP */}
      <PlanTripSection go={go} />

      {/* SERVICE CATEGORIES — hidden on Home (kept for later reuse)
      <section style={{ background: "#fff" }}>
        <Wrap>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="about-script" style={{ fontSize: 24, fontWeight: 600, color: T.green, lineHeight: 1 }}>Wonderful services for you</div>
            <h2 className="disp" style={{ fontWeight: 800, fontSize: "clamp(26px,3.6vw,38px)", letterSpacing: "-0.02em", color: T.ink, margin: "2px 0 0" }}>Our Services</h2>
          </div>
          <ServicesFan go={go} />
        </Wrap>
      </section>
      */}

      {/* QUICK TRANSFER BOOKING (ATS Logistics) */}
      <section style={{ background: "#fff" }}>
        <Wrap style={{ padding: "36px 20px" }}>
          <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div><Eyebrow>ATS Logistics</Eyebrow><h2 className="disp" style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>Need a transfer or a car? Book it now.</h2></div>
            <button onClick={() => go("transport")} style={{ marginLeft: "auto", background: "none", border: "none", color: T.indigo, fontWeight: 700, cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 4 }}>All transport services <ArrowRight size={15} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "stretch" }}>
            <TransferWidget addBooking={addBookingHome} compact user={user} go={go} />
            <div style={{ borderRadius: 16, overflow: "hidden", minHeight: 320, background: `linear-gradient(160deg, rgba(0,0,0,.35), rgba(0,0,0,.20)), url("${supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/transfer.jpg").data.publicUrl}") center/cover no-repeat, linear-gradient(140deg, ${T.green}, ${T.indigo})` }} />
          </div>
        </Wrap>
      </section>

      {/* PORTALS */}
      <Wrap>
        <H2>A portal for every client</H2>
        <PortalTabs go={go} />
      </Wrap>

      {/* AI */}
      <Wrap style={{ paddingTop: 0 }}>
        <div style={{ background: `linear-gradient(120deg, ${T.green}, ${T.ink})`, color: T.paper, borderRadius: 20, padding: "34px 26px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <Bot size={44} strokeWidth={1.6} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 className="disp" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>ATS Travel Assistant</h3>
            <p style={{ opacity: 0.9, marginTop: 4, fontSize: 15 }}>"I have 5 days and $1,500 — plan my Senegal trip." Instant itineraries from real ATS products.</p>
          </div>
          <button style={btnGold} onClick={() => setChat(true)}>Try the assistant</button>
        </div>
      </Wrap>
    </>
  );
}
const selStyle = { width: "100%", border: "none", background: "transparent", fontSize: 14, fontWeight: 500, color: T.ink, fontFamily: "inherit" };
function SearchField({ label: l, children }) {
  return <div style={{ padding: "8px 12px", borderRadius: 10, background: T.paperDark }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.laterite, textTransform: "uppercase", letterSpacing: ".08em" }}>{l}</div>{children}
  </div>;
}
function PortalTabs({ go }) {
  const [tab, setTab] = useState("traveler");
  const content = {
    traveler: ["Save favorites and itineraries · track bookings and trip countdowns · pay instalments · download invoices · chat with ATS on WhatsApp.", "Open my account", "account"],
    corporate: ["Request and approve quotations internally · manage traveler groups · consolidated invoicing · dedicated account manager for governments, embassies, NGOs and companies.", "Open corporate portal", "corporate"],
    agent: ["Net rates and commission tracking · white-label quotations in minutes · manage your customers and bookings · monthly reports.", "Open agent portal", "agents"],
  };
  return (
    <>
      <div style={{ display: "flex", gap: 8, margin: "6px 0 16px", flexWrap: "wrap" }}>
        {[["traveler", "Travelers"], ["corporate", "Corporate & NGO"], ["agent", "Travel agents"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: `1px solid ${tab === k ? T.green : T.line}`, background: tab === k ? T.green : "#fff", color: tab === k ? "#fff" : T.ink, borderRadius: 999, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>{l}</button>
        ))}
      </div>
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 24, fontSize: 15, lineHeight: 1.7 }}>
        <p style={{ margin: 0 }}>{content[tab][0]}</p>
        <button style={{ ...btnGreen, marginTop: 14, fontSize: 14 }} onClick={() => go(content[tab][2])}>{content[tab][1]} →</button>
      </div>
    </>
  );
}

// ---------------- TOURS LISTING ----------------
// ---- Tour photos (Supabase Storage bucket "tour-photos") ----
// Convention: one folder per tour id. Cover file must be named cover.jpg.
// e.g. tour-photos/goree/cover.jpg, tour-photos/goree/2.jpg, ...
const PHOTO_BUCKET = "tour-photos";
const coverUrl = (id) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${id}/cover.jpg`).data.publicUrl;
// Payment provider logos (Supabase Storage · site/)
const PAY_LOGOS = {
  paydunya: supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/logo-paydunya.webp").data.publicUrl,
  stripe: supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/logo-stripe.webp").data.publicUrl,
};

// Resolve a tour's cover by listing its folder — matches "cover.*" (any extension),
// falls back to the first image. Avoids the hard-coded ".jpg" assumption.
function useCoverUrl(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!id) { setUrl(null); return; }
    let alive = true;
    supabase.storage.from(PHOTO_BUCKET).list(id, { limit: 30 }).then(({ data }) => {
      if (!alive || !data) return;
      const files = data.filter((f) => f.name && !f.name.startsWith("."));
      const cover = files.find((f) => /^cover\.[^.]+$/i.test(f.name)) || files[0];
      setUrl(cover ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${id}/${cover.name}`).data.publicUrl : null);
    });
    return () => { alive = false; };
  }, [id]);
  return url;
}

function Thumb({ rec, size = 46 }) {
  const id = rec.tour?.id;
  const auto = useCoverUrl(rec.tour?.thumb ? null : id);
  const url = rec.tour?.thumb || auto;
  const [ok, setOk] = useState(true);
  return (
    <div style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", background: T.paperDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: T.green }}>
      {ok && url ? <img src={url} alt="" onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <CatIcon tour={rec.tour} size={Math.round(size * 0.5)} />}
    </div>
  );
}

function Cover({ tour, id, ratio, radius = 0, size = 58 }) {
  const cid = id || tour?.id;
  const url = useCoverUrl(cid);
  const [ok, setOk] = useState(true);
  return (
    <div style={{ aspectRatio: ratio, width: "100%", borderRadius: radius, overflow: "hidden", background: `linear-gradient(140deg, ${T.green}, ${T.indigo})`, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.9)" }}>
      {ok && url ? <img src={url} alt="" onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <CatIcon tour={tour} size={size} color="rgba(255,255,255,.92)" strokeWidth={1.4} />}
    </div>
  );
}

function useTourPhotos(tourId) {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.storage.from(PHOTO_BUCKET).list(tourId, { limit: 20, sortBy: { column: "name", order: "asc" } })
      .then(({ data }) => {
        if (!alive || !data) return;
        const urls = data
          .filter((f) => f.name && !f.name.startsWith("."))
          .map((f) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${tourId}/${f.name}`).data.publicUrl);
        urls.sort((a, b) => (a.includes("/cover.") ? -1 : b.includes("/cover.") ? 1 : 0));
        setPhotos(urls);
      });
    return () => { alive = false; };
  }, [tourId]);
  return photos;
}

function TourGrid({ tours, go, setBooking, slider, favorites = [], toggleFavorite }) {
  const container = slider
    ? { display: "flex", gap: 18, overflowX: "auto", scrollSnapType: "x mandatory", marginTop: 10, paddingTop: 12, paddingBottom: 46, scrollbarWidth: "none", msOverflowStyle: "none" }
    : { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18, marginTop: 18 };
  const cardExtra = slider ? { flex: "0 0 auto", scrollSnapAlign: "start", boxSizing: "border-box" } : {};
  return (
    <>
      {slider && <style>{`
        .tour-strip::-webkit-scrollbar{display:none}
        .tour-card{width:calc((100% - 54px) / 4);box-sizing:border-box}
        @media(max-width:1000px){.tour-card{width:min(320px,74vw)}}
      `}</style>}
      <div className={slider ? "tour-strip" : ""} style={container}>
      {tours.map((t) => (
        <article key={t.id} className={slider ? "card-hover tour-card" : "card-hover"} onClick={() => go("tour", { id: t.id })} style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", color: "#1A1A1A", ...cardExtra }}>
          <div style={{ position: "relative" }}>
            <Cover tour={t} ratio="4 / 3" size={58} />
            {toggleFavorite && (
              <span role="button" tabIndex={0} aria-label={favorites.includes(t.id) ? "Remove from favorites" : "Save to favorites"}
                onClick={(e) => { e.stopPropagation(); toggleFavorite(t.id); }}
                style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.2)", cursor: "pointer" }}>
                <Heart size={17} fill={favorites.includes(t.id) ? "#C0392B" : "none"} color={favorites.includes(t.id) ? "#C0392B" : "#1A1A1A"} />
              </span>
            )}
          </div>

          <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", gap: 5, marginBottom: 7, flexWrap: "nowrap", overflow: "hidden" }}>
              <span style={pill()}>{t.pole}</span><span style={pill()}>{t.tag}</span>
              {!t.quote && <span style={pill()}>Group discounts</span>}
            </div>
            <h3 className="disp" style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.2, margin: 0, color: "#1A1A1A" }}>{t.name}</h3>
            <div style={{ fontSize: 11.5, color: "rgba(0,0,0,.8)", margin: "6px 0 0" }}>{t.dur}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto", paddingTop: 12 }}>
              <div style={{ minWidth: 0 }}>
                {t.quote ? (
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>Price on request</div>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}><PrefPrice base={fromPrice(t)} pp={false} /> <span style={{ fontWeight: 500, fontSize: 11.5, color: "rgba(0,0,0,.8)" }}>for 5+ pax</span></div>
                    <div style={{ fontSize: 11, color: "rgba(0,0,0,.8)" }}>1–2 pax: {fmtXOF(t.grid.p12.a)}</div>
                  </>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setBooking(t); }} style={{ marginLeft: "auto", background: t.quote ? "#1A1A1A" : T.gold, color: t.quote ? "#fff" : T.ink, border: "none", borderRadius: 10, padding: "8px 15px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", flexShrink: 0 }}>{t.quote ? "Get quote" : "Book"}</button>
            </div>
          </div>
        </article>
      ))}
      </div>
    </>
  );
}
const pill = () => ({ fontSize: 10, fontWeight: 500, color: "#1A1A1A", background: "#F2F2F2", border: "none", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 });

function ToursPage({ go, setBooking, filters, setFilters, favorites, toggleFavorite }) {
  const [q, setQ] = useState("");
  const tags = ["All", ...new Set(TOURS.map((t) => t.tag))];
  const query = q.trim().toLowerCase();
  const tours = TOURS.filter((t) =>
    (filters.pole === "All" || t.pole === filters.pole) &&
    (filters.tag === "All" || t.tag === filters.tag) &&
    (!query || `${t.name} ${t.desc || ""} ${t.tag || ""} ${t.pole || ""}`.toLowerCase().includes(query))
  );
  return (
    <Wrap>
      <Eyebrow>Senegal · 6 regions · transport quoted separately</Eyebrow>
      <H2>All tours & experiences</H2>

      <div style={{ position: "relative", maxWidth: 560, margin: "6px 0 18px" }}>
        <Search size={19} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#8A968E", pointerEvents: "none" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a tour by name or description…"
          aria-label="Search tours"
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 44px 13px 46px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", fontSize: 15, fontFamily: "inherit", color: T.ink, boxShadow: "0 2px 10px rgba(20,32,26,.05)" }}
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear search" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#F2F2F2", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#1A1A1A" }}>
            <X size={15} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {POLES.map((p) => {
          const on = p === filters.pole;
          return <button key={p} onClick={() => setFilters({ ...filters, pole: p })} style={{ border: "none", background: on ? T.green : "#F7F7F7", color: on ? "#fff" : "#1A1A1A", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer" }}>{p === "All" ? "All regions" : p}</button>;
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {tags.map((p) => {
          const on = p === filters.tag;
          return <button key={p} onClick={() => setFilters({ ...filters, tag: p })} style={{ border: "none", background: on ? T.indigo : "#F7F7F7", color: on ? "#fff" : "#1A1A1A", borderRadius: 999, padding: "8px 15px", fontSize: 12.5, fontWeight: on ? 600 : 500, cursor: "pointer" }}>{p === "All" ? "All themes" : p}</button>;
        })}
      </div>
      {tours.length === 0 ? (
        <div style={{ marginTop: 30, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
          No tours match {query ? "your search" : "these filters"} yet. <button style={{ ...btnGreen, marginLeft: 8, fontSize: 13, padding: "8px 14px" }} onClick={() => { setFilters({ pole: "All", tag: "All" }); setQ(""); }}>Reset</button>
        </div>
      ) : <TourGrid tours={tours} go={go} setBooking={setBooking} favorites={favorites} toggleFavorite={toggleFavorite} />}
    </Wrap>
  );
}

// ---------------- TOUR DETAIL ----------------
function PriceGrid({ t }) {
  const rows = [["p12", t.grid.p12], ["p34", t.grid.p34], ["grp", t.grid.grp]];
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", minWidth: 320, borderCollapse: "collapse", fontSize: "clamp(12.5px, 3.2vw, 14.5px)" }}>
        <thead>
          <tr style={{ textAlign: "left", color: T.indigo }}>
            <th style={{ padding: "8px 6px", borderBottom: `2px solid ${T.green}` }}>Basis (per person)</th>
            <th style={{ padding: "8px 6px", borderBottom: `2px solid ${T.green}`, whiteSpace: "nowrap" }}>Adult</th>
            <th style={{ padding: "8px 6px", borderBottom: `2px solid ${T.green}`, whiteSpace: "nowrap" }}>Child 3–12</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "9px 6px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>{tierLabel[k]}</td>
              <td style={{ padding: "9px 6px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{v.a ? fmtXOF(v.a) : "On request"}</td>
              <td style={{ padding: "9px 6px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{v.c ? fmtXOF(v.c) : v.a ? "Adult rate*" : "On request"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const REVIEWS = [
  { who: "Awa M.", txt: "Guide exceptionnel, organisation sans faille. À refaire les yeux fermés." },
  { who: "Jean D.", txt: "Parfait pour un premier séjour au Sénégal — rythme idéal et logistique impeccable." },
  { who: "Caroline", txt: "Merci pour ce moment mémorable, tout était fluide du début à la fin." },
];

// Approx coordinates per zone for the interactive map (lat, lon)
const ZONE_COORDS = {
  dakar: [14.6928, -17.4467], bandia: [14.5833, -17.0000], joal: [14.1667, -16.8333],
  ndangane: [14.0389, -16.7561], palmarin: [14.0667, -16.7667], toubacouta: [13.7897, -16.4711],
  ziguinchor: [12.5833, -16.2719], capskirring: [12.3956, -16.7469], stlouis: [16.0179, -16.4896],
  lompoul: [15.4500, -16.6800], kedougou: [12.5556, -12.1806],
};
const tourCoords = (t) => ZONE_COORDS[t.zone] || [14.4974, -14.4524];

function TourDetail({ tourId, go, setBooking, favorites = [], toggleFavorite, initialDate, initialPax, user, setSignin, notify }) {
  const t = TOURS.find((x) => x.id === tourId) || TOURS[0];
  // Ma Tontine Voyage needs a free account; guests are sent to sign-in instead
  const startTontine = () => { if (!user) { setSignin && setSignin(true); notify && notify("Create a free account to book with Ma Tontine Voyage."); return; } openBooking("deposit"); };
  const [mlat, mlon] = tourCoords(t);
  const fav = favorites.includes(t.id);
  const [pax, setPax] = useState(initialPax || 2);
  const [extras, setExtras] = useState([]);
  const [vehicle, setVehicle] = useState(-1);      // -1 = no transport
  const [preview, setPreview] = useState(null);   // gallery lightbox index
  const [flash, setFlash] = useState("");          // ephemeral alert on the mobile bar
  const flashTimer = useRef();
  const showFlash = (m) => { setFlash(m); clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setFlash(""), 2600); };
  const todayStr = new Date().toISOString().slice(0, 10);
  const minDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); // earliest = day after tomorrow
  const [dateFrom, setDateFrom] = useState(initialDate || "");
  const [dateTo, setDateTo] = useState(initialDate || "");
  const setTripDate = (v) => { setDateFrom(v); setDateTo(v); }; // single date for trips
  // If the user arrives from the hero search, keep the date/travellers they already chose
  useEffect(() => { if (initialDate) { setDateFrom(initialDate); setDateTo(initialDate); } if (initialPax) setPax(initialPax); }, [tourId, initialDate, initialPax]);
  const daysUntil = dateFrom ? Math.ceil((new Date(dateFrom + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000) : null;
  const dateOk = daysUntil != null && daysUntil >= 0 && !!dateTo && dateTo >= dateFrom;
  const tontinePossible = dateOk && daysUntil >= 15;
  const openBooking = (plan) => setBooking({ ...t, initialPlan: plan, initialPax: pax, initialExtras: extras, initialDateFrom: dateFrom, initialDateTo: dateTo, initialVehicle: vehicle });

  const imgs = useTourPhotos(t.id);
  const galleryCount = Math.max(5, imgs.length);
  const tile = (i) => imgs[i] || null;

  // Highlights derived from the program steps (first clause before the distance/time note)
  const highlights = (t.steps || []).slice(0, 6).map((s) => s.split("  ·  ")[0].split("|")[0].trim()).filter(Boolean);

  // Per-person price by group size (auto): 1–2 → p12, 3–4 → p34, 5+ → group rate
  const tier = tierOf(pax);
  const ppUnit = t.quote ? null : (t.grid[tier]?.a ?? fromPrice(t));
  const rates = t.zone ? RATES[t.zone] : null;
  const transportCost = vehicle >= 0 && rates ? rates[vehicle] : 0;
  const extrasTotal = t.addons.filter((a) => extras.includes(a.name) && a.price).reduce((s, a) => s + (a.per === "person" ? a.price * pax : a.price), 0);
  const estTotal = ppUnit != null ? ppUnit * pax + extrasTotal + transportCost : null;
  const toggleExtra = (name) => setExtras((x) => x.includes(name) ? x.filter((n) => n !== name) : [...x, name]);

  // Similar tours for cross-sell (same tag weighted highest, then same pole/zone)
  const similar = useMemo(() => {
    const score = (x) => (x.tag === t.tag ? 3 : 0) + (x.pole === t.pole ? 2 : 0) + (x.zone && x.zone === t.zone ? 1 : 0);
    return TOURS.filter((x) => x.id !== t.id).map((x) => [score(x), x]).sort((a, b) => b[0] - a[0]).slice(0, 9).map((p) => p[1]);
  }, [t.id]);
  const xsellRef = useRef(null);
  const scrollXsell = (dir) => { const el = xsellRef.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" }); };

  // Keyboard navigation for the gallery lightbox
  useEffect(() => {
    if (preview === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPreview(null);
      if (e.key === "ArrowRight") setPreview((p) => (p + 1) % galleryCount);
      if (e.key === "ArrowLeft") setPreview((p) => (p - 1 + galleryCount) % galleryCount);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, galleryCount]);

  return (
    <>
      <Wrap style={{ paddingBottom: 20 }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
          <button onClick={() => go("home")} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink, opacity: 0.8, padding: 0 }}>Home</button>
          {" › "}
          <button onClick={() => go("tours")} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink, opacity: 0.8, padding: 0 }}>Senegal</button>
          {" › "}<span style={{ fontWeight: 600 }}>{t.name}</span>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: T.green }}>{t.tag} · {t.pole}</div>
        <h1 className="disp" style={{ fontSize: "clamp(22px,3.6vw,32px)", fontWeight: 700, margin: "6px 0 10px", letterSpacing: "-0.01em" }}>{t.name}</h1>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13.5, opacity: 0.8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={15} /> {t.dur}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin size={15} /> {t.pole}, Senegal</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Languages size={15} /> Français, English</span>
        </div>

        {/* Gallery — grid on desktop, swipeable slider on mobile */}
        <style>{`
          .tour-gallery{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:10px;margin-top:18px;height:340px}
          .tour-gallery .gtile{border:none;cursor:pointer;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;padding:0}
          .tour-gallery .gtile:first-child{grid-column:1 / 2;grid-row:1 / 3}
          @media(max-width:700px){
            .tour-gallery{display:flex;grid-template-columns:none;grid-template-rows:none;overflow-x:auto;scroll-snap-type:x mandatory;height:230px;-webkit-overflow-scrolling:touch}
            .tour-gallery .gtile{flex:0 0 88%;scroll-snap-align:center}
            .tour-gallery .gtile:first-child{grid-column:auto;grid-row:auto}
          }
        `}</style>
        <div className="tour-gallery">
          {Array.from({ length: galleryCount }).slice(0, 5).map((_, i) => (
            <button key={i} className="gtile" onClick={() => setPreview(i)} aria-label={`View photo ${i + 1}`}
              style={{ background: tile(i) ? `center/cover no-repeat url(${tile(i)})` : `linear-gradient(140deg, ${T.green}, ${T.indigo})`, fontSize: i === 0 ? 72 : 40 }}>
              {!tile(i) && <CatIcon tour={t} size={i === 0 ? 72 : 40} color="rgba(255,255,255,.9)" strokeWidth={1.4} />}
              {i === 4 && galleryCount > 5 && <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>+{galleryCount - 5} photos</span>}
              {i === 0 && (
                <span role="button" tabIndex={0} aria-label={fav ? "Remove from favorites" : "Save to favorites"}
                  onClick={(e) => { e.stopPropagation(); toggleFavorite && toggleFavorite(t.id); }}
                  style={{ position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,.22)", cursor: "pointer" }}>
                  <Heart size={20} fill={fav ? "#C0392B" : "none"} color={fav ? "#C0392B" : "#1A1A1A"} />
                </span>
              )}
            </button>
          ))}
        </div>
      </Wrap>

      <Wrap style={{ paddingTop: 0 }}>
       <div className="tour-cols">
        <div style={{ minWidth: 0 }}>
          {highlights.length > 0 && (
            <Section title="Highlights">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px 20px" }}>
                {highlights.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 14.5, lineHeight: 1.4 }}><Check size={17} color={T.green} style={{ flexShrink: 0, marginTop: 1 }} /><span>{h}</span></div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Description">
            <p style={{ fontSize: 15, lineHeight: 1.75, margin: 0, color: "rgba(0,0,0,.8)", maxWidth: 640 }}>{t.desc}</p>
            {t.sub && <p style={{ fontSize: 13, lineHeight: 1.65, color: "#6B7A72", marginTop: 10, maxWidth: 640 }}>{t.sub}</p>}
          </Section>

          {t.steps.length > 0 && (
            <Section title="Itinerary">
              <div style={{ borderLeft: `2px solid ${T.line}`, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                {t.steps.map((s, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: -27, top: 0, width: 18, height: 18, borderRadius: "50%", background: T.green, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{s}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {t.addons.length > 0 && (
            <Section title="Options & extras">
              <p style={{ fontSize: 13.5, color: "#6B7A72", margin: "0 0 12px" }}>Add options to your experience — they update the estimate on the right. Final selection is confirmed at booking.</p>
              {t.addons.map((a) => {
                const on = extras.includes(a.name);
                const selectable = !!a.price;
                return (
                  <div key={a.name} role="button" tabIndex={0}
                    onClick={() => selectable && toggleExtra(a.name)}
                    onKeyDown={(e) => { if (selectable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleExtra(a.name); } }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1.5px solid ${on ? T.green : T.line}`, borderRadius: 12, marginBottom: 8, cursor: selectable ? "pointer" : "default", background: on ? "#F3FAF5" : "#fff", opacity: selectable ? 1 : 0.7 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${on ? T.green : T.line}`, background: on ? T.green : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on ? <Check size={14} /> : null}</span>
                    <span style={{ flex: 1, fontSize: 14.5 }}>{a.name}</span>
                    <strong style={{ whiteSpace: "nowrap", color: T.green }}>{a.price ? "+ " + fmtXOF(a.price) + (a.per === "person" ? " /pp" : "") : "On request"}</strong>
                  </div>
                );
              })}
            </Section>
          )}

          {!t.quote && (
            <Section title="Prices">
              <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
                <PriceGrid t={t} />
                <p style={{ fontSize: 12.5, color: "#6B7A72", margin: "10px 0 0" }}>Per-person price by group size — larger groups pay less per person. Children 3–12; under 3 free. Transport not included (chosen at booking).</p>
              </div>
            </Section>
          )}

          <Section title="Location">
            <div style={{ border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
              <iframe title={`Map — ${t.name}`} loading="lazy" width="100%" height="320" style={{ border: 0, display: "block" }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${mlon - 0.09}%2C${mlat - 0.06}%2C${mlon + 0.09}%2C${mlat + 0.06}&layer=mapnik&marker=${mlat}%2C${mlon}`} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, color: "#6B7A72" }}>
              <MapPin size={14} color={T.green} /> {t.pole}, Senegal ·{" "}
              <a href={`https://www.openstreetmap.org/?mlat=${mlat}&mlon=${mlon}#map=12/${mlat}/${mlon}`} target="_blank" rel="noopener noreferrer" style={{ color: T.green, fontWeight: 600, textDecoration: "none" }}>View larger map →</a>
            </div>
          </Section>

          <Section title="FAQ">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14.5, lineHeight: 1.6 }}>
              <div><strong>Why do prices change with group size?</strong><br />ATS prices per person by basis — Private 1–2, Private 3–4, or Group 5+ — so bigger groups pay less per person.</div>
              <div><strong>Is transport included?</strong><br />No. Choose your vehicle category at booking (Sedan, SUV, Minivan or coach), priced per vehicle from the ATS Logistics rate card.</div>
              <div><strong>Can I pay in instalments?</strong><br />Yes — Ma Tontine Voyage: 20% deposit confirms your booking, balance in scheduled instalments before departure.</div>
            </div>
          </Section>

          <Section title="Traveler reviews">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {REVIEWS.map((r, i) => (
                <div key={i} style={{ borderBottom: `1px solid ${T.line}`, paddingBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: "50%", background: T.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{r.who.split(" ").map((w) => w[0]).join("")}</span>
                    <strong style={{ fontSize: 14 }}>{r.who}</strong>
                    <Stars size={14} />
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 14, opacity: 0.85 }}>{r.txt}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Sticky booking sidebar (desktop) */}
        <aside className="tour-aside">
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22, position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
            {t.quote ? (
              <div className="disp" style={{ fontWeight: 800, fontSize: 22, color: "#1A1A1A" }}>Price on request</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  {CORP_DISCOUNT > 0 && <span className="disp" style={{ fontWeight: 600, fontSize: 17, color: "#1A1A1A", textDecoration: "line-through", opacity: 0.45 }}>{fmtXOF(ppUnit)}</span>}
                  <span className="disp" style={{ fontWeight: 800, fontSize: 26, color: CORP_DISCOUNT > 0 ? T.green : "#1A1A1A" }}>{fmtXOF(CORP_DISCOUNT > 0 ? corpPrice(ppUnit) : ppUnit)}</span>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>/ person</span>
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.6 }}>{tierLabel[tier]}{CORP_DISCOUNT > 0 ? ` · corporate rate −${CORP_DISCOUNT}% (paid in full)` : ""}</div>
                {tier !== "grp" && <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginTop: 3 }}>from {fmtXOF(fromPrice(t))} / person at 5+ pax</div>}

                <div style={{ marginTop: 14 }}>
                  <label style={label}>Travelers</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setPax(Math.max(1, pax - 1))} style={btnCircle} aria-label="Fewer">−</button>
                    <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{pax}</span>
                    <button onClick={() => setPax(pax + 1)} style={btnCircle} aria-label="More">+</button>
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 4 }}>Price adjusts automatically with group size.</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={label}>Travel date</label>
                  <RangeDate from={dateFrom} to={dateFrom} onChange={(f) => setTripDate(f)} triggerStyle={input} wide single minDate={minDate} align="right" />
                  {dateOk && (
                    <div style={{ fontSize: 12, marginTop: 5, color: "rgba(0,0,0,.8)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <Check size={14} color={T.green} /> {tontinePossible ? "Ma Tontine eligible" : "Available · full payment only (under 15 days)"}
                    </div>
                  )}
                </div>

                {rates && (
                  <div style={{ marginTop: 12 }}>
                    <label style={label}>Transport (optional)</label>
                    <select value={vehicle} onChange={(e) => setVehicle(+e.target.value)} style={{ ...input, fontWeight: 600 }}>
                      <option value={-1}>No transport — I'll arrange my own</option>
                      {VEHICLES.map((v, i) => (
                        <option key={v.name} value={i} disabled={v.cap < pax}>{v.name} · up to {v.cap} — {fmtXOF(rates[i])}{v.cap < pax ? " (too small)" : ""}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 4 }}>Per vehicle, for the day — chosen by group size.</div>
                  </div>
                )}

                <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 14, paddingTop: 12, display: "flex", fontSize: 15 }}>
                  <span style={{ opacity: 0.7 }}>Estimated total {CORP_DISCOUNT > 0 ? "(paid in full)" : ""}</span>
                  <strong style={{ marginLeft: "auto" }}>
                    {CORP_DISCOUNT > 0 && <span style={{ fontWeight: 500, opacity: 0.45, textDecoration: "line-through", marginRight: 6 }}>{fmtXOF(estTotal)}</span>}
                    <span style={{ color: CORP_DISCOUNT > 0 ? T.green : "inherit" }}>{fmtXOF(CORP_DISCOUNT > 0 ? corpPrice(estTotal) : estTotal)}</span>
                  </strong>
                </div>
                <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6, marginTop: 10, color: "rgba(0,0,0,.8)" }}>
                  <strong style={{ color: "#1A1A1A" }}>Ma Tontine Voyage:</strong> reserve with {fmtXOF(estTotal * 0.2)} (20%), balance in instalments before departure{CORP_DISCOUNT > 0 ? " (corporate rate applies to full payment)" : ""}.
                </div>
              </>
            )}

            {t.quote ? (
              <button style={{ ...btnGold, width: "100%", marginTop: 14, borderRadius: 12, background: T.indigo, color: "#fff" }} onClick={() => openBooking("quote")}>Request a quote</button>
            ) : (
              <>
                <button disabled={!dateOk} style={{ ...btnGold, width: "100%", marginTop: 14, borderRadius: 12, opacity: dateOk ? 1 : 0.5, cursor: dateOk ? "pointer" : "not-allowed" }} onClick={() => dateOk && openBooking("full")}>Pay in full</button>
                <button disabled={!tontinePossible} style={{ width: "100%", marginTop: 8, background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 800, cursor: tontinePossible ? "pointer" : "not-allowed", fontSize: 15, opacity: tontinePossible ? 1 : 0.5 }} onClick={() => tontinePossible && startTontine()}>Pay with Ma Tontine (20%)</button>
                {!dateOk && <div style={{ fontSize: 12.5, color: "#8A968E", marginTop: 8, textAlign: "center" }}>Choose a travel date to book.</div>}
              </>
            )}
            <button style={{ background: "none", border: "none", cursor: "pointer", marginTop: 10, fontWeight: 600, color: "#1A1A1A", fontSize: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => toggleFavorite && toggleFavorite(t.id)}>
              <Heart size={16} fill={fav ? "#C0392B" : "none"} color={fav ? "#C0392B" : "#1A1A1A"} /> {fav ? "Saved to favorites" : "Save to favorites"}
            </button>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10, lineHeight: 1.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Shield size={13} /> Instalments available · free cancellation 48h</div>
          </div>
        </aside>
       </div>
      </Wrap>

      {/* Fixed booking bar (mobile only) */}
      <style>{`
        .tour-cols{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:32px}
        .tour-bottombar{display:none}
        @media(max-width:900px){
          .tour-cols{grid-template-columns:1fr}
          .tour-aside{display:none}
          .tour-bottombar{display:block}
        }
      `}</style>
      <div className="tour-bottombar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, background: "#fff", borderTop: `1px solid ${T.line}`, boxShadow: "0 -8px 24px rgba(0,0,0,.12)", padding: "10px 14px calc(10px + env(safe-area-inset-bottom))" }}>
        {flash && (
          <div role="status" style={{ position: "absolute", left: 14, right: 14, bottom: "calc(100% + 8px)", background: T.ink, color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 12.5, fontWeight: 600, textAlign: "center", boxShadow: "0 10px 26px rgba(0,0,0,.3)", animation: "flashIn .2s ease" }}>{flash}</div>
        )}
        {t.quote ? (
          <button style={{ ...btnGold, width: "100%", borderRadius: 12, background: T.indigo, color: "#fff" }} onClick={() => openBooking("quote")}>Request a quote</button>
        ) : (
          <>
            {tier !== "grp" && <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginBottom: 6, textAlign: "center" }}>from {fmtXOF(fromPrice(t))} / person at 5+ pax</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <div style={{ minWidth: 0, flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1A1A1A" }} className="disp">{fmtXOF(estTotal)}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{fmtXOF(ppUnit)} /pers · {pax} pax</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setPax(Math.max(1, pax - 1))} style={btnCircle} aria-label="Fewer">−</button>
                <span style={{ fontWeight: 700, minWidth: 14, textAlign: "center" }}>{pax}</span>
                <button onClick={() => setPax(pax + 1)} style={btnCircle} aria-label="More">+</button>
                <div style={{ width: 138, minWidth: 0, flexShrink: 1 }}>
                  <RangeDate from={dateFrom} to={dateFrom} onChange={(f) => setTripDate(f)} triggerStyle={{ ...input, padding: "9px 10px", fontSize: 13 }} wide single minDate={minDate} align="right" up />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...btnGold, flex: 1, borderRadius: 12, fontSize: 14, padding: "11px 8px", opacity: dateOk ? 1 : 0.5 }} onClick={() => dateOk ? openBooking("full") : showFlash("Choose a travel date above to book.")}>Pay in full</button>
              <button style={{ flex: 1, background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 12, padding: "11px 8px", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: tontinePossible ? 1 : 0.5 }} onClick={() => tontinePossible ? startTontine() : showFlash(dateOk ? "Ma Tontine needs a travel date at least 15 days away." : "Choose a travel date above to book.")}>Ma Tontine</button>
            </div>
            {!dateOk && <div style={{ fontSize: 11, color: "#8A968E", marginTop: 5, textAlign: "center" }}>Choose a travel date to book.</div>}
          </>
        )}
      </div>

      {/* Cross-sell — similar tours (3 visible, rest slide) */}
      {similar.length > 0 && (
        <Wrap style={{ paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <Eyebrow>You may also like</Eyebrow>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: "clamp(19px,2.4vw,24px)", color: T.ink, margin: "6px 0 0" }}>Similar experiences</h3>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => scrollXsell(-1)} aria-label="Scroll left" style={{ width: 42, height: 42, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.ink }}><ChevronLeft size={20} /></button>
              <button onClick={() => scrollXsell(1)} aria-label="Scroll right" style={{ width: 42, height: 42, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.ink }}><ChevronRight size={20} /></button>
            </div>
          </div>
          <div ref={xsellRef} className="xsell-row" style={{ display: "flex", gap: 18, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 8, scrollbarWidth: "none" }}>
            <style>{`.xsell-row::-webkit-scrollbar{display:none}.xsell-card{flex:0 0 calc((100% - 36px)/3);scroll-snap-align:start}@media(max-width:900px){.xsell-card{flex:0 0 calc((100% - 18px)/2)}}@media(max-width:600px){.xsell-card{flex:0 0 82%}}`}</style>
            {similar.map((s) => (
              <article key={s.id} className="card-hover xsell-card" onClick={() => go("tour", { id: s.id })} style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", minWidth: 0, color: "#1A1A1A" }}>
                <Cover tour={s} ratio="4 / 3" size={52} />
                <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", gap: 5, marginBottom: 7, overflow: "hidden" }}>
                    <span style={pill()}>{s.pole}</span><span style={pill()}>{s.tag}</span>
                  </div>
                  <h4 className="disp" style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.2, margin: 0, color: "#1A1A1A" }}>{s.name}</h4>
                  <div style={{ fontSize: 11.5, color: "rgba(0,0,0,.8)", margin: "6px 0 8px" }}>{s.dur}</div>
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1A1A1A" }}>{s.quote ? "Price on request" : <PrefPrice base={fromPrice(s)} pp={false} />}</div>
                    <button onClick={(e) => { e.stopPropagation(); setBooking(s); }} style={{ marginLeft: "auto", background: s.quote ? "#1A1A1A" : T.gold, color: s.quote ? "#fff" : T.ink, border: "none", borderRadius: 10, padding: "7px 13px", fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>{s.quote ? "Get quote" : "Book"}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Wrap>
      )}

      {/* Gallery lightbox — click a photo, then browse left/right */}
      {preview !== null && createPortal((
        <div role="dialog" aria-modal="true" onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <button onClick={() => setPreview(null)} aria-label="Close" style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={22} /></button>
          <button onClick={(e) => { e.stopPropagation(); setPreview((p) => (p - 1 + galleryCount) % galleryCount); }} aria-label="Previous photo" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={26} /></button>
          <button onClick={(e) => { e.stopPropagation(); setPreview((p) => (p + 1) % galleryCount); }} aria-label="Next photo" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={26} /></button>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(900px, 92vw)", aspectRatio: "16 / 10", borderRadius: 16, overflow: "hidden", background: tile(preview) ? `center/cover no-repeat url(${tile(preview)})` : `linear-gradient(140deg, ${T.green}, ${T.indigo})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120 }}>
            {!tile(preview) && <CatIcon tour={t} size={120} color="rgba(255,255,255,.9)" strokeWidth={1.2} />}
          </div>
          <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 13, fontWeight: 600 }}>{preview + 1} / {galleryCount}</div>
        </div>
      ), document.body)}
    </>
  );
}

// ---------------- TRIP BUILDER ----------------
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || "050f6709-6ca3-40c2-a2a5-d38b33da8142";
// Dedicated inboxes (each Web3Forms access key is bound to one recipient).
// Flights -> travel2@ ; Transport (transfers + car rental) -> logistics@.
// Falls back to the main key until the dedicated keys are provided.
// For now everything routes to sales@ (main key). Set these env vars later to split:
//   VITE_WEB3FORMS_KEY_FLIGHTS  -> travel2@ ;  VITE_WEB3FORMS_KEY_LOGISTICS -> logistics@
const WEB3FORMS_KEY_FLIGHTS = import.meta.env.VITE_WEB3FORMS_KEY_FLIGHTS || WEB3FORMS_KEY;
const WEB3FORMS_KEY_LOGISTICS = import.meta.env.VITE_WEB3FORMS_KEY_LOGISTICS || WEB3FORMS_KEY;

// Fire-and-forget Web3Forms submit (agency notification). Skips placeholder keys.
async function sendAgencyEmail(payload) {
  if (!payload.access_key || String(payload.access_key).startsWith("REPLACE_WITH_")) return;
  try {
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { /* ignore */ }
}
const rowsToFields = (rows) => Object.fromEntries((rows || []).map(([l, v]) => [String(l).replace(/[^\w]+/g, "_"), v]));

function TripBuilder({ notify, go, user, saveRecord }) {
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(null); // tour shown in the detail bottom-sheet
  const [trip, setTrip] = useState({ dest: "Senegal", days: 7, pax: 2, hotel: "3★ Standard hotel", tours: [], addons: {}, transport: "Standard SUV (≤4)" });
  const toggleTour = (id) => setTrip((tr) => {
    if (tr.tours.includes(id)) { const a = { ...tr.addons }; delete a[id]; return { ...tr, tours: tr.tours.filter((x) => x !== id), addons: a }; }
    return { ...tr, tours: [...tr.tours, id] };
  });
  const toggleAddon = (id, name) => setTrip((tr) => {
    const cur = { ...(tr.addons || {}) }; const list = cur[id] ? [...cur[id]] : [];
    cur[id] = list.includes(name) ? list.filter((n) => n !== name) : [...list, name];
    return { ...tr, addons: cur };
  });
  // Apply the popup's choices: select the tour (if needed) + set its add-ons, in sync with the Experience list.
  const applyPreview = (id, sel) => setTrip((tr) => {
    const tours = tr.tours.includes(id) ? tr.tours : [...tr.tours, id];
    return { ...tr, tours, addons: { ...(tr.addons || {}), [id]: sel } };
  });
  const removePreview = (id) => setTrip((tr) => {
    const a = { ...(tr.addons || {}) }; delete a[id];
    return { ...tr, tours: tr.tours.filter((x) => x !== id), addons: a };
  });
  const [contact, setContact] = useState({ name: "", email: "", phone: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (user) setContact((c) => ({ ...c, name: c.name || user.name || "", email: c.email || user.email || "" })); }, [user]);

  const requestItinerary = async () => {
    if (!contact.name || !contact.email) { notify("Please add your name and email so ATS can reply."); return; }
    setSending(true);
    const tourNames = trip.tours.map((id) => TOURS.find((t) => t.id === id)?.name).filter(Boolean).join(" | ") || "none selected";
    const payload = {
      access_key: WEB3FORMS_KEY,
      subject: `New itinerary request — ${trip.days}-day ${trip.dest} trip (${trip.pax} pax)`,
      from_name: "ATS Trip Builder",
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      Destination: trip.dest,
      Duration: `${trip.days} days`,
      Travelers: trip.pax,
      Hotel_category: trip.hotel,
      Transport: trip.transport,
      Experiences: tourNames,
      Add_ons: addonNames.join(" | ") || "—",
      Estimated_budget_XOF: total,
      Customer_notes: contact.notes || "—",
      Account: user ? `Signed in (${user.email})` : "Guest",
    };
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        notify("Itinerary request sent — an ATS advisor will reply by email shortly.");
        saveRecord({
          tour: { emoji: "🗺️", name: `Custom ${trip.days}-day ${trip.dest} itinerary`, pole: "Trip Builder", dur: `${trip.days} days` },
          date: "", adults: trip.pax, children: 0, infants: 0,
          plan: "itinerary", months: 0, total, deposit: 0,
          itinerary: { dest: trip.dest, days: trip.days, pax: trip.pax, hotel: trip.hotel, transport: trip.transport, tours: tourNames, addons: addonNames.join(" | "), notes: contact.notes },
          contact,
        });
        // Confirmation email to the client (fire-and-forget)
        supabase.functions.invoke("send-confirmation", { body: { to: contact.email, name: contact.name, kind: "itinerary", summary: [["Destination", trip.dest], ["Duration", `${trip.days} days`], ["Travelers", String(trip.pax)], ["Hotel", trip.hotel], ["Transport", trip.transport], ["Experiences", tourNames]] } }).catch(() => {});
      }
      else notify("Could not send the request. Please try again or contact us on WhatsApp.");
    } catch {
      notify("Network error — please try again or contact us on WhatsApp.");
    } finally { setSending(false); }
  };
  const HOTEL = { "No hotel — I'll arrange my own": 0, "2★ Eco-lodge / guesthouse": 35000, "3★ Standard hotel": 55000, "4★ Boutique / charme": 90000, "5★ Luxury / resort": 160000, "Airbnb / serviced apartment": 60000, "Private villa": 130000 };
  const TRANSPORT = { "No transport": 0, "Standard Sedan (≤3)": 85000, "Premium Sedan (≤3)": 100000, "Standard SUV (≤4)": 95000, "Premium SUV (≤4)": 150000, "Luxury SUV (≤4)": 350000, "Standard Minivan (≤14)": 150000, "Coaster coach (≤22)": 115000 };
  const toursCost = trip.tours.reduce((s, id) => s + (fromPrice(TOURS.find((t) => t.id === id)) || 0), 0) * trip.pax;
  const addonsCost = trip.tours.reduce((s, id) => {
    const t = TOURS.find((x) => x.id === id); const sel = (trip.addons && trip.addons[id]) || [];
    return s + (t ? t.addons.filter((a) => sel.includes(a.name) && a.price).reduce((ss, a) => ss + (a.per === "person" ? a.price * trip.pax : a.price), 0) : 0);
  }, 0);
  const hotelCost = HOTEL[trip.hotel] * trip.days * Math.ceil(trip.pax / 2);
  const transCost = TRANSPORT[trip.transport] * trip.days;
  const total = toursCost + addonsCost + hotelCost + transCost;
  const addonNames = trip.tours.flatMap((id) => ((trip.addons && trip.addons[id]) || []).map((n) => `${TOURS.find((t) => t.id === id)?.name.split(" —")[0]}: ${n}`));
  const steps = ["Basics", "Hotel", "Experiences", "Transport", "Summary"];

  return (
    <Wrap>
      {/* HOW IT WORKS — intro at the top of the Trip Builder */}
      <div style={{ marginBottom: 34 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div className="about-script" style={{ fontSize: 24, fontWeight: 600, color: T.green, lineHeight: 1 }}>How it works</div>
          <h2 className="disp" style={{ fontWeight: 800, fontSize: "clamp(26px,3.6vw,38px)", letterSpacing: "-0.02em", color: T.ink, margin: "2px 0 8px" }}>Plan your trip in 4 simple steps</h2>
          <p style={{ maxWidth: 560, margin: "0 auto", color: "rgba(0,0,0,.8)", fontSize: 15.5, lineHeight: 1.6 }}>From choosing an experience to travelling on the ground — everything ATS offers, in one simple flow.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
          {[
            [Compass, "Choose your experience", "Browse 35+ tours, transfers and flights — or build a fully custom trip."],
            [CalendarCheck, "Reserve with 20%", "Secure any trip with a small deposit through Ma Tontine Voyage."],
            [Clock, "Pay in instalments", "Spread the balance until departure — card, Wave, Orange Money, PayPal…"],
            [Plane, "Travel with ATS", "Meet your local team on the ground and enjoy Senegal, worry-free."],
          ].map(([Ico, title, body], i) => (
            <div key={title} style={{ background: "#F6FAF7", border: `1px solid ${T.line}`, borderRadius: 18, padding: "22px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0,146,69,.10)", color: T.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico size={20} strokeWidth={2} /></span>
                <span className="disp" style={{ fontSize: 34, fontWeight: 800, color: "rgba(11,46,27,.12)", lineHeight: 1 }}>{i + 1}</span>
              </div>
              <div className="disp" style={{ fontWeight: 800, fontSize: 17, color: T.ink, marginBottom: 6 }}>{title}</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      <Eyebrow>Dynamic trip builder</Eyebrow><H2>Build your own trip</H2>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {steps.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} style={{ border: "none", cursor: "pointer", background: i === step ? T.green : i < step ? T.paperDark : "#fff", color: i === step ? "#fff" : T.ink, borderRadius: 999, padding: "8px 16px", fontWeight: 600, fontSize: 13, boxShadow: `inset 0 0 0 1px ${T.line}` }}>
            {i + 1}. {s}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 24 }}>
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          {step === 0 && (
            <>
              <label style={label}>Destination</label>
              <select style={input} value={trip.dest} onChange={(e) => setTrip({ ...trip, dest: e.target.value })}>
                <option>Senegal</option><option>Rwanda</option>
              </select>
              <label style={{ ...label, marginTop: 14 }}>Days: {trip.days}</label>
              <input type="range" min="2" max="15" value={trip.days} onChange={(e) => setTrip({ ...trip, days: +e.target.value })} style={{ width: "100%", accentColor: T.green }} />
              <label style={{ ...label, marginTop: 14 }}>Travelers: {trip.pax}</label>
              <input type="range" min="1" max="12" value={trip.pax} onChange={(e) => setTrip({ ...trip, pax: +e.target.value })} style={{ width: "100%", accentColor: T.green }} />
              <button style={{ ...btnGold, marginTop: 16 }} onClick={() => setStep(1)}>Next: hotel →</button>
            </>
          )}
          {step === 1 && (
            <>
              <label style={label}>Accommodation</label>
              <select style={{ ...input, fontWeight: 600 }} value={trip.hotel} onChange={(e) => setTrip({ ...trip, hotel: e.target.value })}>
                {Object.keys(HOTEL).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 6 }}>{trip.hotel.startsWith("No hotel") ? "No problem — you handle your own accommodation and we plan everything else. It won't be added to your estimate." : "ATS confirms the exact property from its contracted inventory at your chosen level."}</div>
              <button style={{ ...btnGold, marginTop: 16 }} onClick={() => setStep(2)}>Next: experiences →</button>
            </>
          )}
          {step === 2 && (
            <>
              <label style={label}>Pick your experiences ({trip.tours.length} selected)</label>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {TOURS.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: `1px solid ${T.line}`, fontSize: 14 }}>
                    <input type="checkbox" checked={trip.tours.includes(t.id)} style={{ width: 16, height: 16, accentColor: T.green, cursor: "pointer", flexShrink: 0 }} onChange={() => toggleTour(t.id)} />
                    <button onClick={() => setPreview(t)} title="See details" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: T.ink, fontSize: 14 }}>
                      <CatIcon tour={t} size={17} color={T.green} /> <span style={{ textDecoration: "underline", textDecorationColor: T.line, textUnderlineOffset: 3 }}>{t.name}</span>
                    </button>
                    <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>{fromPrice(t) ? fmtXOF(fromPrice(t)) : "on request"}</strong>
                    <button onClick={() => setPreview(t)} aria-label="Details" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "4px 9px", cursor: "pointer", color: T.green, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Détails</button>
                  </div>
                ))}
              </div>

              {/* Add-ons per selected tour */}
              {trip.tours.some((id) => TOURS.find((t) => t.id === id)?.addons?.length) && (
                <div style={{ marginTop: 16 }}>
                  <div style={sect}>Add-ons (optional)</div>
                  {trip.tours.map((id) => {
                    const t = TOURS.find((x) => x.id === id);
                    if (!t || !t.addons?.length) return null;
                    const sel = (trip.addons && trip.addons[id]) || [];
                    return (
                      <div key={id} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}><CatIcon tour={t} size={15} color={T.green} /> {t.name.split(" —")[0]}</div>
                        {t.addons.map((a) => {
                          const on = sel.includes(a.name);
                          return (
                            <label key={a.name} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "6px 0", fontSize: 13, cursor: "pointer", lineHeight: 1.4 }}>
                              <input type="checkbox" checked={on} onChange={() => toggleAddon(id, a.name)} style={{ width: 15, height: 15, accentColor: T.green, marginTop: 2, flexShrink: 0 }} />
                              <span style={{ flex: 1, color: "rgba(0,0,0,.8)" }}>{a.name}</span>
                              <strong style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{a.price ? fmtXOF(a.price) + (a.per === "person" ? " /pp" : "") : "on request"}</strong>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              <button style={{ ...btnGold, marginTop: 16 }} onClick={() => setStep(3)}>Next: transport →</button>
            </>
          )}
          {step === 3 && (
            <>
              <label style={label}>Vehicle + driver at disposal (per day, ATS Logistics rate card)</label>
              <select style={{ ...input, fontWeight: 600 }} value={trip.transport} onChange={(e) => setTrip({ ...trip, transport: e.target.value })}>
                {Object.entries(TRANSPORT).map(([k, v]) => <option key={k} value={k}>{k}{v ? ` — ${fmtXOF(v)} / day` : ""}</option>)}
              </select>
              <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 6 }}>Driver per-diem for multi-day circuits ({fmtXOF(8000)}/night) added at confirmation.</div>
              <button style={{ ...btnGold, marginTop: 16 }} onClick={() => setStep(4)}>See summary →</button>
            </>
          )}
          {step === 4 && (
            <>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, marginTop: 0 }}>Your {trip.days}-day {trip.dest} trip</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, opacity: 0.85 }}>
                {trip.pax} traveler{trip.pax > 1 ? "s" : ""} · {trip.hotel} · {trip.transport} · {trip.tours.length} experience{trip.tours.length !== 1 ? "s" : ""}: {trip.tours.map((id) => TOURS.find((t) => t.id === id)?.name.split(" —")[0]).join(", ") || "none yet"}
              </p>
              {addonNames.length > 0 && <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(0,0,0,.8)", marginTop: -4 }}><strong>Add-ons:</strong> {addonNames.join(" · ")}</p>}
              {sent ? (
                <div style={{ background: T.paperDark, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, fontSize: 14.5, lineHeight: 1.6 }}>
                  <CircleCheck size={18} color={T.green} style={{ verticalAlign: "middle", marginRight: 4 }} /> <strong>Request received.</strong> An ATS advisor will email you at <strong>{contact.email}</strong> to confirm availability and your final quote.
                  <button style={{ ...btnGreen, width: "100%", marginTop: 12, background: "#fff", color: T.green, border: `1.5px solid ${T.green}` }} onClick={() => go("tours")}>Keep browsing tours</button>
                </div>
              ) : (
                <>
                  <label style={label}>Full name</label>
                  <input style={input} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="e.g. Awa Diop" />
                  <label style={label}>Email</label>
                  <input style={input} type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@example.com" />
                  <label style={label}>Phone / WhatsApp (optional)</label>
                  <input style={input} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+221 …" />
                  <label style={label}>Notes for ATS (optional)</label>
                  <textarea style={{ ...input, minHeight: 70, resize: "vertical" }} value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} placeholder="Travel dates, special requests…" />
                  <button disabled={sending} style={{ ...btnGold, width: "100%", marginTop: 6, opacity: sending ? 0.6 : 1 }} onClick={requestItinerary}>{sending ? "Sending…" : "Request this itinerary"}</button>
                  <button style={{ ...btnGreen, width: "100%", marginTop: 8, background: "#fff", color: T.green, border: `1.5px solid ${T.green}` }} onClick={() => go("tours")}>Keep browsing tours</button>
                </>
              )}
            </>
          )}
        </div>
        <aside>
          <div style={{ background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22, position: "sticky", top: 80 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: T.green }}>Live estimated budget</div>
            <div className="disp" style={{ fontSize: 30, fontWeight: 800, margin: "6px 0 12px", color: "#1A1A1A" }}>{fmtXOF(total)} <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(0,0,0,.8)" }}>{fmtUSD(total)}</span></div>
            {trip.hotel.startsWith("No hotel") ? <Row l="Accommodation" v="Self-arranged" /> : <Row l={`Accommodation · ${trip.days} nights`} v={fmtXOF(hotelCost)} />}
            <Row l={`Experiences × ${trip.pax} pax`} v={fmtXOF(toursCost)} />
            {addonsCost > 0 && <Row l="Add-ons" v={fmtXOF(addonsCost)} />}
            <Row l="Transport" v={fmtXOF(transCost)} />
            <div style={{ fontSize: 11.5, color: "#8A968E", marginTop: 6 }}>Experiences at group per-person rates; 'on request' items excluded from the estimate.</div>
            <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 10, paddingTop: 10, fontSize: 13.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>
              <strong style={{ color: T.green }}>Ma Tontine Voyage:</strong> reserve today with {fmtXOF(total * 0.2)} (20%), balance in instalments before departure.
            </div>
          </div>
        </aside>
      </div>
      {preview && (
        <TourPreviewSheet
          tour={preview}
          pax={trip.pax}
          selected={trip.tours.includes(preview.id)}
          currentAddons={(trip.addons && trip.addons[preview.id]) || []}
          onApply={(sel) => applyPreview(preview.id, sel)}
          onRemove={() => removePreview(preview.id)}
          onClose={() => setPreview(null)}
        />
      )}
    </Wrap>
  );
}

// Gallery arrow style for the tour bottom-sheet.
const galArrow = (side) => ({ position: "absolute", top: "50%", [side]: 8, transform: "translateY(-50%)", width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.92)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1A1A1A", boxShadow: "0 2px 8px rgba(0,0,0,.2)" });

// Detail bottom-sheet for a tour inside the Trip Builder — gallery, info, add-on picker, Add/Back.
function TourPreviewSheet({ tour, pax = 1, selected, currentAddons, onApply, onRemove, onClose }) {
  const price = fromPrice(tour);
  const [imgs, setImgs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(() => (Array.isArray(currentAddons) ? currentAddons : []));
  const toggle = (name) => setSel((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));

  useEffect(() => {
    let alive = true;
    supabase.storage.from(PHOTO_BUCKET).list(tour.id, { limit: 100, sortBy: { column: "name", order: "asc" } }).then(({ data }) => {
      if (!alive || !data) return;
      const urls = data.filter((f) => f.name && !f.name.startsWith("."))
        .map((f) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${tour.id}/${f.name}`).data.publicUrl);
      urls.sort((a, b) => (b.includes("/cover.") ? 1 : 0) - (a.includes("/cover.") ? 1 : 0)); // cover first
      setImgs(urls); setIdx(0);
    });
    return () => { alive = false; };
  }, [tour.id]);

  const n = imgs.length;
  const move = (d) => setIdx((i) => (n ? (i + d + n) % n : 0));

  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(20,32,26,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", color: T.ink, width: "100%", maxWidth: 640, maxHeight: "90vh", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 -8px 40px rgba(0,0,0,.25)" }}>
        <div style={{ overflowY: "auto" }}>
          {/* Gallery */}
          {n > 0 && (
            <div>
              <div style={{ position: "relative", background: "#000" }}>
                <img src={imgs[idx]} alt={`${tour.name} ${idx + 1}`} style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                {n > 1 && (
                  <>
                    <button onClick={() => move(-1)} aria-label="Previous" style={galArrow("left")}><ChevronLeft size={20} /></button>
                    <button onClick={() => move(1)} aria-label="Next" style={galArrow("right")}><ChevronRight size={20} /></button>
                    <div style={{ position: "absolute", bottom: 8, right: 10, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "2px 9px" }}>{idx + 1}/{n}</div>
                  </>
                )}
              </div>
              {n > 1 && (
                <div style={{ display: "flex", gap: 6, padding: "8px 12px 0", overflowX: "auto" }}>
                  {imgs.map((u, i) => (
                    <button key={i} onClick={() => setIdx(i)} aria-label={`Photo ${i + 1}`} style={{ flex: "0 0 auto", width: 56, height: 42, borderRadius: 8, overflow: "hidden", border: `2px solid ${i === idx ? T.green : "transparent"}`, padding: 0, cursor: "pointer", background: "none" }}>
                      <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ padding: "14px 20px 4px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8A968E", textTransform: "uppercase", letterSpacing: ".1em" }}>{tour.pole} · {tour.dur}{tour.tag ? ` · ${tour.tag}` : ""}</div>
            <h3 className="disp" style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 8px", color: "#1A1A1A", display: "flex", alignItems: "center", gap: 8, lineHeight: 1.2 }}><CatIcon tour={tour} size={20} color={T.green} /> {tour.name}</h3>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="disp" style={{ fontWeight: 800, fontSize: 20, color: "#1A1A1A" }}>{price ? fmtXOF(price) : "On request"}</span>
              {price ? <span style={{ fontSize: 12.5, opacity: 0.6 }}>/ person (group rate)</span> : null}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(0,0,0,.8)", marginTop: 10 }}>{tour.desc}</p>
            {tour.sub && <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 4, lineHeight: 1.5 }}>{tour.sub}</div>}

            {Array.isArray(tour.steps) && tour.steps.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={sect}>Itinerary &amp; inclusions</div>
                <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {tour.steps.map((s, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.line}`, fontSize: 13.5, lineHeight: 1.5, color: "rgba(0,0,0,.8)" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: T.paperDark, color: T.green, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {Array.isArray(tour.addons) && tour.addons.length > 0 && (
              <div style={{ marginTop: 16, marginBottom: 8 }}>
                <div style={sect}>Add-ons (optional) — {sel.length} selected</div>
                {tour.addons.map((a) => {
                  const on = sel.includes(a.name);
                  return (
                    <label key={a.name} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 0", fontSize: 13.5, cursor: "pointer", lineHeight: 1.4, borderBottom: `1px solid ${T.line}` }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(a.name)} style={{ width: 16, height: 16, accentColor: T.green, marginTop: 2, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: "rgba(0,0,0,.8)" }}>{a.name}</span>
                      <strong style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{a.price ? fmtXOF(a.per === "person" ? a.price * pax : a.price) + (a.per === "person" ? ` (×${pax})` : "") : "on request"}</strong>
                    </label>
                  );
                })}
                <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 6 }}>Your selection is saved to the trip when you tap “{selected ? "Enregistrer" : "Ajouter à mon voyage"}”.</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, padding: "12px 20px", borderTop: `1px solid ${T.line}`, background: "#fff", alignItems: "center" }}>
          <button onClick={onClose} style={{ flex: "0 0 auto", background: "#fff", color: "#1A1A1A", border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <ChevronLeft size={16} /> Retour
          </button>
          {selected && (
            <button onClick={() => { onRemove(); onClose(); }} style={{ flex: "0 0 auto", background: "#fff", color: "#B3261E", border: "1.5px solid #E7C9C6", borderRadius: 12, padding: "12px 14px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
              Retirer
            </button>
          )}
          <button onClick={() => { onApply(sel); onClose(); }} style={{ flex: 1, background: T.gold, color: T.ink, border: "none", borderRadius: 12, padding: "12px 16px", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}>
            {selected ? "Enregistrer" : "Ajouter à mon voyage"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------- FLIGHTS ----------------
function FlightsPage({ notify, user, initial, initialLegs }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState(initial
    ? { type: initial.type || "Round trip", from: initial.from || "", to: initial.to || "", dep: initial.dep || "", ret: initial.ret || "", pax: initial.pax || 1, cls: initial.cls || "Economy" }
    : { type: "Round trip", from: "", to: "", dep: "", ret: "", pax: 1, cls: "Economy" });
  const [legs, setLegs] = useState(initialLegs && initialLegs.length ? initialLegs : [{ from: "", to: "", dep: "" }, { from: "", to: "", dep: "" }]);
  const [contact, setContact] = useState({ name: user?.name || "", email: user?.email || "", phone: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (user) setContact((c) => ({ ...c, name: c.name || user.name || "", email: c.email || user.email || "" })); }, [user]);

  const multi = f.type === "Multi-city";
  const legsValid = legs.every((l) => l.from.trim() && l.to.trim() && l.dep);
  const routeValid = multi ? legsValid : (f.from.trim() && f.to.trim() && f.dep && (f.type !== "Round trip" || f.ret));
  const canSend = routeValid && contact.name.trim() && contact.email.trim();

  const setLeg = (i, k, v) => setLegs((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const heroFlight = supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/flights.jpg").data.publicUrl;

  const submit = async () => {
    if (!canSend || sending) return;
    setSending(true);
    const itinerary = multi
      ? legs.map((l, i) => `Leg ${i + 1}: ${l.from} → ${l.to} on ${l.dep}`).join(" | ")
      : `${f.from} → ${f.to} · dep ${f.dep}${f.type === "Round trip" ? ` · ret ${f.ret}` : ""}`;
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY_FLIGHTS,
          subject: `Flight request — ${f.type} · ${multi ? `${legs.length} legs` : `${f.from} → ${f.to}`} · ${f.pax} pax ${f.cls}`,
          from_name: "ATS Flights",
          name: contact.name, email: contact.email, phone: contact.phone,
          Trip_type: f.type, Itinerary: itinerary, Passengers: f.pax, Class: f.cls,
          Customer_notes: contact.notes || "—",
          Account: user ? `Signed in (${user.email})` : "Guest",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        notify("Flight request sent — our ticketing team will reply with fares.");
        // Confirmation email to the client (fire-and-forget)
        supabase.functions.invoke("send-confirmation", { body: { to: contact.email, name: contact.name, kind: "flight", summary: [["Trip type", f.type], ["Itinerary", itinerary], ["Passengers", String(f.pax)], ["Class", f.cls]] } }).catch(() => {});
      }
      else notify("Could not send the request. Please try again.");
    } catch { notify("Network error — please try again."); }
    finally { setSending(false); }
  };

  return (
    <Wrap>
      <Eyebrow>ATS Travel · IATA-accredited</Eyebrow><H2>Flights & ticketing</H2>
      <p style={{ maxWidth: 640, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>Domestic, international, multi-city and corporate ticketing. Submit a request and our ticketing team responds with the best available fares.</p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "stretch" }} className="flights-grid">
        <style>{`@media(max-width:800px){.flights-grid{grid-template-columns:1fr !important}.flights-img{min-height:200px}}@media(max-width:600px){.leg-grid{grid-template-columns:1fr 1fr !important}}`}</style>

        {/* Left 2/3 — form */}
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E9F7EE", color: T.green }}><Check size={32} /></div>
              <h3 className="disp" style={{ fontWeight: 700, fontSize: 20, margin: "0 0 8px" }}>Request received</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)", maxWidth: 420, margin: "0 auto" }}>
                Our ticketing team is searching the best available fares and will reply to <strong>{contact.email}</strong> shortly.
              </p>
              <button style={{ ...btnGreen, marginTop: 18 }} onClick={() => { setSent(false); setF({ type: "Round trip", from: "", to: "", dep: "", ret: "", pax: 1, cls: "Economy" }); setLegs([{ from: "", to: "", dep: "" }, { from: "", to: "", dep: "" }]); }}>New request</button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {["Round trip", "One way", "Multi-city"].map((tp) => (
                  <button key={tp} onClick={() => setF({ ...f, type: tp })} style={{ border: `1px solid ${f.type === tp ? T.green : T.line}`, background: f.type === tp ? T.green : "#fff", color: f.type === tp ? "#fff" : T.ink, borderRadius: 999, padding: "7px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>{tp}</button>
                ))}
              </div>

              {multi ? (
                <>
                  {legs.map((l, i) => (
                    <div key={i} className="leg-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
                      <div><label style={label}>Leg {i + 1} — From</label><AirportInput value={l.from} onChange={(v) => setLeg(i, "from", v)} placeholder="City or airport…" /></div>
                      <div><label style={label}>To</label><AirportInput value={l.to} onChange={(v) => setLeg(i, "to", v)} placeholder="City or airport…" /></div>
                      <div><label style={label}>Date</label><input type="date" min={todayStr} style={input} value={l.dep} onChange={(e) => setLeg(i, "dep", e.target.value)} /></div>
                      {legs.length > 2 ? <button onClick={() => setLegs((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove leg" style={{ ...btnCircle, marginBottom: 4 }}><X size={14} /></button> : <span />}
                    </div>
                  ))}
                  {legs.length < 6 && (
                    <button onClick={() => setLegs((ls) => [...ls, { from: ls[ls.length - 1].to || "", to: "", dep: "" }])} style={{ background: "none", border: `1.5px dashed ${T.line}`, borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, color: T.green }}>+ Add a leg</button>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                    <div><label style={label}>From</label><AirportInput value={f.from} onChange={(v) => setF({ ...f, from: v })} placeholder="e.g. Dakar (DSS)" /></div>
                    <div><label style={label}>To</label><AirportInput value={f.to} onChange={(v) => setF({ ...f, to: v })} placeholder="e.g. Paris (CDG)" /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
                    <div><label style={label}>Departure</label><input type="date" min={todayStr} style={input} value={f.dep} onChange={(e) => setF({ ...f, dep: e.target.value, ret: f.ret && f.ret < e.target.value ? e.target.value : f.ret })} /></div>
                    {f.type === "Round trip" && <div><label style={label}>Return</label><input type="date" min={f.dep || todayStr} style={input} value={f.ret} onChange={(e) => setF({ ...f, ret: e.target.value })} /></div>}
                  </div>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
                <div><label style={label}>Passengers</label>
                  <select style={input} value={f.pax} onChange={(e) => setF({ ...f, pax: e.target.value })}>{[1, 2, 3, 4, 5, 6, 9].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label style={label}>Class</label>
                  <select style={input} value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })}>{["Economy", "Premium", "Business", "First"].map((c) => <option key={c}>{c}</option>)}</select></div>
              </div>

              <div style={sect}>Your contact details</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div><label style={label}>Full name *</label><input style={input} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="e.g. Awa Diop" /></div>
                <div><label style={label}>Email *</label><input type="email" style={input} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@example.com" /></div>
                <div><label style={label}>Phone / WhatsApp</label><input style={input} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+221 …" /></div>
              </div>
              <label style={label}>Notes (optional)</label>
              <textarea style={{ ...input, minHeight: 60, resize: "vertical" }} value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} placeholder="Flexible dates, baggage, preferred airline…" />

              <button disabled={!canSend || sending} style={{ ...btnGold, marginTop: 14, opacity: canSend && !sending ? 1 : 0.5, cursor: canSend ? "pointer" : "not-allowed" }} onClick={submit}>
                {sending ? "Sending…" : "Request fares"}
              </button>
              {!routeValid && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 6 }}>{multi ? "Complete every leg (from, to, date)." : "Complete the route and dates to send your request."}</div>}
            </>
          )}
        </div>

        {/* Right 1/3 — image */}
        <div className="flights-img" style={{ borderRadius: 16, overflow: "hidden", minHeight: 380, background: `linear-gradient(160deg, rgba(0,50,25,.25), rgba(0,107,51,.15)), url("${heroFlight}") center/cover no-repeat, linear-gradient(140deg, ${T.green}, ${T.indigo})` }} />
      </div>
    </Wrap>
  );
}

// ---------------- EVENTS / MICE ----------------
// Content from the ATS Events brochure (mission, event types, services,
// track record, clients). Portfolio photos live in the bucket under
// mice/realisations/ (any extension). Partner logos (optional images) go in
// mice/partners/ ; without images the marquee falls back to the names below.

// The three service lines shown as top cards (each links to our work).
const MICE_LINES = [
  { key: "conferences", icon: Mic, name: "Conferences & summits", blurb: "Venues, AV production, delegate logistics, transport fleets and side excursions — from board meetings to national summits." },
  { key: "teambuilding", icon: Dumbbell, name: "Team building & Incentive", blurb: "Signature team-building formats and reward trips your teams will remember — from Lac Rose to desert nights." },
  { key: "weddings", icon: Gift, name: "Destination weddings", soon: true, blurb: "Beach, desert or delta — full planning and guest logistics for your celebration in Senegal." },
];

// The service lines — displayed as the "Services that set us apart" grid.
const MICE_SERVICES = [
  { icon: CalendarCheck, name: "Event planning & management", items: ["Event communication", "Institutional & influence communication", "Digital marketing"] },
  { icon: Newspaper, name: "Press & media relations", items: ["Media management & coverage", "Press releases & press kits", "TV, radio & print interviews", "Article placement"] },
  { icon: Video, name: "Audiovisual production", items: ["Scriptwriting", "Films, trailers & documentaries", "Editing", "Event technical direction"] },
  { icon: Palette, name: "Design & graphic identity", items: ["Logo & visual identity", "Brand guidelines", "Print supports — roll-ups, brochures, flyers"] },
  { icon: ConciergeBell, name: "Concierge", items: ["Accommodation", "Hotel & flight booking", "Welcome & orientation", "Transport & logistics", "Parking / fleet management"] },
];

// Selected real projects (ATS Events track record).
// Photos per project: bucket folder mice/realisations/{slug}/ (any extension).
const MICE_REALISATIONS = [
  { slug: "local-content", title: "Local Content Law Workshop — Oil & Gas", venue: "CICAD · Diamniadio", pax: "600 participants", note: "A professional forum on Senegal's petroleum & gas sector.", scope: ["Communication supports design & production", "Venue management", "Event logistics", "Audiovisual production", "Coordination & press relations"] },
  { slug: "nba-youth-summit", title: "NBA Africa Youth Summit 2019", venue: "CICAD · Diamniadio", pax: "650 participants", note: "A summit dedicated to African youth, entrusted to ATS by NBA Africa.", scope: ["Communication supports", "Guest welcome & orientation", "Event logistics", "Audiovisual production", "Full summit organisation"] },
  { slug: "africas-business-heroes", title: "Africa's Business Heroes", venue: "Noom Hotel · Dakar", pax: "1,000 guests", note: "A 2-day pitch competition with a strong digital dimension.", scope: ["Stage backdrops & LED screens", "Photo & video capture", "Hostesses & interpretation booths", "Sound, DJ & radios", "Airport transfers"] },
  { slug: "pasteur-100", title: "Pasteur Network — 100 Years", venue: "Hôtel Azalaï · Dakar", pax: "100 guests", note: "A conference celebrating the centenary of the Pasteur Network.", scope: ["Print supports", "Flight ticketing & visa handling", "Hotel booking & transfers", "Excursions & coach hire", "Dinner cocktail"] },
  { slug: "corporate-awards", title: "The Corporate Awards", venue: "Radisson Blu (Noom) · Dakar", pax: "200 participants", note: "The 4th edition — held in Senegal for the first time.", scope: ["Communication supports", "Press conference", "Public relations", "Gala evening"] },
  { slug: "african-leaders-connect", title: "African Leaders Connect", venue: "Radisson Blu (Noom) · Dakar", pax: "45 investors · 100 guests", note: "Young African leaders gathered around development.", scope: ["Accommodation", "VIP welcome & airport transfers", "Graphic design", "Event organisation"] },
  { slug: "universal-electricity", title: "Universal Access to Electricity", venue: "Zoom videoconference", pax: "25 on-site · 1,000 online", note: "A round table with Senelec, the Ministry of Petroleum & Energy and donors.", scope: ["Logo & visual identity", "Event website", "Audiovisual production", "Media & social-media management", "End-to-end management"] },
  { slug: "citation-launch", title: "Citation Film Launch (Netflix)", venue: "Canal Olympia", pax: "200 participants", note: "Launch entrusted by ADS Group in Dakar and Mindelo.", scope: ["Technical setup & branding", "Logistics & security", "Audiovisual production", "Press releases & invitations", "Event organisation"] },
  { slug: "kfc-launch", title: "KFC Senegal — Launch", venue: "KFC Corniche · Dakar", pax: "300 participants", note: "The launch of KFC's first restaurant in Senegal.", scope: ["Audiovisual production", "Ceremony organisation", "Guest welcome"] },
  { slug: "seed-academy", title: "SEED Academy Cultural Night", venue: "CNEPS · Thiès", pax: "600 participants", note: "A traditional gala dinner organised for the SEED Project.", scope: ["Concept & event management", "Audiovisual production", "Catering service"] },
  { slug: "bmc-optesis", title: "BMC-OPTESIS Open Day", venue: "Yaye Fatou building · Point E", pax: "200 participants", note: "Announcing the OPTESIS × BMC Audit & Consulting alliance.", scope: ["Technical direction", "Sound & lighting"] },
];

const MICE_STATS = [["2018", "Founded · Senegal & Rwanda"], ["11+", "Flagship events delivered"], ["5,000+", "Delegates & guests hosted"], ["35+", "Partners & clients"]];

const MICE_PARTNERS = ["SAR", "Ministère du Pétrole & des Énergies", "NBA Africa", "Petrosen", "SEED Project", "Optesis", "ADS Group", "Senelec", "MSGBC Oil, Gas & Power", "CFAO", "SGBS", "Mazars", "Woodside Energy", "BOAD", "Terrou-Bi", "Green Motion", "Institut Pasteur", "KFC", "FabAfriq", "Sports Ventures", "Venue Solutions", "Motus"];

// Auto-sliding photo carousel fed by a bucket folder; icon fallback when empty.
const carArrow = (side) => ({ position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 12, width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,.88)", color: T.ink, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,.18)", zIndex: 2 });
// Full-bleed hero background slideshow (auto cross-fade). Falls back to the header's own gradient when empty.
function HeroSlides({ folder }) {
  const map = usePhotoMap(folder);
  const photos = useMemo(() => Object.keys(map).sort().map((k) => map[k]), [map]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % photos.length), 5000);
    return () => clearInterval(t);
  }, [photos.length]);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {photos.map((src, j) => (
        <div key={src} style={{ position: "absolute", inset: 0, backgroundImage: `url("${src}")`, backgroundSize: "cover", backgroundPosition: "center", opacity: j === i ? 1 : 0, transition: "opacity 1s ease" }} />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(0,0,0,.58) 0%, rgba(0,0,0,.42) 100%)" }} />
    </div>
  );
}

function PhotoCarousel({ folder, icon: Icon = Sparkles, height = "clamp(260px, 44vw, 460px)" }) {
  const map = usePhotoMap(folder);
  const photos = useMemo(() => Object.keys(map).sort().map((k) => map[k]), [map]);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [folder]);
  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % photos.length), 4500);
    return () => clearInterval(t);
  }, [photos.length]);
  if (!photos.length) return (
    <div style={{ height, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(140deg, ${T.paperDark}, #fff)`, border: `1px solid ${T.line}` }}>
      <Icon size={56} color={T.green} strokeWidth={1.4} />
    </div>
  );
  return (
    <div style={{ position: "relative", height, borderRadius: 18, overflow: "hidden", border: `1px solid ${T.line}`, background: T.paperDark }}>
      {photos.map((src, j) => (
        <img key={src} src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: j === i ? 1 : 0, transition: "opacity .7s ease" }} />
      ))}
      {photos.length > 1 && (<>
        <button onClick={() => setI((i - 1 + photos.length) % photos.length)} aria-label="Previous photo" style={carArrow("left")}><ChevronLeft size={20} /></button>
        <button onClick={() => setI((i + 1) % photos.length)} aria-label="Next photo" style={carArrow("right")}><ChevronRight size={20} /></button>
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, zIndex: 2 }}>
          {photos.map((_, j) => <button key={j} onClick={() => setI(j)} aria-label={`Photo ${j + 1}`} style={{ width: j === i ? 22 : 8, height: 8, borderRadius: 999, border: "none", cursor: "pointer", padding: 0, background: j === i ? T.gold : "rgba(255,255,255,.75)", transition: "width .25s" }} />)}
        </div>
      </>)}
    </div>
  );
}

// Per-project gallery: swipeable strip at the top of a card + click-to-expand lightbox.
function ProjectGallery({ folder, icon: Icon = Mic, height = 180 }) {
  const map = usePhotoMap(folder);
  const photos = useMemo(() => Object.keys(map).sort().map((k) => map[k]), [map]);
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { setI(0); }, [folder]);
  const has = photos.length > 0;
  const go = (d, e) => { if (e) e.stopPropagation(); setI((x) => (x + d + photos.length) % photos.length); };

  // Auto-advance the strip when it has several photos (paused while the lightbox is open).
  useEffect(() => {
    if (open || photos.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % photos.length), 4000);
    return () => clearInterval(t);
  }, [open, photos.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  return (
    <>
      <div onClick={() => has && setOpen(true)} style={{ position: "relative", height, borderRadius: 12, overflow: "hidden", marginBottom: 14, cursor: has ? "zoom-in" : "default", background: "linear-gradient(140deg,#F3F5F3,#FFFFFF)", border: `1px solid ${T.line}` }}>
        {has ? (
          <img src={photos[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={44} color="#B8C4BC" strokeWidth={1.4} /></div>
        )}
        {has && (
          <div style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 8, background: "rgba(0,0,0,.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Search size={15} /></div>
        )}
        {photos.length > 1 && (<>
          <button onClick={(e) => go(-1, e)} aria-label="Previous" style={{ ...carArrow("left"), width: 30, height: 30, left: 8 }}><ChevronLeft size={16} /></button>
          <button onClick={(e) => go(1, e)} aria-label="Next" style={{ ...carArrow("right"), width: 30, height: 30, right: 8 }}><ChevronRight size={16} /></button>
          <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 2 }}>
            {photos.map((_, j) => <span key={j} style={{ width: j === i ? 18 : 6, height: 6, borderRadius: 999, background: j === i ? T.gold : "rgba(255,255,255,.8)", transition: "width .25s" }} />)}
          </div>
        </>)}
      </div>

      {open && has && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={22} /></button>
          <img src={photos[i]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "94vw", maxHeight: "84vh", objectFit: "contain", borderRadius: 8 }} />
          {photos.length > 1 && (<>
            <button onClick={(e) => go(-1, e)} aria-label="Previous" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={26} /></button>
            <button onClick={(e) => go(1, e)} aria-label="Next" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={26} /></button>
            <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: 13, fontWeight: 600 }}>{i + 1} / {photos.length}</div>
          </>)}
        </div>,
        document.body
      )}
    </>
  );
}

// Infinite partner-logo carousel (marquee). Uses images from mice/partners/ if present, otherwise partner names.
function PartnerMarquee() {
  const logos = usePhotoMap("mice/partners");
  const keys = Object.keys(logos).sort();
  const items = keys.length ? keys : MICE_PARTNERS;
  const doubled = [...items, ...items];
  return (
    <div style={{ overflow: "hidden", position: "relative", padding: "10px 0", maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
      <style>{`@keyframes ats-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ display: "flex", gap: 44, width: "max-content", animation: "ats-marquee 30s linear infinite", alignItems: "center" }}>
        {doubled.map((n, i) => keys.length
          ? <img key={i} src={logos[n]} alt={n} style={{ height: 46, objectFit: "contain" }} />
          : <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15, color: "rgba(0,0,0,.8)", whiteSpace: "nowrap" }}><Building2 size={18} color={T.green} strokeWidth={1.8} /> {n}</span>)}
      </div>
    </div>
  );
}

function EventsPage({ notify, go, user, saveRecord }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [ev, setEv] = useState({ type: "Conference / Summit", pax: "20–50", date: "", location: "", budget: "To be discussed", msg: "" });
  const [contact, setContact] = useState({ name: user?.name || "", email: user?.email || "", phone: "", org: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (user) setContact((c) => ({ ...c, name: c.name || user.name || "", email: c.email || user.email || "" })); }, [user]);
  const types = ["Conference / Summit", "Team building", "Incentive travel", "Destination wedding", "Product launch", "Government event", "Other"];
  const canSend = ev.type && ev.date && contact.name.trim() && contact.email.trim();

  const submit = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `MICE request — ${ev.type} · ${ev.pax} guests · ${ev.date}`,
          from_name: "ATS Events",
          name: contact.name, email: contact.email, phone: contact.phone,
          Organization: contact.org || "—",
          Event_type: ev.type, Guests: ev.pax, Target_date: ev.date,
          Location: ev.location || "—", Budget: ev.budget,
          Details: ev.msg || "—",
          Account: user ? `Signed in (${user.email})` : "Guest",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        notify("Proposal request sent — our events team will reply within 24h.");
        saveRecord({
          tour: { emoji: "🎤", name: `${ev.type} — event proposal`, pole: "MICE", dur: ev.date },
          date: ev.date, adults: 0, children: 0, infants: 0,
          plan: "quote", months: 0, total: 0, deposit: 0,
          event: { type: ev.type, guests: ev.pax, date: ev.date, location: ev.location, budget: ev.budget, notes: ev.msg },
          contact,
        });
        supabase.functions.invoke("send-confirmation", { body: { to: contact.email, name: contact.name, kind: "event", summary: [["Event type", ev.type], ["Guests", ev.pax], ["Target date", ev.date], ["Location", ev.location || "—"], ["Budget", ev.budget]] } }).catch(() => {});
      } else notify("Could not send the request. Please try again.");
    } catch { notify("Network error — please try again."); }
    finally { setSending(false); }
  };

  return (
    <>
      {/* Hero landing — full-width auto-scrolling image gallery + black overlay + text (same height as Home hero) */}
      <header style={{ background: `linear-gradient(160deg, #006B33 0%, ${T.green} 65%, #00A84F 100%)`, color: T.paper, position: "relative" }}>
        <HeroSlides folder="mice/hero" />
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px", position: "relative", zIndex: 2, minHeight: "90vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ color: T.gold, fontWeight: 600, letterSpacing: ".14em", fontSize: 12, textTransform: "uppercase", margin: 0 }}>ATS Events · ATS Business</p>
          <h1 className="disp" style={{ color: "#fff", fontSize: "clamp(30px,5vw,50px)", lineHeight: 1.05, fontWeight: 700, margin: "14px 0 16px", maxWidth: 780, letterSpacing: "-0.02em" }}>MICE</h1>
          <p style={{ color: "rgba(255,255,255,.92)", maxWidth: 680, lineHeight: 1.65, fontSize: "clamp(14px,1.8vw,16px)", margin: 0 }}>A multidisciplinary team based in Senegal and Rwanda, turning every interaction into an authentic, memorable experience. From board meetings to national summits, ATS Events runs your event end to end.</p>
          <button onClick={() => go("micework")} style={{ ...btnGold, marginTop: 22, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8 }}>View our work <ArrowRight size={16} /></button>
        </div>
      </header>

    <Wrap>
      {/* Service lines — each links to our work */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, margin: "26px 0 14px" }}>
        {MICE_LINES.map((s) => (
          <div key={s.key} className="card-hover" style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 24, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <s.icon size={30} color={T.green} strokeWidth={1.7} />
              {s.soon && <span style={{ background: T.gold, color: T.ink, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "4px 10px", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>Coming soon</span>}
            </div>
            <h3 className="disp" style={{ fontWeight: 700, fontSize: 18, margin: "12px 0 7px" }}>{s.name}</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(0,0,0,.8)", margin: "0 0 18px", flex: 1 }}>{s.blurb}</p>
            <button onClick={() => go("micework", { service: s.key })} style={{ background: "#fff", color: T.green, border: `1.5px solid ${T.green}`, borderRadius: 999, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>See our work <ArrowRight size={16} /></button>
          </div>
        ))}
      </div>

      {/* Services that set us apart — brochure-style grid (1px dividers, white cells) */}
      <div style={{ marginTop: 42 }}>
        <Eyebrow>What we do</Eyebrow>
        <h3 className="disp" style={{ fontWeight: 800, fontSize: "clamp(20px,2.6vw,26px)", margin: "6px 0 20px" }}>Services that set us apart</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 1, background: T.line, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden" }}>
          {MICE_SERVICES.map((s) => (
            <div key={s.name} style={{ background: "#fff", padding: "26px 22px", display: "flex", flexDirection: "column" }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "#F4F6F4", border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <s.icon size={26} color={T.green} strokeWidth={1.8} />
              </div>
              <h4 className="disp" style={{ fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: ".01em", margin: "0 0 12px", lineHeight: 1.3, color: T.ink }}>{s.name}</h4>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                {s.items.map((it) => (
                  <li key={it} style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(0,0,0,.8)", display: "flex", gap: 7 }}>
                    <Check size={14} color={T.green} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />{it}
                  </li>
                ))}
              </ul>
              <div style={{ width: 34, height: 3, borderRadius: 999, background: T.gold, marginTop: 18 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Track record CTA — green background, yellow button */}
      <div style={{ marginTop: 42, background: `linear-gradient(120deg, ${T.green}, ${T.indigo})`, borderRadius: 18, padding: "30px 28px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 20 }}>Trusted by 35+ organisations since 2018</div>
          <div style={{ fontSize: 14, opacity: 0.92, marginTop: 5 }}>Summits, gala dinners, launches and conferences delivered across Senegal.</div>
        </div>
        <button onClick={() => go("micework")} style={{ ...btnGold, display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>View our work <ArrowRight size={16} /></button>
      </div>

      <div id="mice-form" style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: "26px 24px", marginTop: 42 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "30px 10px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E9F7EE", color: T.green }}><Check size={32} /></div>
            <h3 className="disp" style={{ fontWeight: 700, fontSize: 20, margin: "0 0 8px" }}>Request received</h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)", maxWidth: 440, margin: "0 auto" }}>
              Our events team is reviewing your brief and will reply to <strong>{contact.email}</strong> within 24 hours with a tailored proposal.
            </p>
            <button style={{ ...btnGreen, marginTop: 18 }} onClick={() => { setSent(false); setEv({ type: "Conference / Summit", pax: "20–50", date: "", location: "", budget: "To be discussed", msg: "" }); }}>New request</button>
          </div>
        ) : (
          <>
            <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, marginTop: 0 }}>Request an event proposal</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div><label style={label}>Event type *</label><select style={input} value={ev.type} onChange={(e) => setEv({ ...ev, type: e.target.value })}>{types.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label style={label}>Guests</label><select style={input} value={ev.pax} onChange={(e) => setEv({ ...ev, pax: e.target.value })}>{["<20", "20–50", "50–150", "150–500", "500+"].map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label style={label}>Target date *</label><input type="date" min={todayStr} style={input} value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
              <div><label style={label}>City / venue</label><input style={input} value={ev.location} onChange={(e) => setEv({ ...ev, location: e.target.value })} placeholder="e.g. Dakar, Saly, Diamniadio…" /></div>
              <div><label style={label}>Budget range</label><select style={input} value={ev.budget} onChange={(e) => setEv({ ...ev, budget: e.target.value })}>{["To be discussed", "< 5M XOF", "5–15M XOF", "15–50M XOF", "50M+ XOF"].map((t) => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div style={sect}>Your contact details</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div><label style={label}>Full name *</label><input style={input} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="e.g. Awa Diop" /></div>
              <div><label style={label}>Email *</label><input type="email" style={input} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@company.com" /></div>
              <div><label style={label}>Phone / WhatsApp</label><input style={input} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="+221 …" /></div>
              <div><label style={label}>Organization</label><input style={input} value={contact.org} onChange={(e) => setContact({ ...contact, org: e.target.value })} placeholder="Company, NGO, agency…" /></div>
            </div>
            <label style={{ ...label, marginTop: 12 }}>Tell us about your event</label>
            <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} value={ev.msg} onChange={(e) => setEv({ ...ev, msg: e.target.value })} placeholder="Objectives, format, special requirements…" />
            <button disabled={!canSend || sending} style={{ ...btnGold, marginTop: 14, opacity: canSend && !sending ? 1 : 0.5, cursor: canSend ? "pointer" : "not-allowed" }} onClick={submit}>{sending ? "Sending…" : "Request proposal"}</button>
            {!canSend && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 6 }}>Choose a target date and add your name and email to send your request.</div>}
          </>
        )}
      </div>
    </Wrap>
    </>
  );
}

// ATS Events track record — carousel, figures, real projects, partners.
function MiceWorkPage({ go }) {
  return (
    <Wrap>
      <button onClick={() => go("events")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.green, fontWeight: 700, fontSize: 14, padding: 0, marginBottom: 14 }}><ChevronLeft size={16} /> Back to MICE</button>
      <Eyebrow>Our track record · ATS Events</Eyebrow><H2>Selected work</H2>
      <p style={{ maxWidth: 720, lineHeight: 1.65, color: "rgba(0,0,0,.8)", marginTop: 0 }}>Summits, gala dinners, product launches and international conferences delivered end to end since 2018 — for governments, energy majors, global brands and NGOs across Senegal.</p>

      {/* Aggregate figures — white cards with border, taller */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, margin: "30px 0 8px" }}>
        {MICE_STATS.map(([n, l]) => (
          <div key={l} style={{ background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 16, padding: "32px 20px", textAlign: "center", minHeight: 132, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="disp" style={{ fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 800, color: "#1A1A1A" }}>{n}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: "rgba(0,0,0,.8)", lineHeight: 1.4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Real projects — each with a click-to-expand image gallery */}
      <h3 className="disp" style={{ fontWeight: 800, fontSize: "clamp(19px,2.4vw,24px)", color: T.ink, margin: "46px 0 20px" }}>Projects we delivered</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {MICE_REALISATIONS.map((r) => (
          <div key={r.title} className="card-hover" style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column" }}>
            <ProjectGallery folder={`mice/realisations/${r.slug}`} icon={Mic} />
            <h3 className="disp" style={{ fontWeight: 700, fontSize: 16.5, margin: "0 0 7px", lineHeight: 1.35, color: T.ink }}>{r.title}</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12.5, fontWeight: 600, color: "#6B7A70", marginBottom: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin size={13} strokeWidth={2} color={T.green} />{r.venue}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Users size={13} strokeWidth={2} color={T.green} />{r.pax}</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(0,0,0,.8)", margin: "0 0 14px" }}>{r.note}</p>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#8A968E", marginBottom: 8 }}>What we handled</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {r.scope.map((it) => (
                <li key={it} style={{ fontSize: 12.5, lineHeight: 1.4, color: "rgba(0,0,0,.8)", display: "flex", gap: 7 }}>
                  <Check size={13} color={T.green} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />{it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h3 className="disp" style={{ fontWeight: 800, fontSize: "clamp(19px,2.4vw,24px)", color: T.ink, margin: "46px 0 18px" }}>They trusted us</h3>
      <PartnerMarquee />

      <div style={{ marginTop: 46, background: `linear-gradient(120deg, ${T.green}, ${T.indigo})`, borderRadius: 18, padding: "30px 28px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 20 }}>Planning something similar?</div>
          <div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>Tell us about your event — our team replies within 24h with a tailored proposal.</div>
        </div>
        <button onClick={() => go("events")} style={{ ...btnGold, whiteSpace: "nowrap" }}>Request a proposal</button>
      </div>
    </Wrap>
  );
}

// ---------------- CORPORATE (public B2B recruitment) ----------------
function CorporatePage({ notify, go, user, role }) {
  const [f, setF] = useState({ org: "", name: "", email: "", phone: "", travelers: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (user) setF((x) => ({ ...x, name: x.name || user.name || "", email: x.email || user.email || "" })); }, [user]);
  const canSend = f.org.trim() && f.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email);
  const isCorp = role === "corporate" || role === "admin";

  const submit = async () => {
    if (!canSend) { notify("Please add your organization, name and a valid work email."); return; }
    setSending(true);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `New corporate account request — ${f.org}`,
          from_name: "ATS Corporate",
          name: f.name, email: f.email, phone: f.phone,
          Organization: f.org, Approx_travelers_per_year: f.travelers || "—",
          Message: f.message || "—",
          Account: user ? `Signed in (${user.email})` : "Guest",
        }),
      });
      const data = await res.json();
      if (data.success) { setSent(true); notify("Request received — our corporate team will get back to you."); }
      else notify("Could not send the request. Please try again.");
    } catch { notify("Network error — please try again."); }
    finally { setSending(false); }
  };

  return (
    <Wrap>
      <Eyebrow>Governments · Embassies · NGOs · Companies</Eyebrow><H2>Corporate travel & logistics</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}>
        <div style={{ lineHeight: 1.7, fontSize: 15 }}>
          <p style={{ marginTop: 0, color: "rgba(0,0,0,.8)" }}>One account for your organization's travel in Africa — with a negotiated preferential rate applied automatically to every booking.</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2, marginTop: 0 }}>
            <li>Preferential B2B rate on the full catalogue</li>
            <li>Manage traveler groups and missions</li>
            <li>ATS Logistics: fleet, coaches (22–50 seats), group movement</li>
            <li>Dedicated account manager, EN/FR</li>
          </ul>
          <div style={{ background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 14, padding: "16px 18px", marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#8A968E", marginBottom: 10 }}>How it works</div>
            {[["Request an account", "Send us your organization details below."], ["We set your rate", "ATS reviews and activates your account with your negotiated discount."], ["Book at your rate", "Your preferential rate applies automatically at checkout — no code needed."]].map(([t, d], i) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "7px 0" }}>
                <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: T.green, color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <div><strong style={{ color: "#1A1A1A" }}>{t}</strong><div style={{ fontSize: 13.5, color: "rgba(0,0,0,.8)" }}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          {isCorp ? (
            <>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 19, marginTop: 0 }}>Your corporate account is active</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>Your preferential rate is applied automatically at checkout. Browse the catalogue and book at your negotiated rate.</p>
              <button style={{ ...btnGold, marginTop: 6, width: "100%" }} onClick={() => go("tours")}>Browse tours →</button>
            </>
          ) : sent ? (
            <div style={{ textAlign: "center", padding: "20px 6px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E9F7EE", color: T.green }}><Check size={28} /></div>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>Request received</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>Our corporate team will review it and get back to you at <strong>{f.email}</strong>.</p>
            </div>
          ) : (
            <>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 19, marginTop: 0 }}>Open a corporate account</h3>
              <label style={{ ...label, marginTop: 8 }}>Organization *</label>
              <input style={input} placeholder="e.g. UNDP Senegal" value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} />
              <label style={label}>Contact name *</label>
              <input style={input} placeholder="Your full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <label style={label}>Work email *</label>
              <input style={input} type="email" placeholder="name@organization.org" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <label style={label}>Phone / WhatsApp</label>
              <input style={input} placeholder="+221 …" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              <label style={label}>Approx. travelers / year</label>
              <input style={input} placeholder="e.g. 50" value={f.travelers} onChange={(e) => setF({ ...f, travelers: e.target.value })} />
              <label style={label}>Message (optional)</label>
              <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} placeholder="Tell us about your travel needs…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
              <button disabled={!canSend || sending} style={{ ...btnGold, marginTop: 14, width: "100%", opacity: (canSend && !sending) ? 1 : 0.55, cursor: canSend ? "pointer" : "not-allowed" }} onClick={submit}>{sending ? "Sending…" : "Request account"}</button>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8, textAlign: "center" }}>Requests are reviewed by ATS. Once approved, we activate your account and rate.</div>
            </>
          )}
        </div>
      </div>
    </Wrap>
  );
}

// ---------------- AGENTS (public recruitment / become an ambassador) ----------------
function AgentsPage({ notify, go, user, role }) {
  const [f, setF] = useState({ country: "", name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (user) setF((x) => ({ ...x, name: x.name || user.name || "", email: x.email || user.email || "" })); }, [user]);
  const canSend = f.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email);

  const submit = async () => {
    if (!canSend) { notify("Please add your name and a valid email."); return; }
    setSending(true);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `New ambassador application — ${f.name}`,
          from_name: "ATS Ambassador Program",
          name: f.name, email: f.email, phone: f.phone,
          Country: f.country || "—",
          Message: f.message || "—",
          Account: user ? `Signed in (${user.email})` : "Guest",
        }),
      });
      const data = await res.json();
      if (data.success) { setSent(true); notify("Application received — the ATS team will get back to you."); }
      else notify("Could not send the application. Please try again.");
    } catch { notify("Network error — please try again."); }
    finally { setSending(false); }
  };

  const isAgent = role === "agent" || role === "admin";
  const HOW = [
    ["Get your code", "We set up your personal ambassador code and referral link."],
    ["Share it", "Your clients book with your code — they get a discount, you get tracked."],
    ["Earn commission", "A commission is recorded on every booking made with your code."],
    ["Get paid", "Track your earnings and payouts anytime from your agent portal."],
  ];

  return (
    <Wrap>
      <Eyebrow>Travel agents · Tour operators · Resellers</Eyebrow><H2>Become an ATS ambassador</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}>
        <div style={{ lineHeight: 1.7, fontSize: 15 }}>
          <p style={{ marginTop: 0, color: "rgba(0,0,0,.8)" }}>Earn a commission on every trip you bring to ATS. Share your code, book for your clients, and follow your earnings in real time.</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2, marginTop: 0 }}>
            <li>Preferential rates on the full Senegal catalogue</li>
            <li>Commission tracking and statements</li>
            <li>Personal code + referral link</li>
            <li>Book for your clients in a few clicks</li>
          </ul>
          <div style={{ background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 14, padding: "16px 18px", marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#8A968E", marginBottom: 10 }}>How it works</div>
            {HOW.map(([t, d], i) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "7px 0" }}>
                <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: T.green, color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <div><strong style={{ color: "#1A1A1A" }}>{t}</strong><div style={{ fontSize: 13.5, color: "rgba(0,0,0,.8)" }}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          {isAgent ? (
            <>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 19, marginTop: 0 }}>You're an ATS ambassador</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>Access your code, referral link, bookings and commissions in your portal.</p>
              <button style={{ ...btnGold, marginTop: 6, width: "100%" }} onClick={() => go("agent")}>Open agent portal →</button>
            </>
          ) : sent ? (
            <div style={{ textAlign: "center", padding: "20px 6px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E9F7EE", color: T.green }}><Check size={28} /></div>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>Application received</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>The ATS team will review your application and get back to you at <strong>{f.email}</strong>.</p>
            </div>
          ) : (
            <>
              <h3 className="disp" style={{ fontWeight: 800, fontSize: 19, marginTop: 0 }}>Apply to become an ambassador</h3>
              <label style={{ ...label, marginTop: 8 }}>Full name *</label>
              <input style={input} placeholder="Your full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <label style={label}>Country</label>
              <input style={input} placeholder="e.g. France, USA, Nigeria…" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
              <label style={label}>Email *</label>
              <input style={input} type="email" placeholder="you@agency.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <label style={label}>Phone / WhatsApp</label>
              <input style={input} placeholder="+221 …" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              <label style={label}>Message (optional)</label>
              <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} placeholder="Tell us about you and how you'd promote ATS…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
              <button disabled={!canSend || sending} style={{ ...btnGold, marginTop: 14, width: "100%", opacity: (canSend && !sending) ? 1 : 0.55, cursor: canSend ? "pointer" : "not-allowed" }} onClick={submit}>{sending ? "Sending…" : "Apply"}</button>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8, textAlign: "center" }}>Applications are reviewed by ATS. Once approved, we set up your code and portal.</div>
            </>
          )}
        </div>
      </div>
    </Wrap>
  );
}

// ---------------- AGENT PORTAL (logged-in agents; own data via RLS) ----------------
function AgentPortal({ user, role, setSignin, notify, go, setBooking }) {
  const [codes, setCodes] = useState([]);
  const [comms, setComms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selTour, setSelTour] = useState("");
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      supabase.from("promo_codes").select("*").eq("agent_id", user.id),
      supabase.from("commissions").select("*").eq("agent_id", user.id).order("created_at", { ascending: false }),
    ]).then(([c1, c2]) => {
      if (!alive) return;
      setCodes(c1.data || []);
      setComms(c2.data || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.id]);

  if (!user) return (
    <Wrap><H2>Agent portal</H2>
      <p style={{ opacity: 0.8 }}>Sign in with your ATS agent account to access your dashboard.</p>
      <button style={btnGold} onClick={() => setSignin(true)}>Sign in</button>
    </Wrap>
  );
  if (role && role !== "agent" && role !== "admin") return (
    <Wrap><H2>Agent portal</H2>
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 24, lineHeight: 1.6 }}>
        This area is reserved for ATS ambassadors. Want to become one? <button style={{ background: "none", border: "none", color: T.green, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }} onClick={() => go("agents")}>Apply here</button>.
      </div>
    </Wrap>
  );

  const num = (x) => Number(x || 0);
  const earned = comms.reduce((s, c) => s + num(c.amount), 0);
  const pending = comms.filter((c) => c.status === "pending").reduce((s, c) => s + num(c.amount), 0);
  const paid = comms.filter((c) => c.status === "paid").reduce((s, c) => s + num(c.amount), 0);
  const copy = (txt) => { try { navigator.clipboard.writeText(txt); notify("Copied to clipboard"); } catch { notify(txt); } };
  const statusColorMap = { pending: "#B8860B", approved: T.indigo, paid: T.green, cancelled: "#B3261E" };
  const stat = { background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 14, padding: "16px 18px" };
  const primaryCode = (codes.find((c) => c.active) || codes[0] || {}).code || "";
  const bookableTours = TOURS.filter((t) => !t.quote);
  const bookForClient = () => {
    const t = TOURS.find((x) => x.id === selTour) || bookableTours[0];
    if (!t) return;
    setBooking({ ...t, initialPlan: "full", initialPromo: primaryCode, agentBooking: true });
  };

  return (
    <Wrap>
      <Eyebrow>Ambassador dashboard</Eyebrow>
      <H2>Welcome, {user.name}</H2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 22 }}>
        {[["Total earned", earned], ["Pending", pending], ["Paid out", paid], ["Attributed bookings", comms.length, true]].map(([l, v, count]) => (
          <div key={l} style={stat}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", color: "#8A968E", fontWeight: 700 }}>{l}</div>
            <div className="disp" style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A", marginTop: 4 }}>{count ? v : fmtXOF(v)}</div>
          </div>
        ))}
      </div>

      {primaryCode && (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, marginBottom: 22 }}>
          <h3 className="disp" style={{ fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>Book for a client</h3>
          <div style={{ fontSize: 13, color: "#6B7A72", marginBottom: 12 }}>Pick an experience, then enter your client's details. Your code <strong>{primaryCode}</strong> is applied automatically — the client gets the discount and you earn your commission.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ ...label, marginTop: 0 }}>Experience</label>
              <select style={{ ...input, fontWeight: 600 }} value={selTour} onChange={(e) => setSelTour(e.target.value)}>
                {bookableTours.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button style={{ ...btnGold, fontSize: 14, padding: "12px 20px" }} onClick={bookForClient}>Start booking →</button>
          </div>
        </div>
      )}

      <h3 className="disp" style={{ fontWeight: 800, fontSize: 18, margin: "0 0 12px" }}>Your codes</h3>
      {loading ? <div style={{ opacity: 0.6 }}>Loading…</div> : codes.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>No code assigned yet — your ATS manager will set one up for you.</div>
      ) : codes.map((c) => {
        const link = `${window.location.origin}/?ref=${encodeURIComponent(c.code)}`;
        return (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className="disp" style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".04em" }}>{c.code}</span>
              <span style={{ ...pill(), background: c.active ? "#E9F7EE" : "#F2F2F2", color: c.active ? T.green : "#8A968E", fontSize: 12 }}>{c.active ? "Active" : "Inactive"}</span>
              <span style={{ fontSize: 13, color: "rgba(0,0,0,.8)" }}>−{num(c.discount_percent)}% client · {num(c.commission_percent)}% commission</span>
              <button style={{ marginLeft: "auto", ...btnGreen, fontSize: 13, padding: "8px 14px", background: "#fff", color: T.green, border: `1.5px solid ${T.green}` }} onClick={() => copy(c.code)}>Copy code</button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <input readOnly value={link} style={{ ...input, flex: 1, minWidth: 220, background: "#F8F8F8" }} onFocus={(e) => e.target.select()} />
              <button style={{ ...btnGold, fontSize: 13, padding: "10px 16px" }} onClick={() => copy(link)}>Copy link</button>
            </div>
            <div style={{ fontSize: 12.5, color: "#8A968E", marginTop: 8 }}>Used {num(c.uses)} time{num(c.uses) === 1 ? "" : "s"}{c.max_uses ? ` / ${c.max_uses} max` : ""}. Share your link — clients who book with it get the discount and you earn your commission.</div>
          </div>
        );
      })}

      <h3 className="disp" style={{ fontWeight: 800, fontSize: 18, margin: "24px 0 12px" }}>Commissions</h3>
      {comms.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>No commission yet. They appear here once a client pays with your code.</div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
          {comms.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtXOF(c.amount)} <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.6 }}>on {fmtXOF(c.order_amount)}</span></div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>Code {c.code} · {num(c.commission_percent)}% · {new Date(c.created_at).toLocaleDateString()}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: statusColorMap[c.status] || "#8A968E", textTransform: "capitalize" }}>● {c.status}</span>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
}

// ---------------- ADMIN CONSOLE (role: admin; all writes via admin RLS) ----------------
function AdminConsole({ user, isAdmin, isSuper, setSignin }) {
  const [tab, setTab] = useState("users");
  const [profiles, setProfiles] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [codes, setCodes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [comms, setComms] = useState([]);
  const [activity, setActivity] = useState([]);
  const [waContacts, setWaContacts] = useState([]);
  const [bookingFilter, setBookingFilter] = useState("all");
  const [onlyRequests, setOnlyRequests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [newOrg, setNewOrg] = useState({ name: "", discount: "" });
  const [newCode, setNewCode] = useState({ code: "", agent_id: "", discount: "10", commission: "5" });

  const reload = async () => {
    setLoading(true);
    const [p, o, c, b, cm, ac, wa] = await Promise.all([
      supabase.from("profiles").select("id,email,first_name,last_name,role,org_id").order("created_at"),
      supabase.from("organizations").select("*").order("created_at"),
      supabase.from("promo_codes").select("*").order("created_at"),
      supabase.from("bookings").select("id,user_id,data,status,created_at,guest_email,ref").order("created_at", { ascending: false }),
      supabase.from("commissions").select("*").order("created_at", { ascending: false }),
      supabase.from("admin_activity").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("whatsapp_contacts").select("*"),
    ]);
    setProfiles(p.data || []); setOrgs(o.data || []); setCodes(c.data || []); setBookings(b.data || []); setComms(cm.data || []); setActivity(ac.data || []); setWaContacts(wa.data || []); setLoading(false);
  };
  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  if (!user) return (<Wrap><H2>Admin</H2><p style={{ opacity: 0.8 }}>Sign in with an admin account.</p><button style={btnGold} onClick={() => setSignin(true)}>Sign in</button></Wrap>);
  if (!isAdmin) return (<Wrap><H2>Admin</H2><div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>This area is reserved for ATS administrators.</div></Wrap>);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  const orgName = (id) => (orgs.find((o) => o.id === id) || {}).name || "—";
  const agents = profiles.filter((p) => p.role === "agent");

  const setRole = async (id, role) => {
    const patch = { role, updated_at: new Date().toISOString() };
    if (role !== "corporate") patch.org_id = null;
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return flash("Error: " + error.message);
    flash("Role updated"); reload();
  };
  const assignOrg = async (id, org_id) => {
    const { error } = await supabase.from("profiles").update({ org_id: org_id || null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return flash("Error: " + error.message);
    flash("Organization set"); reload();
  };
  const createOrg = async () => {
    if (!newOrg.name.trim()) return flash("Organization name required");
    const { error } = await supabase.from("organizations").insert({ name: newOrg.name.trim(), discount_percent: Number(newOrg.discount) || 0, active: true });
    if (error) return flash("Error: " + error.message);
    setNewOrg({ name: "", discount: "" }); flash("Organization created"); reload();
  };
  const setOrgDiscount = async (id, pct) => {
    const { error } = await supabase.from("organizations").update({ discount_percent: Number(pct) || 0 }).eq("id", id);
    if (error) return flash("Error: " + error.message);
    reload();
  };
  const toggleOrg = async (id, active) => { await supabase.from("organizations").update({ active }).eq("id", id); reload(); };
  const createCode = async () => {
    if (!newCode.code.trim() || !newCode.agent_id) return flash("Code and agent required");
    const { error } = await supabase.from("promo_codes").insert({
      code: newCode.code.trim().toUpperCase(), agent_id: newCode.agent_id,
      discount_percent: Number(newCode.discount) || 0, commission_percent: Number(newCode.commission) || 0, active: true,
    });
    if (error) return flash("Error: " + error.message);
    setNewCode({ code: "", agent_id: "", discount: "10", commission: "5" }); flash("Code created"); reload();
  };
  const toggleCode = async (id, active) => { await supabase.from("promo_codes").update({ active }).eq("id", id); reload(); };
  const updateCode = async (id, patch) => { const { error } = await supabase.from("promo_codes").update(patch).eq("id", id); if (error) return flash("Error: " + error.message); flash("Code updated"); reload(); };
  const setCommStatus = async (id, status) => { const { error } = await supabase.from("commissions").update({ status }).eq("id", id); if (error) return flash("Error: " + error.message); flash("Commission " + status); reload(); };

  // ---- Booking status management (admin) ----
  const BOOKING_STATUSES = ["pending", "invoiced", "confirmed", "paid", "settled", "completed", "cancelled"];
  // Corporate "pay later" outstanding: bookings still invoiced, grouped by organization
  const invoicedBookings = bookings.filter((b) => b.status === "invoiced" && b.data?.corp);
  const owedByOrg = invoicedBookings.reduce((m, b) => { const k = b.data.corp.orgId || b.data.corp.orgName; m[k] = (m[k] || 0) + (Number(b.data.corp.owed) || 0); return m; }, {});
  const totalOutstanding = invoicedBookings.reduce((s, b) => s + (Number(b.data.corp.owed) || 0), 0);
  const markInvoicePaid = (b) => setBookingStatus(b, "paid");
  const prevStatusBefore = (b, marker) => { const h = (b.data?.statusHistory || []).slice().reverse().find((x) => x.to === marker); return h?.from || "confirmed"; };
  const patchBookingRow = async (b, patch, action) => {
    const { error } = await supabase.from("bookings").update(patch).eq("id", b.id);
    if (error) return flash("Error: " + error.message);
    supabase.from("admin_activity").insert({ actor_id: user.id, actor_email: user.email, actor_role: isSuper ? "super_admin" : "admin", action, target_label: b.data?.tour?.name || b.ref || String(b.id).slice(0, 8), details: { ref: b.ref, from: b.status, to: patch.status } }).catch(() => {});
    flash("Booking updated"); reload();
  };
  const setBookingStatus = (b, status) => {
    if (status === b.status) return;
    const hist = Array.isArray(b.data?.statusHistory) ? b.data.statusHistory : [];
    const data = { ...(b.data || {}), statusHistory: [...hist, { at: new Date().toISOString(), from: b.status, to: status, by: "admin" }] };
    patchBookingRow(b, { status, data }, "booking.status." + status);
  };
  const approveChange = (b) => {
    const pc = b.data?.pendingChange || {};
    const data = { ...b.data };
    if (pc.date) { data.dateFrom = pc.date; data.date = pc.date; }
    if (pc.adults != null) data.adults = pc.adults;
    if (pc.children != null) data.children = pc.children;
    const back = prevStatusBefore(b, "modification_requested");
    const hist = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    data.statusHistory = [...hist, { at: new Date().toISOString(), from: b.status, to: back, by: "admin", applied: pc }];
    delete data.pendingChange;
    patchBookingRow(b, { data, status: back }, "booking.modify_approved");
  };
  const rejectChange = (b) => {
    const data = { ...b.data };
    const back = prevStatusBefore(b, "modification_requested");
    const hist = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    data.statusHistory = [...hist, { at: new Date().toISOString(), from: b.status, to: back, by: "admin", rejected: data.pendingChange || null }];
    delete data.pendingChange;
    patchBookingRow(b, { data, status: back }, "booking.modify_rejected");
  };
  const confirmRefund = (b) => {
    const data = { ...b.data, refund: { ...(b.data?.refund || {}), processedAt: new Date().toISOString() } };
    const hist = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    data.statusHistory = [...hist, { at: new Date().toISOString(), from: b.status, to: "cancelled", by: "admin" }];
    patchBookingRow(b, { data, status: "cancelled" }, "booking.refund_processed");
  };

  // ---- WhatsApp outreach (shared across admins to avoid double-messaging) ----
  const waDigits = (p) => String(p || "").replace(/[^\d]/g, "").replace(/^0+/, ""); // international digits
  const waMap = waContacts.reduce((m, r) => { m[r.phone] = r; return m; }, {});
  const shortEmail = (e) => (e || "").split("@")[0];
  const openWhatsApp = async (b) => {
    const raw = b.data?.contact?.phone;
    const phone = waDigits(raw);
    if (!phone) { flash("No phone number on this booking."); return; }
    const name = (b.data?.contact?.name || "").split(" ")[0] || "there";
    const item = b.data?.tour?.name || "your booking";
    const ref = b.ref ? ` (ref ${b.ref})` : "";
    const text = `Hello ${name}, this is Africa Tourism Solutions about ${item}${ref}. `;
    // Log the outreach first so other admins see it, then open WhatsApp
    const prev = waMap[phone];
    await supabase.from("whatsapp_contacts").upsert({
      phone, customer_name: b.data?.contact?.name || null,
      last_admin_id: user.id, last_admin_email: user.email,
      last_at: new Date().toISOString(), count: (prev?.count || 0) + 1, updated_at: new Date().toISOString(),
    }, { onConflict: "phone" });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    reload();
  };

  // Booking channel: corporate / agent / direct
  const channelOf = (d) => (d && d.corp) ? "corporate" : (d && d.promo && d.promo.agentId) ? "agent" : "direct";
  const custOf = (b) => b.data?.contact?.name || b.guest_email || (profiles.find((p) => p.id === b.user_id) || {}).email || "—";
  const emailOf = (id) => (profiles.find((p) => p.id === id) || {}).email || "—";

  const ROLES = ["client", "agent", "corporate", "admin", "super_admin"];
  const roleOptions = (current) => isSuper ? ROLES : Array.from(new Set(["client", "agent", "corporate", current]));
  const th = { textAlign: "left", padding: "8px 10px", fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".05em", color: "#8A968E", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", fontSize: 13.5, borderBottom: `1px solid ${T.line}`, verticalAlign: "middle" };
  const sel = { ...input, padding: "6px 8px", fontSize: 13, width: "auto" };
  const tabs = [["users", "Users & roles"], ["orgs", "Corporate"], ["codes", "Promo codes"], ["bookings", "Bookings"], ["commissions", "Commissions"], ["analytics", "Analytics"], ["activity", isSuper ? "Activity (all)" : "Activity"]];
  const actionLabel = (a) => ({ "promo_code.create": "created code", "promo_code.update": "edited code", "promo_code.activate": "activated code", "promo_code.deactivate": "deactivated code", "organization.create": "created org", "organization.update": "edited org", "organization.activate": "activated org", "organization.deactivate": "deactivated org", "profile.update": "changed user", "commission.approved": "approved commission", "commission.paid": "paid commission", "commission.cancelled": "cancelled commission", "booking.modify_approved": "approved a change", "booking.modify_rejected": "rejected a change", "booking.refund_processed": "processed a refund" }[a] || (a && a.startsWith("booking.status.") ? `set booking → ${a.slice(15)}` : a));
  const REQUEST_STATES = ["modification_requested", "cancellation_requested"];
  const requestCount = bookings.filter((b) => REQUEST_STATES.includes(b.status)).length;
  const shownBookings = bookings.filter((b) => (bookingFilter === "all" || channelOf(b.data) === bookingFilter) && (!onlyRequests || REQUEST_STATES.includes(b.status)));
  const commStatusColor = { pending: "#B8860B", approved: T.indigo, paid: T.green, cancelled: "#B3261E" };

  return (
    <Wrap>
      <Eyebrow>Back office</Eyebrow><H2>Admin console</H2>
      {msg && <div style={{ background: "#E9F7EE", border: "1px solid #C7E9D3", color: "#1A6B3A", borderRadius: 10, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: "none", cursor: "pointer", background: tab === k ? T.green : "#fff", color: tab === k ? "#fff" : T.ink, borderRadius: 999, padding: "8px 16px", fontWeight: 600, fontSize: 13, boxShadow: `inset 0 0 0 1px ${T.line}` }}>{l}</button>
        ))}
      </div>

      {loading ? <div style={{ opacity: 0.6 }}>Loading…</div> : (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, overflowX: "auto" }}>
          {tab === "users" && (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr><th style={th}>User</th><th style={th}>Role</th><th style={th}>Organization</th></tr></thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td style={td}><div style={{ fontWeight: 600 }}>{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</div><div style={{ fontSize: 12, opacity: 0.6 }}>{p.email}</div></td>
                    <td style={td}>
                      {(() => { const locked = !isSuper && (p.role === "admin" || p.role === "super_admin"); return (
                        <>
                          <select style={{ ...sel, opacity: locked ? 0.6 : 1 }} disabled={locked} value={p.role} onChange={(e) => setRole(p.id, e.target.value)}>
                            {roleOptions(p.role).map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {locked && <div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 2 }}>super-admin only</div>}
                        </>
                      ); })()}
                    </td>
                    <td style={td}>
                      {p.role === "corporate"
                        ? <select style={sel} value={p.org_id || ""} onChange={(e) => assignOrg(p.id, e.target.value)}><option value="">— none —</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                        : <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "orgs" && (
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
                <div><label style={{ ...label, marginTop: 0 }}>New organization</label><input style={{ ...input, minWidth: 200 }} placeholder="Company name" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} /></div>
                <div><label style={{ ...label, marginTop: 0 }}>Discount %</label><input style={{ ...input, width: 100 }} type="number" value={newOrg.discount} onChange={(e) => setNewOrg({ ...newOrg, discount: e.target.value })} /></div>
                <button style={{ ...btnGold, padding: "11px 18px" }} onClick={createOrg}>Add</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead><tr><th style={th}>Organization</th><th style={th}>Discount %</th><th style={th}>Outstanding (pay later)</th><th style={th}>Status</th></tr></thead>
                <tbody>
                  {orgs.map((o) => {
                    const owed = owedByOrg[o.id] || 0;
                    return (
                    <tr key={o.id}>
                      <td style={td}>{o.name}</td>
                      <td style={td}><input style={{ ...sel, width: 80 }} type="number" defaultValue={o.discount_percent} onBlur={(e) => setOrgDiscount(o.id, e.target.value)} /></td>
                      <td style={{ ...td, fontWeight: 700, color: owed > 0 ? T.indigo : "#8A968E" }}>{owed > 0 ? fmtXOF(owed) : "—"}</td>
                      <td style={td}><button onClick={() => toggleOrg(o.id, !o.active)} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: o.active ? "#E9F7EE" : "#F2F2F2", color: o.active ? T.green : "#8A968E" }}>{o.active ? "Active" : "Inactive"}</button></td>
                    </tr>
                    );
                  })}
                  {orgs.length === 0 && <tr><td style={td} colSpan={4}>No organization yet.</td></tr>}
                </tbody>
              </table>

              {/* Book-now-pay-later: invoices awaiting settlement */}
              <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 className="disp" style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Corporate invoices — pay later</h3>
                <span style={{ background: "#F3F1FB", color: T.indigo, borderRadius: 999, padding: "3px 12px", fontSize: 12.5, fontWeight: 700 }}>Total outstanding: {fmtXOF(totalOutstanding)}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, marginTop: 10 }}>
                <thead><tr><th style={th}>Item</th><th style={th}>Organization</th><th style={th}>Gross</th><th style={th}>Rate</th><th style={th}>Owed</th><th style={th}>Booked</th><th style={th}>Settle</th></tr></thead>
                <tbody>
                  {invoicedBookings.map((b) => (
                    <tr key={b.id}>
                      <td style={td}><div style={{ fontWeight: 600 }}>{b.data?.tour?.name || "—"}</div><div style={{ fontSize: 11.5, opacity: 0.6 }}>{custOf(b)}</div></td>
                      <td style={td}>{b.data.corp.orgName}</td>
                      <td style={td}>{fmtXOF(b.data.corp.grossTotal)}</td>
                      <td style={td}>−{b.data.corp.discountPercent}%</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtXOF(b.data.corp.owed)}</td>
                      <td style={td}>{new Date(b.created_at).toLocaleDateString()}</td>
                      <td style={td}><button onClick={() => markInvoicePaid(b)} style={{ border: "none", background: T.green, color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mark paid</button></td>
                    </tr>
                  ))}
                  {invoicedBookings.length === 0 && <tr><td style={td} colSpan={7}>No outstanding corporate invoice.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "codes" && (
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
                <div><label style={{ ...label, marginTop: 0 }}>Code</label><input style={{ ...input, width: 140 }} placeholder="AWA10" value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })} /></div>
                <div><label style={{ ...label, marginTop: 0 }}>Agent</label><select style={{ ...sel, minWidth: 180 }} value={newCode.agent_id} onChange={(e) => setNewCode({ ...newCode, agent_id: e.target.value })}><option value="">— pick agent —</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}</select></div>
                <div><label style={{ ...label, marginTop: 0 }}>Discount %</label><input style={{ ...input, width: 90 }} type="number" value={newCode.discount} onChange={(e) => setNewCode({ ...newCode, discount: e.target.value })} /></div>
                <div><label style={{ ...label, marginTop: 0 }}>Commission %</label><input style={{ ...input, width: 110 }} type="number" value={newCode.commission} onChange={(e) => setNewCode({ ...newCode, commission: e.target.value })} /></div>
                <button style={{ ...btnGold, padding: "11px 18px" }} onClick={createCode}>Create</button>
              </div>
              {agents.length === 0 && <div style={{ fontSize: 12.5, color: T.laterite, marginBottom: 12 }}>No agent yet — set a user's role to “agent” in the Users tab first.</div>}
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead><tr><th style={th}>Code</th><th style={th}>Agent</th><th style={th}>Disc %</th><th style={th}>Comm %</th><th style={th}>Uses / Max</th><th style={th}>Expiry</th><th style={th}>Status</th></tr></thead>
                <tbody>
                  {codes.map((c) => {
                    const ag = profiles.find((p) => p.id === c.agent_id);
                    return (
                      <tr key={c.id}>
                        <td style={{ ...td, fontWeight: 700 }}>{c.code}</td>
                        <td style={td}>{ag ? ag.email : "—"}</td>
                        <td style={td}><input style={{ ...sel, width: 70 }} type="number" defaultValue={c.discount_percent} onBlur={(e) => Number(e.target.value) !== Number(c.discount_percent) && updateCode(c.id, { discount_percent: Number(e.target.value) || 0 })} /></td>
                        <td style={td}><input style={{ ...sel, width: 70 }} type="number" defaultValue={c.commission_percent} onBlur={(e) => Number(e.target.value) !== Number(c.commission_percent) && updateCode(c.id, { commission_percent: Number(e.target.value) || 0 })} /></td>
                        <td style={td}>{c.uses} / <input style={{ ...sel, width: 64 }} type="number" placeholder="∞" defaultValue={c.max_uses ?? ""} onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== (c.max_uses ?? null)) updateCode(c.id, { max_uses: v }); }} /></td>
                        <td style={td}><input style={{ ...sel, width: 140 }} type="date" defaultValue={c.expires_at ? c.expires_at.slice(0, 10) : ""} onBlur={(e) => { const v = e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null; if ((v ? v.slice(0, 10) : null) !== (c.expires_at ? c.expires_at.slice(0, 10) : null)) updateCode(c.id, { expires_at: v }); }} /></td>
                        <td style={td}><button onClick={() => toggleCode(c.id, !c.active)} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: c.active ? "#E9F7EE" : "#F2F2F2", color: c.active ? T.green : "#8A968E" }}>{c.active ? "Active" : "Inactive"}</button></td>
                      </tr>
                    );
                  })}
                  {codes.length === 0 && <tr><td style={td} colSpan={7}>No promo code yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "bookings" && (
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
                {[["all", "All"], ["direct", "Direct"], ["agent", "Agent"], ["corporate", "Corporate"]].map(([k, l]) => (
                  <button key={k} onClick={() => setBookingFilter(k)} style={{ border: "none", cursor: "pointer", background: bookingFilter === k ? T.green : "#F7F7F7", color: bookingFilter === k ? "#fff" : "#1A1A1A", borderRadius: 999, padding: "6px 14px", fontWeight: 600, fontSize: 12.5 }}>{l}{k !== "all" ? ` · ${bookings.filter((b) => channelOf(b.data) === k).length}` : ` · ${bookings.length}`}</button>
                ))}
                <button onClick={() => setOnlyRequests((v) => !v)} style={{ border: "none", cursor: "pointer", marginLeft: "auto", background: onlyRequests ? "#B3261E" : (requestCount ? "#FBECEC" : "#F7F7F7"), color: onlyRequests ? "#fff" : (requestCount ? "#B3261E" : "#8A968E"), borderRadius: 999, padding: "6px 14px", fontWeight: 700, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}><Info size={14} /> Action needed · {requestCount}</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead><tr><th style={th}>Item</th><th style={th}>Customer</th><th style={th}>Channel</th><th style={th}>Plan</th><th style={th}>Total</th><th style={th}>Status</th><th style={th}>Manage</th><th style={th}>Date</th></tr></thead>
                <tbody>
                  {shownBookings.map((b) => {
                    const d = b.data || {};
                    const ch = channelOf(d);
                    return (
                      <tr key={b.id}>
                        <td style={td}><div style={{ fontWeight: 600 }}>{d.tour?.name || "—"}</div>{d.promo?.code && <div style={{ fontSize: 11.5, color: T.green }}>code {d.promo.code}</div>}{d.corp?.orgName && <div style={{ fontSize: 11.5, color: T.indigo }}>{d.corp.orgName}</div>}</td>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{custOf(b)}</div>
                          {(() => {
                            const phone = waDigits(d.contact?.phone);
                            if (!phone) return <div style={{ fontSize: 11, color: "#8A968E" }}>No phone</div>;
                            const c = waMap[phone];
                            const mine = c && c.last_admin_id === user.id;
                            return (
                              <div style={{ marginTop: 5 }}>
                                <button onClick={() => openWhatsApp(b)} title={`WhatsApp ${d.contact.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${c ? "#E0C36B" : "#25D366"}`, background: c ? "#FFF8E6" : "#EAFBF0", color: c ? "#8a6d1a" : "#128C4B", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                  <MessageCircle size={13} /> {c ? "Message again" : "WhatsApp"}
                                </button>
                                {c && (
                                  <div style={{ fontSize: 10.5, marginTop: 3, color: mine ? T.green : "#B3261E", fontWeight: 600, lineHeight: 1.4 }}>
                                    {mine ? "You contacted" : `Contacted by ${shortEmail(c.last_admin_email)}`} · {new Date(c.last_at).toLocaleDateString()}{c.count > 1 ? ` · ${c.count}×` : ""}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={td}><span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "capitalize", color: ch === "agent" ? T.green : ch === "corporate" ? T.indigo : "#8A968E" }}>{ch}</span></td>
                        <td style={td}>{planLabel(d.plan)}</td>
                        <td style={td}>{(() => {
                          if (d.plan === "quote" || d.plan === "itinerary") return "—";
                          if (d.plan === "deposit") {
                            const ts = tontineState({ ...d, _status: b.status });
                            return ts.settled
                              ? <span style={{ color: T.green, fontWeight: 700 }}>100%</span>
                              : <span>{ts.payCount}/{ts.plannedTotal} <span style={{ opacity: 0.55, fontWeight: 500 }}>· {fmtXOF(d.total)}</span></span>;
                          }
                          return fmtXOF(d.total);
                        })()}</td>
                        <td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: statusColor(b.status) }}>● {statusLabel[b.status] || b.status}</span></td>
                        <td style={td}>
                          {b.status === "modification_requested" ? (
                            <div style={{ minWidth: 210 }}>
                              <div style={{ fontSize: 11.5, color: "rgba(0,0,0,.75)", marginBottom: 6, lineHeight: 1.5 }}>
                                Requested:{d.pendingChange?.date ? ` ${d.pendingChange.date}` : ""}{d.pendingChange?.adults != null ? ` · ${d.pendingChange.adults}${d.pendingChange.children ? `+${d.pendingChange.children}ch` : ""} pax` : ""}{d.pendingChange?.note ? ` · “${d.pendingChange.note}”` : ""}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button onClick={() => approveChange(b)} style={{ border: "none", background: T.green, color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                                <button onClick={() => rejectChange(b)} style={{ border: "1px solid #B3261E", background: "#fff", color: "#B3261E", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reject</button>
                              </div>
                            </div>
                          ) : b.status === "cancellation_requested" ? (
                            <div style={{ minWidth: 210 }}>
                              <div style={{ fontSize: 11.5, color: "#B3261E", marginBottom: 6, lineHeight: 1.5 }}>
                                Refund due: <strong>{fmtXOF(d.refund?.refundAmount || 0)}</strong> ({d.refund?.retainedPct}% retained on {fmtXOF(d.refund?.amountPaid || 0)})
                              </div>
                              <button onClick={() => confirmRefund(b)} style={{ border: "none", background: "#B3261E", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirm refund → cancel</button>
                            </div>
                          ) : (
                            <select style={{ ...sel, width: 150 }} value={b.status} onChange={(e) => setBookingStatus(b, e.target.value)}>
                              {[...new Set([...BOOKING_STATUSES, b.status])].map((s) => <option key={s} value={s}>{statusLabel[s] || s}</option>)}
                            </select>
                          )}
                        </td>
                        <td style={td}>{new Date(b.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                  {shownBookings.length === 0 && <tr><td style={td} colSpan={8}>No booking in this view.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "commissions" && (
            <div style={{ padding: 16 }}>
              {(() => {
                const num = (x) => Number(x || 0);
                const sum = (st) => comms.filter((c) => c.status === st).reduce((s, c) => s + num(c.amount), 0);
                return (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    {[["Pending", sum("pending")], ["Approved", sum("approved")], ["Paid", sum("paid")]].map(([l, v]) => (
                      <div key={l} style={{ background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 12, padding: "10px 16px" }}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#8A968E", fontWeight: 700 }}>{l}</div><div className="disp" style={{ fontWeight: 800, fontSize: 18 }}>{fmtXOF(v)}</div></div>
                    ))}
                  </div>
                );
              })()}
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={th}>Agent</th><th style={th}>Code</th><th style={th}>Amount</th><th style={th}>Order</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead>
                <tbody>
                  {comms.map((c) => (
                    <tr key={c.id}>
                      <td style={td}>{emailOf(c.agent_id)}</td>
                      <td style={td}>{c.code || "—"}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmtXOF(c.amount)}</td>
                      <td style={td}>{fmtXOF(c.order_amount)} · {c.commission_percent}%</td>
                      <td style={td}><span style={{ fontSize: 12, fontWeight: 700, textTransform: "capitalize", color: commStatusColor[c.status] || "#8A968E" }}>● {c.status}</span></td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {c.status === "pending" && <button onClick={() => setCommStatus(c.id, "approved")} style={{ border: `1px solid ${T.indigo}`, background: "#fff", color: T.indigo, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Approve</button>}
                          {(c.status === "pending" || c.status === "approved") && <button onClick={() => setCommStatus(c.id, "paid")} style={{ border: "none", background: T.green, color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mark paid</button>}
                          {c.status !== "paid" && c.status !== "cancelled" && <button onClick={() => setCommStatus(c.id, "cancelled")} style={{ border: "1px solid #B3261E", background: "#fff", color: "#B3261E", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {comms.length === 0 && <tr><td style={td} colSpan={6}>No commission yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "analytics" && (() => {
            const num = (x) => Number(x || 0);
            const isSale = (d) => d && d.plan !== "quote" && d.plan !== "itinerary";
            const paid = bookings.filter((b) => isSale(b.data) && ["paid", "confirmed", "settled"].includes(b.status));
            const revenue = paid.reduce((s, b) => s + num(b.data?.total), 0);
            const channels = ["direct", "agent", "corporate"];
            const byChannel = channels.map((ch) => {
              const list = paid.filter((b) => channelOf(b.data) === ch);
              return { ch, count: list.length, rev: list.reduce((s, b) => s + num(b.data?.total), 0) };
            });
            const maxRev = Math.max(1, ...byChannel.map((x) => x.rev));
            // top agents by commission earned
            const agg = {};
            comms.forEach((c) => { agg[c.agent_id] = (agg[c.agent_id] || 0) + num(c.amount); });
            const topAgents = Object.entries(agg).map(([id, v]) => ({ email: emailOf(id), v })).sort((a, b) => b.v - a.v).slice(0, 5);
            // last 6 months booking counts
            const now = new Date();
            const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1); return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }), count: 0 }; });
            bookings.forEach((b) => { const d = new Date(b.created_at); const k = `${d.getFullYear()}-${d.getMonth()}`; const m = months.find((x) => x.key === k); if (m) m.count++; });
            const maxM = Math.max(1, ...months.map((m) => m.count));
            const chColor = { direct: "#8A968E", agent: T.green, corporate: T.indigo };
            const statCard = { background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 150 };
            return (
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                  {[["Confirmed revenue", fmtXOF(revenue)], ["Confirmed bookings", String(paid.length)], ["Total bookings", String(bookings.length)], ["Commissions owed", fmtXOF(comms.filter((c) => c.status !== "paid" && c.status !== "cancelled").reduce((s, c) => s + num(c.amount), 0))]].map(([l, v]) => (
                    <div key={l} style={statCard}><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#8A968E", fontWeight: 700 }}>{l}</div><div className="disp" style={{ fontWeight: 800, fontSize: 20, marginTop: 4 }}>{v}</div></div>
                  ))}
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: T.green, margin: "0 0 10px" }}>Revenue by channel</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {byChannel.map((x) => (
                    <div key={x.ch} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 84, fontSize: 13, textTransform: "capitalize", color: "rgba(0,0,0,.8)" }}>{x.ch}</span>
                      <div style={{ flex: 1, background: "#F2F2F2", borderRadius: 999, height: 22, overflow: "hidden" }}><div style={{ width: `${Math.round((x.rev / maxRev) * 100)}%`, height: "100%", background: chColor[x.ch], borderRadius: 999, minWidth: x.rev > 0 ? 4 : 0 }} /></div>
                      <span style={{ width: 120, textAlign: "right", fontSize: 13, fontWeight: 700 }}>{fmtXOF(x.rev)}</span>
                      <span style={{ width: 60, textAlign: "right", fontSize: 12, opacity: 0.6 }}>{x.count} bkg</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: T.green, margin: "0 0 10px" }}>Top agents (commission)</h4>
                    {topAgents.length === 0 ? <div style={{ fontSize: 13, opacity: 0.6 }}>No commission yet.</div> : topAgents.map((a, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                        <span style={{ fontWeight: 800, color: "#8A968E", width: 18 }}>{i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</span>
                        <strong style={{ fontSize: 13 }}>{fmtXOF(a.v)}</strong>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: T.green, margin: "0 0 10px" }}>Bookings — last 6 months</h4>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                      {months.map((m) => (
                        <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 700 }}>{m.count}</div>
                          <div style={{ width: "100%", background: T.green, borderRadius: "6px 6px 0 0", height: `${Math.round((m.count / maxM) * 90)}%`, minHeight: m.count > 0 ? 4 : 0 }} />
                          <div style={{ fontSize: 11, opacity: 0.6 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {tab === "activity" && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12.5, color: "#6B7A72", marginBottom: 12 }}>
                {isSuper ? "Full activity log — every admin action, including super-admin." : "Actions by admins. Super-admin activity is not shown here."}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={th}>When</th><th style={th}>Admin</th><th style={th}>Action</th><th style={th}>Target</th></tr></thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleString()}</td>
                      <td style={td}>{a.actor_email}{a.actor_role === "super_admin" && <span style={{ fontSize: 10.5, color: T.indigo, fontWeight: 700, marginLeft: 5 }}>SUPER</span>}</td>
                      <td style={td}>{actionLabel(a.action)}</td>
                      <td style={td}><strong>{a.target_label || "—"}</strong>{a.details && a.action === "profile.update" && a.details.role_from !== a.details.role_to && <span style={{ fontSize: 12, opacity: 0.6 }}> · {a.details.role_from} → {a.details.role_to}</span>}</td>
                    </tr>
                  ))}
                  {activity.length === 0 && <tr><td style={td} colSpan={4}>No activity recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Wrap>
  );
}

// ---------------- ABOUT ----------------
function AboutDeco({ k, style }) {
  // k is a base name without extension (e.g. "deco-passport"); tries common formats.
  const EXTS = ["svg", "png", "jpg", "jpeg", "webp"];
  const [idx, setIdx] = useState(0);
  if (idx >= EXTS.length) return null;
  const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`site/${k}.${EXTS[idx]}`).data.publicUrl;
  return <img src={url} onError={() => setIdx((i) => i + 1)} alt="" aria-hidden="true" className="about-deco" style={{ position: "absolute", pointerEvents: "none", zIndex: 2, ...style }} />;
}

function AboutIntro() {
  const img1 = useCoverUrl("city");
  const img2 = useCoverUrl("goree");
  const img3 = useCoverUrl("boat");
  const features = [
    [Compass, "Local Ground Expertise", "A Senegalese-owned DMC with teams on the ground across the country."],
    [Shield, "Safety First Always", "Vetted guides, reliable transport and support throughout your trip."],
    [Users, "Professional Guides", "Passionate, multilingual guides who reveal the real, majestic Senegal."],
  ];
  const box = (url, cls) => (
    <div className={cls} style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 20px 46px rgba(11,46,27,.15)", background: url ? `url("${url}") center/cover no-repeat` : `linear-gradient(150deg, ${T.green}, ${T.indigo})` }} />
  );
  return (
    <div style={{ background: "#fff" }}>
      <style>{`
        .about-wrap{position:relative;max-width:1060px;margin:0 auto}
        .about-grid{display:grid;grid-template-columns:0.92fr 1fr;gap:44px;align-items:center}
        .about-collage{position:relative;height:480px}
        .about-collage .c1{position:absolute;top:0;left:0;width:52%;height:64%;z-index:1}
        .about-collage .c2{position:absolute;top:19%;right:0;width:54%;height:62%;border:6px solid #fff;z-index:3}
        .about-collage .c3{position:absolute;bottom:0;left:2%;width:50%;height:32%;border:6px solid #fff;z-index:2}
        .about-script{font-family:'Caveat',cursive}
        @media(max-width:960px){
          .about-grid{grid-template-columns:1fr;gap:30px}
          .about-collage{height:auto;display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .about-collage .c1,.about-collage .c2,.about-collage .c3{position:static;width:auto;height:180px;border:none}
          .about-collage .c1{grid-column:1 / 2}
          .about-collage .c2{grid-column:2 / 3}
          .about-collage .c3{grid-column:1 / 3;height:160px}
          .about-deco{display:none !important}
        }
      `}</style>
      <Wrap style={{ padding: "64px 20px" }}>
        <div className="about-wrap">
          {/* Decorative icons around the block (upload to site/… to enable) */}
          <AboutDeco k="deco-passport" style={{ top: -22, left: -48, width: 72, transform: "rotate(-8deg)" }} />
          <AboutDeco k="deco-buoy" style={{ left: -70, top: "64%", width: 58 }} />
          <AboutDeco k="deco-hat" style={{ right: -66, top: 120, width: 64 }} />
          <AboutDeco k="deco-compass" style={{ right: -82, top: "58%", width: 66 }} />
          <AboutDeco k="deco-bus" style={{ right: -60, bottom: -22, width: 132 }} />
          <div className="about-grid">
            <div className="about-collage">
              {box(img1, "c1")}
              {box(img2, "c2")}
              {box(img3, "c3")}
            </div>
            <div>
              <div className="about-script" style={{ fontSize: 32, fontWeight: 600, color: T.green, marginBottom: 2, lineHeight: 1 }}>Welcome to ATS</div>
              <h1 className="disp" style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", color: T.ink, margin: "0 0 20px" }}>About Africa Tourism Solutions</h1>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(0,0,0,.8)", margin: "0 0 30px" }}>
                Founded by two young Senegalese entrepreneurs, ATS is the expression of an Africa revalued — historically, touristically and culturally. We exist to break the stereotype of a continent defined by poverty and danger, with a rich, authentic offer that shows its true, majestic beauty.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {features.map(([Ico, title, desc]) => (
                  <div key={title} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span style={{ width: 50, height: 50, flexShrink: 0, borderRadius: "50%", background: "rgba(0,146,69,.10)", color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico size={21} strokeWidth={2} /></span>
                    <div>
                      <div className="disp" style={{ fontWeight: 700, fontSize: 17, color: T.ink }}>{title}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(0,0,0,.8)", marginTop: 3 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <a href="https://wa.me/221774807878?text=Bonjour%20ATS%2C%20j'aimerais%20plus%20d'informations." target="_blank" rel="noopener noreferrer" style={{ marginTop: 30, display: "inline-flex", alignItems: "center", gap: 12, background: T.ink, color: "#fff", borderRadius: 999, padding: "15px 32px", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Contact With Us <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </div>
      </Wrap>
    </div>
  );
}

function CeoWord() {
  const [ok, setOk] = useState(true);
  const ceoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/team/alioune-mboup.webp").data.publicUrl;
  const paras = [
    "Africa Tourism Solutions is a tourism and events agency. Through inclusive, innovative solutions, we set out to give both locals and visitors a truly unique experience on African soil.",
    "Founded by two young Senegalese entrepreneurs, ATS is the expression of an Africa revalued — historically, touristically and culturally. At the heart of our team are young professionals passionate about the development of Africa.",
    "To overcome the perception of a continent defined by poverty and danger, we are committed to breaking that stereotype with a rich, authentic offer of services.",
    "Through our work, we hope to inspire African youth to discover the grand, majestic beauty of the continent — because educating this generation is essential to preserving our culture and heritage.",
  ];
  return (
    <div style={{ background: "#fff" }}>
      <style>{`
        .ceo-grid{display:grid;grid-template-columns:0.82fr 1fr;gap:44px;align-items:stretch;max-width:1060px;margin:0 auto}
        .ceo-photo{position:relative;border-radius:22px;overflow:hidden;min-height:520px;background:linear-gradient(140deg,#0B2E1B,#123A26);box-shadow:0 26px 60px rgba(11,46,27,.20)}
        @media(max-width:860px){
          .ceo-grid{grid-template-columns:1fr;gap:26px}
          .ceo-photo{min-height:420px}
        }
      `}</style>
      <Wrap style={{ padding: "8px 20px 56px" }}>
        <div className="ceo-grid">
          <div className="ceo-photo">
            {ok && <img src={ceoUrl} alt="Alioune Mboup — CEO & Co-founder" onError={() => setOk(false)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6,20,13,.82) 0%, rgba(6,20,13,.20) 42%, rgba(6,20,13,0) 66%)" }} />
            <div style={{ position: "absolute", left: 26, right: 26, bottom: 24 }}>
              <div className="disp" style={{ color: "#fff", fontWeight: 800, fontSize: 26, letterSpacing: "-0.01em" }}>Alioune Mboup</div>
              <div style={{ color: T.gold, fontWeight: 700, fontSize: 12.5, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 4 }}>CEO &amp; Co-founder</div>
            </div>
          </div>
          <div>
            <div className="about-script" style={{ fontSize: 30, fontWeight: 600, color: T.green, lineHeight: 1 }}>A word from</div>
            <h2 className="disp" style={{ fontSize: "clamp(26px,3.4vw,38px)", fontWeight: 800, letterSpacing: "-0.02em", color: T.ink, margin: "2px 0 14px" }}>Our Director</h2>
            <div style={{ width: 54, height: 4, borderRadius: 4, background: T.gold, marginBottom: 22 }} />
            <div style={{ position: "relative" }}>
              <span className="disp" aria-hidden="true" style={{ position: "absolute", top: -26, left: -8, fontSize: 88, lineHeight: 1, color: "rgba(0,146,69,.12)", fontWeight: 800 }}>&ldquo;</span>
              {paras.map((p, idx) => (
                <p key={idx} style={{ fontSize: 15.5, lineHeight: 1.75, color: "rgba(0,0,0,.8)", margin: idx === 0 ? "0 0 14px" : "0 0 14px" }}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </Wrap>
    </div>
  );
}

function TeamStrip() {
  const N = TEAM.length;
  const COPIES = 5;
  const LIST = [].concat(...Array.from({ length: COPIES }, () => TEAM));
  const CARD = 210;
  const [idx, setIdx] = useState(2 * N); // start on the middle copy (Aminata)
  const [paused, setPaused] = useState(false);
  const wrapRef = useRef(null);
  const cardRefs = useRef([]);
  const instantRef = useRef(true);
  const normTimer = useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const center = (i, smooth) => {
    const c = wrapRef.current, card = cardRefs.current[i];
    if (!c || !card) return;
    c.scrollTo({ left: card.offsetLeft - (c.clientWidth - CARD) / 2, behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => {
    if (paused || reduce) return;
    const id = setInterval(() => setIdx((v) => v + 1), 2600);
    return () => clearInterval(id);
  }, [paused, reduce]);
  useEffect(() => {
    const smooth = !instantRef.current;
    instantRef.current = false;
    center(idx, smooth);
    if (normTimer.current) clearTimeout(normTimer.current);
    if (idx < 2 * N || idx >= 3 * N) {
      normTimer.current = setTimeout(() => {
        instantRef.current = true;
        setIdx((v) => { let w = v; while (w < 2 * N) w += N; while (w >= 3 * N) w -= N; return w; });
      }, smooth ? 540 : 0);
    }
    return () => {};
  }, [idx, N]);
  const go = (dir) => setIdx((v) => v + dir);
  const arrow = (side) => ({ position: "absolute", top: "50%", [side]: 6, transform: "translateY(-50%)", zIndex: 5, width: 42, height: 42, borderRadius: "50%", border: "1px solid rgba(11,46,27,.10)", background: "rgba(255,255,255,.82)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: T.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(11,46,27,.16)", transition: "background .2s ease, transform .2s ease" });
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`.team-strip::-webkit-scrollbar{display:none}.team-arrow:hover{background:#fff !important}`}</style>
      <button aria-label="Previous" className="team-arrow" onClick={() => go(-1)} style={arrow("left")}><ChevronLeft size={20} /></button>
      <button aria-label="Next" className="team-arrow" onClick={() => go(1)} style={arrow("right")}><ChevronRight size={20} /></button>
      <div ref={wrapRef} className="team-strip"
        style={{ display: "flex", alignItems: "center", gap: 22, overflowX: "auto", padding: "48px 0 64px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {LIST.map(([n, r, slug], i) => {
          const on = i === idx;
          return (
            <button key={i} ref={(el) => (cardRefs.current[i] = el)} onClick={() => setIdx(i)} aria-label={`${n} — ${r}`}
              style={{ position: "relative", flex: "0 0 auto", width: CARD, borderRadius: 18, overflow: "hidden", padding: 0, border: "none", cursor: "pointer", background: "#EFF3EF",
                opacity: on ? 1 : 0.9, transform: on ? "scale(1.14)" : "scale(1)", transformOrigin: "center center", zIndex: on ? 2 : 1,
                boxShadow: on ? "0 14px 34px rgba(11,46,27,.20)" : "0 6px 16px rgba(0,0,0,.08)", transition: "transform .5s ease, opacity .5s ease, box-shadow .5s ease" }}>
              <TeamPhoto slug={slug} name={n} ratio="4 / 5" />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6,20,13,.86) 0%, rgba(6,20,13,.28) 34%, rgba(6,20,13,0) 55%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: 14, right: 14, bottom: 14, textAlign: "left", pointerEvents: "none" }}>
                <div className="disp" style={{ color: "#fff", fontWeight: 800, fontSize: 15.5, lineHeight: 1.15 }}>{n}</div>
                <div style={{ color: on ? T.gold : "rgba(255,255,255,.85)", fontWeight: 600, fontSize: 11.5, letterSpacing: ".06em", marginTop: 3, transition: "color .4s ease" }}>{r}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const REVIEW_FALLBACK = [
  { author: "Pauline Edima-Tenwo", role: "DG de Global Business Group", rating: 5, text: "Personnellement, j'ai été très satisfaite par les prestations d'ATS que j'utilisais pour la première fois (disponibilités, excellent rapport qualité prix, ponctualité, flexibilité) : je recommande sans hésiter." },
  { author: "Mme Dia", role: "Cliente", rating: 5, text: "J'ai eu la chance de vivre une excursion magique dans le désert de Lompoul avec l'équipe ATS, et c'était tout simplement exceptionnel ! La ponctualité, la logistique fluide et l'excellent rapport qualité-prix méritent d'être salués." },
  { author: "Maureen Rosita", role: "Cliente", rating: 5, text: "Depuis que je suis arrivée au Sénégal, je rêvais de découvrir l'intérieur du pays. ATS m'a donné cette opportunité, et surtout à des tarifs vraiment abordables." },
];

function GMark({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9h-7.3v5.7C10.7 41.1 16.9 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 10l7.3-5.7z"/><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 16.9 2 10.7 6.9 7.9 14l7.3 5.7c1.7-5.2 6.5-9 12.8-9z"/></svg>;
}

function ReviewsSlider({ reviews, usingGoogle }) {
  const N = reviews.length;
  const COPIES = 5;
  const LIST = [].concat(...Array.from({ length: COPIES }, () => reviews));
  const [idx, setIdx] = useState(2 * N);
  const [paused, setPaused] = useState(false);
  const wrapRef = useRef(null);
  const cardRefs = useRef([]);
  const instantRef = useRef(true);
  const normTimer = useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const center = (i, smooth) => {
    const c = wrapRef.current, card = cardRefs.current[i];
    if (!c || !card) return;
    c.scrollTo({ left: card.offsetLeft - (c.clientWidth - card.clientWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => {
    if (paused || reduce || N < 2) return;
    const id = setInterval(() => setIdx((v) => v + 1), 5000);
    return () => clearInterval(id);
  }, [paused, reduce, N]);
  useEffect(() => {
    const smooth = !instantRef.current; instantRef.current = false;
    center(idx, smooth);
    if (normTimer.current) clearTimeout(normTimer.current);
    if (idx < 2 * N || idx >= 3 * N) {
      normTimer.current = setTimeout(() => {
        instantRef.current = true;
        setIdx((v) => { let w = v; while (w < 2 * N) w += N; while (w >= 3 * N) w -= N; return w; });
      }, smooth ? 560 : 0);
    }
  }, [idx, N]);
  const activeDot = ((idx % N) + N) % N;
  const toDot = (d) => setIdx((v) => v + (d - (((v % N) + N) % N)));
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`.rev-strip::-webkit-scrollbar{display:none}.rev-text{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}`}</style>
      <div ref={wrapRef} className="rev-strip" style={{ display: "flex", alignItems: "center", gap: 26, overflowX: "auto", padding: "26px 0 40px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {LIST.map((r, i) => {
          const on = i === idx;
          return (
            <article key={i} ref={(el) => (cardRefs.current[i] = el)} onClick={() => !on && setIdx(i)}
              style={{ position: "relative", flex: "0 0 auto", width: "min(600px, 86vw)", background: on ? "#fff" : "#F1F6F3", borderRadius: 20, padding: "26px 28px 30px",
                boxShadow: on ? "0 26px 60px rgba(11,46,27,.16)" : "none", opacity: on ? 1 : 0.55, transform: on ? "scale(1)" : "scale(.9)", transformOrigin: "center center",
                transition: "opacity .5s ease, transform .5s ease, box-shadow .5s ease", cursor: on ? "default" : "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {r.photo
                  ? <img src={r.photo} alt="" referrerPolicy="no-referrer" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: T.paperDark, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 19 }}>{(r.author || "?").trim().charAt(0).toUpperCase()}</div>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="disp" style={{ fontWeight: 800, fontSize: 18, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.author}</div>
                  <div style={{ fontSize: 13, color: "rgba(0,0,0,.8)" }}>{r.when || r.role || "Voyageur"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Stars size={16} n={Math.round(r.rating || 5)} />
                  {usingGoogle && <GMark size={16} />}
                </div>
              </div>
              <p className="rev-text" style={{ margin: "16px 0 0", fontSize: 15.5, lineHeight: 1.7, color: "rgba(0,0,0,.8)" }}>&ldquo;{r.text}&rdquo;</p>
              {on && (
                <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: -22, transform: "translateX(-50%)", width: 46, height: 46, borderRadius: "50%", background: T.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(0,146,69,.4)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 5C6.5 5 4 7.5 4 10.5V19h7v-8H7.2c0-1.8 1-3 2.3-3V5zm9 0c-3 0-5.5 2.5-5.5 5.5V19h7v-8h-3.8c0-1.8 1-3 2.3-3V5z"/></svg>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {N > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 9, marginTop: 6 }}>
          {reviews.map((_, d) => (
            <button key={d} aria-label={`Avis ${d + 1}`} onClick={() => toDot(d)}
              style={{ width: d === activeDot ? 22 : 9, height: 9, borderRadius: 999, border: "none", cursor: "pointer", padding: 0, background: d === activeDot ? T.green : "rgba(11,46,27,.18)", transition: "width .3s ease, background .3s ease" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartnerLogo({ k, onState }) {
  const EXTS = ["svg", "png", "jpg", "jpeg", "webp"];
  const [i, setI] = useState(0);
  if (i >= EXTS.length) return null;
  const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`site/partners/${k}.${EXTS[i]}`).data.publicUrl;
  return <img src={url} alt="Partenaire ATS" onLoad={() => onState(k, true)} onError={() => { if (i + 1 >= EXTS.length) onState(k, false); setI((x) => x + 1); }}
    style={{ height: 42, width: "auto", maxWidth: 150, objectFit: "contain", filter: "grayscale(1)", opacity: 0.65, transition: "opacity .2s, filter .2s" }}
    onMouseEnter={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.opacity = "1"; }}
    onMouseLeave={(e) => { e.currentTarget.style.filter = "grayscale(1)"; e.currentTarget.style.opacity = "0.65"; }} />;
}

function Partners() {
  const KEYS = Array.from({ length: 10 }, (_, i) => `partner-${i + 1}`);
  const [oks, setOks] = useState({});
  const onState = (k, v) => setOks((o) => (o[k] === v ? o : { ...o, [k]: v }));
  const any = Object.values(oks).some(Boolean);
  return (
    <div style={{ marginTop: 46, display: any ? "block" : "none" }}>
      <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(0,0,0,.8)", marginBottom: 18 }}>Ils nous font confiance</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "24px 40px" }}>
        {KEYS.map((k) => <PartnerLogo key={k} k={k} onState={onState} />)}
      </div>
    </div>
  );
}

function GoogleReviews() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.functions.invoke("google-reviews").then(({ data, error }) => {
      if (!alive || error || !data || !data.reviews || !data.reviews.length) return;
      setData(data);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const usingGoogle = !!(data && data.reviews && data.reviews.length);
  const reviews = usingGoogle ? data.reviews : REVIEW_FALLBACK;
  const writeUrl = data?.writeReviewUrl || "https://search.google.com/local/writereview?placeid=ChIJXwRg7DBzwQ4Rn9doWBHa8sc";
  const mapsUrl = data?.mapsUri || "https://maps.google.com/?cid=14407817925944203167";
  return (
    <div style={{ marginTop: 48 }}>
      <div className="about-script" style={{ textAlign: "center", fontSize: 30, fontWeight: 600, color: T.green, lineHeight: 1 }}>Testimonial</div>
      <h2 className="disp" style={{ textAlign: "center", fontWeight: 800, fontSize: "clamp(26px,3.6vw,38px)", letterSpacing: "-0.02em", color: T.ink, margin: "2px 0 6px" }}>What Clients Say About Us</h2>
      {usingGoogle && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(0,0,0,.8)" }}>
          <GMark size={16} /><span style={{ fontWeight: 800, color: T.ink }}>{data.rating}</span>
          <Stars size={15} n={Math.round(data.rating)} /><span style={{ opacity: 0.7 }}>· {data.count} avis Google</span>
        </div>
      )}
      <ReviewsSlider key={reviews.length + (usingGoogle ? "g" : "f")} reviews={reviews} usingGoogle={usingGoogle} />
      <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: T.ink, border: `1.5px solid ${T.line}`, borderRadius: 999, padding: "10px 18px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}><GMark size={16} /> Voir sur Google</a>
        <a href={writeUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.green, color: "#fff", border: "none", borderRadius: 999, padding: "11px 20px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Laisser un avis <ArrowRight size={17} /></a>
      </div>
      <Partners />
    </div>
  );
}

function AboutPage({ notify }) {
  return (
    <>
      <AboutIntro />
      <CeoWord />
      <Wrap>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <h3 className="disp" style={{ fontWeight: 800, fontSize: 22, marginTop: 0, color: "#1A1A1A" }}>The ATS Group</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {[["ATS Travel", "Flights & ticketing"], ["ATS Events", "MICE & celebrations"], ["ATS Business", "Corporate & team building"], ["ATS Logistics", "Fleet & group movement"], ["ATS Evasion", "Leisure escapes"], ["ATS School", "Educational travel"]].map(([n, d]) => (
              <div key={n} style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{n}</div>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,.8)", marginTop: 2 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <h3 className="disp" style={{ fontWeight: 800, fontSize: 22, margin: "40px 0 6px", textAlign: "center" }}>Our team</h3>
        <p style={{ textAlign: "center", color: "rgba(0,0,0,.8)", fontSize: 14, margin: "0 0 4px" }}>The people who craft your journey on the ground.</p>
        <TeamStrip />

        <GoogleReviews />
      </Wrap>
    </>
  );
}

// ---------------- PAYMENT RESULT ----------------
function PaymentResult({ status, go, user, setSignin }) {
  const success = status === "success";
  return (
    <Wrap>
      <div style={{ maxWidth: 520, margin: "20px auto", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 20, padding: 32, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: success ? "#E9F7EE" : "#FDECEA", color: success ? T.green : "#B3261E" }}>
          {success ? <Check size={38} /> : <X size={38} />}
        </div>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
          {success ? "Payment received" : "Payment not completed"}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(0,0,0,.8)", margin: "0 0 22px" }}>
          {success
            ? "Thank you! Your payment was received and your booking is being confirmed. You'll find it in your account with its receipt shortly."
            : "Your payment was cancelled or did not go through. No charge was made — your booking is still pending, you can try paying again from your account."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {user
            ? <button style={{ ...btnGold, width: "100%", borderRadius: 12 }} onClick={() => go("account")}>View my bookings</button>
            : <button style={{ ...btnGold, width: "100%", borderRadius: 12 }} onClick={() => setSignin(true)}>Sign in to see my booking</button>}
          {!success && <button style={{ width: "100%", background: "#fff", color: T.green, border: `1.5px solid ${T.green}`, borderRadius: 12, padding: "11px 14px", fontWeight: 700, cursor: "pointer", fontSize: 14 }} onClick={() => go("tours")}>Browse tours</button>}
          <button style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600, color: T.ink, opacity: 0.65, fontSize: 14 }} onClick={() => go("home")}>Back to home</button>
        </div>
        {success && <div style={{ fontSize: 12, opacity: 0.55, marginTop: 16 }}>Final confirmation is validated automatically once PayDunya notifies our system.</div>}
      </div>
    </Wrap>
  );
}

// ---------------- ACCOUNT ----------------
const planLabel = (p) => p === "deposit" ? "Ma Tontine Voyage" : p === "quote" ? "Quote requested" : p === "itinerary" ? "Custom itinerary" : "Paid in full";
const planColor = (p) => p === "deposit" ? T.laterite : p === "quote" ? T.indigo : p === "itinerary" ? T.indigo : T.green;
const statusLabel = { pending: "In progress", confirmed: "Confirmed", paid: "Paid", cancelled: "Cancelled", settled: "Fully paid", completed: "Completed", invoiced: "Invoiced · due", modification_requested: "Change requested", cancellation_requested: "Cancellation requested" };
const statusColor = (s) => s === "cancelled" ? "#B3261E" : s === "cancellation_requested" ? "#B3261E" : s === "modification_requested" ? T.gold : s === "invoiced" ? T.indigo : s === "settled" || s === "confirmed" || s === "paid" || s === "completed" ? T.green : T.laterite;

// ---- ATS cancellation policy (mirror of the server; used for on-screen previews only) ----
const retainedPctFor = (days) => days == null ? 10 : days < 3 ? 100 : days < 7 ? 50 : days < 10 ? 30 : 10;
const MODIFY_MIN_DAYS = 7;
const bookingDaysToDeparture = (b) => {
  const ds = b?.dateFrom || b?.date || b?.transfer?.date;
  if (!ds || !/^\d{4}-\d{2}-\d{2}/.test(String(ds))) return null;
  const dep = new Date(String(ds).slice(0, 10) + "T00:00:00");
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.ceil((dep - today) / 86400000);
};
const isPaidStatus = (s) => s === "paid" || s === "confirmed" || s === "settled";
const bookingAmountPaid = (b) => {
  if (!isPaidStatus(b._status)) return 0;
  if (b.plan === "deposit") return Number(b.paidAmount ?? b.deposit ?? 0);
  return Number(b.paidAmount ?? b.total ?? 0);
};

function AccountPage({ user, bookings, favorites = [], toggleFavorite, setSignin, notify, signOut, patchBooking, cancelBooking, manageBooking, payInstallment, role, go }) {
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  if (!user) return (
    <Wrap>
      <H2>My account</H2>
      <p style={{ opacity: 0.8 }}>Sign in to view your bookings, quote requests, payment plans and travel documents.</p>
      <button style={btnGold} onClick={() => setSignin(true)}>Sign in</button>
    </Wrap>
  );
  const tabs = [["all", "All"], ["booking", "Bookings"], ["quote", "Quotes"], ["itinerary", "Itineraries"], ["favorites", "Favorites"]];
  const bucket = (b) => b.plan === "quote" ? "quote" : b.plan === "itinerary" ? "itinerary" : "booking";
  const list = bookings.filter((b) => filter === "all" || bucket(b) === filter);

  return (
    <Wrap>
      <Eyebrow>Customer portal</Eyebrow>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <H2>Welcome, {user.name}</H2>
        <button style={{ marginLeft: "auto", background: "none", border: `1.5px solid ${T.line}`, borderRadius: 999, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13.5, color: T.ink }} onClick={signOut}>Sign out</button>
      </div>
      <div style={{ fontSize: 13.5, opacity: 0.65, marginTop: -6, marginBottom: 16 }}>{user.email}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {role === "agent" && (
          <button style={{ ...btnGold, fontSize: 14, padding: "10px 18px" }} onClick={() => go("agent")}>Open agent portal →</button>
        )}
        {(role === "admin" || role === "super_admin") && (
          <button style={{ background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 999, fontWeight: 700, fontSize: 14, padding: "10px 18px", cursor: "pointer" }} onClick={() => go("admin")}>Open admin console →</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map(([k, l]) => {
          const n = k === "all" ? bookings.length : k === "favorites" ? favorites.length : bookings.filter((b) => bucket(b) === k).length;
          return <button key={k} onClick={() => setFilter(k)} style={{ border: "none", cursor: "pointer", background: filter === k ? T.green : "#fff", color: filter === k ? "#fff" : T.ink, borderRadius: 999, padding: "8px 16px", fontWeight: 600, fontSize: 13, boxShadow: `inset 0 0 0 1px ${T.line}` }}>{l} {n > 0 && `· ${n}`}</button>;
        })}
      </div>

      {filter === "favorites" ? (
        favorites.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>No favorites yet — tap the heart on any tour to save it here.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {favorites.map((id) => <FavoriteCard key={id} id={id} go={go} onRemove={() => toggleFavorite(id)} />)}
          </div>
        )
      ) : list.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>Nothing here yet — book a tour, request a quote or build a trip and it will appear in this space.</div>
      ) : list.map((b, i) => {
        const ts = b.plan === "deposit" ? tontineState(b) : null;
        return (
        <div key={b._id || i} className="card-hover" style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 20, marginBottom: 14, opacity: b._status === "cancelled" ? 0.6 : 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Thumb rec={b} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="disp" style={{ fontWeight: 800, fontSize: 17 }}>{b.tour.name}</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{b.adults} traveler{b.adults > 1 ? "s" : ""}{b.children ? ` · ${b.children} child` : ""}{b.date ? ` · ${b.date}` : ""}{b.plan === "quote" || b.plan === "itinerary" ? "" : ` · Total ${fmtXOF(b.total)}`}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...pill(planColor(b.plan)), fontSize: 12 }}>{planLabel(b.plan)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor(b._status), alignSelf: "center" }}>● {statusLabel[b._status] || "In progress"}</span>
          </div>

          {ts && b._status !== "cancelled" && (
            <div style={{ background: T.paperDark, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                <span>{ts.settled ? `Fully paid · ${ts.payCount}/${ts.payCount} payments` : `Ma Tontine · ${ts.payCount}/${ts.plannedTotal} payments (deposit incl.)`}</span>
                <span style={{ color: T.green }}>{ts.settled ? 100 : ts.pct}%</span>
              </div>
              <div style={{ height: 9, borderRadius: 999, background: "rgba(11,46,27,.12)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${ts.settled ? 100 : ts.pct}%`, background: `linear-gradient(90deg, ${T.green}, ${T.gold})`, borderRadius: 999, transition: "width .4s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                <span>Paid: {fmtXOF(ts.paidAmount)}</span>
                <span>Remaining: {fmtXOF(ts.remaining)}</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ ...btnGreen, fontSize: 13, padding: "8px 16px" }} onClick={() => setDetail(b)}>View details</button>
            {ts && b._status !== "cancelled" && !ts.settled && (
              <button style={{ background: "none", border: `1.5px solid ${T.line}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: T.ink, padding: "8px 16px", fontSize: 13 }}
                onClick={() => setPayTarget(b)}>Pay towards balance</button>
            )}
          </div>
        </div>
        );
      })}

      {detail && <BookingDetail rec={detail} onClose={() => setDetail(null)} notify={notify} patchBooking={patchBooking} cancelBooking={cancelBooking} manageBooking={manageBooking} user={user} onPay={(r) => setPayTarget(r)} />}
      {payTarget && <InstallmentModal rec={payTarget} onClose={() => setPayTarget(null)} onConfirm={(amt, pm) => { const r = payTarget; setPayTarget(null); payInstallment(r, amt, pm); }} />}
    </Wrap>
  );
}

// A saved tour card shown in the account "My favorites" grid.
function FavoriteCard({ id, go, onRemove }) {
  const t = TOURS.find((x) => x.id === id);
  const img = useCoverUrl(id);
  if (!t) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <button onClick={() => go("tour", { id })} aria-label={t.name}
        style={{ border: "none", padding: 0, cursor: "pointer", height: 118, display: "flex", alignItems: "center", justifyContent: "center", background: img ? `center/cover no-repeat url(${img})` : `linear-gradient(140deg, ${T.green}, ${T.indigo})` }}>
        {!img && <CatIcon tour={t} size={40} color="rgba(255,255,255,.9)" strokeWidth={1.4} />}
      </button>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{t.name}</div>
        <div style={{ fontSize: 12.5, opacity: 0.7 }}>{t.pole} · {fromPrice(t) ? fmtXOF(fromPrice(t)) : "on request"}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <button onClick={() => go("tour", { id })} style={{ ...btnGreen, fontSize: 12.5, padding: "7px 14px" }}>View</button>
          <button onClick={onRemove} aria-label="Remove from favorites" style={{ background: "none", border: `1.5px solid ${T.line}`, borderRadius: 10, cursor: "pointer", padding: "7px 10px", display: "flex", alignItems: "center" }}>
            <Heart size={15} fill="#C0392B" color="#C0392B" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Ma Tontine Voyage : client chooses how much to pay towards the balance ----
function InstallmentModal({ rec, onClose, onConfirm }) {
  const ts = tontineState(rec);
  const [amount, setAmount] = useState(String(ts.minNext));
  const [payMethod, setPayMethod] = useState("stripe"); // PayDunya temporarily disabled — Stripe only
  const val = Math.round(Number(amount) || 0);
  const valid = val >= ts.minNext && val <= ts.remaining;
  const paysOff = val >= ts.remaining - 1;
  const box = { background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 12, padding: "12px 14px" };
  return (
    <Overlay onClose={onClose}>
      <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, margin: "0 0 4px" }}>Pay towards your balance</h3>
      <div style={{ fontSize: 13.5, opacity: 0.7, marginBottom: 14 }}>{rec.tour?.name}</div>

      <div style={{ ...box, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}>
          <span style={{ opacity: 0.7 }}>Remaining balance</span><span style={{ fontWeight: 700 }}>{fmtXOF(ts.remaining)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}>
          <span style={{ opacity: 0.7 }}>Payments so far</span><span style={{ fontWeight: 700 }}>{ts.payCount}/{ts.plannedTotal}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}>
          <span style={{ opacity: 0.7 }}>Minimum this time</span><span style={{ fontWeight: 700 }}>{fmtXOF(ts.minNext)}</span>
        </div>
      </div>

      <label style={{ ...label, display: "block" }}>Amount to pay now (XOF)</label>
      <input type="number" value={amount} min={ts.minNext} max={ts.remaining} step="1000"
        onChange={(e) => setAmount(e.target.value)} style={{ ...input, marginBottom: 8 }} />
      <div style={{ fontSize: 12.5, opacity: 0.7, marginBottom: 4 }}>
        Between {fmtXOF(ts.minNext)} and {fmtXOF(ts.remaining)}. Pay more to clear your trip faster{paysOff && valid ? " — this payment settles the booking in full." : "."}
      </div>
      {!valid && (
        <div style={{ fontSize: 12.5, color: "#B3261E", marginBottom: 6 }}>
          Enter an amount from {fmtXOF(ts.minNext)} to {fmtXOF(ts.remaining)}.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "#fff", color: T.ink, border: `2px solid ${T.green}`, borderRadius: 10, padding: "11px 8px", marginTop: 14, boxShadow: "0 0 0 3px rgba(0,146,69,.12)" }}>
        <img src={PAY_LOGOS.stripe} alt="Stripe" style={{ height: 18, maxWidth: "60%", objectFit: "contain" }} />
        <span style={{ fontWeight: 700, fontSize: 12 }}>International card <span style={{ fontWeight: 500, opacity: 0.7 }}>· Visa / Mastercard · USD</span></span>
      </div>
      {valid && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Charged in USD: <strong>${(val / 590).toFixed(2)}</strong> (1 USD = 590 XOF).</div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button style={{ ...btnGold, fontSize: 13.5, padding: "10px 18px", opacity: valid ? 1 : 0.5, cursor: valid ? "pointer" : "not-allowed" }}
          disabled={!valid} onClick={() => onConfirm(val, payMethod)}>Pay {valid ? fmtXOF(val) : ""}</button>
        <button style={{ background: "none", border: `1.5px solid ${T.line}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: T.ink, padding: "10px 18px", fontSize: 13.5 }}
          onClick={onClose}>Cancel</button>
      </div>
    </Overlay>
  );
}

function downloadInvoice(rec, user) {
  const ts = rec.plan === "deposit" ? tontineState(rec) : null;
  const rows = [
    ["Reference", (rec._id || "PENDING").toString().slice(0, 8).toUpperCase()],
    ["Customer", user?.name || rec.contact?.name || "—"],
    ["Email", user?.email || rec.contact?.email || "—"],
    ["Item", rec.tour.name],
    ["Travelers", `${rec.adults} adult(s)${rec.children ? ` · ${rec.children} child` : ""}`],
    rec.date ? ["Date", rec.date] : null,
    ...(rec.addons && rec.addons.length ? rec.addons.map((a) => [`Add-on: ${a.name}${a.per === "person" ? " (per person)" : ""}`, a.amount != null ? fmtXOF(a.amount) : "on request"]) : []),
    ["Payment plan", planLabel(rec.plan)],
    rec.plan !== "quote" && rec.plan !== "itinerary" ? ["Total", fmtXOF(rec.total)] : null,
    ts ? ["Deposit paid", fmtXOF(rec.deposit)] : null,
    ts ? ["Paid to date", fmtXOF(ts.paidAmount)] : null,
    ts ? ["Remaining", ts.settled ? "Fully paid" : fmtXOF(ts.remaining)] : null,
    ts ? ["Payments made", ts.settled ? `${ts.payCount} / ${ts.payCount}` : `${ts.payCount} / ${ts.plannedTotal}`] : null,
  ].filter(Boolean);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ATS invoice</title>
    <style>body{font-family:Arial,sans-serif;color:#0B2E1B;max-width:640px;margin:40px auto;padding:0 20px}
    h1{color:#009245}.h{border-bottom:2px solid #F8D815;padding-bottom:10px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse}td{padding:9px 4px;border-bottom:1px solid #eee;font-size:14px}
    td:first-child{opacity:.6;width:40%}td:last-child{font-weight:600;text-align:right}
    .f{margin-top:24px;font-size:12px;opacity:.6;line-height:1.6}</style></head>
    <body><div class="h"><h1>Africa Tourism Solutions</h1><div>Booking confirmation / invoice</div></div>
    <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>
    <div class="f">Immeuble SICAP, Point E, Lot 8, Dakar · +221 77 480 78 78 · infos@africatourismsolutions.com</div>
    <script>window.onload=function(){window.print()}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

function BookingDetail({ rec, onClose, notify, patchBooking, cancelBooking, manageBooking, user, onPay }) {
  const it = rec.itinerary;
  const ts = rec.plan === "deposit" ? tontineState(rec) : null;
  return (
    <Overlay onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Thumb rec={rec} size={44} />
        <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, margin: 0, flex: 1 }}>{rec.tour.name}</h3>
      </div>
      <div style={{ display: "flex", gap: 8, margin: "10px 0 14px" }}>
        <span style={{ ...pill(planColor(rec.plan)), fontSize: 12 }}>{planLabel(rec.plan)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(rec._status), alignSelf: "center" }}>● {statusLabel[rec._status] || "In progress"}</span>
      </div>

      <div style={{ background: T.paperDark, borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: 1.7 }}>
        <Row l="Travelers" v={`${rec.adults} adult(s)${rec.children ? ` · ${rec.children} child` : ""}${rec.infants ? ` · ${rec.infants} infant` : ""}`} />
        {rec.date && <Row l="Date" v={rec.date} />}
        {rec.tour.pole && <Row l="Category" v={rec.tour.pole} />}
        {rec.tour.dur && <Row l="Duration" v={rec.tour.dur} />}
        {it && <>
          <Row l="Destination" v={it.dest} />
          <Row l="Hotel" v={it.hotel} />
          <Row l="Transport" v={it.transport} />
          <div style={{ padding: "4px 0" }}><span style={{ opacity: 0.75 }}>Experiences</span><div style={{ fontWeight: 600, marginTop: 4 }}>{it.tours}</div></div>
          {it.notes && <div style={{ padding: "4px 0" }}><span style={{ opacity: 0.75 }}>Notes</span><div style={{ marginTop: 4 }}>{it.notes}</div></div>}
        </>}
        {rec.addons && rec.addons.length > 0 && (
          <div style={{ padding: "4px 0" }}>
            <span style={{ opacity: 0.75 }}>Add-ons</span>
            {rec.addons.map((a) => (
              <div key={a.name} style={{ display: "flex", fontSize: 13.5, marginTop: 4 }}>
                <span>{a.name}{a.per === "person" ? " (per person)" : ""}</span>
                <span style={{ marginLeft: "auto", fontWeight: 600 }}>{a.amount != null ? fmtXOF(a.amount) : "on request"}</span>
              </div>
            ))}
          </div>
        )}
        {rec.plan !== "quote" && rec.plan !== "itinerary" && <Row l="Total" v={fmtXOF(rec.total)} />}
        {ts && <>
          <Row l="Deposit paid" v={fmtXOF(rec.deposit)} />
          <Row l="Paid to date" v={fmtXOF(ts.paidAmount)} />
          <Row l="Balance" v={ts.settled ? "Fully paid" : fmtXOF(ts.remaining)} />
          <Row l="Payments made" v={ts.settled ? `${ts.payCount} / ${ts.payCount} · 100%` : `${ts.payCount} / ${ts.plannedTotal}`} />
        </>}
      </div>

      {(rec.plan === "quote" || rec.plan === "itinerary") && rec._status === "pending" && (
        <div style={{ fontSize: 13.5, opacity: 0.75, marginTop: 12, lineHeight: 1.5 }}>An ATS advisor is reviewing your request and will reply by email with a personalised proposal.</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        {ts && rec._status !== "cancelled" && !ts.settled && (
          <button style={{ ...btnGold, fontSize: 13.5, padding: "9px 16px" }}
            onClick={() => { onClose(); onPay(rec); }}>Pay towards balance</button>
        )}
        {rec.plan !== "quote" && rec.plan !== "itinerary" && (
          <button style={{ ...btnGreen, fontSize: 13.5, padding: "9px 16px" }} onClick={() => downloadInvoice(rec, user)}>Download invoice</button>
        )}
        <button style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: T.indigo, fontSize: 13.5 }} onClick={() => notify("Opening WhatsApp chat with ATS: +221 77 480 78 78")}>Contact ATS</button>
      </div>

      <BookingManager view={viewFromRecord(rec)} run={(action, change) => manageBooking(action, { id: rec._id, change })} notify={notify} onChanged={onClose} />

      <button style={{ background: "none", border: "none", cursor: "pointer", marginTop: 12, fontWeight: 600, color: T.ink, opacity: 0.6, width: "100%", fontSize: 14 }} onClick={onClose}>Close</button>
    </Overlay>
  );
}

// Build the server-shaped management "view" from a local record (previews only; the
// server re-computes eligibility & refund authoritatively on the actual action).
function viewFromRecord(rec) {
  const days = bookingDaysToDeparture(rec);
  const amountPaid = bookingAmountPaid(rec);
  const pct = retainedPctFor(days);
  const closed = rec._status === "cancelled" || rec._status === "completed";
  return {
    id: rec._id, ref: rec._ref, status: rec._status, data: rec,
    days, amountPaid, retainedPct: pct,
    refundPreview: Math.max(0, Math.round(amountPaid * (100 - pct) / 100)),
    canModify: !closed && rec._status !== "settled" && (days == null || days >= MODIFY_MIN_DAYS),
    canCancel: !closed, modifyMinDays: MODIFY_MIN_DAYS,
  };
}

// Shared self-service controls: request a date/traveller change, or cancel (with the
// policy-based refund shown up front). Used in the account modal AND the guest page.
function BookingManager({ view: v, run, notify, onChanged }) {
  const d = v.data || {};
  const isLogistics = !!(d.rental || d.transfer || d.route);
  const [mode, setMode] = useState(null); // null | "modify" | "cancel"
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(d.dateFrom || d.date || "");
  const [adults, setAdults] = useState(d.adults ?? 2);
  const [children, setChildren] = useState(d.children ?? 0);
  const [note, setNote] = useState("");
  const todayStr = new Date().toISOString().slice(0, 10);
  const closed = v.status === "cancelled" || v.status === "completed";

  const submit = async (action, change) => {
    setBusy(true);
    const r = await run(action, change);
    setBusy(false);
    if (r.error) { notify(r.error); return; }
    setMode(null);
    if (action === "modify") notify("Change requested — an ATS advisor will confirm it shortly.");
    else notify(r.booking?.status === "cancelled" ? "Booking cancelled." : "Cancellation requested — our team will process your refund.");
    onChanged && onChanged(r.booking);
  };

  const box = { background: T.paperDark, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", marginTop: 12 };

  return (
    <div>
      {/* Pending change already requested */}
      {d.pendingChange && v.status === "modification_requested" && (
        <div style={{ ...box, background: "#FFF8E6", borderColor: "#F1E2A6" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}><Clock size={15} color={T.gold} /> Change requested — awaiting ATS confirmation</div>
          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>
            {d.pendingChange.date && <>New date: <strong>{d.pendingChange.date}</strong><br /></>}
            {d.pendingChange.adults != null && <>Travellers: <strong>{d.pendingChange.adults}{d.pendingChange.children ? ` + ${d.pendingChange.children} child` : ""}</strong></>}
          </div>
        </div>
      )}
      {/* Refund summary after a cancellation request */}
      {d.refund && (v.status === "cancellation_requested" || v.status === "cancelled") && (
        <div style={{ ...box, background: "#FBECEC", borderColor: "#F0C9C6" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "#B3261E" }}>{v.status === "cancelled" ? "Booking cancelled" : "Cancellation requested"}</div>
          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>
            {d.refund.amountPaid > 0
              ? <>Per our cancellation policy, {d.refund.retainedPct}% of {fmtXOF(d.refund.amountPaid)} is retained — <strong>refund due: {fmtXOF(d.refund.refundAmount)}</strong>, processed within 3–5 days.</>
              : <>This booking wasn't paid, so nothing is charged.</>}
          </div>
        </div>
      )}

      {/* Actions */}
      {!closed && v.status !== "cancellation_requested" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" }}>
          {v.canModify && v.status !== "modification_requested" && (
            <button style={{ background: "none", border: `1.5px solid ${T.line}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: T.ink, padding: "9px 16px", fontSize: 13.5 }} onClick={() => setMode(mode === "modify" ? null : "modify")}>Change date / travellers</button>
          )}
          {!v.canModify && v.status !== "modification_requested" && v.days != null && v.days < v.modifyMinDays && (
            <span style={{ fontSize: 12.5, color: "rgba(0,0,0,.65)" }}>Changes close {v.modifyMinDays} days before departure — contact ATS for last-minute changes.</span>
          )}
          {v.canCancel && (
            <button style={{ marginLeft: "auto", background: "none", border: `1.5px solid #B3261E`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: "#B3261E", padding: "9px 16px", fontSize: 13.5 }} onClick={() => setMode(mode === "cancel" ? null : "cancel")}>Cancel {d.plan === "quote" || d.plan === "itinerary" ? "request" : "booking"}</button>
          )}
        </div>
      )}

      {/* Modify form */}
      {mode === "modify" && (
        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Request a change</div>
          <label style={{ ...label, marginTop: 0 }}>New travel date</label>
          <RangeDate from={date} to={date} onChange={(f) => setDate(f)} triggerStyle={input} wide single minDate={todayStr} />
          <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
            <div>
              <div style={label}>{isLogistics ? "Passengers" : "Adults"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setAdults((a) => Math.max(1, a - 1))} style={btnCircle} aria-label="Fewer">−</button>
                <span style={{ fontWeight: 700, minWidth: 18, textAlign: "center" }}>{adults}</span>
                <button onClick={() => setAdults((a) => a + 1)} style={btnCircle} aria-label="More">+</button>
              </div>
            </div>
            {!isLogistics && (
              <div>
                <div style={label}>Children (3–12)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setChildren((c) => Math.max(0, c - 1))} style={btnCircle} aria-label="Fewer">−</button>
                  <span style={{ fontWeight: 700, minWidth: 18, textAlign: "center" }}>{children}</span>
                  <button onClick={() => setChildren((c) => c + 1)} style={btnCircle} aria-label="More">+</button>
                </div>
              </div>
            )}
          </div>
          <label style={{ ...label }}>Note for ATS (optional)</label>
          <textarea style={{ ...input, minHeight: 60, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know about this change?" />
          <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.7)", marginTop: 8, lineHeight: 1.5 }}>Your change is submitted for confirmation — any price difference is settled with ATS before it's applied.</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button disabled={busy} style={{ ...btnGold, fontSize: 13.5, padding: "9px 18px", opacity: busy ? 0.6 : 1 }} onClick={() => submit("modify", { date, adults, children, note })}>{busy ? "Sending…" : "Request change"}</button>
            <button style={{ background: "none", border: `1.5px solid ${T.line}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: T.ink, padding: "9px 18px", fontSize: 13.5 }} onClick={() => setMode(null)}>Back</button>
          </div>
        </div>
      )}

      {/* Cancel confirm with policy preview */}
      {mode === "cancel" && (
        <div style={{ ...box, background: "#FBECEC", borderColor: "#F0C9C6" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#B3261E" }}>Cancel this {d.plan === "quote" || d.plan === "itinerary" ? "request" : "booking"}?</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>
            {v.amountPaid > 0 ? (
              <>You've paid <strong>{fmtXOF(v.amountPaid)}</strong>. {v.days != null && <>Your departure is in <strong>{v.days} day{v.days > 1 ? "s" : ""}</strong>, so </>}our policy retains <strong>{v.retainedPct}%</strong> — you would be refunded <strong>{fmtXOF(v.refundPreview)}</strong>{v.refundPreview > 0 ? " within 3–5 days" : " (no refund)"}.</>
            ) : (
              <>This booking isn't paid yet — cancelling is free.</>
            )}
          </div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,.6)", marginTop: 6 }}>See our full <TermsLink>Cancellation Policy</TermsLink>. Third-party supplier penalties may apply.</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button disabled={busy} style={{ background: "#B3261E", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, padding: "9px 18px", fontSize: 13.5, opacity: busy ? 0.6 : 1 }} onClick={() => submit("cancel")}>{busy ? "Processing…" : "Confirm cancellation"}</button>
            <button style={{ background: "none", border: `1.5px solid ${T.line}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: T.ink, padding: "9px 18px", fontSize: 13.5 }} onClick={() => setMode(null)}>Keep booking</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Guest self-service page reached from the confirmation email's magic link (?manage=<token>)
function ManageBookingPage({ token, manageBooking, notify, go }) {
  const [state, setState] = useState({ loading: true, view: null, error: "" });
  const load = async () => {
    const r = await manageBooking("get", { token });
    if (r.error) setState({ loading: false, view: null, error: r.error });
    else setState({ loading: false, view: r.booking, error: "" });
  };
  useEffect(() => { load(); }, [token]);

  const run = async (action, change) => {
    const r = await manageBooking(action, { token, change });
    if (r.booking) setState((s) => ({ ...s, view: r.booking }));
    return r;
  };

  const v = state.view;
  const d = v?.data || {};
  return (
    <Wrap>
      <button onClick={() => go("home")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.ink, fontWeight: 700, fontSize: 14, padding: 0, marginBottom: 14 }}><ChevronLeft size={18} /> Home</button>
      <Eyebrow>Manage your booking</Eyebrow>
      {state.loading ? (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 24 }}>Loading your booking…</div>
      ) : state.error || !v ? (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>We couldn't open this booking.</div>
          <div style={{ fontSize: 13.5, color: "rgba(0,0,0,.75)", lineHeight: 1.6 }}>{state.error || "The link may have expired."} You can reach us on WhatsApp at +221 77 480 78 78 or by email at infos@africatourismsolutions.com.</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: "22px 24px", maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Thumb rec={d} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="disp" style={{ fontWeight: 800, fontSize: 19 }}>{d.tour?.name || "Your booking"}</div>
              <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.7)" }}>Reference <strong>{v.ref}</strong></div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, margin: "12px 0 14px" }}>
            <span style={{ ...pill(planColor(d.plan)), fontSize: 12 }}>{planLabel(d.plan)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(v.status), alignSelf: "center" }}>● {statusLabel[v.status] || "In progress"}</span>
          </div>
          <div style={{ background: T.paperDark, borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: 1.7 }}>
            {(d.adults != null) && <Row l="Travellers" v={`${d.adults}${d.children ? ` + ${d.children} child` : ""}`} />}
            {(d.dateFrom || d.date) && <Row l="Date" v={d.dateFrom || d.date} />}
            {d.plan !== "quote" && d.plan !== "itinerary" && d.total != null && <Row l="Total" v={fmtXOF(d.total)} />}
            {v.amountPaid > 0 && <Row l="Paid" v={fmtXOF(v.amountPaid)} />}
          </div>
          <BookingManager view={v} run={run} notify={notify} onChanged={(b) => b && setState((s) => ({ ...s, view: b }))} />
        </div>
      )}
    </Wrap>
  );
}

// ---------------- MODALS ----------------
function SignInModal({ onClose, onDone, notify }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const google = async () => {
    setError(""); setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { setError(error.message); setBusy(false); }
  };

  const submit = async () => {
    setError("");
    if (!email || !password) return setError("Email and password are required.");
    if (mode === "signup" && (!firstName || !lastName)) return setError("First name and last name are required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) onDone(`Welcome, ${firstName}! Your ATS account is ready.`);
      else onDone("Account created — check your email to confirm your address, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      onDone("Welcome back!");
    }
  };

  const forgot = async () => {
    if (!email) return setError("Enter your email above first, then click “Forgot password”.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setBusy(false);
    if (error) return setError(error.message);
    notify("Password reset email sent — check your inbox.");
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="disp" style={{ fontWeight: 800, fontSize: 22, marginTop: 0 }}>{mode === "signin" ? "Sign in to ATS" : "Create your ATS account"}</h3>

      <button disabled={busy} onClick={google} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "11px 14px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", color: T.ink }}>
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3c-2 1.4-4.6 2.6-7.4 2.6-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C41.4 35.4 44 30.1 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
        Continue with Google
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", opacity: 0.55, fontSize: 12.5 }}>
        <div style={{ flex: 1, height: 1, background: T.line }} /> or with email <div style={{ flex: 1, height: 1, background: T.line }} />
      </div>

      {mode === "signup" && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><label style={label}>First name</label><input style={input} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label style={label}>Last name</label><input style={input} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        </div>
      )}
      <label style={label}>Email</label>
      <input style={input} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label style={label}>Password</label>
      <input style={input} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "Minimum 8 characters" : ""} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />

      {error && <div role="alert" style={{ background: "#FDECEA", color: "#B3261E", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, marginTop: 10 }}>{error}</div>}

      <button disabled={busy} style={{ ...btnGold, width: "100%", marginTop: 14, opacity: busy ? 0.6 : 1 }} onClick={submit}>
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13.5 }}>
        <button style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: T.indigo, padding: 0 }} onClick={() => { setError(""); setMode(mode === "signin" ? "signup" : "signin"); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        {mode === "signin" && <button style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600, color: T.indigo, padding: 0 }} onClick={forgot}>Forgot password?</button>}
      </div>
    </Overlay>
  );
}

function AIChat({ onClose, go }) {
  const [msgs, setMsgs] = useState([{ me: false, text: "Salut ! I'm the ATS Travel Assistant. Tell me your days and budget — e.g. « I have 5 days and $1,500 » — and I'll build a Senegal plan from real ATS products." }]);
  const [txt, setTxt] = useState("");
  const reply = (q) => {
    const lower = q.toLowerCase();
    if (lower.includes("5 day") || lower.includes("1500") || lower.includes("1,500"))
      return "Perfect for 5 days / ~$1,500 for two: Day 1 Dakar City Tour · Day 2 Gorée Island · Day 3 Bandia Safari + Somone Lagoon · Day 4–5 Lompoul Desert Overnight. At the Private 1–2 pax basis with a Standard Sedan, that lands well inside budget with a mid-range hotel — and you can reserve it all with a 20% Tontine deposit. Want me to open the Trip Builder?";
    if (lower.includes("honeymoon")) return "Honeymoon pick: 2 nights Lompoul desert camp under the stars, then Sine Saloum eco-lodge with private pirogue at sunset, finish with a Gorée day and a sunset Océane Cruise in Dakar. I can price it for your dates.";
    if (lower.includes("family")) return "Family favourite: Bandia Safari (kids love the giraffes), Accrobaobab ziplines, Lac Rose, and Ngor Island beach day. Children 2–11 pay 70% on all ATS tours.";
    return "I can plan by budget, days or interests (safari, heritage, beach, food…). Try: « Plan a family week in Senegal » or « honeymoon ideas ». For live booking, any plan converts to a Tontine payment schedule.";
  };
  const send = () => { if (!txt.trim()) return; const q = txt; setTxt(""); setMsgs((m) => [...m, { me: true, text: q }, { me: false, text: reply(q) }]); };
  return (
    <div style={{ position: "fixed", right: 16, bottom: 84, width: "min(380px, calc(100vw - 32px))", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,.3)", zIndex: 80, display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
      <div style={{ padding: "12px 16px", background: T.indigo, color: "#fff", borderRadius: "18px 18px 0 0", display: "flex", alignItems: "center" }}>
        <strong className="disp" style={{ display: "flex", alignItems: "center", gap: 8 }}><Bot size={20} /> ATS Travel Assistant</strong>
        <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}><X size={18} /></button>
      </div>
      <div style={{ padding: 14, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: "85%", background: m.me ? T.green : T.paperDark, color: m.me ? "#fff" : T.ink, borderRadius: 14, padding: "10px 13px", fontSize: 14, lineHeight: 1.5 }}>{m.text}</div>
        ))}
        {msgs.length > 2 && (
          <button style={{ ...btnGold, alignSelf: "flex-start", fontSize: 13, padding: "8px 14px" }} onClick={() => { onClose(); go("builder"); }}>Open Trip Builder →</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${T.line}` }}>
        <input style={{ ...input, flex: 1 }} placeholder="I have 5 days and $1,500…" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button style={{ ...btnGold, borderRadius: 10, padding: "10px 16px" }} onClick={send}>Send</button>
      </div>
    </div>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(20,32,26,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.paper, borderRadius: 20, width: "100%", maxWidth: 420, padding: 24, color: T.ink }}>{children}</div>
    </div>
  );
}

// n = number of instalments for the 80% balance (AFTER the 20% deposit).
// Total payments = 1 deposit + n instalments.
const TONTINE_OPTIONS = [
  { key: "15d", label: "15 days", days: 15, n: 1 },
  { key: "1m", label: "1 month", days: 30, n: 1 },
  { key: "2m", label: "2 months", days: 60, n: 2 },
  { key: "3m", label: "3 months", days: 90, n: 3 },
  { key: "6m", label: "6 months", days: 180, n: 6 },
  { key: "9m", label: "9 months", days: 270, n: 9 },
  { key: "1y", label: "1 year", days: 365, n: 12 },
];

function BookingModal({ tour, user, onClose, onConfirm }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const minDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); // earliest = day after tomorrow
  const [dateFrom, setDateFrom] = useState(tour.initialDateFrom || tour.initialDate || "");
  const [dateTo, setDateTo] = useState(tour.initialDateTo || tour.initialDateFrom || tour.initialDate || "");
  const setTripDate = (v) => { setDateFrom(v); setDateTo(v); }; // single date for trips
  const date = dateFrom; // start date drives availability / scheduling
  const [adults, setAdults] = useState(tour.initialPax || 2);
  const [children, setChildren] = useState(0); // 3–12
  const [infants, setInfants] = useState(0);  // under 3, free
  const [addons, setAddons] = useState(tour.initialExtras || []);
  const [vehicle, setVehicle] = useState(tour.initialVehicle ?? -1); // -1 = no transport
  const [plan, setPlan] = useState(tour.initialPlan === "deposit" ? "deposit" : "full");
  const [sched, setSched] = useState("3m");
  const [tranches, setTranches] = useState(3); // client-chosen number of instalments for the 80% balance
  const [accepted, setAccepted] = useState(false); // mandatory T&C acceptance for paid bookings
  const [payMethod, setPayMethod] = useState("stripe"); // PayDunya temporarily disabled — Stripe only
  const [promoCode, setPromoCode] = useState(() => { try { return (tour.initialPromo || localStorage.getItem("ats_ref") || "").toUpperCase(); } catch { return (tour.initialPromo || "").toUpperCase(); } });
  const [promo, setPromo] = useState(null); // validate-promo result
  const [promoChecking, setPromoChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const [bill, setBill] = useState(() => {
    if (tour.agentBooking) return { firstName: "", lastName: "", email: "", phone: "", address: "", city: "", country: "" };
    const [fn, ...rn] = (user?.name || "").split(" ");
    return { firstName: fn || "", lastName: rn.join(" ") || "", email: user?.email || "", phone: "", address: "", city: "", country: "" };
  });
  const toggle = (n) => setAddons((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));

  // ---- Ma Tontine availability vs chosen travel date ----
  const daysUntil = date ? Math.ceil((new Date(date + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000) : null;
  const optAvailable = (o) => daysUntil != null && daysUntil >= o.days;
  const tontineAvailable = TONTINE_OPTIONS.some(optAvailable);
  const tontineAllowed = tontineAvailable && !!user && !IS_CORPORATE; // Ma Tontine requires a free account; corporate books on invoice
  const selectedOpt = TONTINE_OPTIONS.find((o) => o.key === sched) || TONTINE_OPTIONS[3];
  const baseN = selectedOpt.n;                 // instalments implied by the chosen period
  const maxTr = baseN + 2;                      // client may go up to +2 instalments
  const months = Math.min(Math.max(1, tranches), maxTr); // effective number of instalments

  // a guest can never sit on the deposit plan (account required); corporate books full on invoice
  useEffect(() => { if (!user || IS_CORPORATE) setPlan((p) => (p === "deposit" ? "full" : p)); }, [user]);

  // keep schedule + plan valid when the date changes
  useEffect(() => {
    if (!tontineAvailable) { setPlan((p) => (p === "deposit" ? "full" : p)); return; }
    if (!optAvailable(selectedOpt)) {
      const firstOk = TONTINE_OPTIONS.find(optAvailable);
      if (firstOk) setSched(firstOk.key);
    }
  }, [date]);

  // when the period changes, reset the instalment count to that period's default
  useEffect(() => { setTranches(selectedOpt.n); }, [sched]);

  // full page: start at the top
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const pax = adults + children;
  const seats = pax + infants;
  const tier = tierOf(pax);
  const tg = tour.grid[tier];
  const rates = tour.zone ? RATES[tour.zone] : null;
  const childAsAdult = !tour.quote && tg.c == null && children > 0;

  const calc = useMemo(() => {
    if (tour.quote) return null;
    const base = adults * tg.a + children * (tg.c ?? tg.a);
    const paidAddons = tour.addons.filter((x) => addons.includes(x.name) && x.price);
    const addonTotal = paidAddons.reduce((s, x) => s + (x.per === "person" ? x.price * pax : x.price), 0);
    const transport = vehicle >= 0 && rates ? rates[vehicle] : 0;
    const total = base + addonTotal + transport;
    return { base, addonTotal, transport, total, deposit: total * 0.2, installment: (total * 0.8) / months };
  }, [tour, adults, children, addons, vehicle, months, pax, tg, rates]);

  const onRequestAddons = tour.addons.filter((x) => addons.includes(x.name) && !x.price);
  const chosenAddons = tour.addons.filter((x) => addons.includes(x.name)).map((a) => ({ name: a.name, per: a.per, price: a.price, amount: a.price ? (a.per === "person" ? a.price * pax : a.price) : null }));

  // ---- Promo / ambassador code (full payment only) ----
  const total0 = calc ? calc.total : 0;
  useEffect(() => {
    const c = promoCode.trim();
    if (!c || plan !== "full" || !total0) { setPromo(null); setPromoChecking(false); return; }
    setPromoChecking(true);
    const id = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("validate-promo", { body: { code: c, amount: total0 } });
        setPromo(data && data.valid ? data : { valid: false });
      } catch { setPromo({ valid: false }); }
      finally { setPromoChecking(false); }
    }, 400);
    return () => clearTimeout(id);
  }, [promoCode, plan, total0]);
  const corporate = plan === "full" && CORP_DISCOUNT > 0;         // corporate rate takes priority
  const promoValid = plan === "full" && !corporate && promo && promo.valid;
  const promoPct = promoValid ? Number(promo.discount_percent) || 0 : 0;
  const discPct = corporate ? CORP_DISCOUNT : promoPct;
  const discActive = corporate || promoValid;
  const discLabel = corporate ? "Corporate rate" : (promoValid ? `Promo ${promo.code}` : "");
  const payTotal = calc ? Math.round(calc.total * (1 - discPct / 100)) : 0;

  const Counter = ({ label: l, sub, value, set, min = 0 }) => (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
      <div><div style={{ fontWeight: 600, fontSize: 14.5 }}>{l}</div><div style={{ fontSize: 12, opacity: 0.6 }}>{sub}</div></div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => set(Math.max(min, value - 1))} aria-label={`Fewer ${l}`} style={btnCircle}>−</button>
        <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700 }}>{value}</span>
        <button onClick={() => set(value + 1)} aria-label={`More ${l}`} style={btnCircle}>+</button>
      </div>
    </div>
  );

  const headerBlock = (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8A968E", textTransform: "uppercase", letterSpacing: ".1em" }}>{tour.pole} · {tour.dur}</div>
      <h3 className="disp" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, margin: "6px 0 0", color: "#1A1A1A" }}>{tour.name}</h3>
    </div>
  );

  if (tour.quote) {
    return (
      <Wrap>
        <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.ink, fontWeight: 700, fontSize: 14, padding: 0, marginBottom: 14 }}>
          <ChevronLeft size={18} /> Back
        </button>
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 20, width: "100%", maxWidth: 720, margin: "0 auto", padding: "26px 30px", color: T.ink }}>
          {headerBlock}
          <div style={sect}>Travel date</div>
          <input type="date" min={minDate} value={dateFrom} onChange={(e) => setTripDate(e.target.value)} style={input} />
          <div style={sect}>Travelers</div>
          <Counter label="Adults" sub="" value={adults} set={setAdults} min={1} />
          <Counter label="Children (3–12)" sub="" value={children} set={setChildren} />
          <Counter label="Infants (under 3)" sub="Free" value={infants} set={setInfants} />
          <div style={sect}>Your request</div>
          <textarea style={{ ...input, minHeight: 70, resize: "vertical" }} placeholder="Dates flexible? Interests? Budget range?" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button style={{ width: "100%", marginTop: 14, background: T.indigo, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
            onClick={() => onConfirm({ tour, date, adults, children, infants, plan: "quote", months: 0, total: 0, deposit: 0 })}>
            Send quote request
          </button>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6, textAlign: "center" }}>An ATS advisor replies with a personalised price by email/WhatsApp.</div>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.ink, fontWeight: 700, fontSize: 14, padding: 0, marginBottom: 14 }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(300px,1fr)", gap: 24, alignItems: "start" }}>
          {/* LEFT — booking + billing + payment */}
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 20, padding: "26px 30px", color: T.ink }}>
            {tour.agentBooking && (
              <div style={{ marginBottom: 4, background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "10px 13px", fontSize: 13, lineHeight: 1.5, color: "rgba(0,0,0,.8)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <UserRound size={16} color={T.green} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>You're booking on behalf of a client{tour.initialPromo ? <> — your code <strong>{tour.initialPromo}</strong> is applied</> : ""}. Enter the client's billing details below.</span>
              </div>
            )}

            <div style={{ ...sect, marginTop: 0 }}>Reservation & billing details</div>
            <BillingFields bill={bill} setBill={setBill} />
            {!dateFrom && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 8 }}>Choose your travel date in the order panel to enable payment.</div>}

            {!IS_CORPORATE && (<>
            <div style={sect}>Payment</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPlan("full")} style={{ flex: 1, border: `1.5px solid ${plan === "full" ? T.green : T.line}`, background: plan === "full" ? T.green : "#fff", borderRadius: 12, padding: "10px 8px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: plan === "full" ? "#fff" : T.ink }}>Pay in full</button>
              <button onClick={() => tontineAllowed && setPlan("deposit")} disabled={!tontineAllowed} title={!user ? "A free account is required for Ma Tontine Voyage" : !tontineAvailable ? "Choose a travel date further away to pay in instalments" : ""}
                style={{ flex: 1, border: `1.5px solid ${plan === "deposit" ? T.green : T.line}`, background: plan === "deposit" ? T.green : "#fff", borderRadius: 12, padding: "10px 8px", fontWeight: 600, fontSize: 13, cursor: tontineAllowed ? "pointer" : "not-allowed", color: plan === "deposit" ? "#fff" : T.ink, opacity: tontineAllowed ? 1 : 0.45 }}>
                Ma Tontine Voyage · 20% deposit
              </button>
            </div>
            {tontineAvailable && !user && (
              <div style={{ marginTop: 10, background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: "rgba(0,0,0,.8)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Info size={15} color={T.green} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Ma Tontine Voyage needs a free account so we can track your instalments. You can still <strong>pay in full</strong> as a guest, or sign in to pay in instalments.</span>
              </div>
            )}
            {!tontineAvailable && (
              <div style={{ marginTop: 10, background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: "rgba(0,0,0,.8)" }}>
                {!date
                  ? "Select a travel date in the order panel to unlock Ma Tontine Voyage instalment plans."
                  : `⏳ Your travel date is in ${daysUntil} day${daysUntil > 1 ? "s" : ""} — too soon for instalments (minimum 15 days). Please pay in full, or pick a later date.`}
              </div>
            )}
            {plan === "deposit" && tontineAvailable && (
              <div style={{ marginTop: 10, fontSize: 14 }}>
                <div style={{ fontSize: 12.5, opacity: 0.7, marginBottom: 6 }}>Choose your instalment period (fully paid before departure):</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TONTINE_OPTIONS.map((o) => {
                    const ok = optAvailable(o);
                    return (
                      <button key={o.key} onClick={() => ok && setSched(o.key)} disabled={!ok}
                        title={ok ? "" : `Needs a travel date at least ${o.days} days away`}
                        style={{ border: `1.5px solid ${sched === o.key && ok ? T.green : T.line}`, borderRadius: 999, padding: "5px 13px", fontWeight: 600, fontSize: 12.5, cursor: ok ? "pointer" : "not-allowed", background: sched === o.key && ok ? T.green : "#fff", color: sched === o.key && ok ? "#fff" : T.ink, opacity: ok ? 1 : 0.4 }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>Greyed periods require a travel date further in the future than the period itself.</div>
                <div style={{ fontSize: 12.5, opacity: 0.7, margin: "14px 0 6px" }}>Split the balance into instalments (you choose the exact amount each time):</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Array.from({ length: maxTr }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => setTranches(n)}
                      style={{ border: `1.5px solid ${months === n ? T.green : T.line}`, borderRadius: 999, padding: "5px 13px", fontWeight: 600, fontSize: 12.5, cursor: "pointer", background: months === n ? T.green : "#fff", color: months === n ? "#fff" : T.ink }}>
                      {n}×
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>From 1 instalment (pay the balance at once) up to {maxTr}× for this period. You can always pay more than the minimum, or clear the balance early.</div>
              </div>
            )}
            </>)}

            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: T.green, marginTop: 20, marginBottom: 12, borderTop: `1px solid ${T.line}`, paddingTop: 18 }}>Order summary</div>
            <Row l={`Tour · ${tierLabel[tier]} · ${adults} ad${children ? ` + ${children} ch` : ""}`} v={fmtXOF(calc.base)} />
            {calc.transport > 0 && <Row l={`Transport · ${VEHICLES[vehicle].name}`} v={fmtXOF(calc.transport)} />}
            {chosenAddons.map((a) => <Row key={a.name} l={`+ ${a.name}${a.per === "person" ? ` (×${pax})` : ""}`} v={a.amount != null ? fmtXOF(a.amount) : "on request"} />)}
            {discActive && <div style={{ display: "flex", padding: "4px 0", color: T.green, fontWeight: 600 }}><span>{discLabel} · −{discPct}%</span><span style={{ marginLeft: "auto" }}>−{fmtXOF(calc.total - payTotal)}</span></div>}
            <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 8, paddingTop: 10, display: "flex", fontSize: 17 }}>
              <strong>Total</strong>
              <strong style={{ marginLeft: "auto" }}>
                {discActive && <span style={{ fontWeight: 500, fontSize: 13, opacity: 0.5, textDecoration: "line-through", marginRight: 6 }}>{fmtXOF(calc.total)}</span>}
                {fmtXOF(payTotal)} <span style={{ fontWeight: 500, fontSize: 13, opacity: 0.6 }}>{fmtUSD(payTotal)}</span>
              </strong>
            </div>
            {(childAsAdult || onRequestAddons.length > 0) && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: T.laterite, lineHeight: 1.5 }}>
                {childAsAdult && "Child rate for this tour is confirmed at booking (adult rate shown). "}
                {onRequestAddons.length > 0 && `${onRequestAddons.length} selected add-on(s) priced on request — quoted before payment.`}
              </div>
            )}
            {plan === "deposit" && tontineAvailable && (
              <div style={{ marginTop: 10, background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.6, color: "rgba(0,0,0,.8)" }}>
                <strong style={{ color: "#1A1A1A" }}>Due today: {fmtXOF(calc.deposit)}</strong> (20% deposit)<br />
                Then the balance of {fmtXOF(calc.total - calc.deposit)} split into <strong>{months} instalment{months > 1 ? "s" : ""}</strong>, so a minimum of <strong>{fmtXOF(calc.installment)}</strong> per payment.<br />
                <span style={{ display: "flex", gap: 7, marginTop: 6, alignItems: "flex-start" }}><Info size={15} color={T.green} style={{ flexShrink: 0, marginTop: 2 }} /><span>That amount is only a <strong>minimum</strong>: at each payment you're free to pay <strong>more</strong> — even the whole remaining balance at once — to finish sooner. You never pay less than the minimum.</span></span>
                <span style={{ display: "block", marginTop: 6 }}>Fully settled before your travel date{date ? ` (${date})` : ""}. Reminders by email, SMS and WhatsApp.</span>
              </div>
            )}
            {plan === "full" && corporate && (
              <div style={{ marginTop: 14, background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 10, padding: "10px 13px", fontSize: 13, color: "rgba(0,0,0,.8)", display: "flex", gap: 8, alignItems: "center" }}>
                <Building2 size={16} color={T.green} style={{ flexShrink: 0 }} /> Your corporate rate (−{CORP_DISCOUNT}%) is applied automatically.
              </div>
            )}
            {plan === "full" && !corporate && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
                <label style={{ ...label, marginTop: 0 }}>Promo / ambassador code (optional)</label>
                <input style={input} value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="e.g. AWA10" autoComplete="off" />
                {promoCode.trim() && (
                  promoChecking
                    ? <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 6 }}>Checking…</div>
                    : promoValid
                      ? <div style={{ fontSize: 12.5, color: T.green, fontWeight: 700, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}><Check size={14} /> Code applied — {promoPct}% off</div>
                      : <div style={{ fontSize: 12.5, color: "#B3261E", marginTop: 6 }}>Invalid or expired code.</div>
                )}
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div style={sect}>{IS_CORPORATE ? "Billing" : "Payment method"}</div>
              {IS_CORPORATE ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#F3F1FB", color: T.ink, border: `1.5px solid #DAD3F2`, borderRadius: 12, padding: "12px 16px" }}>
                  <Building2 size={20} color={T.indigo} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>Book now, pay later</span>
                    <div style={{ fontWeight: 500, fontSize: 12, opacity: 0.8 }}>Charged to your corporate account{CORP_DISCOUNT > 0 ? ` at the −${CORP_DISCOUNT}% corporate rate` : ""} — no payment today. ATS invoices you for settlement.</div>
                  </div>
                </div>
              ) : (
                <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 12, background: "#fff", color: T.ink, border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "10px 40px 10px 16px" }}>
                  <img src={PAY_LOGOS.stripe} alt="Stripe" style={{ height: 20, objectFit: "contain", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Pay with credit card</span>
                    <span style={{ fontWeight: 500, fontSize: 11.5, opacity: 0.7 }}>Visa / Mastercard — secure payment in USD</span>
                  </div>
                  <CircleCheck size={18} color="#fff" fill={T.green} style={{ position: "absolute", top: 8, right: 8 }} />
                </div>
              )}
            </div>

            <TermsCheck checked={accepted} onChange={setAccepted} />
            <button style={{ width: "100%", marginTop: 12, background: IS_CORPORATE ? T.indigo : T.gold, color: IS_CORPORATE ? "#fff" : T.ink, border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 16, cursor: (billValid(bill) && dateFrom && accepted) ? "pointer" : "not-allowed", opacity: (billValid(bill) && dateFrom && accepted) ? 1 : 0.55 }}
              disabled={!billValid(bill) || !dateFrom || !accepted}
              onClick={() => onConfirm({ tour, date: dateFrom, dateFrom, dateTo: dateFrom, adults, children, infants, plan: IS_CORPORATE ? "full" : plan, months, schedule: plan === "deposit" ? selectedOpt.label : "", total: calc.total, deposit: calc.deposit, contact: { ...bill, name: `${bill.firstName} ${bill.lastName}`.trim() }, addons: chosenAddons, promoCode: promoValid ? promo.code : "", payMethod })}>
              {IS_CORPORATE ? `Book now — pay later (${fmtXOF(payTotal)})` : plan === "deposit" ? `Reserve with ${fmtXOF(calc.deposit)} deposit` : `Pay in full — ${fmtXOF(payTotal)}`}
            </button>
            {(() => {
              const missing = [];
              if (!dateFrom) missing.push("travel date");
              if (!bill.firstName) missing.push("first name");
              if (!bill.lastName) missing.push("last name");
              if (!bill.email) missing.push("email");
              if (!bill.phone) missing.push("phone");
              if (!accepted) missing.push("accept the Terms & Conditions");
              if (!missing.length) return null;
              return (
                <div style={{ marginTop: 10, background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#B3261E", lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Info size={15} color="#B3261E" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>To unlock payment, please complete: <strong>{missing.join(", ")}</strong>.</span>
                </div>
              );
            })()}
          </div>

          {/* RIGHT — tour configuration + order summary + coupon */}
          <aside>
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 20, padding: "26px 30px", color: T.ink, fontSize: 14.5 }}>
              {headerBlock}

              <div style={sect}>Travel date</div>
              <input type="date" min={minDate} value={dateFrom} onChange={(e) => setTripDate(e.target.value)} style={input} />

              <div style={sect}>Travelers</div>
              <Counter label="Adults" sub={`${fmtXOF(tg.a)} each at current basis`} value={adults} set={setAdults} min={1} />
              <Counter label="Children (3–12)" sub={tg.c ? `${fmtXOF(tg.c)} each` : "child rate confirmed at booking"} value={children} set={setChildren} />
              <Counter label="Infants (under 3)" sub="Free" value={infants} set={setInfants} />
              <div style={{ marginTop: 10, background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, color: "rgba(0,0,0,.8)" }}>
                Basis applied: <strong style={{ color: "#1A1A1A" }}>{tierLabel[tier]}</strong> — {tier !== "grp" ? "add travelers to unlock lower per-person rates." : "best per-person rate unlocked."}
              </div>

              {rates && (
                <>
                  <div style={sect}>Transport — choose your vehicle (optional)</div>
                  <select value={vehicle} onChange={(e) => setVehicle(+e.target.value)} style={{ ...input, fontWeight: 600 }}>
                    <option value={-1}>No transport — I'll arrange my own</option>
                    {VEHICLES.map((v, i) => (
                      <option key={v.name} value={i} disabled={v.cap < seats}>
                        {v.name} · up to {v.cap} — {fmtXOF(rates[i])}{v.cap < seats ? " (too small for your group)" : ""}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 6 }}>Per vehicle, round trip / at disposal for the day — ATS Logistics rate card.</div>
                </>
              )}

              {tour.addons.length > 0 && (
                <>
                  <div style={sect}>Add-ons</div>
                  {tour.addons.map((x) => (
                    <label key={x.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.line}`, cursor: "pointer", fontSize: 14 }}>
                      <input type="checkbox" checked={addons.includes(x.name)} onChange={() => toggle(x.name)} style={{ width: 17, height: 17, accentColor: T.green, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{x.name}</span>
                      <strong style={{ whiteSpace: "nowrap" }}>{x.price ? fmtXOF(x.price) + (x.per === "person" ? " /pp" : "") : "on request"}</strong>
                    </label>
                  ))}
                </>
              )}

            </div>
          </aside>
        </div>
      </div>
    </Wrap>
  );
}
const sect = { margin: "22px 0 9px", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".08em", color: T.green };

const COUNTRY_LIST = ["Senegal", "Gambia", "Mali", "Mauritania", "Guinea", "Ivory Coast", "France", "Morocco", "United States", "United Kingdom", "Canada", "Other"];
const billValid = (b) => b.firstName && b.lastName && b.email && b.phone;

function BillingFields({ bill, setBill }) {
  const set = (k) => (e) => setBill({ ...bill, [k]: e.target.value });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>First name *</label><input style={input} value={bill.firstName || ""} onChange={set("firstName")} autoComplete="given-name" /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>Last name *</label><input style={input} value={bill.lastName || ""} onChange={set("lastName")} autoComplete="family-name" /></div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>Email *</label><input style={input} type="email" value={bill.email || ""} onChange={set("email")} autoComplete="email" /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>Phone / WhatsApp *</label><input style={input} value={bill.phone || ""} onChange={set("phone")} placeholder="+221 …" autoComplete="tel" /></div>
      </div>
      <div><label style={label}>Address <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
      <input style={input} value={bill.address || ""} onChange={set("address")} placeholder="Street, building, apt" autoComplete="street-address" /></div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>City <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label><input style={input} value={bill.city || ""} onChange={set("city")} autoComplete="address-level2" /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>Country <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
          <select style={input} value={bill.country || ""} onChange={set("country")}>
            <option value="">Select…</option>
            {COUNTRY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}


// ---------------- ATS LOGISTICS QUICK-BOOK ----------------
const ROUTES = [
  { id: "airport", name: "Airport transfer — AIBD ⇄ Dakar / Saly / Lac Rose", zone: "airport", unit: "one way" },
  { id: "dakar", name: "Vehicle at disposal — Dakar day (~10h)", zone: "dakar", unit: "per day" },
  { id: "bandia", name: "Round trip — Bandia / Accrobaobab / Somone / Saly", zone: "bandia", unit: "round trip" },
  { id: "joal", name: "Round trip — Joal-Fadiouth", zone: "joal", unit: "round trip" },
  { id: "lompoul", name: "Round trip — Lompoul desert", zone: "lompoul", unit: "round trip" },
  { id: "stlouis", name: "Round trip — Saint-Louis", zone: "stlouis", unit: "round trip" },
  { id: "ndangane", name: "Round trip — Ndangane (Sine Saloum)", zone: "ndangane", unit: "round trip" },
  { id: "toubacouta", name: "Round trip — Toubacouta", zone: "toubacouta", unit: "round trip" },
  { id: "ziguinchor", name: "Round trip — Ziguinchor (Casamance)", zone: "ziguinchor", unit: "round trip" },
  { id: "capskirring", name: "Round trip — Cap Skirring", zone: "capskirring", unit: "round trip" },
  { id: "kedougou", name: "Round trip — Kédougou", zone: "kedougou", unit: "round trip" },
];

// Vehicle photos live in the same bucket under the "vehicles/" folder.
// Any extension works (jpg, png, webp…): the file's base name must equal the vehicle slug.
// e.g. vehicles/standard-suv.png, vehicles/luxury-minivan.webp
// Generic photo map for a bucket folder: { baseName(without ext): publicUrl }
function usePhotoMap(folder) {
  const [map, setMap] = useState({});
  useEffect(() => {
    supabase.storage.from(PHOTO_BUCKET).list(folder, { limit: 100 }).then(({ data }) => {
      if (!data) return;
      const m = {};
      for (const f of data) {
        if (!f.name || f.name.startsWith(".")) continue;
        const base = f.name.replace(/\.[^.]+$/, "");
        m[base] = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(`${folder}/${f.name}`).data.publicUrl;
      }
      setMap(m);
    });
  }, [folder]);
  return map;
}
const useVehiclePhotoMap = () => usePhotoMap("vehicles");

// ---- Transfers: fixed point-to-point routes (both directions), per-vehicle price ----
const TRANSFER_ROUTES = [
  { id: "aibd-dakar", name: "AIBD ⇄ Dakar", prices: RATES.airport },
  { id: "aibd-saly", name: "AIBD ⇄ Saly", prices: [40000, 60000, 120000, 65000, 90000, 240000, 130000, 120000, 180000, 80000, 110000, 220000] },
  { id: "dakar-saly", name: "Dakar ⇄ Saly", prices: [45000, 65000, 130000, 70000, 100000, 260000, 140000, 130000, 190000, 90000, 120000, 240000] },
];
// Directional route list for the hero transfer search (same prices both ways)
const TRANSFER_DIRECTIONS = [
  { id: "dakar-aibd", from: "Dakar", to: "AIBD", pricesId: "aibd-dakar" },
  { id: "aibd-dakar", from: "AIBD", to: "Dakar", pricesId: "aibd-dakar" },
  { id: "aibd-saly", from: "AIBD", to: "Saly", pricesId: "aibd-saly" },
  { id: "saly-aibd", from: "Saly", to: "AIBD", pricesId: "aibd-saly" },
  { id: "dakar-saly", from: "Dakar", to: "Saly", pricesId: "dakar-saly" },
  { id: "saly-dakar", from: "Saly", to: "Dakar", pricesId: "dakar-saly" },
];

// ---- Car rental fleet (self-drive). daily = "Full Day Hire (Dakar)". Photos: bucket "rentals/{slug}.*" ----
// transmission/fuel/seats are best-guess defaults — adjust if needed.
const CARS = [
  { id: "megane", name: "Renault Megane", type: "Berline Standard", year: 2021, seats: 5, bags: 2, transmission: "Manual", fuel: "Petrol", daily: 50000, location: "Dakar", available: true, slug: "renault-megane" },
  { id: "elantra", name: "Hyundai Elantra", type: "Berline Prestige", year: 2021, seats: 5, bags: 3, transmission: "Automatic", fuel: "Petrol", daily: 60000, location: "Dakar", available: true, slug: "hyundai-elantra" },
  { id: "accord", name: "Honda Accord", type: "Berline Premium", year: 2023, seats: 5, bags: 3, transmission: "Automatic", fuel: "Petrol", daily: 70000, location: "Dakar", available: true, slug: "honda-accord" },
  { id: "santafe", name: "Hyundai Santa Fe", type: "SUV Standard", year: 2014, seats: 7, bags: 4, transmission: "Automatic", fuel: "Diesel", daily: 65000, location: "Dakar", available: false, slug: "hyundai-santafe" },
  { id: "prado", name: "Toyota Prado VX", type: "4X4", year: 2022, seats: 7, bags: 4, transmission: "Automatic", fuel: "Diesel", daily: 120000, location: "Dakar", available: true, slug: "prado-vx" },
  { id: "metris", name: "Mercedes Metris", type: "Van", year: 2020, seats: 8, bags: 6, transmission: "Automatic", fuel: "Diesel", daily: 130000, location: "Dakar", available: true, slug: "mercedes-metris" },
];

function VehiclePhoto({ url, name, height }) {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, [url]);
  return (
    <div style={{ marginTop: 10, height, display: "flex", alignItems: "center", justifyContent: "flex-start", background: "transparent", fontSize: 44 }}>
      {ok && url ? <img src={url} alt={name} onError={() => setOk(false)} style={{ height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain", display: "block" }} /> : <Car size={40} color={T.green} strokeWidth={1.5} />}
    </div>
  );
}

function TransferCheckout({ detail, user, onClose, onConfirm }) {
  const [bill, setBill] = useState(() => { const [fn, ...rn] = (user?.name || "").split(" "); return { firstName: fn || "", lastName: rn.join(" ") || "", email: user?.email || "", phone: "", address: "", city: "", country: "" }; });
  const [accepted, setAccepted] = useState(false);
  const total = detail.total;
  const promo = usePromo(total);

  const rows = detail.rows || [["Service", detail.route], ["Vehicle", detail.vehicle], ["Date", detail.date || "—"], ["Pick-up", detail.time], ["Passengers", detail.pax]];

  const confirm = () => {
    if (!billValid(bill) || !accepted) return;
    const base = detail.record || { tour: detail.tour, date: detail.date, adults: detail.pax, children: 0, infants: 0, transfer: { time: detail.time, unit: detail.unit } };
    const name = `${bill.firstName} ${bill.lastName}`.trim();
    sendAgencyEmail({
      access_key: WEB3FORMS_KEY_LOGISTICS,
      subject: `Transfer request — ${detail.route || detail.title || "transport"}`,
      from_name: "ATS Transfers",
      name, email: bill.email, phone: bill.phone,
      Billing_address: [bill.address, bill.city, bill.country].filter(Boolean).join(", "),
      ...rowsToFields(rows),
      Total_XOF: total,
    });
    onConfirm({ ...base, plan: "full", months: 0, schedule: "", total, deposit: 0, contact: { ...bill, name }, promoCode: promo.valid ? promo.promo.code : "" });
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, marginTop: 0 }}>{detail.title || "Confirm your transfer"}</h3>
      <div style={{ background: "#f8f8f8", border: "1px solid #ECECEC", borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: 1.7 }}>
        {rows.map(([l, v]) => <Row key={l} l={l} v={v} />)}
        {promo.active && <div style={{ display: "flex", padding: "4px 0", color: T.green, fontWeight: 600 }}><span>{promo.label} · −{promo.pct}%</span><span style={{ marginLeft: "auto" }}>−{fmtXOF(total - promo.payTotal)}</span></div>}
        <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 8, paddingTop: 8, display: "flex", fontSize: 16 }}>
          <strong>Total</strong><strong style={{ marginLeft: "auto" }}>
            {promo.active && <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.5, textDecoration: "line-through", marginRight: 6 }}>{fmtXOF(total)}</span>}
            {fmtXOF(promo.payTotal)} <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.6 }}>{fmtUSD(promo.payTotal)}</span>
          </strong>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "#6B7A72", marginTop: 8 }}>{IS_CORPORATE ? "Booked on your corporate account — invoiced by ATS, no payment today." : "Confirmed with full payment — no instalment plan."}</div>

      <div style={sect}>Reservation & billing details</div>
      <BillingFields bill={bill} setBill={setBill} />
      {!promo.corporate && !IS_CORPORATE && <PromoField p={promo} />}

      <TermsCheck checked={accepted} onChange={setAccepted} />
      <button disabled={!billValid(bill) || !accepted} style={{ ...btnGold, width: "100%", marginTop: 12, background: IS_CORPORATE ? T.indigo : undefined, color: IS_CORPORATE ? "#fff" : undefined, opacity: (billValid(bill) && accepted) ? 1 : 0.55, cursor: (billValid(bill) && accepted) ? "pointer" : "not-allowed" }} onClick={confirm}>
        {IS_CORPORATE ? `Book now — pay later (${fmtXOF(promo.payTotal)})` : `Pay in full — ${fmtXOF(promo.payTotal)}`}
      </button>
    </Overlay>
  );
}

// Full-page car-rental checkout (replaces the old modal). Neutral #F8F8F8 panels, car photo.
function RentalCheckoutPage({ detail, user, onBack, onConfirm }) {
  const [bill, setBill] = useState(() => { const [fn, ...rn] = (user?.name || "").split(" "); return { firstName: fn || "", lastName: rn.join(" ") || "", email: user?.email || "", phone: "", address: "", city: "", country: "" }; });
  const [accepted, setAccepted] = useState(false);
  const total = detail.total;
  const promo = usePromo(total);
  const rows = detail.rows || [];
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const confirm = () => {
    if (!billValid(bill) || !accepted) return;
    const base = detail.record || {};
    const name = `${bill.firstName} ${bill.lastName}`.trim();
    sendAgencyEmail({
      access_key: WEB3FORMS_KEY_LOGISTICS,
      subject: `Car rental — ${detail.carName || "vehicle"}`,
      from_name: "ATS Car Rental",
      name, email: bill.email, phone: bill.phone,
      Billing_address: [bill.address, bill.city, bill.country].filter(Boolean).join(", "),
      ...rowsToFields(rows),
      Total_XOF: total,
    });
    onConfirm({ ...base, plan: "full", months: 0, schedule: "", total, deposit: 0, contact: { ...bill, name }, promoCode: promo.valid ? promo.promo.code : "" });
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.ink, fontWeight: 700, fontSize: 14, padding: 0, marginBottom: 14 }}>
        <ChevronLeft size={18} /> Back to cars
      </button>
      <h2 className="disp" style={{ fontWeight: 800, fontSize: 24, margin: "0 0 18px" }}>{detail.title || "Confirm your car rental"}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(280px, 380px)", gap: 24, alignItems: "start" }} className="rental-cols">
        {/* Summary — photo (left) + vehicle info (right) */}
        <div style={{ background: "#F8F8F8", border: "1px solid #ECECEC", borderRadius: 16, overflow: "hidden", display: "flex", flexWrap: "wrap" }} className="rental-summary">
          <div style={{ flex: "1 1 240px", minWidth: 220, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #ECECEC", padding: 12, minHeight: 220 }}>
            {detail.image
              ? <img src={detail.image} alt={detail.carName || "Car"} style={{ width: "100%", height: "100%", maxHeight: 240, objectFit: "contain" }} />
              : <Car size={64} color={T.green} strokeWidth={1.3} />}
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 260, padding: "18px 20px" }}>
            {detail.carName && <div className="disp" style={{ fontWeight: 800, fontSize: 18 }}>{detail.carName}</div>}
            {detail.carType && <div style={{ fontSize: 12.5, opacity: 0.6, marginBottom: 10 }}>{detail.carType}</div>}
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              {rows.map(([l, v]) => <Row key={l} l={l} v={v} />)}
              {promo.active && <div style={{ display: "flex", padding: "4px 0", color: T.green, fontWeight: 600 }}><span>{promo.label} · −{promo.pct}%</span><span style={{ marginLeft: "auto" }}>−{fmtXOF(total - promo.payTotal)}</span></div>}
              <div style={{ borderTop: "1px solid #E4E4E4", marginTop: 8, paddingTop: 10, display: "flex", fontSize: 17 }}>
                <strong>Total</strong><strong style={{ marginLeft: "auto" }}>
                  {promo.active && <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.5, textDecoration: "line-through", marginRight: 6 }}>{fmtXOF(total)}</span>}
                  {fmtXOF(promo.payTotal)} <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.55 }}>{fmtUSD(promo.payTotal)}</span>
                </strong>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "#6B7A72", marginTop: 10 }}>{IS_CORPORATE ? "Booked on your corporate account — invoiced by ATS, no payment today." : "Confirmed with full payment — no instalment plan."}</div>
          </div>
        </div>

        {/* Billing */}
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
          <div style={{ ...sect, marginTop: 0 }}>Reservation & billing details</div>
          <BillingFields bill={bill} setBill={setBill} />
          {!promo.corporate && !IS_CORPORATE && <PromoField p={promo} />}
          <TermsCheck checked={accepted} onChange={setAccepted} />
          <button disabled={!billValid(bill) || !accepted} style={{ ...btnGold, width: "100%", marginTop: 12, background: IS_CORPORATE ? T.indigo : undefined, color: IS_CORPORATE ? "#fff" : undefined, opacity: (billValid(bill) && accepted) ? 1 : 0.55, cursor: (billValid(bill) && accepted) ? "pointer" : "not-allowed" }} onClick={confirm}>
            {IS_CORPORATE ? `Book now — pay later (${fmtXOF(promo.payTotal)})` : `Pay in full — ${fmtXOF(promo.payTotal)}`}
          </button>
        </div>
      </div>
      <style>{`@media (max-width: 820px){ .rental-cols{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// Full-page transfer checkout (replaces the old popup): billing details, recap, secure payment.
function TransferCheckoutPage({ detail, user, go, onConfirm }) {
  const [bill, setBill] = useState(() => { const [fn, ...rn] = (user?.name || "").split(" "); return { firstName: fn || "", lastName: rn.join(" ") || "", email: user?.email || "", phone: "", address: "", city: "", country: "" }; });
  const [accepted, setAccepted] = useState(false);
  const vmap = useVehiclePhotoMap();
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  const total = detail?.total || 0;
  const promo = usePromo(total);
  useEffect(() => { if (!detail) go("transport"); }, [detail]);
  if (!detail) return null;

  const rows = detail.rows || [];
  const photo = detail.vehicleSlug ? vmap[detail.vehicleSlug] : null;
  const ready = billValid(bill) && accepted;

  const confirm = () => {
    if (!ready) return;
    const name = `${bill.firstName} ${bill.lastName}`.trim();
    sendAgencyEmail({
      access_key: WEB3FORMS_KEY_LOGISTICS,
      subject: `Transfer request — ${detail.routeLabel || "transport"}`,
      from_name: "ATS Transfers",
      name, email: bill.email, phone: bill.phone,
      Billing_address: [bill.address, bill.city, bill.country].filter(Boolean).join(", "),
      ...rowsToFields(rows),
      Total_XOF: total,
    });
    const base = detail.record || {};
    if (base.tour && !base.tour.thumb && photo) base.tour.thumb = photo;
    onConfirm({ ...base, plan: "full", months: 0, schedule: "", total, deposit: 0, contact: { ...bill, name }, promoCode: promo.valid ? promo.promo.code : "" });
  };

  return (
    <Wrap>
      <button onClick={() => (window.history.length > 1 ? window.history.back() : go("transport"))} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.ink, fontWeight: 700, fontSize: 14, padding: 0, marginBottom: 14, fontFamily: "inherit" }}>
        <ChevronLeft size={18} /> Back
      </button>
      <Eyebrow>ATS Logistics · Transfer booking</Eyebrow>
      <h2 className="disp" style={{ fontWeight: 800, fontSize: "clamp(22px,3vw,28px)", margin: "6px 0 20px", color: T.ink }}>{detail.title || "Confirm your transfer"}</h2>

      <div className="transfer-cols" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px, 400px)", gap: 24, alignItems: "start" }}>
        {/* LEFT — billing */}
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          <div style={{ ...sect, marginTop: 0 }}>Reservation & billing details</div>
          <BillingFields bill={bill} setBill={setBill} />
          {!promo.corporate && !IS_CORPORATE && <PromoField p={promo} />}
          <TermsCheck checked={accepted} onChange={setAccepted} />
          <button disabled={!ready} style={{ ...btnGold, width: "100%", marginTop: 14, padding: "14px 22px", background: IS_CORPORATE ? T.indigo : undefined, color: IS_CORPORATE ? "#fff" : undefined, opacity: ready ? 1 : 0.55, cursor: ready ? "pointer" : "not-allowed" }} onClick={confirm}>
            {IS_CORPORATE ? `Book now — pay later (${fmtXOF(promo.payTotal)})` : `Pay — ${fmtXOF(promo.payTotal)}`}
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12.5, color: "rgba(0,0,0,.8)", marginTop: 10 }}>
            <Shield size={14} color={T.green} /> {IS_CORPORATE ? "Booked on your corporate account — invoiced by ATS" : "Secure payment — instant confirmation by email"}
          </div>
        </div>

        {/* RIGHT — recap */}
        <aside style={{ background: "#F8F8F8", border: "1px solid #ECECEC", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ background: "#fff", borderBottom: "1px solid #ECECEC", padding: 16, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 150 }}>
            {photo ? <img src={photo} alt={detail.vehicleName || "Vehicle"} style={{ width: "100%", maxHeight: 170, objectFit: "contain" }} /> : <Car size={56} color={T.green} strokeWidth={1.3} />}
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
              <Route size={17} color={T.green} strokeWidth={2.2} />
              <span className="disp" style={{ fontWeight: 800, fontSize: 18, color: T.ink }}>{detail.routeLabel}</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,.8)", marginBottom: 12 }}>{detail.vehicleName}{detail.vehicleMeta ? ` · ${detail.vehicleMeta}` : ""}</div>
            <div style={{ fontSize: 14, lineHeight: 1.75 }}>
              {rows.map(([l, v]) => <Row key={l} l={l} v={v} />)}
              {promo.active && <div style={{ display: "flex", padding: "4px 0", color: T.green, fontWeight: 600 }}><span>{promo.label} · −{promo.pct}%</span><span style={{ marginLeft: "auto" }}>−{fmtXOF(total - promo.payTotal)}</span></div>}
              <div style={{ borderTop: "1px solid #E4E4E4", marginTop: 10, paddingTop: 10, display: "flex", fontSize: 17 }}>
                <strong>Total</strong>
                <strong style={{ marginLeft: "auto" }}>
                  {promo.active && <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.5, textDecoration: "line-through", marginRight: 6 }}>{fmtXOF(total)}</span>}
                  {fmtXOF(promo.payTotal)} <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.55 }}>{fmtUSD(promo.payTotal)}</span>
                </strong>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)", marginTop: 10 }}>Fixed rate per vehicle — paid in full, no instalment plan.</div>
          </div>
        </aside>
      </div>
      <style>{`@media (max-width: 860px){ .transfer-cols{ grid-template-columns: 1fr !important; } .transfer-cols aside{ order: -1; } }`}</style>
    </Wrap>
  );
}

function VehiclePickerModal({ prices, vmap, pax, onSelect, onClose }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(11,46,27,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 14, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.paper, borderRadius: 20, width: "100%", maxWidth: 760, margin: "24px 0", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>Choose your vehicle</h3>
          <button onClick={onClose} aria-label="Close" style={{ ...btnCircle, marginLeft: "auto" }}><X size={16} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {VEHICLES.map((v, i) => {
            const ok = v.cap >= pax;
            return (
              <button key={v.slug} disabled={!ok} onClick={() => ok && onSelect(i)}
                className={ok ? "card-hover" : ""} style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.45, padding: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", height: 130, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,.9)", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: T.ink }}>{v.type}</span>
                  {vmap[v.slug] ? <img src={vmap[v.slug]} alt={v.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Car size={44} color={T.green} strokeWidth={1.5} />}
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div className="disp" style={{ fontWeight: 700, fontSize: 15.5 }}>{v.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, opacity: 0.7, margin: "5px 0 8px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Users size={13} /> {v.cap}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Luggage size={13} /> {v.bags}</span></div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: T.green }} className="disp">{fmtXOF(prices[i])}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TransferWidget({ addBooking, compact, user, go }) {
  const [dirI, setDirI] = useState(0);
  const [vehicle, setVehicle] = useState(0);
  const [pax, setPax] = useState(2);
  const [paxOpen, setPaxOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10 h 30");
  const [checkout, setCheckout] = useState(null);
  const [picker, setPicker] = useState(false);
  const vmap = useVehiclePhotoMap();
  const todayStr = new Date().toISOString().slice(0, 10);
  const dir = TRANSFER_DIRECTIONS[dirI];
  const prices = TRANSFER_ROUTES.find((x) => x.id === dir.pricesId).prices;
  const routeLabel = `${dir.from} → ${dir.to}`;
  const veh = VEHICLES[vehicle];
  const price = prices[vehicle];
  const capOk = veh.cap >= pax;
  const complete = capOk && !!date && !!time && pax > 0;

  const openCheckout = () => {
    const detail = {
      title: "Confirm your transfer",
      total: price,
      routeLabel,
      vehicleName: veh.name,
      vehicleSlug: veh.slug,
      vehicleMeta: `${veh.type} · ${veh.cap} passengers · ${veh.bags} bags`,
      rows: [["Route", routeLabel], ["Vehicle", veh.name], ["Date", date], ["Pick-up", time], ["Passengers", pax]],
      record: {
        tour: { emoji: "🚙", name: `${veh.name} — ${routeLabel}`, pole: "Transfer", dur: `${date} · ${time}`, thumb: vmap[veh.slug] || null },
        route: routeLabel, vehicle: veh.name, unit: "transfer", date, time, pax,
        adults: pax, children: 0, infants: 0, transfer: { time, unit: "transfer" },
      },
    };
    if (go) { go("transferCheckout", { detail }); return; }
    setCheckout({ tour: detail.record.tour, route: routeLabel, vehicle: veh.name, unit: "transfer", date, time, pax, total: price });
  };

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: compact ? 16 : 22 }}>
      {!compact && <h3 className="disp" style={{ fontWeight: 700, fontSize: 18, marginTop: 0 }}>Book an airport / city transfer</h3>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <HSelect Ico={Route} label="Route" value={dirI} onChange={setDirI} popWidth={260}
          options={TRANSFER_DIRECTIONS.map((d, i) => ({ v: i, label: `${d.from} → ${d.to}` }))} />
        {/* Vehicle — opens the photo picker popup */}
        <div style={{ ...heroBox, position: "relative", cursor: "pointer", flex: "0 0 auto" }} onClick={() => setPicker(true)} role="button" aria-haspopup="dialog" aria-expanded={picker}>
          {vmap[veh.slug]
            ? <img src={vmap[veh.slug]} alt="" style={{ width: 48, height: 32, objectFit: "contain", flexShrink: 0 }} />
            : <Car size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={heroLab}>Vehicle</div>
            <div style={{ fontSize: 14.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{veh.name} · {fmtXOF(price)}</div>
          </div>
          <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
        </div>
        {picker && <VehiclePickerModal prices={prices} vmap={vmap} pax={pax} onSelect={(i) => { setVehicle(i); setPicker(false); }} onClose={() => setPicker(false)} />}
        <HField Ico={Calendar} label="Transfer date">
          <RangeDate from={date} to={date} onChange={(f) => setDate(f)} triggerStyle={{ background: "transparent", border: "none", padding: 0 }} wide single minDate={todayStr} />
        </HField>
        <div style={{ display: "flex", gap: 10 }}>
          <TimeField label="Pick-up time" value={time} onChange={setTime} />
          {/* Passengers */}
          <div style={{ ...heroBox, position: "relative", cursor: "pointer" }} onClick={() => setPaxOpen((o) => !o)} role="button" aria-haspopup="dialog" aria-expanded={paxOpen}>
            <Users size={19} color={T.green} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={heroLab}>Passengers</div>
              <div style={{ fontSize: 14.5, color: T.ink }}>{pax} passenger{pax > 1 ? "s" : ""}</div>
            </div>
            <ChevronDown size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
            {paxOpen && (
              <>
                <div onClick={(e) => { e.stopPropagation(); setPaxOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
                <div onClick={(e) => e.stopPropagation()} role="dialog" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 91, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 18px 44px rgba(0,0,0,.22)", padding: 20, width: "min(300px, calc(100vw - 28px))", cursor: "default" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, color: T.ink }}>Passengers</div>
                      <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)" }}>Up to {veh.cap} for this vehicle</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <button onClick={() => setPax((p) => Math.max(1, p - 1))} disabled={pax <= 1} aria-label="Less" style={{ ...btnCircle, width: 44, height: 44, fontSize: 20, opacity: pax <= 1 ? 0.4 : 1, cursor: pax <= 1 ? "not-allowed" : "pointer" }}>−</button>
                      <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center", fontSize: 15 }}>{pax}</span>
                      <button onClick={() => setPax((p) => Math.min(50, p + 1))} aria-label="More" style={{ ...btnCircle, width: 44, height: 44, fontSize: 20 }}>+</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <button onClick={(e) => { e.stopPropagation(); setPaxOpen(false); }} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 999, padding: "11px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 22, color: T.green }}>{fmtXOF(price)}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>per vehicle · fixed rate</div>
        </div>
        <button disabled={!complete} style={{ ...heroSearchBtnStyle, marginLeft: "auto", opacity: complete ? 1 : 0.55, cursor: complete ? "pointer" : "not-allowed" }} onClick={() => complete && openCheckout()}>
          <Search size={18} /> Book
        </button>
      </div>
      {!capOk && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 6 }}>This vehicle is too small for {pax} passengers — pick a larger category.</div>}
      {capOk && !date && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 6 }}>Choose a date to continue.</div>}

      {checkout && <TransferCheckout detail={checkout} user={user} onClose={() => setCheckout(null)} onConfirm={(rec) => { setCheckout(null); addBooking(rec); }} />}
    </div>
  );
}

// ---------------- CAR RENTAL ----------------
// Fuel is included in the daily rate below. "Without fuel" deducts this per-day
// placeholder estimate (to be replaced with the transport team's real prices).
const FUEL_PER_DAY = 15000;

const toHOpt = (t) => (t || "").includes(":") ? t.replace(":", " h ") : (t || ""); // "10:30" (hero payload) → "10 h 30" (TIME_OPTS)

function CarRentalWidget({ addBooking, user, initial }) {
  const minDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); // earliest = day after tomorrow (J+2)
  const [pickup, setPickup] = useState(initial?.pickup || "");
  const [dropoff, setDropoff] = useState(initial?.dropoff || "");
  const [dateFrom, setDateFrom] = useState(initial?.dateFrom || "");
  const [dateTo, setDateTo] = useState(initial?.dateTo || "");
  const [puTime, setPuTime] = useState(toHOpt(initial?.puTime) || "10 h 30");
  const [doTime, setDoTime] = useState(toHOpt(initial?.doTime) || "10 h 30");
  const [searched, setSearched] = useState(!!(initial?.pickup && initial?.dateFrom));
  // Keep the criteria the client entered in the hero search (and refresh them on a new search)
  useEffect(() => {
    if (!initial) return;
    if (initial.pickup) setPickup(initial.pickup);
    if (initial.dropoff) setDropoff(initial.dropoff);
    if (initial.dateFrom) setDateFrom(initial.dateFrom);
    if (initial.dateTo) setDateTo(initial.dateTo);
    if (initial.puTime) setPuTime(toHOpt(initial.puTime));
    if (initial.doTime) setDoTime(toHOpt(initial.doTime));
    if (initial.pickup && initial.dateFrom) setSearched(true);
  }, [initial]);
  const [checkout, setCheckout] = useState(null);
  const [fuelById, setFuelById] = useState({}); // car.id -> "with" | "without"
  const cmap = usePhotoMap("rentals");

  const effTo = dateTo || dateFrom; // empty "to" = single-day rental
  const days = dateFrom ? Math.max(1, Math.round((new Date(effTo + "T00:00:00") - new Date(dateFrom + "T00:00:00")) / 86400000)) : 0;
  const canSearch = pickup.trim() && dateFrom;
  const getFuel = (id) => fuelById[id] ?? "with";
  const dailyFor = (car, fuel) => fuel === "without" ? Math.max(0, car.daily - FUEL_PER_DAY) : car.daily;

  const openCheckout = (car) => {
    const fuel = getFuel(car.id);
    const daily = dailyFor(car, fuel);
    const total = daily * days;
    const single = effTo === dateFrom;
    const period = single ? dateFrom : `${dateFrom} → ${effTo}`;
    setCheckout({
      title: "Confirm your car rental",
      total,
      image: cmap[car.slug] || null,
      carName: car.name,
      carType: `${car.type} · ${car.year}`,
      rows: [
        ["Car", car.name],
        ["Pick-up", `${pickup} · ${dateFrom} ${puTime}`],
        ["Return", `${dropoff || pickup} · ${dateFrom !== effTo ? effTo : dateFrom} ${doTime}`],
        ["Duration", `${days} day${days > 1 ? "s" : ""}`],
        ["Fuel", fuel === "with" ? "Included" : "Not included"],
        ["Daily rate", fmtXOF(daily)],
      ],
      record: {
        tour: { emoji: "🚗", name: `${car.name} — ${days}-day rental`, pole: "Car rental", dur: period, thumb: cmap[car.slug] || null },
        date: period,
        adults: car.seats, children: 0, infants: 0,
        rental: { car: car.name, pickup, dropoff: dropoff || pickup, dateFrom, dateTo: effTo, puTime, doTime, days, daily, fuel: fuel === "with" ? "Included" : "Not included" },
      },
    });
  };

  if (checkout) return <RentalCheckoutPage detail={checkout} user={user} onBack={() => setCheckout(null)} onConfirm={(rec) => { setCheckout(null); addBooking(rec); }} />;

  return (
    <div>
      {/* Search form — same fields as the hero widget */}
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
        <div className="hero-fields" style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <HField Ico={MapPin} label="Pick-up">
            <AddressInput bare value={pickup} onChange={setPickup} placeholder="Address in Dakar…" />
          </HField>
          <HField Ico={MapPin} label="Drop-off">
            <AddressInput bare value={dropoff} onChange={setDropoff} placeholder="Same drop-off" />
          </HField>
          <HField Ico={Calendar} label="Dates">
            <RangeDate from={dateFrom} to={dateTo} minDate={minDate} onChange={(f, tt) => { setDateFrom(f); setDateTo(tt); }} triggerStyle={{ background: "transparent", border: "none", padding: 0 }} wide />
          </HField>
          <TimeField label="Pick-up time" value={puTime} onChange={setPuTime} />
          <TimeField label="Drop-off time" value={doTime} onChange={setDoTime} />
          <button disabled={!canSearch} className="hero-search-btn" style={{ ...heroSearchBtnStyle, opacity: canSearch ? 1 : 0.55, cursor: canSearch ? "pointer" : "not-allowed" }} onClick={() => canSearch && setSearched(true)}>
            <Search size={18} /> Search
          </button>
        </div>
        {!canSearch && <div style={{ fontSize: 12.5, color: "rgba(0,0,0,.8)", marginTop: 8 }}>Enter a pick-up location and rental dates to search.</div>}
      </div>

      {/* Results */}
      {searched && canSearch && (
        <>
          {(() => { const avail = CARS.filter((c) => c.available).length; return <div style={{ fontSize: 14, fontWeight: 700, margin: "22px 0 12px" }}>{avail} car{avail > 1 ? "s" : ""} available · {days} day{days > 1 ? "s" : ""}</div>; })()}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {CARS.map((car) => (
              <div key={car.id} className={car.available ? "card-hover" : ""} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", opacity: car.available ? 1 : 0.6 }}>
                <div style={{ position: "relative", height: 150, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: T.ink }}>{car.type} · {car.year}</span>
                  {!car.available && <span style={{ position: "absolute", top: 8, right: 8, background: "#B3261E", color: "#fff", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>Unavailable</span>}
                  {cmap[car.slug] ? <img src={cmap[car.slug]} alt={car.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Car size={46} color={T.green} strokeWidth={1.5} />}
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                  <div className="disp" style={{ fontWeight: 700, fontSize: 16 }}>{car.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                    <span style={{ ...pill(T.indigo), display: "inline-flex", alignItems: "center", gap: 4 }}><Users size={12} /> {car.seats} seats</span>
                    <span style={{ ...pill(T.laterite), display: "inline-flex", alignItems: "center", gap: 4 }}><Settings2 size={12} /> {car.transmission}</span>
                    <span style={{ ...pill(T.green), display: "inline-flex", alignItems: "center", gap: 4 }}><Fuel size={12} /> {car.fuel}</span>
                    <span style={{ ...pill(T.indigo), display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {car.location}</span>
                  </div>
                  {(() => {
                    const fuel = getFuel(car.id);
                    const daily = dailyFor(car, fuel);
                    return (
                      <>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                          {[["with", "With fuel"], ["without", "Without fuel"]].map(([k, l]) => (
                            <button key={k} onClick={() => setFuelById((m) => ({ ...m, [car.id]: k }))}
                              style={{ flex: 1, border: `1.5px solid ${fuel === k ? T.green : T.line}`, background: fuel === k ? T.green : "#fff", color: fuel === k ? "#fff" : T.ink, borderRadius: 10, padding: "6px 8px", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                              <Fuel size={13} /> {l}
                            </button>
                          ))}
                        </div>
                        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: T.green }} className="disp">{fmtXOF(daily)}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}> /day</span></div>
                            <div style={{ fontSize: 12.5, opacity: 0.7 }}>Total {days}d: <strong>{fmtXOF(daily * days)}</strong></div>
                          </div>
                          {car.available
                            ? <button style={{ ...btnGold, marginLeft: "auto", fontSize: 14, padding: "9px 16px" }} onClick={() => openCheckout(car)}>Book</button>
                            : <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#B3261E", fontWeight: 700 }}>Unavailable</span>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TransportPage({ addBooking, notify, user, go, initialRental }) {
  const [tab, setTab] = useState(initialRental ? "rental" : "transfers");
  useEffect(() => { if (initialRental) setTab("rental"); }, [initialRental]);
  return (
    <Wrap>
      <style>{`
        @media(max-width:760px){
          .hero-fields{flex-direction:column !important}
          .hero-search-btn{padding:13px !important}
        }
      `}</style>
      <Eyebrow>ATS Logistics · fixed rates, instant booking</Eyebrow>
      <H2>Transfers & car rental</H2>
      <div style={{ display: "flex", gap: 8, margin: "6px 0 20px" }}>
        {[["transfers", "Transfers", Bus], ["rental", "Car rental", Car]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: "none", cursor: "pointer", background: tab === k ? T.green : "#fff", color: tab === k ? "#fff" : T.ink, borderRadius: 999, padding: "9px 18px", fontWeight: 700, fontSize: 14, boxShadow: `inset 0 0 0 1px ${T.line}`, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon size={16} /> {l}</button>
        ))}
      </div>

      {tab === "transfers" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
          <TransferWidget addBooking={addBooking} user={user} go={go} />
          <div style={{ display: "grid", gap: 12 }}>
            {[[Plane, "Airport transfers", "AIBD ⇄ Dakar or AIBD ⇄ Saly — meet & greet at arrivals, fixed price per vehicle."],
              [Car, "Intercity", "Dakar ⇄ Saly and back — comfortable private transfer, any vehicle category."],
              [Bus, "Groups & coaches", "Sedan to 50-seat motorcoach — delegations, events, team movement."],
              [Clock, "24/7 & flight tracking", "Night arrivals covered; drivers track your flight for delays."]].map(([Icon, n, b]) => (
              <div key={n} className="card-hover" style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Icon size={24} color={T.green} strokeWidth={1.7} style={{ flexShrink: 0, marginTop: 2 }} />
                <div><strong>{n}</strong><div style={{ fontSize: 13.5, color: "#6B7A72", lineHeight: 1.5 }}>{b}</div></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <CarRentalWidget addBooking={addBooking} user={user} initial={initialRental} />
      )}
    </Wrap>
  );
}

// ---------------- BLOG ----------------
const W = "https://africatourismsolutions.com/wp-content/uploads";
const BLOG = [
  {
    slug: "thiebou-dieune", title: "Thiébou Dieune", date: "2025-05-26", tag: "Gastronomie",
    hero: `${W}/2025/04/thieb-djen-senegalaise-01.webp`, images: [],
    excerpt: "Élément incontournable de la gastronomie sénégalaise, le thiébou dieune fait la réputation de toute une nation et s'est exporté à travers le monde.",
    body: [
      "Vous avez dit thiébou dieune ??",
      "Élément incontournable de la gastronomie sénégalaise, le thiébou dieune fait la réputation de toute une nation établie en Afrique de l'Ouest et a fini par s'exporter à travers le monde.",
      "Qu'est-ce donc ce fameux plat qui dès les 12 coups de midi passés décore et embaume l'espace des maisonnées sénégalaises ?",
      "Traduit du wolof au français par « Riz au Poisson », le thiébou dieune est le plat privilégié à l'heure du déjeuner. Il est fait à base de riz, et agrémenté de légumes comme la carotte, le chou, le manioc, l'aubergine…",
      "Comptez à peu près 2 heures de cuisson. Selon les condiments utilisés, il peut être blanc lorsqu'il est cuisiné avec de la tomate farcie — on parlera alors de « thiébou dieune bu wekh » — ou à base de tomate concentrée et de couleur orangée, il s'agit alors du « thiébou dieune bou khonk ».",
      "D'ailleurs, on retrouve également le thiébou dieune chez nos voisins ghanéens et nigériens qui parlent de Jollof rice. Dans ce cas, on peut même retrouver de la salade et du concombre pour accompagner le plat.",
      "Une raison de plus qui nous pousse à poser la question : qui est le vrai auteur de ce plat ?",
    ],
  },
  {
    slug: "tour-de-dakar-en-car-rapide", title: "Tour de Dakar en car rapide", date: "2025-05-21", tag: "Excursion",
    hero: `${W}/2020/11/tour-de-dakar-car-rapide.jpg`, images: [],
    excerpt: "Le car rapide est l'un des moyens de transport les plus populaires au Sénégal. Le tour de Dakar à son bord est une activité à faire entre amis ou en famille.",
    body: [
      "Le car rapide est l'un des moyens de transport les plus populaires au Sénégal. Les Dakarois reconnaissent la valeur de ce petit car aux couleurs jaunes et bleues avec ses fresques florales, et l'apprenti, toujours agile à l'arrière de l'automobile.",
      "Au cours d'une journée ensoleillée, le tour de Dakar est une activité à faire entre amis, collègues ou en famille !",
      "Nous démarrons avec la visite du Monument de la Renaissance africaine, haut de 52 mètres, qui donne une vue splendide sur Dakar. Nous faisons ensuite une escale à la mosquée de la Divinité également située à Ouakam, une belle réalisation architecturale nichée à quelques mètres de l'océan Atlantique.",
      "Pendant notre excursion, nous marquons un arrêt à la Place du Souvenir africain où nous découvrons de grands espaces d'exposition et la carte de l'Afrique. C'est un lieu de retrouvailles et d'expression artistique accolé au centre commercial Sea Plaza.",
      "Nous apercevons même des pêcheurs au loin et décidons de prendre des photos avant de nous diriger vers le Tacos de Lyon pour déjeuner !",
      "Notre tour en car rapide prit fin au village artisanal de Soumbédioune, un site traditionnel où l'on retrouve d'une part des pêcheurs, et de l'autre des artisans. L'originalité de leur travail nous a d'ailleurs poussés à acheter un éventail à base de wax.",
      "Visiter tous ces endroits en une seule journée fut une expérience sympathique à bord de ce symbole du transport urbain dakarois ! Nous vous recommandons vivement ce circuit entre amis ou en famille.",
    ],
  },
  {
    slug: "dakar-capitale-de-lart", title: "Dakar, capitale de l'art !", date: "2024-11-15", tag: "Culture",
    hero: null, images: [],
    excerpt: "Du 7 novembre au 7 décembre 2024, Dakar renoue avec l'art à l'occasion de la Biennale de l'art africain contemporain.",
    body: [
      "Du 7 novembre au 7 décembre 2024, Dakar renoue avec l'art.",
      "Un rendez-vous passionnant attendu par les amateurs d'art, les artistes, les collectionneurs, le grand public…",
      "Tout y passe : peinture, sculpture, arts sonores, arts numériques, photographie… Que vous participiez au IN ou aux Off, découvrez les expositions dans les lieux définis ou dans des endroits insoupçonnés où le maître mot reste l'art.",
      "La Biennale de l'art africain contemporain est l'une des plus grandes rencontres de l'art sur le continent ; cette 15ᵉ édition renforce et ravive le rôle de l'art dans l'émancipation des nations.",
      "Pour l'occasion, un programme riche et diversifié est organisé. Participez aux vernissages, visitez les expositions et assistez aux conférences, tables rondes…",
    ],
  },
  {
    slug: "team-building", title: "Team Building", date: "2024-10-08", tag: "MICE",
    hero: null, images: [],
    excerpt: "Développer ses équipes grâce au team building : détente, renforcement de l'esprit d'équipe et amélioration des valeurs communes.",
    body: [
      "Développer ses équipes grâce au team building.",
      "Le team building se présente comme l'une des activités les plus favorables à la détente, au renforcement de l'esprit d'équipe et à l'amélioration des valeurs communes chez les travailleurs d'une organisation. Pour les petites équipes ou de plus grandes organisations, il est toujours intéressant pour la direction de définir le besoin en team building et d'organiser ce moment spécial de manière annuelle.",
      "Le team building peut avoir plusieurs objectifs : resserrer les liens d'une équipe ou en créer de nouveaux, faciliter l'intégration de nouveaux collaborateurs, acquérir de nouvelles compétences…",
      "En fonction des objectifs fixés, les choix d'activités se présentent ainsi : team building récréatif (activités de groupe physiques et divertissantes), team building tactique (formation du personnel à la gestion des challenges), team building événementiel (événements marquants : anniversaire de la société, pot de départ…).",
      "Chaque activité répond à une thématique élaborée par nos encadreurs et coachs certifiés qui s'assurent du bon déroulement de l'activité. Loin d'être une activité à but uniquement ludique et onéreux, le team building est un signal de l'intérêt de l'entreprise pour ses employés et de sa volonté à construire une équipe soudée, dynamique et productive.",
      "Vous souhaitez organiser un team building ? Écrivez-nous à infos@africatourismsolutions.com",
    ],
  },
  {
    slug: "caravane-2024", title: "Caravane 2024", date: "2024-08-26", tag: "Événement",
    hero: `${W}/2024/08/IMG_9859-copie-768x768.jpeg`,
    images: [`${W}/2024/08/IMG_0212-copie-768x768.jpeg`, `${W}/2024/08/IMG_9903-copie-768x768.jpeg`, `${W}/2024/08/IMG_0059-copie-768x768.jpeg`, `${W}/2024/08/IMG_0114-copie-768x768.jpeg`, `${W}/2024/08/IMG_9831-copie-768x768.jpeg`, `${W}/2024/08/IMG_0250-copie-768x768.jpeg`, `${W}/2024/08/IMG_0087-copie-768x768.jpeg`, `${W}/2024/08/IMG_0323-copie-768x768.jpeg`, `${W}/2024/08/IMG_0318-copie-768x768.jpeg`, `${W}/2024/08/IMG_0302-copie-768x768.jpeg`],
    excerpt: "Des vacances utiles et ludiques avec la Caravane pour les Enfants : clap de fin de la 3ᵉ édition de la caravane touristique.",
    body: [
      "Des vacances utiles et ludiques avec la Caravane pour les Enfants.",
      "Clap de fin de la 3ᵉ édition de la Caravane touristique pour les enfants ! Un moment unique au cours duquel nous amenons les enfants à la découverte des plus belles destinations touristiques du Sénégal.",
      "Cette année, trois destinations ont été à l'honneur : Dakar, Saly et Toubab Dialaw. Nous avons choisi comme base la petite côte pour nos jeunes aventuriers, avec des excursions à Gorée, Saly, Bandia ou encore Toubab Dialaw.",
      "L'un des moments les plus idylliques fut lors de notre visite à Gorée où Colonel, l'un des guides que nous apprécions le plus et le doyen des guides de l'île, a entraîné les enfants pour une visite taillée sur mesure pour leur âge et adaptée à leur sensibilité. Nous en étions ravis !",
      "De retour à Dakar, nous nous sommes rendus à Keur Mbaye Fall pour apporter notre contribution à l'association Les Petites Gouttes qui organisait elle aussi un patronage pour les enfants talibés, albinos et vivant dans les quartiers environnants.",
      "Après cette belle journée, nous avons repris la route, direction la petite côte, plus précisément Saly ! Entre les activités à Accrobaobab, le déjeuner à Bandia, ou encore la journée passée à Ndayane à l'hôtel Pierre de Lisse, il n'y avait pas de place pour l'ennui.",
      "À cela se sont ajoutées les activités de natation, techniques et manuelles animées par nos brillants moniteurs : les enfants ont appris à confectionner des sacs à moquette, des tableaux de décoration, des pots de fleurs et même des activités culinaires sous l'œil avisé de nos encadreurs.",
      "Pour clôturer la caravane, moniteurs et enfants ont échangé sur la thématique « L'impact des réseaux sociaux sur les enfants », l'occasion de rappeler les bases d'un usage d'internet plus sécurisé. Au cours de cette soirée éducative et culturelle, nos aventuriers ont arboré leurs plus belles tenues traditionnelles — un moment de joie que nous chérissons encore, les enfants dansant au rythme des tam-tams, heureux et reconnaissants.",
    ],
  },
  {
    slug: "cap-skirring-la-perle-du-sud", title: "Cap Skirring, la perle du Sud", date: "2023-10-24", tag: "Destination",
    hero: `${W}/2023/10/ats-cap-skirring.jpg`,
    images: [`${W}/2023/10/ats-cap-skirring-escalades-768x768.jpg`, `${W}/2023/10/belle-plage-cap-skirring-768x768.jpg`, `${W}/2023/10/roi-de-oussout-cap-skirring-768x768.jpg`, `${W}/2023/10/jeu-de-loisir-ats-cap-skirring-768x768.jpg`, `${W}/2023/10/champs-cap-skirring-ats-768x768.jpg`, `${W}/2023/10/Cap-skirring-ats-decouvrir-768x768.jpg`],
    excerpt: "Située à Ziguinchor, Cap Skirring est la station balnéaire la plus prisée après la petite côte — la promesse d'un dépaysement total.",
    body: [
      "Les villes au Sud ont le charme d'être des destinations conviviales ! Cap Skirring n'y fait pas exception.",
      "Située dans la région de Ziguinchor, elle est la station balnéaire la plus prisée après la petite côte. Abritant une chaîne d'hôtels variés, des Airbnb atypiques, et riche de sa culture locale et du savoir-faire de ses habitants dans les domaines artistiques ou agricoles, Cap Skirring demeure une ville charmante au potentiel touristique fort ! C'est la promesse d'un dépaysement total.",
      "À partir de Dakar, comptez 1 heure en avion avec les compagnies locales. Un trajet en route est aussi possible et dure une journée — vous pourrez d'ailleurs profiter du paysage. À bord du bateau Aline Sitoé Diatta, vous aurez droit à une vue imprenable sur l'océan Atlantique et les dauphins seront même de sortie de temps à autre !",
      "Pourquoi visiter Cap Skirring ?",
      "🏖️ Paysage — L'environnement naturel est encore préservé. Vous pouvez trouver des pépites comme le village de Kabrousse ou l'hôtel Hibiscus, là où le chant des oiseaux et la vue de l'océan Atlantique sauront vous charmer.",
      "🍽️ Gastronomie — Les fruits, crustacés et gourmandises locales ne manquent pas. Fans de fruits de la passion et de fruits de mer ? Vous serez servis. Vous retrouverez dans les maisons familiales de grandes cours et des arbres fruitiers à foison !",
      "😌 Cyclotourisme — Malgré son statut de ville touristique, le Cap est aussi apprécié pour son calme. Vous pourrez profiter d'une balade à vélo ou escalader 25 mètres de hauteur à la pointe Saint-Georges.",
      "Alors, êtes-vous prêts à découvrir Cap Skirring ? Nous serons là pour vous aider dans l'organisation de votre voyage ! Écrivez-nous à infos@africatourismsolutions.com. À très vite !",
    ],
  },
  {
    slug: "ile-de-goree", title: "Île de Gorée", date: "2023-07-20", tag: "Destination",
    hero: `${W}/2023/03/ile-de-goree-ats-5-scaled.jpg`, images: [],
    excerpt: "Patrimoine mondial de l'UNESCO, l'île de Gorée est le premier site touristique du Sénégal, à 30 minutes de chaloupe de Dakar.",
    body: [
      "Patrimoine mondial classé à l'UNESCO, l'île de Gorée est le premier site touristique du Sénégal. Pour la rejoindre à partir de Dakar, il suffit d'emprunter la chaloupe pour un trajet de 30 minutes.",
      "Découvrez l'histoire et l'architecture de cette île témoin de la traite négrière entre amis, et profitez de la plage en fin de journée.",
    ],
  },
  {
    slug: "le-desert-de-lompoul", title: "Le désert de Lompoul", date: "2023-07-20", tag: "Destination", author: "Abdou Diouf",
    hero: `${W}/2023/02/desert-de-lompoul-ats-0-1.jpg`, images: [],
    excerpt: "Le Sahara en miniature au Sénégal : le désert de Lompoul, un site atypique de dunes ocres entre Dakar et Saint-Louis.",
    body: [
      "Le Sahara en miniature au Sénégal : voici le désert de Lompoul, un site atypique qui vaut le détour. Lompoul est le seul désert du Sénégal et l'un des endroits incontournables à visiter.",
      "Il offre aux visiteurs des paysages sensationnels et un mélange de cultures sénégalo-mauritanien. Le désert de Lompoul est situé entre Dakar et Saint-Louis, sur la frontière atlantique au nord-ouest du Sénégal. Aux alentours se trouvent le village de Lompoul et la ville de Kébémer, mais aussi la mer. Il s'étend sur seulement 18 kilomètres carrés mais paraît très vaste à l'œil nu, formé de dunes de sable ocre pouvant aller jusqu'à 50 mètres de hauteur.",
      "Le désert de Lompoul peut se parcourir à pied pour les adeptes de la randonnée et, pour ceux à la recherche de sensations fortes, s'aventurer dans les dunes à bord d'un 4×4. Pour une découverte plus originale, montez à dos de chameau pour voir ce désert en hauteur. Quel que soit le mode de transport, de magnifiques panoramas attendent ceux qui s'aventurent au sommet des dunes.",
      "Pour ceux qui le souhaitent, vous pourrez passer la nuit dans les camps et lodges destinés à vous faire profiter de la magie d'une nuit étoilée dans les dunes, et vivre le désert comme un nomade. Après une journée d'exploration, les voyageurs se retrouvent au fond des dunes, entourés de plats traditionnels, dans une ambiance chaleureuse au son des tambours.",
      "Alors n'attendez plus, venez vous évader dans le désert de Lompoul avec ATS.",
    ],
  },
  {
    slug: "des-moments-inoubliables", title: "Des moments inoubliables", date: "2023-04-03", tag: "Inspiration",
    hero: `${W}/2023/03/reserve-de-fathala-ats-4-scaled.jpg`, images: [],
    excerpt: "Entre amis, en famille ou en couple, explorez le Sénégal — ses rues colorées, sa culture riche et ses journées ensoleillées.",
    body: [
      "Entre amis, en famille ou en couple, explorez le Sénégal !",
      "Nous vous invitons à une découverte du pays de la Teranga, de ses rues colorées, de sa culture riche, de journées ensoleillées et pleines de rythme.",
      "Plongez dans la région sud, où se mêlent nature et chaleur humaine : une aventure unique. En verte Casamance on découvre des mets savoureux de la terre à l'assiette, dans un cadre chaleureux propice à la détente.",
      "Le long de la côte dakaroise, au bord de l'océan Atlantique, nous saurons dénicher les plus beaux spots pour vous. À 5 heures de Dakar, une petite marche avec les lions et nous foulerons avec enthousiasme la terre du Saloum qui abrite une des plus belles mangroves du pays. Nous irons ensemble au cœur des villes sénégalaises : Kédougou, Lompoul, la petite côte…",
      "Une visite du Sénégal ne pourrait être complète sans un pèlerinage à Saint-Louis autour d'un bon thiébou dieune Penda Mbaye, le plat national sénégalais désormais inscrit au patrimoine mondial de l'UNESCO.",
    ],
  },
  {
    slug: "les-iles-du-saloum", title: "Les îles du Saloum", date: "2023-03-31", tag: "Destination",
    hero: `${W}/2023/03/iles-du-saloum-ats-sine-saloum-6-scaled.jpg`, images: [],
    excerpt: "Une envie de vous éloigner des grandes villes ? Découvrez le Sine Saloum, une région classée à l'UNESCO, riche en biodiversité.",
    body: [
      "Une envie de vous éloigner des grandes villes du Sénégal ? Venez découvrir le Sine Saloum, une région riche en biodiversité.",
      "Classé au patrimoine de l'UNESCO, le delta des deux fleuves — le Sine et le Saloum — a donné naissance à une région de faune et de flore exceptionnelle, avec des paysages de mangroves, d'îlots, de plages et de forêts à couper le souffle.",
      "Le Sine Saloum vous permettra d'être pleinement en contact avec cette nature luxuriante, d'observer les oiseaux et de profiter d'une ambiance chaleureuse et calme. Cette destination vous procurera sérénité et bien-être grâce à ce magnifique paysage verdoyant.",
      "N'hésitez plus et venez explorer le Sine Saloum avec ATS, cet endroit préservé du Sénégal.",
    ],
  },
  {
    slug: "la-lutte-senegalaise", title: "La lutte sénégalaise, un sport passionnant !", date: "2023-03-31", tag: "Culture", author: "Abdou Diouf",
    hero: `${W}/2023/03/273017071_478732156962715_5276060254870059247_n.jpg`, images: [],
    excerpt: "La lutte sénégalaise « bëre », à la fois mystique et divertissante, est un sport national profondément ancré dans la culture du pays.",
    body: [
      "19h ! Du haut des gradins, le public retient son souffle. Des prières muettes sont adressées aux dieux de l'arène, portées par les chants traditionnels des cantatrices sérères. La pression est à son comble et au cœur de l'arène, deux mastodontes couverts de gris-gris se jaugent en attendant le coup de sifflet de l'arbitre. On est dimanche, jour de combat de lutte sénégalaise.",
      "La lutte sénégalaise « bëre » est un élément important dans certains groupes ethniques au Sénégal, en raison de son caractère à la fois mystique et divertissant. Chez les Sérères et les Diolas, les tournois appelés « mbapatt » marquent la fin de l'hivernage et célèbrent l'abondance de la récolte. Ces jeux rassemblent les champions de plusieurs villages et les gagnants sont récompensés par des denrées, du bétail ou autre.",
      "Tout autour de ce sport gravitent des rites à caractère mystique, effectués pour se protéger d'attaques spirituelles et assurer la victoire. Qui dit lutte dit folklore : les lutteurs pénètrent dans l'arène escortés d'une délégation chargée de l'attirail mystique. Potions, talismans et sorts sont présents dans un camp comme dans l'autre, pour se protéger ou intimider l'adversaire.",
      "S'ensuit une animation « bàkk » où le lutteur et sa suite se mettent en formation face au tambour major qui, au rythme du tam-tam, chante les exploits du combattant. Celui-ci n'hésite pas à esquisser des pas de danse et à montrer ses muscles saillants pour déchaîner la foule.",
      "De nos jours, ce qui était une épreuve de courage et d'adresse est devenu un sport de combat professionnalisé incluant des éléments de boxe, d'où l'appellation « lutte avec frappe ». Le CNG est l'organe de régulation de la discipline : il y a victoire en cas de chute d'un lutteur sur la tête, les fesses ou le dos, de 4 appuis (deux mains et deux genoux) ou par KO.",
      "Plusieurs écoles de lutte forment des jeunes au métier de lutteur, « mbër » en wolof. Ce sport national est très apprécié au Sénégal pour sa valeur traditionnelle. Assister à un combat de lutte « lamb » vous permettra de faire l'expérience de l'authenticité sénégalaise et de vous connecter à une culture dans toute sa splendeur.",
    ],
  },
];
const blogDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const setSEO = (title, description) => {
  try {
    document.title = title;
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
    m.setAttribute("content", description || "");
  } catch { /* ignore */ }
};

function BlogPage({ go }) {
  useEffect(() => {
    setSEO("Blog — Africa Tourism Solutions", "Récits de voyage, destinations et culture du Sénégal par Africa Tourism Solutions : Gorée, Sine Saloum, Cap Skirring, désert de Lompoul et bien plus.");
    window.scrollTo({ top: 0 });
  }, []);
  const [feat, ...rest] = BLOG;
  const Card = ({ a, big }) => (
    <button onClick={() => go("article", { slug: a.slug })} className="card-hover" style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ position: "relative", aspectRatio: big ? "16 / 8" : "16 / 10", background: "#EEF2EF", overflow: "hidden" }}>
        {a.hero
          ? <img src={a.hero} alt={a.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: `linear-gradient(120deg, ${T.green}, ${T.indigo})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Newspaper size={40} strokeWidth={1.5} /></div>}
        <span style={{ position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,.92)", color: "#1A1A1A", borderRadius: 999, padding: "4px 12px", fontSize: 11.5, fontWeight: 700 }}>{a.tag}</span>
      </div>
      <div style={{ padding: big ? "20px 22px" : "16px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 12, color: "#8A968E", fontWeight: 600, marginBottom: 6 }}>{blogDate(a.date)}</div>
        <h3 className="disp" style={{ fontWeight: 800, fontSize: big ? 24 : 18, margin: 0, lineHeight: 1.25, color: "#1A1A1A" }}>{a.title}</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(0,0,0,.8)", marginTop: 8, marginBottom: 12 }}>{a.excerpt}</p>
        <span style={{ marginTop: "auto", color: T.green, fontWeight: 700, fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 5 }}>Lire l'article <ArrowRight size={15} /></span>
      </div>
    </button>
  );
  return (
    <Wrap>
      <Eyebrow>Le blog ATS</Eyebrow>
      <H2>Récits, destinations & culture du Sénégal</H2>
      <p style={{ maxWidth: 640, lineHeight: 1.6, color: "rgba(0,0,0,.8)", marginTop: -4 }}>Nos coups de cœur, nos aventures et nos conseils pour découvrir le Sénégal autrement.</p>
      <div style={{ marginTop: 20 }}><Card a={feat} big /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22, marginTop: 22 }}>
        {rest.map((a) => <Card key={a.slug} a={a} />)}
      </div>
    </Wrap>
  );
}

function ArticlePage({ slug, go }) {
  const a = BLOG.find((x) => x.slug === slug) || BLOG[0];
  const [lightbox, setLightbox] = useState(null);
  useEffect(() => {
    setSEO(`${a.title} — Africa Tourism Solutions`, a.excerpt);
    window.scrollTo({ top: 0 });
    let s;
    try {
      s = document.createElement("script");
      s.type = "application/ld+json"; s.id = "ld-article";
      s.text = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline: a.title, datePublished: a.date, author: { "@type": "Organization", name: a.author || "Africa Tourism Solutions" }, image: a.hero || undefined, articleSection: a.tag, publisher: { "@type": "Organization", name: "Africa Tourism Solutions" } });
      document.getElementById("ld-article")?.remove();
      document.head.appendChild(s);
    } catch { /* ignore */ }
    return () => { try { s?.remove(); } catch { /* ignore */ } };
  }, [slug]);
  const more = BLOG.filter((x) => x.slug !== a.slug).slice(0, 3);
  return (
    <Wrap style={{ maxWidth: 820 }}>
      <button onClick={() => go("blog")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.ink, fontWeight: 700, fontSize: 14, padding: 0, marginBottom: 16 }}><ChevronLeft size={18} /> Tous les articles</button>
      <article>
        <div style={{ fontSize: 12.5, color: "#8A968E", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{a.tag} · <time dateTime={a.date}>{blogDate(a.date)}</time></div>
        <h1 className="disp" style={{ fontWeight: 800, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15, margin: "8px 0 0", color: "#1A1A1A" }}>{a.title}</h1>
        {a.author && <div style={{ fontSize: 13.5, color: "#6B7A72", marginTop: 8 }}>Par {a.author}</div>}
        {a.hero && <img src={a.hero} alt={a.title} style={{ width: "100%", borderRadius: 18, marginTop: 18, aspectRatio: "16 / 9", objectFit: "cover" }} />}
        <div style={{ marginTop: 20, fontSize: 16.5, lineHeight: 1.8, color: "#2C3A33" }}>
          {a.body.map((p, i) => <p key={i} style={{ margin: "0 0 18px" }}>{p}</p>)}
        </div>
        {a.images && a.images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 8 }}>
            {a.images.map((src, i) => (
              <button key={i} onClick={() => setLightbox(src)} className="card-hover" style={{ padding: 0, border: "none", borderRadius: 12, overflow: "hidden", cursor: "pointer", aspectRatio: "1 / 1", background: "#EEF2EF" }}>
                <img src={src} alt={`${a.title} ${i + 1}`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}
      </article>

      <div style={{ marginTop: 40, borderTop: `1px solid ${T.line}`, paddingTop: 24 }}>
        <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, margin: "0 0 14px" }}>À lire aussi</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {more.map((x) => (
            <button key={x.slug} onClick={() => go("article", { slug: x.slug })} className="card-hover" style={{ textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", padding: 0 }}>
              <div style={{ aspectRatio: "16 / 10", background: "#EEF2EF" }}>{x.hero ? <img src={x.hero} alt={x.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(120deg, ${T.green}, ${T.indigo})` }} />}</div>
              <div style={{ padding: 12 }}><div style={{ fontSize: 11.5, color: "#8A968E", fontWeight: 600 }}>{blogDate(x.date)}</div><div className="disp" style={{ fontWeight: 700, fontSize: 15, marginTop: 3, color: "#1A1A1A" }}>{x.title}</div></div>
            </button>
          ))}
        </div>
      </div>

      {lightbox && createPortal(
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} />
          <button onClick={() => setLightbox(null)} aria-label="Close" style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: "50%", width: 42, height: 42, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={22} /></button>
        </div>, document.body)}
    </Wrap>
  );
}

// ---------------- FOOTER ----------------
function Footer({ go, notify }) {
  const [email, setEmail] = useState("");
  const head = { fontWeight: 700, marginBottom: 10, color: "#fff", fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" };
  return (
    <footer style={{ background: T.ink, color: "#DCE7DF", padding: "52px 20px 24px", marginTop: 20 }}>
      <style>{`.foot-link{transition:color .15s ease}.foot-link:hover{color:#fff !important}.foot-social:hover{background:rgba(255,255,255,.20) !important}`}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 28, fontSize: 14 }}>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 19, marginBottom: 10, color: "#fff" }}>Africa Tourism Solutions</div>
          <p style={{ color: "rgba(255,255,255,.72)", lineHeight: 1.6, marginTop: 0 }}>Tourism · DMC · Events · Logistics · Travel management. Dakar, Senegal. IATA-accredited.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            {ATS_SOCIALS.map(([s, url]) => (
              <a key={s} href={url} target="_blank" rel="noopener noreferrer" className="foot-social" style={{ background: "rgba(255,255,255,.10)", color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", transition: "background .15s ease" }}>{s}</a>
            ))}
          </div>
        </div>
        <div>
          <div style={head}>Explore</div>
          {[["tours", "Tours & experiences"], ["builder", "Trip Builder"], ["transport", "Transfers & car hire"], ["flights", "Flights"], ["events", "Events & MICE"], ["blog", "Blog"], ["about", "About Us"], ["terms", "Terms & cancellation policy"]].map(([k, l]) => (
            <button key={k} onClick={() => go(k)} className="foot-link" style={{ display: "block", background: "none", border: "none", color: "rgba(255,255,255,.74)", cursor: "pointer", padding: "4px 0", fontSize: 14, fontFamily: "inherit", textAlign: "left" }}>{l}</button>
          ))}
        </div>
        <div>
          <div style={head}>ATS Group</div>
          <p style={{ color: "rgba(255,255,255,.72)", lineHeight: 1.9, marginTop: 0 }}>ATS Travel · ATS Events · ATS Business · ATS Logistics · ATS Evasion · ATS School</p>
        </div>
        <div>
          <div style={head}>Newsletter</div>
          <input style={{ ...input, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.20)", color: "#fff" }} placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button style={{ ...btnGold, marginTop: 8, fontSize: 13.5, padding: "9px 18px" }} onClick={() => { notify(email ? "Subscribed — welcome to the ATS newsletter." : "Enter your email first"); setEmail(""); }}>Subscribe</button>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "34px auto 0", paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.14)", display: "flex", flexWrap: "wrap", gap: "14px 28px", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "rgba(255,255,255,.78)" }}>
          <div>
            <span style={{ color: "#fff", fontWeight: 700 }}>Contact:</span>{" "}
            <a href="tel:+221774807878" className="foot-link" style={{ color: T.gold, fontWeight: 600, textDecoration: "none" }}>+221 77 480 78 78</a> ·{" "}
            <a href="tel:+221338251279" className="foot-link" style={{ color: T.gold, fontWeight: 600, textDecoration: "none" }}>+221 33 825 12 79</a> ·{" "}
            <a href="mailto:infos@africatourismsolutions.com" className="foot-link" style={{ color: T.gold, fontWeight: 600, textDecoration: "none", wordBreak: "break-all" }}>infos@africatourismsolutions.com</a>
          </div>
          <div>Immeuble SICAP, Point E, Lot 8, apt A · Hann Maristes 2, Dakar</div>
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", alignSelf: "flex-end" }}>© 2026 Africa Tourism Solutions</div>
      </div>
    </footer>
  );
}
