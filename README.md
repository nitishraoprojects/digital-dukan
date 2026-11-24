# Nikavi Labs — Agency Website

Static site built with **HTML, CSS, Bootstrap 5.3, Motion (vanilla JS) and Lucide icons**. No build step.

```
index.html              Main agency site (all sections)
assets/css/styles.css   Brand design system on top of Bootstrap grid
assets/js/config.js     ← YOUR DETAILS GO HERE (WhatsApp, email, booking link, form key)
assets/js/main.js       Animations, navigation, showcase, lead form logic
demos/*.html            7 working concept demos (hotel, restaurant, clinic, jewellery, salon, real estate, retail)
robots.txt, sitemap.xml SEO files (update the domain)
```

## Before launch — fill in `assets/js/config.js`

| Setting | What to put |
|---|---|
| `whatsappNumber` | `91` + your 10-digit mobile, digits only, e.g. `919876543210` |
| `email` | Your business email |
| `bookingUrl` | Google Calendar appointment-schedule link or Calendly 15-min event link |
| `form.accessKey` | Free key from https://web3forms.com (enquiries then land in your inbox) |
| `socials` | Instagram / LinkedIn / Facebook URLs (empty = hidden) |

Until these are filled:
- The lead form still works: it validates, then opens WhatsApp with all the enquiry details pre-written, so no lead is lost.
- "Book a call" buttons fall back to a WhatsApp message requesting a call.

To use Formspree or your own API instead of Web3Forms, set `form.endpoint` to that URL and leave `accessKey` empty. The form POSTs JSON.

When you get a custom domain, replace `https://nikavi.pages.dev/` in `index.html` and `world.html` (canonical + Open Graph), `robots.txt` and `sitemap.xml` with it, and add a 1200×630 `og:image` once you have brand imagery.

## Run locally

```bash
python3 -m http.server 5173
```
Then open http://localhost:5173

## Deploy

Upload the folder to any static host: Netlify (drag & drop), Vercel, GitHub Pages, Cloudflare Pages or regular shared hosting.

## Honesty rules built into the site

- Showcase projects are labelled **Concept** everywhere, and each demo page carries a "concept demo" banner.
- There are no testimonials, client logos, years of experience or client counts. The "Our Promise" section stands in until you have real client stories. Replace it with genuine feedback once you have it.
- Demo photography slots are styled placeholders labelled "photography". Use real photos for client work.

## The Digital City (`world.html`)

A cinematic, scroll-driven 3D experience: a portal intro → flight into the city → five districts where storefront doors open and the business's website emerges into the street → the Nikavi Labs tower finale with pricing and the lead form.

- **Stack:** Three.js r160 (ES modules via import map) + GSAP 3.12 ScrollTrigger. No framework, no build step, no downloaded 3D assets — the city, people, vehicles and screens are all generated in code.
- **Files:** `assets/js/world/` — `main.js` (renderer, camera path, time of day, holograms), `city.js` (districts, buildings, vehicles, tower), `people.js` (tiny animated characters), `effects.js` (sky, particles, fountain), `textures.js` (neon signs, animated website billboards), `audio.js` (synthesised sound, off by default), `form.js` (lead form — same config as the classic site).
- **Website holograms** are real HTML inside the scene (CSS3D) so they stay sharp, readable and clickable. On phones they appear as 2D overlays with a compact layout.
- **Performance:** instanced buildings/lamps/trees/cars, one shared material for all people, distance culling, bloom + shadows on desktop only, automatic quality drop if the frame rate falls.
- **Accessibility:** "Skip Experience" everywhere, keyboard-reachable district jumps, `prefers-reduced-motion` support, and a fallback screen that sends visitors to the classic site if WebGL isn't available.
- **Deep link:** `world.html#city` skips the intro and flies straight in.
- Needs to be served over http(s) (GitHub Pages is fine) — ES modules don't load from `file://`.
