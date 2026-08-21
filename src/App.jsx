import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./lib/supabase";
import {
  Landmark, PawPrint, Leaf, TreePalm, Mountain, Utensils, Palette, Route, Bird, Music,
  Compass, Map as MapIcon, Car, Plane, Bus, Clock, Users, Luggage, Fuel, Settings2, MapPin,
  Calendar, Check, X, Star, MessageCircle, Bot, ChevronLeft, ChevronRight, ChevronDown, Heart,
  Menu, Search, Shield, ArrowRight, Package, Globe, Sparkles, Hotel, UserRound, Gift, Trophy,
  Mic, Dumbbell, Languages, CircleCheck, Building2, Ship, Waves,
  CalendarCheck, Newspaper, Video, ConciergeBell, PenTool,
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
  { id: "sn", name: "Senegal", live: true, x: 14.6, y: 29.9, count: "35+ experiences" },
  { id: "rw", name: "Rwanda", live: true, x: 71.2, y: 50.8, count: "Packages available" },
  { id: "cv", name: "Cape Verde", live: false, x: 3.1, y: 28.6 },
  { id: "gm", name: "Gambia", live: false, x: 13.4, y: 35.4 },
  { id: "gn", name: "Guinea", live: false, x: 19.1, y: 35.0 },
  { id: "ma", name: "Morocco", live: false, x: 24.5, y: 7.6 },
  { id: "ci", name: "Ivory Coast", live: false, x: 26.1, y: 38.9 },
  { id: "gh", name: "Ghana", live: false, x: 31.6, y: 38.3 },
  { id: "et", name: "Ethiopia", live: false, x: 83.4, y: 37.6 },
  { id: "ke", name: "Kenya", live: false, x: 80.9, y: 48.0 },
  { id: "tz", name: "Tanzania & Zanzibar", live: false, x: 81.5, y: 55.6 },
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
const label = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#1A1A1A", display: "block", marginBottom: 7 };
// ---------------- RANGE DATE PICKER (single calendar, from → to, past disabled) ----------------
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function RangeDate({ from, to, onChange, triggerStyle }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const todayStr = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const start = from ? new Date(from + "T00:00:00") : now;
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Mon=0
  const canPrev = new Date(view.y, view.m, 1) > new Date(now.getFullYear(), now.getMonth(), 1);

  const pick = (ds) => {
    if (!from || (from && to)) { onChange(ds, ""); return; }
    if (ds < from) { onChange(ds, ""); return; }
    onChange(from, ds); // wait for "Done" — do not auto-close
  };
  const label = from ? (to ? `${from} → ${to}` : `${from} → …`) : "jj/mm/aaaa";

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ ...(triggerStyle || {}), display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", cursor: "pointer", color: T.ink }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: from ? T.ink : "#8A968F" }}>{label}</span>
        <Calendar size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 91, background: "#fff", color: T.ink, border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 18px 40px rgba(0,0,0,.22)", padding: 14, width: "min(290px, calc(100vw - 32px))", maxWidth: "90vw" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <button type="button" disabled={!canPrev} onClick={() => setView((v) => ({ y: v.m === 0 ? v.y - 1 : v.y, m: v.m === 0 ? 11 : v.m - 1 }))}
                style={{ ...btnCircle, opacity: canPrev ? 1 : 0.3, cursor: canPrev ? "pointer" : "not-allowed" }}>‹</button>
              <strong style={{ flex: 1, textAlign: "center", fontSize: 14 }}>{MONTHS[view.m]} {view.y}</strong>
              <button type="button" onClick={() => setView((v) => ({ y: v.m === 11 ? v.y + 1 : v.y, m: v.m === 11 ? 0 : v.m + 1 }))} style={btnCircle}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, fontSize: 11, opacity: 0.55, marginBottom: 4 }}>
              {WD.map((w) => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const ds = iso(view.y, view.m, d);
                const past = ds < todayStr;
                const isFrom = ds === from, isTo = ds === to;
                const inRange = from && to && ds > from && ds < to;
                const sel = isFrom || isTo;
                return (
                  <button key={i} type="button" disabled={past} onClick={() => pick(ds)}
                    style={{ border: "none", borderRadius: 8, padding: "7px 0", fontSize: 13, cursor: past ? "not-allowed" : "pointer",
                      background: sel ? T.green : inRange ? "#E3F3E9" : "transparent", color: past ? "#C7CFCA" : sel ? "#fff" : T.ink, fontWeight: sel ? 700 : 500 }}>
                    {d}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => { onChange("", ""); }} style={{ flex: 1, background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Clear</button>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, background: T.green, color: "#fff", border: "none", borderRadius: 8, padding: "7px", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- LIVE ADDRESS AUTOCOMPLETE (OpenStreetMap / Nominatim, Senegal) ----------------
function AddressInput({ value, onChange, placeholder }) {
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
      <input style={input} value={q} placeholder={placeholder} autoComplete="off"
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); }}
        onFocus={() => results.length && setOpen(true)} />
      {open && results.length > 0 && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 41, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 14px 34px rgba(0,0,0,.18)", overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
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

  // ---- Load this user's bookings from the database (and save any made before sign-in) ----
  const [pending, setPending] = useState([]);
  const mapRow = (r) => ({ ...r.data, _id: r.id, _status: r.status || "pending", _created: r.created_at });
  const reloadBookings = async (uid) => {
    const { data, error } = await supabase.from("bookings").select("id, data, status, created_at").eq("user_id", uid).order("created_at", { ascending: false });
    if (!error && data) setBookings(data.map(mapRow));
  };
  useEffect(() => {
    if (!user) { setBookings([]); return; }
    const sync = async () => {
      if (pending.length) {
        await supabase.from("bookings").insert(pending.map((b) => ({ user_id: user.id, data: b })));
        setPending([]);
      }
      await reloadBookings(user.id);
    };
    sync();
  }, [user?.id]);

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); setBookings([]); go("home"); notify("Signed out"); };

  // ---- Persist a record (booking / quote / itinerary request) ----
  const saveRecord = async (b) => {
    if (user) {
      const { data, error } = await supabase.from("bookings").insert({ user_id: user.id, data: b, status: b.status || "pending" }).select("id, data, status, created_at").single();
      if (error) { console.error("Save failed:", error.message); return null; }
      const rec = mapRow(data);
      setBookings((x) => [rec, ...x]);
      return rec;
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
    const { data, error } = await supabase.functions.invoke("create-payment", {
      body: {
        amount,
        description: `${b.tour?.name || "ATS booking"}${b.plan === "deposit" ? " — 20% deposit" : ""}`,
        bookingId: rec?._id || null,
        customer: b.contact || {},
        siteUrl: window.location.origin,
        meta: { kind: b.plan === "deposit" ? "deposit" : "full" },
      },
    });
    if (error || !data?.url) { notify("Payment could not be started. Please try again."); return; }
    window.location.href = data.url;
  };

  // ---- Pay one Ma Tontine instalment via PayDunya ----
  const payInstallment = async (rec) => {
    if (!rec._id) { notify("This booking can't be paid online yet."); return; }
    const amount = Math.round((rec.total - rec.deposit) / rec.months);
    const nextNo = (rec.paid || 0) + 1;
    notify("Redirecting to secure payment…");
    const { data, error } = await supabase.functions.invoke("create-payment", {
      body: {
        amount,
        description: `${rec.tour?.name || "ATS booking"} — instalment ${nextNo}/${rec.months}`,
        bookingId: rec._id,
        customer: rec.contact || {},
        siteUrl: window.location.origin,
        meta: { kind: "installment" },
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

  const [pendingPay, setPendingPay] = useState(null);
  const go = (name, params = {}) => { setPage({ name, ...params }); window.scrollTo({ top: 0 }); };
  const confirmBooking = (b) => {
    setBooking(null);
    // Quote / itinerary requests: no payment, just save + notify
    if (b.plan === "quote" || b.plan === "itinerary") {
      saveRecord(b);
      notify("Request sent — an ATS advisor will reply with a personalised price.");
      if (!user) setSignin(true); else go("account");
      return;
    }
    // Paid booking (full or deposit) → sign-in required, then PayDunya
    if (!user) { setPendingPay(b); setSignin(true); notify("Sign in to complete your payment."); return; }
    startPayment(b);
  };

  // Resume payment right after the user signs in
  useEffect(() => {
    if (user && pendingPay) { const b = pendingPay; setPendingPay(null); startPayment(b); }
  }, [user?.id]);

  // Handle return from PayDunya (?payment=success|cancel[&token=…]) → confirm + show page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("payment");
    const token = params.get("token");
    if (!p) return;
    window.history.replaceState({}, "", window.location.pathname);
    setPage({ name: "payment", status: p });
    window.scrollTo({ top: 0 });
    if (p === "success" && token) {
      // Safety net: confirm server-side even if the async IPN didn't arrive
      supabase.functions.invoke("confirm-payment", { body: { token } })
        .then(() => supabase.auth.getSession())
        .then(({ data }) => { const uid = data.session?.user?.id; if (uid) reloadBookings(uid); });
    }
  }, []);

  const ctx = { go, notify, setBooking, user, setUser, bookings, filters, setFilters, setSignin, setChat, signOut, saveRecord, patchBooking, cancelBooking, payInstallment, currency, setCurrency };

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

      <Nav {...ctx} page={page} />
      {page.name === "home" && <Home {...ctx} addBookingHome={confirmBooking} />}
      {page.name === "tours" && <ToursPage {...ctx} />}
      {page.name === "tour" && <TourDetail {...ctx} tourId={page.id} />}
      {page.name === "builder" && <TripBuilder {...ctx} />}
      {page.name === "flights" && <FlightsPage {...ctx} />}
      {page.name === "transport" && <TransportPage addBooking={confirmBooking} notify={notify} user={user} />}
      {page.name === "events" && <EventsPage {...ctx} />}
      {page.name === "micework" && <MiceWorkPage {...ctx} service={page.service} />}
      {page.name === "corporate" && <CorporatePage {...ctx} />}
      {page.name === "agents" && <AgentsPage {...ctx} />}
      {page.name === "about" && <AboutPage {...ctx} />}
      {page.name === "account" && <AccountPage {...ctx} />}
      {page.name === "payment" && <PaymentResult status={page.status} {...ctx} />}
      <Footer {...ctx} />

      {booking && <BookingModal tour={booking} user={user} onClose={() => setBooking(null)} onConfirm={confirmBooking} />}
      {signin && <SignInModal onClose={() => setSignin(false)} notify={notify} onDone={(msg) => { setSignin(false); if (msg) notify(msg); }} />}
      {chat && <AIChat onClose={() => setChat(false)} go={go} />}

      {/* Floating WhatsApp + AI */}
      <div style={{ position: "fixed", right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 10, zIndex: 50 }}>
        <a href="https://wa.me/221774807878?text=Bonjour%20ATS%2C%20j'aimerais%20plus%20d'informations." target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: "#25D366", color: "#fff", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          <svg viewBox="0 0 24 24" width="27" height="27" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
        <button onClick={() => setChat(true)} aria-label="AI assistant" style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: T.indigo, color: "#fff", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={24} /></button>
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
function NavSelect({ value, options, onChange, trigger, full }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", width: full ? "100%" : "auto" }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 41 }} />}
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: full ? "space-between" : "center", gap: 8, width: full ? "100%" : "auto", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, padding: "7px 12px 7px 14px", cursor: "pointer", color: T.ink, fontFamily: "inherit" }}>
        {trigger}
        <ChevronDown size={15} color={T.ink} style={{ marginLeft: 4, flexShrink: 0 }} />
      </button>
      {open && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, left: full ? 0 : "auto", zIndex: 42, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 14px 34px rgba(0,0,0,.16)", overflow: "hidden", minWidth: 130 }}>
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", border: "none", background: value === o ? T.paperDark : "#fff", color: T.ink, fontWeight: value === o ? 700 : 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Nav({ go, page, user, setSignin, bookings, currency, setCurrency }) {
  const [open, setOpen] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const logoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/logo.png").data.publicUrl;
  const links = [
    ["home", "Home"], ["tours", "Tours"], ["builder", "Trip Builder"], ["transport", "Transports"], ["flights", "Flights"],
    ["events", "MICE"], ["corporate", "Corporate"], ["agents", "Agents"], ["about", "About Us"],
  ];
  const nav = (k) => { go(k); setOpen(false); };
  // Language UI state (translation wired separately). Currency comes from the app (drives all prices).
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
    <button onClick={() => nav("account")} style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: full ? "flex-start" : "center", color: "#fff", background: T.green, padding: full ? "11px 16px" : "8px 16px", borderRadius: full ? 12 : 999, border: "none", cursor: "pointer", fontWeight: 700, width: full ? "100%" : "auto", boxShadow: full ? "none" : "0 4px 14px rgba(0,146,69,.35)" }}>
      <UserRound size={17} strokeWidth={2.2} /> {user.name.split(" ")[0]} {bookings.length > 0 && `· ${bookings.length}`}
    </button>
  ) : (
    <button onClick={() => { setSignin(true); setOpen(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: full ? "flex-start" : "center", color: "#fff", background: T.green, padding: full ? "11px 16px" : "8px 18px", borderRadius: full ? 12 : 999, border: "none", cursor: "pointer", fontWeight: 700, width: full ? "100%" : "auto", boxShadow: full ? "none" : "0 4px 14px rgba(0,146,69,.35)" }}><UserRound size={17} strokeWidth={2.2} /> Sign in</button>
  );

  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "transparent" }}>
      <style>{`
        .nav-desktop{display:flex}
        .nav-burger{display:none !important}
        .nav-drawer{display:none}
        .nav-link:hover{background:rgba(0,146,69,.10)}
        @media(max-width:980px){
          .nav-desktop{display:none !important}
          .nav-burger{display:flex !important;align-items:center;justify-content:center}
          .nav-drawer{display:block}
        }
      `}</style>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Logo pill — solid white rounded */}
        <button onClick={() => nav("home")} aria-label="Africa Tourism Solutions — home" className="disp" style={{ background: "#fff", border: "1px solid rgba(11,46,27,.06)", boxShadow: "0 6px 22px rgba(11,46,27,.12)", display: "flex", alignItems: "center", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", cursor: "pointer", padding: logoOk ? "7px 18px" : "10px 18px", borderRadius: 999, color: T.ink }}>
          {logoOk
            ? <img src={logoUrl} alt="Africa Tourism Solutions" onError={() => setLogoOk(false)} style={{ height: 34, display: "block" }} />
            : <><span style={{ color: T.green }}>Africa</span>&nbsp;Tourism&nbsp;<span style={{ color: "#C9A902" }}>Solutions</span></>}
        </button>

        {/* Desktop links pill */}
        <div className="nav-desktop" style={{ ...GLASS, marginLeft: "auto", gap: 2, fontSize: 13, fontWeight: 600, alignItems: "center", padding: "6px 8px", borderRadius: 999 }}>
          {links.map(([k, l]) => (
            <button key={k} onClick={() => nav(k)} className="nav-link" style={{ background: page.name === k ? T.green : "transparent", border: "none", cursor: "pointer", color: page.name === k ? "#fff" : T.ink, padding: "8px 12px", borderRadius: 999, fontWeight: page.name === k ? 700 : 600, transition: "background .15s", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>

        {/* Language + currency (desktop) */}
        <div className="nav-desktop">{prefs(false)}</div>

        {/* Account (desktop) */}
        <div className="nav-desktop">{accountBtn(false)}</div>

        {/* Mobile hamburger */}
        <button className="nav-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}
          style={{ ...GLASS, marginLeft: "auto", width: 46, height: 46, borderRadius: 14, cursor: "pointer", color: T.ink }}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="nav-drawer" style={{ ...GLASS, margin: "0 16px", borderRadius: 18, padding: "10px 12px 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {links.map(([k, l]) => (
              <button key={k} onClick={() => nav(k)} style={{ background: page.name === k ? T.green : "transparent", border: "none", cursor: "pointer", color: page.name === k ? "#fff" : T.ink, padding: "12px 12px", borderRadius: 10, fontWeight: page.name === k ? 700 : 600, fontSize: 15, textAlign: "left" }}>{l}</button>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>{prefs(true)}</div>
          <div style={{ marginTop: 12 }}>{accountBtn(true)}</div>
        </div>
      )}
    </nav>
  );
}

// ---------------- HOME ----------------
function Home({ go, notify, setBooking, filters, setFilters, setChat, addBookingHome, user }) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [search, setSearch] = useState({ dest: "Senegal", exp: "All", dateFrom: "", dateTo: "", pax: 2 });
  const featured = ["goree","bandia","lacrose","toubacouta","stlouis","lompoul","food","boat"].map((id) => TOURS.find((t) => t.id === id));
  const todayStr = new Date().toISOString().slice(0, 10);
  const heroUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/hero.jpg").data.publicUrl;

  return (
    <>
      <header style={{
        background: `linear-gradient(160deg, rgba(0,0,0,.58) 0%, rgba(0,0,0,.42) 100%), url("${heroUrl}") center/cover no-repeat, linear-gradient(160deg, #006B33 0%, ${T.green} 65%, #00A84F 100%)`,
        color: T.paper, position: "relative",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px", position: "relative", minHeight: "90vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Eyebrow><span style={{ color: T.gold }}>Stop wondering, start discovering</span></Eyebrow>
          <h1 className="disp" style={{ fontSize: "clamp(30px,5vw,50px)", lineHeight: 1.05, fontWeight: 700, margin: "14px 0 16px", maxWidth: 780, letterSpacing: "-0.02em" }}>
            Africa, organised by the people who live it.
          </h1>
          <p style={{ maxWidth: 560, fontSize: 17, opacity: 0.9, lineHeight: 1.55 }}>
            Tours, flights, hotels, transport, events and full destination management — starting in Senegal, expanding across the continent.
          </p>
          <div style={{ marginTop: 30, background: T.paper, borderRadius: 16, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, boxShadow: "0 18px 40px rgba(0,60,30,.30)" }}>
            <SearchField label="Destination">
              <select style={selStyle} value={search.dest} onChange={(e) => setSearch({ ...search, dest: e.target.value })}>
                {["Senegal", "Rwanda", "More coming soon…"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </SearchField>
            <SearchField label="Experience">
              <select style={selStyle} value={search.exp} onChange={(e) => setSearch({ ...search, exp: e.target.value })}>
                {["All", "Heritage", "Safari", "Nature", "Beach", "Adventure", "Gastronomy", "Culture", "Circuit"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </SearchField>
            <SearchField label="Dates">
              <RangeDate from={search.dateFrom} to={search.dateTo} onChange={(f, tt) => setSearch({ ...search, dateFrom: f, dateTo: tt })} triggerStyle={selStyle} />
            </SearchField>
            <SearchField label="Travelers">
              <select style={selStyle} value={search.pax} onChange={(e) => setSearch({ ...search, pax: e.target.value })}>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} traveler{n > 1 ? "s" : ""}</option>)}
              </select>
            </SearchField>
            <button style={{ ...btnGold, borderRadius: 10 }} onClick={() => { setFilters({ ...filters, tag: search.exp }); go("tours"); }}>Search</button>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>Popular: Gorée Island · Bandia Safari · Lac Rose · Toubacouta · Saint-Louis · Lompoul</div>
        </div>
      </header>

      {/* MAP */}
      <Wrap>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 40, alignItems: "center" }}>
          <div>
            <Eyebrow>One platform · one continent</Eyebrow>
            <H2>Choose your Africa</H2>
            <p style={{ lineHeight: 1.6, opacity: 0.85, marginBottom: 20 }}>
              Senegal is live with 35+ documented experiences across six regions; Rwanda packages are available. New destinations open progressively.
            </p>
            <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {country.live ? <span style={{ width: 12, height: 12, borderRadius: "50%", background: T.green, boxShadow: "0 0 0 4px rgba(0,146,69,.18)" }} /> : <Globe size={24} color={T.laterite} />}
                <div>
                  <div className="disp" style={{ fontWeight: 700, fontSize: 18 }}>{country.name}</div>
                  <div style={{ fontSize: 13, color: country.live ? T.green : T.laterite, fontWeight: 600 }}>
                    {country.live ? `Live now · ${country.count}` : "Coming soon"}
                  </div>
                </div>
              </div>
              {country.live ? (
                <button style={{ ...btnGreen, marginTop: 12, fontSize: 13.5, padding: "9px 18px" }} onClick={() => go("tours")}>
                  Explore {country.name} →
                </button>
              ) : (
                <button style={{ ...btnGold, marginTop: 12, background: T.indigo, color: "#fff", fontSize: 13.5, padding: "9px 18px" }}
                  onClick={() => notify(`You're on the waitlist for ${country.name} — we'll email you at launch.`)}>
                  Notify me when {country.name} opens
                </button>
              )}
            </div>
          </div>
          <svg viewBox="0 0 100 100" role="img" aria-label="Dotted map of Africa with ATS destinations, islands included" style={{ width: "100%", maxWidth: 470, margin: "0 auto", display: "block" }}>
            {DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.62" fill={T.green} opacity="0.55" />)}
            {COUNTRIES.map((c) => (
              <g key={c.id} style={{ cursor: "pointer" }} onClick={() => setCountry(c)}>
                <circle cx={c.x} cy={c.y} r={c.live ? 1.6 : 1.4} fill={c.live ? T.gold : T.indigo} stroke="#fff" strokeWidth="0.4" className={c.live ? "pulse" : ""} />
                <circle cx={c.x} cy={c.y} r="2.2" fill="transparent" />
                {country.id === c.id && <circle cx={c.x} cy={c.y} r="2.3" fill="none" stroke={T.gold} strokeWidth="0.6" />}
              </g>
            ))}
            <text x="50" y="98" textAnchor="middle" fontSize="2.8" fill={T.ink} opacity="0.55">Tap a marker — Cape Verde, Zanzibar, Comoros & Madagascar included</text>
          </svg>
        </div>
      </Wrap>

      {/* QUICK TRANSFER BOOKING (ATS Logistics) */}
      <section style={{ background: "#F8F8F8" }}>
        <Wrap style={{ padding: "36px 20px" }}>
          <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div><Eyebrow>ATS Logistics</Eyebrow><h2 className="disp" style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>Need a transfer or a car? Book it now.</h2></div>
            <button onClick={() => go("transport")} style={{ marginLeft: "auto", background: "none", border: "none", color: T.indigo, fontWeight: 700, cursor: "pointer", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 4 }}>All transport services <ArrowRight size={15} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "stretch" }}>
            <TransferWidget addBooking={addBookingHome} compact user={user} />
            <div style={{ borderRadius: 16, overflow: "hidden", minHeight: 320, background: `linear-gradient(160deg, rgba(0,50,25,.25), rgba(0,107,51,.15)), url("${supabase.storage.from(PHOTO_BUCKET).getPublicUrl("site/transfer.jpg").data.publicUrl}") center/cover no-repeat, linear-gradient(140deg, ${T.green}, ${T.indigo})` }} />
          </div>
        </Wrap>
      </section>

      {/* FEATURED TOURS */}
      <section style={{ background: "#fff", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <Wrap>
          <div style={{ display: "flex", alignItems: "end", flexWrap: "wrap", gap: 12 }}>
            <div><Eyebrow>Senegal · from the ATS catalogue</Eyebrow><H2>Featured tours & experiences</H2></div>
            <button onClick={() => go("tours")} style={{ ...btnGreen, marginLeft: "auto", fontSize: 14 }}>See all tours →</button>
          </div>
          <TourGrid tours={featured} go={go} setBooking={setBooking} />
        </Wrap>
      </section>

      {/* SERVICES */}
      <Wrap>
        <Eyebrow>More than tours</Eyebrow><H2>The full ATS ecosystem</H2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
          {[
            [Plane, "Flights", "IATA-accredited ticketing: domestic, international, multi-city and corporate.", "flights"],
            [Hotel, "Accommodation", "Hotels, resorts, villas, eco-lodges and camps — vetted and contracted by ATS.", "builder"],
            [Car, "Transport", "Airport transfers and vehicle hire at fixed rates — book instantly, no quote needed.", "transport"],
            [Mic, "MICE", "Conferences, incentives, team building, destination weddings, government events.", "events"],
            [Package, "ATS Logistics", "Event logistics, group movement and corporate transport coordination.", "transport"],
            [UserRound, "Concierge", "Meet & greet, visa assistance, VIP services, private guides, translation.", "corporate"],
          ].map(([Icon, name, body, dest]) => (
            <button key={name} className="card-hover" onClick={() => go(dest)} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 20, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: T.ink }}>
              <Icon size={30} color={T.green} strokeWidth={1.7} />
              <h3 className="disp" style={{ fontWeight: 700, fontSize: 18, margin: "10px 0 6px" }}>{name}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.8, margin: 0 }}>{body}</p>
              <div style={{ marginTop: 10, fontWeight: 700, fontSize: 13, color: T.laterite, display: "flex", alignItems: "center", gap: 4 }}>Open <ArrowRight size={14} /></div>
            </button>
          ))}
        </div>
      </Wrap>

      {/* MA TONTINE VOYAGE */}
      <section style={{ background: T.indigo, color: T.paper }}>
        <Wrap style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 36, alignItems: "center" }}>
          <div>
            <Eyebrow><span style={{ color: T.gold }}>Ma Tontine Voyage</span></Eyebrow>
            <H2>Reserve now. Pay in instalments.</H2>
            <p style={{ lineHeight: 1.6, opacity: 0.9 }}>
              Confirm any trip with a <strong style={{ color: T.gold }}>20% deposit</strong> and pay the balance in scheduled instalments before departure — card, PayPal, bank transfer, Orange Money, Wave or M-Pesa. Automatic receipts and reminders by email, SMS and WhatsApp.
            </p>
            <button style={{ ...btnGold, marginTop: 18 }} onClick={() => go("builder")}>Open the Trip Builder</button>
          </div>
          <div style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: T.gold }}>Example payment plan</div>
            <div className="disp" style={{ fontSize: 21, fontWeight: 700, margin: "8px 0 14px" }}>Teranga Package 7 days · {fmtXOF(865000)} pp</div>
            {[["Today — 20% deposit", fmtXOF(173000), true], ["Month 1", fmtXOF(230700)], ["Month 2", fmtXOF(230700)], ["Month 3 — before departure", fmtXOF(230600)]].map(([l, v, hot]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.15)", fontSize: 14.5 }}>
                <span style={{ opacity: 0.9 }}>{l}</span><strong style={{ color: hot ? T.gold : T.paper }}>{v}</strong>
              </div>
            ))}
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

