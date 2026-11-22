# Digital Dukan — Agency Website

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

Also replace `https://www.digitaldukan.in/` in `index.html` (canonical + Open Graph), `robots.txt` and `sitemap.xml` with your real domain, and add a 1200×630 `og:image` once you have brand imagery.

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