function TourGrid({ tours, go, setBooking }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18, marginTop: 18 }}>
      {tours.map((t) => (
        <article key={t.id} className="card-hover" onClick={() => go("tour", { id: t.id })} style={{ background: T.paper, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", color: "#1A1A1A" }}>
          <Cover tour={t} ratio="4 / 3" size={58} />

          <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", gap: 5, marginBottom: 7, flexWrap: "nowrap", overflow: "hidden" }}>
              <span style={pill()}>{t.pole}</span><span style={pill()}>{t.tag}</span>
              {!t.quote && <span style={pill()}>Group discounts</span>}
            </div>
            <h3 className="disp" style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.2, margin: 0, color: "#1A1A1A" }}>{t.name}</h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.45, color: "#555", flex: 1, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.desc}</p>
            <div style={{ fontSize: 11.5, color: "#777", margin: "8px 0 4px" }}>{t.dur}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                {t.quote ? (
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>Price on request</div>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>from {fmtXOF(fromPrice(t))} <span style={{ fontWeight: 500, fontSize: 11.5, color: "#888" }}>pp</span></div>
                    <div style={{ fontSize: 11, color: "#888" }}>group rate · 1–2 pax: {fmtXOF(t.grid.p12.a)}</div>
                  </>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setBooking(t); }} style={{ marginLeft: "auto", background: t.quote ? "#1A1A1A" : T.gold, color: t.quote ? "#fff" : T.ink, border: "none", borderRadius: 10, padding: "8px 15px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", flexShrink: 0 }}>{t.quote ? "Get quote" : "Book"}</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
const pill = () => ({ fontSize: 10, fontWeight: 500, color: "#1A1A1A", background: "#F2F2F2", border: "none", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 });

function ToursPage({ go, setBooking, filters, setFilters }) {
  const tags = ["All", ...new Set(TOURS.map((t) => t.tag))];
  const tours = TOURS.filter((t) => (filters.pole === "All" || t.pole === filters.pole) && (filters.tag === "All" || t.tag === filters.tag));
  return (
    <Wrap>
      <Eyebrow>Senegal · 6 regions · transport quoted separately</Eyebrow>
      <H2>All tours & experiences</H2>
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
          No tours match these filters yet. <button style={{ ...btnGreen, marginLeft: 8, fontSize: 13, padding: "8px 14px" }} onClick={() => setFilters({ pole: "All", tag: "All" })}>Reset filters</button>
        </div>
      ) : <TourGrid tours={tours} go={go} setBooking={setBooking} />}
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

function TourDetail({ tourId, go, setBooking }) {
  const t = TOURS.find((x) => x.id === tourId) || TOURS[0];
  const [mlat, mlon] = tourCoords(t);
  const [fav, setFav] = useState(false);
  const [pax, setPax] = useState(2);
  const [extras, setExtras] = useState([]);
  const [vehicle, setVehicle] = useState(-1);      // -1 = no transport
  const [preview, setPreview] = useState(null);   // gallery lightbox index
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>Photos coming soon — tap any tile to preview (swipe on mobile). Real imagery will replace these placeholders.</div>
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
            <p style={{ fontSize: 15, lineHeight: 1.75, margin: 0, color: "#3B4A42", maxWidth: 640 }}>{t.desc}</p>
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
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22, position: "sticky", top: 80 }}>
            {t.quote ? (
              <div className="disp" style={{ fontWeight: 800, fontSize: 22, color: "#1A1A1A" }}>Price on request</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="disp" style={{ fontWeight: 800, fontSize: 26, color: "#1A1A1A" }}>{fmtXOF(ppUnit)}</span>
                  <span style={{ fontSize: 13, opacity: 0.6 }}>/ person</span>
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.6 }}>{fmtXOF(ppUnit)} · {tierLabel[tier]}</div>

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
                  <label style={label}>Travel dates</label>
                  <RangeDate from={dateFrom} to={dateTo} onChange={(f, tt) => { setDateFrom(f); setDateTo(tt); }} triggerStyle={input} />
                  {dateOk && (
                    <div style={{ fontSize: 12, marginTop: 5, color: "#5A6B61", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
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
                  <span style={{ opacity: 0.7 }}>Estimated total</span>
                  <strong style={{ marginLeft: "auto" }}>{fmtXOF(estTotal)}</strong>
                </div>
                <div style={{ background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6, marginTop: 10, color: "#3B4A42" }}>
                  <strong style={{ color: "#1A1A1A" }}>Ma Tontine Voyage:</strong> reserve with {fmtXOF(estTotal * 0.2)} (20%), balance in instalments before departure.
                </div>
              </>
            )}

            {t.quote ? (
              <button style={{ ...btnGold, width: "100%", marginTop: 14, borderRadius: 12, background: T.indigo, color: "#fff" }} onClick={() => openBooking("quote")}>Request a quote</button>
            ) : (
              <>
                <button disabled={!dateOk} style={{ ...btnGold, width: "100%", marginTop: 14, borderRadius: 12, opacity: dateOk ? 1 : 0.5, cursor: dateOk ? "pointer" : "not-allowed" }} onClick={() => dateOk && openBooking("full")}>Pay in full</button>
                <button disabled={!tontinePossible} style={{ width: "100%", marginTop: 8, background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 800, cursor: tontinePossible ? "pointer" : "not-allowed", fontSize: 15, opacity: tontinePossible ? 1 : 0.5 }} onClick={() => tontinePossible && openBooking("deposit")}>Pay with Ma Tontine (20%)</button>
                {!dateOk && <div style={{ fontSize: 12.5, color: "#8A968E", marginTop: 8, textAlign: "center" }}>Choose a travel date to book.</div>}
              </>
            )}
            <button style={{ width: "100%", marginTop: 8, background: "#fff", color: "#1A1A1A", border: "1.5px solid #1A1A1A", borderRadius: 12, padding: "11px 14px", fontWeight: 700, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => go("builder")}>
              <Sparkles size={16} /> Build a 100% custom trip
            </button>
            <button style={{ background: "none", border: "none", cursor: "pointer", marginTop: 10, fontWeight: 600, color: "#1A1A1A", fontSize: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setFav(!fav)}>
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
        {t.quote ? (
          <button style={{ ...btnGold, width: "100%", borderRadius: 12, background: T.indigo, color: "#fff" }} onClick={() => openBooking("quote")}>Request a quote</button>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#1A1A1A" }} className="disp">{fmtXOF(estTotal)}</div>
                <div style={{ fontSize: 11.5, opacity: 0.6 }}>{fmtXOF(ppUnit)} /pers · {pax} pax</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPax(Math.max(1, pax - 1))} style={btnCircle} aria-label="Fewer">−</button>
                <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>{pax}</span>
                <button onClick={() => setPax(pax + 1)} style={btnCircle} aria-label="More">+</button>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <RangeDate from={dateFrom} to={dateTo} onChange={(f, tt) => { setDateFrom(f); setDateTo(tt); }} triggerStyle={input} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={!dateOk} style={{ ...btnGold, flex: 1, borderRadius: 12, fontSize: 14, padding: "12px 8px", opacity: dateOk ? 1 : 0.5 }} onClick={() => dateOk && openBooking("full")}>Pay in full</button>
              <button disabled={!tontinePossible} style={{ flex: 1, background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 12, padding: "12px 8px", fontWeight: 800, cursor: tontinePossible ? "pointer" : "not-allowed", fontSize: 14, opacity: tontinePossible ? 1 : 0.5 }} onClick={() => tontinePossible && openBooking("deposit")}>Ma Tontine</button>
            </div>
            {!dateOk && <div style={{ fontSize: 11.5, color: "#8A968E", marginTop: 6, textAlign: "center" }}>Choose a travel date above to book.</div>}
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
                  <div style={{ fontSize: 11.5, color: "#777", margin: "6px 0 8px" }}>{s.dur}</div>
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "#1A1A1A" }}>{s.quote ? "Price on request" : <>from {fmtXOF(fromPrice(s))}</>}</div>
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
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || "ebabe71e-99df-4752-b59a-bb901b6ce4fb";

function TripBuilder({ notify, go, user, saveRecord }) {
  const [step, setStep] = useState(0);
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
  const HOTEL = { "2★ Eco-lodge / guesthouse": 35000, "3★ Standard hotel": 55000, "4★ Boutique / charme": 90000, "5★ Luxury / resort": 160000 };
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
              <label style={label}>Hotel category</label>
              <select style={{ ...input, fontWeight: 600 }} value={trip.hotel} onChange={(e) => setTrip({ ...trip, hotel: e.target.value })}>
                {Object.keys(HOTEL).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 6 }}>ATS confirms the exact property from its contracted inventory at your chosen star level.</div>
              <button style={{ ...btnGold, marginTop: 16 }} onClick={() => setStep(2)}>Next: experiences →</button>
            </>
          )}
          {step === 2 && (
            <>
              <label style={label}>Pick your experiences ({trip.tours.length} selected)</label>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {TOURS.map((t) => (
                  <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: `1px solid ${T.line}`, cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={trip.tours.includes(t.id)} style={{ width: 16, height: 16, accentColor: T.green }} onChange={() => toggleTour(t.id)} />
                    <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}><CatIcon tour={t} size={17} color={T.green} /> {t.name}</span>
                    <strong style={{ fontSize: 13 }}>{fromPrice(t) ? fmtXOF(fromPrice(t)) : "on request"}</strong>
                  </label>
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
                              <span style={{ flex: 1, color: "#3B4A42" }}>{a.name}</span>
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
                {trip.pax} traveler{trip.pax > 1 ? "s" : ""} · {trip.hotel} hotel · {trip.transport} · {trip.tours.length} experience{trip.tours.length !== 1 ? "s" : ""}: {trip.tours.map((id) => TOURS.find((t) => t.id === id)?.name.split(" —")[0]).join(", ") || "none yet"}
              </p>
              {addonNames.length > 0 && <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5A6B61", marginTop: -4 }}><strong>Add-ons:</strong> {addonNames.join(" · ")}</p>}
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
            <div className="disp" style={{ fontSize: 30, fontWeight: 800, margin: "6px 0 12px", color: "#1A1A1A" }}>{fmtXOF(total)} <span style={{ fontSize: 14, fontWeight: 500, color: "#888" }}>{fmtUSD(total)}</span></div>
            <Row l={`Hotel · ${trip.days} nights`} v={fmtXOF(hotelCost)} />
            <Row l={`Experiences × ${trip.pax} pax`} v={fmtXOF(toursCost)} />
            {addonsCost > 0 && <Row l="Add-ons" v={fmtXOF(addonsCost)} />}
            <Row l="Transport" v={fmtXOF(transCost)} />
            <div style={{ fontSize: 11.5, color: "#8A968E", marginTop: 6 }}>Experiences at group per-person rates; 'on request' items excluded from the estimate.</div>
            <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 10, paddingTop: 10, fontSize: 13.5, lineHeight: 1.6, color: "#3B4A42" }}>
              <strong style={{ color: T.green }}>Ma Tontine Voyage:</strong> reserve today with {fmtXOF(total * 0.2)} (20%), balance in instalments before departure.
            </div>
          </div>
        </aside>
      </div>
    </Wrap>
  );
}

// ---------------- FLIGHTS ----------------
function FlightsPage({ notify, user }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ type: "Round trip", from: "Dakar (DSS)", to: "", dep: "", ret: "", pax: 1, cls: "Economy" });
  const [legs, setLegs] = useState([{ from: "Dakar (DSS)", to: "", dep: "" }, { from: "", to: "", dep: "" }]);
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
          access_key: WEB3FORMS_KEY,
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
      <p style={{ maxWidth: 640, lineHeight: 1.6, color: "#3B4A42" }}>Domestic, international, multi-city and corporate ticketing. Submit a request and our ticketing team responds with the best available fares.</p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "stretch" }} className="flights-grid">
        <style>{`@media(max-width:800px){.flights-grid{grid-template-columns:1fr !important}.flights-img{min-height:200px}}@media(max-width:600px){.leg-grid{grid-template-columns:1fr 1fr !important}}`}</style>

        {/* Left 2/3 — form */}
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          {sent ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: "#E9F7EE", color: T.green }}><Check size={32} /></div>
              <h3 className="disp" style={{ fontWeight: 700, fontSize: 20, margin: "0 0 8px" }}>Request received</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#3B4A42", maxWidth: 420, margin: "0 auto" }}>
                Our ticketing team is searching the best available fares and will reply to <strong>{contact.email}</strong> shortly.
              </p>
              <button style={{ ...btnGreen, marginTop: 18 }} onClick={() => { setSent(false); setF({ type: "Round trip", from: "Dakar (DSS)", to: "", dep: "", ret: "", pax: 1, cls: "Economy" }); setLegs([{ from: "Dakar (DSS)", to: "", dep: "" }, { from: "", to: "", dep: "" }]); }}>New request</button>
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
                      <div><label style={label}>Leg {i + 1} — From</label><input style={input} value={l.from} onChange={(e) => setLeg(i, "from", e.target.value)} placeholder="City (CODE)" /></div>
                      <div><label style={label}>To</label><input style={input} value={l.to} onChange={(e) => setLeg(i, "to", e.target.value)} placeholder="City (CODE)" /></div>
                      <div><label style={label}>Date</label><input type="date" min={todayStr} style={input} value={l.dep} onChange={(e) => setLeg(i, "dep", e.target.value)} /></div>
                      {legs.length > 2 ? <button onClick={() => setLegs((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove leg" style={{ ...btnCircle, marginBottom: 4 }}><X size={14} /></button> : <span />}
                    </div>
                  ))}
                  {legs.length < 6 && (
                    <button onClick={() => setLegs((ls) => [...ls, { from: ls[ls.length - 1].to || "", to: "", dep: "" }])} style={{ background: "none", border: `1.5px dashed ${T.line}`, borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13, color: T.green }}>+ Add a leg</button>
                  )}
                </>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div><label style={label}>From</label><input style={input} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
                  <div><label style={label}>To</label><input style={input} placeholder="e.g. Paris (CDG)" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
                  <div><label style={label}>Departure</label><input type="date" min={todayStr} style={input} value={f.dep} onChange={(e) => setF({ ...f, dep: e.target.value, ret: f.ret && f.ret < e.target.value ? e.target.value : f.ret })} /></div>
                  {f.type === "Round trip" && <div><label style={label}>Return</label><input type="date" min={f.dep || todayStr} style={input} value={f.ret} onChange={(e) => setF({ ...f, ret: e.target.value })} /></div>}
                </div>
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
          : <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15, color: "#3B4A42", whiteSpace: "nowrap" }}><Building2 size={18} color={T.green} strokeWidth={1.8} /> {n}</span>)}
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
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#5A6B61", margin: "0 0 18px", flex: 1 }}>{s.blurb}</p>
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
                  <li key={it} style={{ fontSize: 13, lineHeight: 1.45, color: "#5A6B61", display: "flex", gap: 7 }}>
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
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#3B4A42", maxWidth: 440, margin: "0 auto" }}>
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
      <p style={{ maxWidth: 720, lineHeight: 1.65, color: "#5A6B61", marginTop: 0 }}>Summits, gala dinners, product launches and international conferences delivered end to end since 2018 — for governments, energy majors, global brands and NGOs across Senegal.</p>

      {/* Aggregate figures — white cards with border, taller */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, margin: "30px 0 8px" }}>
        {MICE_STATS.map(([n, l]) => (
          <div key={l} style={{ background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 16, padding: "32px 20px", textAlign: "center", minHeight: 132, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="disp" style={{ fontSize: "clamp(26px,3.2vw,36px)", fontWeight: 800, color: "#1A1A1A" }}>{n}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: "#5A6B61", lineHeight: 1.4 }}>{l}</div>
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
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "#3B4A42", margin: "0 0 14px" }}>{r.note}</p>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#8A968E", marginBottom: 8 }}>What we handled</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {r.scope.map((it) => (
                <li key={it} style={{ fontSize: 12.5, lineHeight: 1.4, color: "#5A6B61", display: "flex", gap: 7 }}>
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

// ---------------- CORPORATE ----------------
function CorporatePage({ notify }) {
  const [org, setOrg] = useState("");
  return (
    <Wrap>
      <Eyebrow>Governments · Embassies · NGOs · Companies</Eyebrow><H2>Corporate travel & logistics</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        <div style={{ lineHeight: 1.7, fontSize: 15 }}>
          <p>One account for your organization's travel in Africa:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Request and approve quotations internally</li>
            <li>Manage traveler groups and missions</li>
            <li>Consolidated monthly invoicing</li>
            <li>ATS Logistics: fleet, coaches (22–50 seats), group movement</li>
            <li>Dedicated account manager, EN/FR</li>
          </ul>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          <h3 className="disp" style={{ fontWeight: 800, fontSize: 19, marginTop: 0 }}>Open a corporate account</h3>
          <label style={label}>Organization</label>
          <input style={input} placeholder="e.g. UNDP Senegal" value={org} onChange={(e) => setOrg(e.target.value)} />
          <label style={{ ...label, marginTop: 12 }}>Work email</label>
          <input style={input} placeholder="name@organization.org" />
          <button style={{ ...btnGold, marginTop: 14, width: "100%" }} onClick={() => notify(`Corporate account request received${org ? " for " + org : ""} — our team will verify and activate your portal.`)}>Request account</button>
        </div>
      </div>
    </Wrap>
  );
}

// ---------------- AGENTS ----------------
function AgentsPage({ notify }) {
  return (
    <Wrap>
      <Eyebrow>Travel agents · Tour operators · Resellers</Eyebrow><H2>Agent & reseller portal</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        <div style={{ lineHeight: 1.7, fontSize: 15 }}>
          <ul style={{ paddingLeft: 20, lineHeight: 2, marginTop: 0 }}>
            <li>Net rates on the full Senegal catalogue</li>
            <li>Commission tracking and monthly statements</li>
            <li>White-label quotations in minutes</li>
            <li>Manage your customers and bookings in one place</li>
          </ul>
          <div style={{ background: T.paperDark, borderRadius: 12, padding: "14px 16px", fontSize: 14 }}>
            <strong>This month:</strong> 12 bookings · 486,000 XOF earned · next payout 30 Aug.
          </div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 }}>
          <h3 className="disp" style={{ fontWeight: 800, fontSize: 19, marginTop: 0 }}>Become an ATS partner</h3>
          <label style={label}>Agency name</label><input style={input} placeholder="Your agency" />
          <label style={{ ...label, marginTop: 12 }}>Country</label><input style={input} placeholder="e.g. France, USA, Nigeria…" />
          <label style={{ ...label, marginTop: 12 }}>Email</label><input style={input} placeholder="you@agency.com" />
          <button style={{ ...btnGold, marginTop: 14, width: "100%" }} onClick={() => notify("Partner application received — our B2B team will send your net-rate agreement.")}>Apply</button>
        </div>
      </div>
    </Wrap>
  );
}

// ---------------- ABOUT ----------------
function AboutPage({ notify }) {
  return (
    <>
      <div style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8F5EF 100%)", color: T.ink, borderBottom: "1px solid #ECE7DD" }}>
        <Wrap style={{ padding: "64px 20px", textAlign: "center" }}>
          <p style={{ color: T.green, fontWeight: 600, letterSpacing: ".14em", fontSize: 12, textTransform: "uppercase", margin: 0 }}>Qui sommes-nous</p>
          <h1 className="disp" style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 700, margin: "10px 0 14px", letterSpacing: "-0.02em", color: "#1A1A1A" }}>About Africa Tourism Solutions</h1>
          <p style={{ maxWidth: 680, margin: "0 auto", fontSize: 17, lineHeight: 1.6, color: "#3B4A42" }}>
            Founded by two young Senegalese entrepreneurs, ATS is the expression of an Africa revalued — historically, touristically and culturally. We exist to break the stereotype of a continent defined by poverty and danger, with a rich, authentic offer that shows its true, majestic beauty.
          </p>
        </Wrap>
      </div>
      <Wrap>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 28 }}>
          <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 76, height: 76, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1px solid #EEE" }}>
                <TeamPhoto slug="alioune-mboup" name="Alioune Mboup" ratio="1 / 1" />
              </div>
              <div>
                <div className="disp" style={{ fontWeight: 800, fontSize: 19, color: "#1A1A1A" }}>Alioune Mboup</div>
                <div style={{ fontSize: 13, color: "#6B7A72", fontWeight: 700 }}>CEO &amp; Co-founder</div>
              </div>
            </div>
            <p style={{ lineHeight: 1.65, fontSize: 15, marginTop: 16, marginBottom: 0, color: "#3B4A42" }}>
              "Through inclusive and innovative solutions, we want to offer locals and visitors a unique experience on African soil. We hope to inspire African youth to discover the grand, majestic beauty of the continent — because educating this generation is essential to preserving our culture and heritage."
            </p>
          </div>
          <div>
            <h3 className="disp" style={{ fontWeight: 800, fontSize: 21, marginTop: 0, color: "#1A1A1A" }}>The ATS Group</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {[["ATS Travel", "Flights & ticketing"], ["ATS Events", "MICE & celebrations"], ["ATS Business", "Corporate & team building"], ["ATS Logistics", "Fleet & group movement"], ["ATS Evasion", "Leisure escapes"], ["ATS School", "Educational travel"]].map(([n, d]) => (
                <div key={n} style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{n}</div>
                  <div style={{ fontSize: 12, color: "#7A867E", marginTop: 2 }}>{d}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, background: "#FAFAFA", border: "1px solid #EEE", borderRadius: 14, padding: "16px 18px", fontSize: 14, lineHeight: 1.7, color: "#3B4A42" }}>
              <strong style={{ color: "#1A1A1A" }}>Contact:</strong>{" "}
              <a href="tel:+221774807878" style={{ color: T.green, fontWeight: 600, textDecoration: "none" }}>+221 77 480 78 78</a> ·{" "}
              <a href="tel:+221338251279" style={{ color: T.green, fontWeight: 600, textDecoration: "none" }}>+221 33 825 12 79</a> ·{" "}
              <a href="mailto:infos@africatourismsolutions.com" style={{ color: T.green, fontWeight: 600, textDecoration: "none", wordBreak: "break-all" }}>infos@africatourismsolutions.com</a><br />
              Immeuble SICAP, Point E, Lot 8, apt A · Hann Maristes 2, Dakar
            </div>
          </div>
        </div>

        <h3 className="disp" style={{ fontWeight: 800, fontSize: 22, margin: "36px 0 14px" }}>Our team</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 16 }}>
          {TEAM.map(([n, r, slug]) => (
            <div key={n} className="card-hover" style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 16, overflow: "hidden" }}>
              <TeamPhoto slug={slug} name={n} ratio="4 / 5" />
              <div style={{ padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{n}</div>
                <div style={{ fontSize: 12, color: "#7A867E", marginTop: 2 }}>{r}</div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="disp" style={{ fontWeight: 800, fontSize: 22, margin: "36px 0 14px" }}>What clients say</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {[["Pauline Edima-Tenwo", "DG, Global Business Group", "Very satisfied for a first experience: availability, excellent value, punctuality, flexibility. I recommend without hesitation."],
            ["Mme Dia", "Client", "A magical Lompoul desert excursion — so rich and well-paced it felt like two full days. Punctuality and smooth logistics deserve praise."],
            ["Caroline", "Family trip", "A huge thank you for organising this memorable trip — we absolutely loved it and hope to return to your magnificent country."]].map(([n, r, q]) => (
            <div key={n} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, fontSize: 14, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}><Stars size={15} /></div>
              <p style={{ margin: "8px 0" }}>{q}</p>
              <strong>{n}</strong> <span style={{ opacity: 0.65 }}>· {r}</span>
            </div>
          ))}
        </div>
        <button style={{ ...btnGreen, marginTop: 20 }} onClick={() => notify("Opening Google Reviews for Africa Tourism Solutions.")}>Leave a review</button>
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
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3B4A42", margin: "0 0 22px" }}>
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
const statusLabel = { pending: "In progress", confirmed: "Confirmed", paid: "Paid", cancelled: "Cancelled", settled: "Fully paid" };
const statusColor = (s) => s === "cancelled" ? "#B3261E" : s === "settled" || s === "confirmed" || s === "paid" ? T.green : T.laterite;

function AccountPage({ user, bookings, setSignin, notify, signOut, patchBooking, cancelBooking, payInstallment }) {
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  if (!user) return (
    <Wrap>
      <H2>My account</H2>
      <p style={{ opacity: 0.8 }}>Sign in to view your bookings, quote requests, payment plans and travel documents.</p>
      <button style={btnGold} onClick={() => setSignin(true)}>Sign in</button>
    </Wrap>
  );
  const tabs = [["all", "All"], ["booking", "Bookings"], ["quote", "Quotes"], ["itinerary", "Itineraries"]];
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

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map(([k, l]) => {
          const n = k === "all" ? bookings.length : bookings.filter((b) => bucket(b) === k).length;
          return <button key={k} onClick={() => setFilter(k)} style={{ border: "none", cursor: "pointer", background: filter === k ? T.green : "#fff", color: filter === k ? "#fff" : T.ink, borderRadius: 999, padding: "8px 16px", fontWeight: 600, fontSize: 13, boxShadow: `inset 0 0 0 1px ${T.line}` }}>{l} {n > 0 && `· ${n}`}</button>;
        })}
      </div>

      {list.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>Nothing here yet — book a tour, request a quote or build a trip and it will appear in this space.</div>
      ) : list.map((b, i) => {
        const paidCount = b.paid || 0; // number of instalments paid (excludes the 20% deposit)
        const perInst = b.plan === "deposit" ? (b.total - b.deposit) / b.months : 0;
        const paidAmount = b.plan === "deposit" ? b.deposit + perInst * paidCount : 0;
        const pct = b.plan === "deposit" && b.total ? Math.round((paidAmount / b.total) * 100) : 0;
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

          {b.plan === "deposit" && b._status !== "cancelled" && (
            <div style={{ background: T.paperDark, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                <span>{pct >= 100 ? "Fully paid" : `Ma Tontine · deposit + ${paidCount}/${b.months} instalment${b.months > 1 ? "s" : ""} paid`}</span>
                <span style={{ color: T.green }}>{pct}%</span>
              </div>
              <div style={{ height: 9, borderRadius: 999, background: "rgba(11,46,27,.12)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.green}, ${T.gold})`, borderRadius: 999, transition: "width .4s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                <span>Paid: {fmtXOF(paidAmount)}</span>
                <span>Remaining: {fmtXOF(b.total - paidAmount)}</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ ...btnGreen, fontSize: 13, padding: "8px 16px" }} onClick={() => setDetail(b)}>View details</button>
            {b.plan === "deposit" && b._status !== "cancelled" && paidCount < b.months && (
              <button style={{ background: "none", border: `1.5px solid ${T.line}`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: T.ink, padding: "8px 16px", fontSize: 13 }}
                onClick={() => payInstallment(b)}>Pay next instalment</button>
            )}
          </div>
        </div>
        );
      })}

      {detail && <BookingDetail rec={detail} onClose={() => setDetail(null)} notify={notify} patchBooking={patchBooking} cancelBooking={cancelBooking} user={user} payInstallment={payInstallment} />}
    </Wrap>
  );
}

function downloadInvoice(rec, user) {
  const remaining = rec.plan === "deposit" ? rec.total - rec.deposit : 0;
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
    rec.plan === "deposit" ? ["Deposit paid", fmtXOF(rec.deposit)] : null,
    rec.plan === "deposit" ? ["Remaining", `${fmtXOF(remaining)} in ${rec.months} instalments`] : null,
    rec.plan === "deposit" ? ["Instalments paid", `${rec.paid || 0} / ${rec.months}`] : null,
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

function BookingDetail({ rec, onClose, notify, patchBooking, cancelBooking, user, payInstallment }) {
  const it = rec.itinerary;
  const remaining = rec.plan === "deposit" ? rec.total - rec.deposit : 0;
  const canCancel = rec._status !== "cancelled" && rec._status !== "settled";
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
        {rec.plan === "deposit" && <>
          <Row l="Deposit paid" v={fmtXOF(rec.deposit)} />
          <Row l="Balance" v={`${fmtXOF(remaining)} · ${rec.months} × ${fmtXOF(remaining / rec.months)}${rec.schedule ? ` over ${rec.schedule}` : ""}`} />
          <Row l="Instalments paid" v={`${rec.paid || 0} / ${rec.months}`} />
        </>}
      </div>

      {(rec.plan === "quote" || rec.plan === "itinerary") && rec._status === "pending" && (
        <div style={{ fontSize: 13.5, opacity: 0.75, marginTop: 12, lineHeight: 1.5 }}>An ATS advisor is reviewing your request and will reply by email with a personalised proposal.</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        {rec.plan === "deposit" && rec._status !== "cancelled" && (rec.paid || 0) < rec.months && (
          <button style={{ ...btnGold, fontSize: 13.5, padding: "9px 16px" }}
            onClick={() => { onClose(); payInstallment(rec); }}>Pay next instalment</button>
        )}
        {rec.plan !== "quote" && rec.plan !== "itinerary" && (
          <button style={{ ...btnGreen, fontSize: 13.5, padding: "9px 16px" }} onClick={() => downloadInvoice(rec, user)}>Download invoice</button>
        )}
        <button style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: T.indigo, fontSize: 13.5 }} onClick={() => notify("Opening WhatsApp chat with ATS: +221 77 480 78 78")}>Contact ATS</button>
        {canCancel && (
          <button style={{ marginLeft: "auto", background: "none", border: `1.5px solid #B3261E`, borderRadius: 10, cursor: "pointer", fontWeight: 700, color: "#B3261E", padding: "9px 16px", fontSize: 13.5 }}
            onClick={async () => { await cancelBooking(rec); onClose(); }}>Cancel {rec.plan === "quote" ? "request" : rec.plan === "itinerary" ? "request" : "booking"}</button>
        )}
      </div>
      <button style={{ background: "none", border: "none", cursor: "pointer", marginTop: 12, fontWeight: 600, color: T.ink, opacity: 0.6, width: "100%", fontSize: 14 }} onClick={onClose}>Close</button>
    </Overlay>
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
  const [dateFrom, setDateFrom] = useState(tour.initialDateFrom || tour.initialDate || "");
  const [dateTo, setDateTo] = useState(tour.initialDateTo || "");
  const date = dateFrom; // start date drives availability / scheduling
  const [adults, setAdults] = useState(tour.initialPax || 2);
  const [children, setChildren] = useState(0); // 3–12
  const [infants, setInfants] = useState(0);  // under 3, free
  const [addons, setAddons] = useState(tour.initialExtras || []);
  const [vehicle, setVehicle] = useState(tour.initialVehicle ?? -1); // -1 = no transport
  const [plan, setPlan] = useState(tour.initialPlan === "deposit" ? "deposit" : "full");
  const [sched, setSched] = useState("3m");
  const [msg, setMsg] = useState("");
  const [bill, setBill] = useState(() => { const [fn, ...rn] = (user?.name || "").split(" "); return { firstName: fn || "", lastName: rn.join(" ") || "", email: user?.email || "", phone: "", address: "", city: "", country: "" }; });
  const toggle = (n) => setAddons((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));

  // ---- Ma Tontine availability vs chosen travel date ----
  const daysUntil = date ? Math.ceil((new Date(date + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000) : null;
  const optAvailable = (o) => daysUntil != null && daysUntil >= o.days;
  const tontineAvailable = TONTINE_OPTIONS.some(optAvailable);
  const selectedOpt = TONTINE_OPTIONS.find((o) => o.key === sched) || TONTINE_OPTIONS[3];
  const months = selectedOpt.n;

  // keep schedule + plan valid when the date changes
  useEffect(() => {
    if (!tontineAvailable) { setPlan((p) => (p === "deposit" ? "full" : p)); return; }
    if (!optAvailable(selectedOpt)) {
      const firstOk = TONTINE_OPTIONS.find(optAvailable);
      if (firstOk) setSched(firstOk.key);
    }
  }, [date]);

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

  return (
    <div role="dialog" aria-modal="true" className="bk-overlay" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(17,24,20,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <style>{`@media(max-width:640px){.bk-overlay{align-items:flex-end !important;padding:0 !important}.bk-modal{max-width:none !important;border-radius:20px 20px 0 0 !important;max-height:94vh !important;padding:20px 18px !important}}`}</style>
      <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: "28px 32px", color: T.ink }}>
        <div style={{ display: "flex", alignItems: "start", gap: 12, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8A968E", textTransform: "uppercase", letterSpacing: ".1em" }}>{tour.pole} · {tour.dur}</div>
            <h3 className="disp" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, margin: "6px 0 0", color: "#1A1A1A" }}>{tour.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ ...btnCircle, marginLeft: "auto" }}><X size={16} /></button>
        </div>

        <div style={sect}>Travel dates</div>
        <RangeDate from={dateFrom} to={dateTo} onChange={(f, tt) => { setDateFrom(f); setDateTo(tt); }} triggerStyle={input} />

        <div style={sect}>Travelers</div>
        <Counter label="Adults" sub={tour.quote ? "" : `${fmtXOF(tg.a)} each at current basis`} value={adults} set={setAdults} min={1} />
        <Counter label="Children (3–12)" sub={tour.quote ? "" : tg.c ? `${fmtXOF(tg.c)} each` : "child rate confirmed at booking"} value={children} set={setChildren} />
        <Counter label="Infants (under 3)" sub="Free" value={infants} set={setInfants} />
        {!tour.quote && (
          <div style={{ marginTop: 10, background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, color: "#3B4A42" }}>
            Basis applied: <strong style={{ color: "#1A1A1A" }}>{tierLabel[tier]}</strong> — {tier !== "grp" ? "add travelers to unlock lower per-person rates." : "best per-person rate unlocked."}
          </div>
        )}

        {tour.quote ? (
          <>
            <div style={sect}>Your request</div>
            <textarea style={{ ...input, minHeight: 70, resize: "vertical" }} placeholder="Dates flexible? Interests? Budget range?" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <button style={{ width: "100%", marginTop: 14, background: T.indigo, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 16, cursor: "pointer" }}
              onClick={() => onConfirm({ tour, date, adults, children, infants, plan: "quote", months: 0, total: 0, deposit: 0 })}>
              Send quote request
            </button>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6, textAlign: "center" }}>An ATS advisor replies with a personalised price by email/WhatsApp.</div>
          </>
        ) : (
          <>
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

            <div style={sect}>Payment</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPlan("full")} style={{ flex: 1, border: `1.5px solid ${plan === "full" ? T.green : T.line}`, background: plan === "full" ? "#fff" : "transparent", borderRadius: 12, padding: "10px 8px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: T.ink }}>Pay in full</button>
              <button onClick={() => tontineAvailable && setPlan("deposit")} disabled={!tontineAvailable} title={!tontineAvailable ? "Choose a travel date further away to pay in instalments" : ""}
                style={{ flex: 1, border: `1.5px solid ${plan === "deposit" ? T.green : T.line}`, background: plan === "deposit" ? "#fff" : "transparent", borderRadius: 12, padding: "10px 8px", fontWeight: 600, fontSize: 13, cursor: tontineAvailable ? "pointer" : "not-allowed", color: T.ink, opacity: tontineAvailable ? 1 : 0.45 }}>
                Ma Tontine Voyage · 20% deposit
              </button>
            </div>
            {!tontineAvailable && (
              <div style={{ marginTop: 10, background: "#F8F5EF", border: "1px solid #ECE7DD", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: "#5A6B61" }}>
                {!date
                  ? "Select a travel date above to unlock Ma Tontine Voyage instalment plans."
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
              </div>
            )}

            <div style={{ marginTop: 18, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, fontSize: 14.5 }}>
              <Row l={`Tour · ${tierLabel[tier]} · ${adults} ad${children ? ` + ${children} ch` : ""}`} v={fmtXOF(calc.base)} />
              {calc.transport > 0 && <Row l={`Transport · ${VEHICLES[vehicle].name}`} v={fmtXOF(calc.transport)} />}
              {chosenAddons.map((a) => <Row key={a.name} l={`+ ${a.name}${a.per === "person" ? ` (×${pax})` : ""}`} v={a.amount != null ? fmtXOF(a.amount) : "on request"} />)}
              <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 8, paddingTop: 10, display: "flex", fontSize: 17 }}>
                <strong>Total</strong>
                <strong style={{ marginLeft: "auto" }}>{fmtXOF(calc.total)} <span style={{ fontWeight: 500, fontSize: 13, opacity: 0.6 }}>{fmtUSD(calc.total)}</span></strong>
              </div>
              {(childAsAdult || onRequestAddons.length > 0) && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: T.laterite, lineHeight: 1.5 }}>
                  {childAsAdult && "Child rate for this tour is confirmed at booking (adult rate shown). "}
                  {onRequestAddons.length > 0 && `${onRequestAddons.length} selected add-on(s) priced on request — quoted before payment.`}
                </div>
              )}
              {plan === "deposit" && tontineAvailable && (
                <div style={{ marginTop: 10, background: "#F7F7F7", border: "1px solid #EEE", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.6, color: "#3B4A42" }}>
                  <strong style={{ color: "#1A1A1A" }}>Due today: {fmtXOF(calc.deposit)}</strong> (20% deposit)<br />
                  Then <strong>{months} × {fmtXOF(calc.installment)}</strong> over {selectedOpt.label} (balance {fmtXOF(calc.total - calc.deposit)}).<br />
                  Fully settled before your travel date{date ? ` (${date})` : ""}. Reminders by email, SMS and WhatsApp.
                </div>
              )}
            </div>

            <div style={sect}>Reservation & billing details</div>
            <BillingFields bill={bill} setBill={setBill} />
            {(!dateFrom || !dateTo) && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 8 }}>Please choose your travel dates (start and end) above to book.</div>}

            <button style={{ width: "100%", marginTop: 14, background: T.gold, color: T.ink, border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: (billValid(bill) && dateFrom && dateTo) ? 1 : 0.55 }}
              disabled={!billValid(bill) || !dateFrom || !dateTo}
              onClick={() => onConfirm({ tour, date: `${dateFrom} → ${dateTo}`, dateFrom, dateTo, adults, children, infants, plan, months, schedule: plan === "deposit" ? selectedOpt.label : "", total: calc.total, deposit: calc.deposit, contact: { ...bill, name: `${bill.firstName} ${bill.lastName}`.trim() }, addons: chosenAddons })}>
              {plan === "deposit" ? `Reserve with ${fmtXOF(calc.deposit)} deposit` : `Pay in full — ${fmtXOF(calc.total)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
const sect = { margin: "22px 0 9px", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".08em", color: T.green };

const COUNTRY_LIST = ["Senegal", "Gambia", "Mali", "Mauritania", "Guinea", "Ivory Coast", "France", "Morocco", "United States", "United Kingdom", "Canada", "Other"];
const billValid = (b) => b.firstName && b.lastName && b.email && b.phone && b.address && b.city && b.country;

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
      <div><label style={label}>Address *</label>
      <input style={input} value={bill.address || ""} onChange={set("address")} placeholder="Street, building, apt" autoComplete="street-address" /></div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>City *</label><input style={input} value={bill.city || ""} onChange={set("city")} autoComplete="address-level2" /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label style={label}>Country *</label>
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
  const total = detail.total;

  const rows = detail.rows || [["Service", detail.route], ["Vehicle", detail.vehicle], ["Date", detail.date || "—"], ["Pick-up", detail.time], ["Passengers", detail.pax]];

  const confirm = () => {
    if (!billValid(bill)) return;
    const base = detail.record || { tour: detail.tour, date: detail.date, adults: detail.pax, children: 0, infants: 0, transfer: { time: detail.time, unit: detail.unit } };
    onConfirm({ ...base, plan: "full", months: 0, schedule: "", total, deposit: 0, contact: { ...bill, name: `${bill.firstName} ${bill.lastName}`.trim() } });
  };

  return (
    <Overlay onClose={onClose}>
      <h3 className="disp" style={{ fontWeight: 800, fontSize: 20, marginTop: 0 }}>{detail.title || "Confirm your transfer"}</h3>
      <div style={{ background: T.paperDark, borderRadius: 12, padding: "12px 14px", fontSize: 14, lineHeight: 1.7 }}>
        {rows.map(([l, v]) => <Row key={l} l={l} v={v} />)}
        <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 8, paddingTop: 8, display: "flex", fontSize: 16 }}>
          <strong>Total</strong><strong style={{ marginLeft: "auto" }}>{fmtXOF(total)} <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.6 }}>{fmtUSD(total)}</span></strong>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "#6B7A72", marginTop: 8 }}>Confirmed with full payment — no instalment plan.</div>

      <div style={sect}>Reservation & billing details</div>
      <BillingFields bill={bill} setBill={setBill} />

      <button disabled={!billValid(bill)} style={{ ...btnGold, width: "100%", marginTop: 14, opacity: billValid(bill) ? 1 : 0.55 }} onClick={confirm}>
        Pay in full — {fmtXOF(total)}
      </button>
    </Overlay>
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

function TransferWidget({ addBooking, compact, user }) {
  const [route, setRoute] = useState(0);
  const [vehicle, setVehicle] = useState(0);
  const [pax, setPax] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [checkout, setCheckout] = useState(null);
  const [picker, setPicker] = useState(false);
  const vmap = useVehiclePhotoMap();
  const todayStr = new Date().toISOString().slice(0, 10);
  const r = TRANSFER_ROUTES[route];
  const price = r.prices[vehicle];
  const capOk = VEHICLES[vehicle].cap >= pax;
  const complete = capOk && !!date && !!time && pax > 0;

  const openCheckout = () => setCheckout({
    tour: { emoji: "🚙", name: `${VEHICLES[vehicle].name} — ${r.name}`, pole: "Transfer", dur: `${date} · ${time}`, thumb: vmap[VEHICLES[vehicle].slug] || null },
    route: r.name, vehicle: VEHICLES[vehicle].name, unit: "transfer", date, time, pax, total: price,
  });

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: compact ? 16 : 22 }}>
      {!compact && <h3 className="disp" style={{ fontWeight: 700, fontSize: 18, marginTop: 0 }}>Book an airport / city transfer</h3>}
      <label style={label}>Route</label>
      <select style={{ ...input, fontWeight: 600 }} value={route} onChange={(e) => setRoute(+e.target.value)}>
        {TRANSFER_ROUTES.map((x, i) => <option key={x.id} value={i}>{x.name}</option>)}
      </select>
      <label style={{ ...label, marginTop: 10 }}>Vehicle</label>
      <button onClick={() => setPicker(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 84, height: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {vmap[VEHICLES[vehicle].slug] ? <img src={vmap[VEHICLES[vehicle].slug]} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Car size={30} color={T.green} strokeWidth={1.5} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{VEHICLES[vehicle].name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.65 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Users size={12} /> {VEHICLES[vehicle].cap}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Luggage size={12} /> {VEHICLES[vehicle].bags}</span><span>{fmtXOF(price)}</span></div>
        </div>
        <span style={{ color: T.green, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Change ›</span>
      </button>
      {picker && <VehiclePickerModal prices={r.prices} vmap={vmap} pax={pax} onSelect={(i) => { setVehicle(i); setPicker(false); }} onClose={() => setPicker(false)} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 10 }}>
        <div><label style={label}>Date</label><input type="date" min={todayStr} style={input} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label style={label}>Pick-up</label><input type="time" style={input} value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div><label style={label}>Passengers</label>
          <select style={input} value={pax} onChange={(e) => setPax(+e.target.value)}>{[1,2,3,4,5,6,7,10,14,22,33,50].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 22, color: T.green }}>{fmtXOF(price)}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>per vehicle · fixed rate</div>
        </div>
        <button disabled={!complete} style={{ ...btnGold, marginLeft: "auto", opacity: complete ? 1 : 0.5, cursor: complete ? "pointer" : "not-allowed" }} onClick={() => complete && openCheckout()}>
          Continue →
        </button>
      </div>
      {!capOk && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 6 }}>This vehicle is too small for {pax} passengers — pick a larger category.</div>}
      {capOk && !date && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 6 }}>Choose a date to continue.</div>}

      {checkout && <TransferCheckout detail={checkout} user={user} onClose={() => setCheckout(null)} onConfirm={(rec) => { setCheckout(null); addBooking(rec); }} />}
    </div>
  );
}

// ---------------- CAR RENTAL ----------------
function CarRentalWidget({ addBooking, user }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [pickup, setPickup] = useState("");
  const [sameReturn, setSameReturn] = useState(true);
  const [dropoff, setDropoff] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [puTime, setPuTime] = useState("10:00");
  const [doTime, setDoTime] = useState("10:00");
  const [searched, setSearched] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const cmap = usePhotoMap("rentals");

  const days = dateFrom && dateTo ? Math.max(1, Math.round((new Date(dateTo + "T00:00:00") - new Date(dateFrom + "T00:00:00")) / 86400000)) : 0;
  const canSearch = pickup.trim() && dateFrom && dateTo && (sameReturn || dropoff.trim());
  const returnLoc = sameReturn ? pickup : dropoff;

  const openCheckout = (car) => {
    const total = car.daily * days;
    setCheckout({
      title: "Confirm your car rental",
      total,
      rows: [
        ["Car", car.name],
        ["Pick-up", `${pickup} · ${dateFrom} ${puTime}`],
        ["Return", `${returnLoc} · ${dateTo} ${doTime}`],
        ["Duration", `${days} day${days > 1 ? "s" : ""}`],
        ["Daily rate", fmtXOF(car.daily)],
      ],
      record: {
        tour: { emoji: "🚗", name: `${car.name} — ${days}-day rental`, pole: "Car rental", dur: `${dateFrom} → ${dateTo}`, thumb: cmap[car.slug] || null },
        date: `${dateFrom} → ${dateTo}`,
        adults: car.seats, children: 0, infants: 0,
        rental: { car: car.name, pickup, returnLoc, dateFrom, dateTo, puTime, doTime, days, daily: car.daily },
      },
    });
  };

  return (
    <div>
      {/* Search form */}
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <label style={label}>Pick-up location</label>
            <AddressInput value={pickup} onChange={setPickup} placeholder="Type an address in Senegal…" />
          </div>
          <div>
            <label style={label}>Return location</label>
            {sameReturn ? (
              <div style={{ ...input, background: T.paperDark, color: "#6B7A72", display: "flex", alignItems: "center" }}>{pickup || "Same as pick-up"}</div>
            ) : (
              <AddressInput value={dropoff} onChange={setDropoff} placeholder="Return address in Senegal…" />
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={sameReturn} onChange={(e) => setSameReturn(e.target.checked)} style={{ accentColor: T.green }} /> Same as pick-up
            </label>
          </div>
          <div>
            <label style={label}>Rental dates</label>
            <RangeDate from={dateFrom} to={dateTo} onChange={(f, tt) => { setDateFrom(f); setDateTo(tt); }} triggerStyle={input} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>Pick-up time</label><input type="time" style={input} value={puTime} onChange={(e) => setPuTime(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={label}>Drop-off time</label><input type="time" style={input} value={doTime} onChange={(e) => setDoTime(e.target.value)} /></div>
          </div>
        </div>
        <button disabled={!canSearch} style={{ ...btnGold, marginTop: 14, opacity: canSearch ? 1 : 0.5, cursor: canSearch ? "pointer" : "not-allowed" }} onClick={() => setSearched(true)}>
          Search available cars
        </button>
        {!canSearch && <div style={{ fontSize: 12.5, color: T.laterite, marginTop: 6 }}>Enter a pick-up location and rental dates to search.</div>}
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
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: T.green }} className="disp">{fmtXOF(car.daily)}<span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}> /day</span></div>
                      <div style={{ fontSize: 12.5, opacity: 0.7 }}>Total {days}d: <strong>{fmtXOF(car.daily * days)}</strong></div>
                    </div>
                    {car.available
                      ? <button style={{ ...btnGold, marginLeft: "auto", fontSize: 14, padding: "9px 16px" }} onClick={() => openCheckout(car)}>Book</button>
                      : <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#B3261E", fontWeight: 700 }}>Unavailable</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {checkout && <TransferCheckout detail={checkout} user={user} onClose={() => setCheckout(null)} onConfirm={(rec) => { setCheckout(null); addBooking(rec); }} />}
    </div>
  );
}

function TransportPage({ addBooking, notify, user }) {
  const [tab, setTab] = useState("transfers");
  return (
    <Wrap>
      <Eyebrow>ATS Logistics · fixed rates, instant booking</Eyebrow>
      <H2>Transfers & car rental</H2>
      <div style={{ display: "flex", gap: 8, margin: "6px 0 20px" }}>
        {[["transfers", "Transfers", Bus], ["rental", "Car rental", Car]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: "none", cursor: "pointer", background: tab === k ? T.green : "#fff", color: tab === k ? "#fff" : T.ink, borderRadius: 999, padding: "9px 18px", fontWeight: 700, fontSize: 14, boxShadow: `inset 0 0 0 1px ${T.line}`, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon size={16} /> {l}</button>
        ))}
      </div>

      {tab === "transfers" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
          <TransferWidget addBooking={addBooking} user={user} />
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
        <CarRentalWidget addBooking={addBooking} user={user} />
      )}
    </Wrap>
  );
}

// ---------------- FOOTER ----------------
function Footer({ go, notify }) {
  const [email, setEmail] = useState("");
  return (
    <footer style={{ background: "#F8F5EF", color: "#1A1A1A", borderTop: "1px solid #ECE7DD", padding: "44px 20px", marginTop: 20 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 24, fontSize: 14 }}>
        <div>
          <div className="disp" style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: "#1A1A1A" }}>Africa Tourism Solutions</div>
          <p style={{ color: "#6B7A72", lineHeight: 1.6 }}>Tourism · DMC · Events · Logistics · Travel management. Dakar, Senegal. IATA-accredited.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            {["Facebook", "Instagram", "X", "LinkedIn"].map((s) => (
              <button key={s} onClick={() => notify(`Opening ATS ${s}…`)} style={{ background: "#F2F2F2", border: "none", color: "#1A1A1A", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#1A1A1A" }}>Explore</div>
          {[["tours", "Tours & experiences"], ["builder", "Trip Builder"], ["transport", "Transfers & car hire"], ["flights", "Flights"], ["events", "Events & MICE"], ["about", "About Us"]].map(([k, l]) => (
            <button key={k} onClick={() => go(k)} style={{ display: "block", background: "none", border: "none", color: "#5A6B61", cursor: "pointer", padding: "4px 0", fontSize: 14, fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#1A1A1A" }}>ATS Group</div>
          <p style={{ color: "#6B7A72", lineHeight: 1.9 }}>ATS Travel · ATS Events · ATS Business · ATS Logistics · ATS Evasion · ATS School</p>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#1A1A1A" }}>Newsletter</div>
          <input style={{ ...input }} placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button style={{ ...btnGold, marginTop: 8, fontSize: 13.5, padding: "9px 18px" }} onClick={() => { notify(email ? "Subscribed — welcome to the ATS newsletter." : "Enter your email first"); setEmail(""); }}>Subscribe</button>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "22px auto 0", fontSize: 12.5, color: "#9AA79F" }}>© 2026 Africa Tourism Solutions</div>
    </footer>
  );
}
