# icemax.net

Corporate website for **iceMax SG Pte. Ltd.** — edge-network security and multi-cloud
server architectures, Singapore.

Hugo site with an original iceMax design system. It borrows AnorTechWebUI's *architecture*
(Hugo, Markdown content, layouts, partials, reusable components) and none of its design,
branding, colours or components.

## Run

```bash
npm install          # supplies three + lenis for Hugo's esbuild pipeline
hugo server          # http://localhost:1313
hugo --gc --minify   # static output in public/
```

`public/` is plain static files — deploy to any static host.

## Content is the source of truth

Substantive copy lives in Markdown under `content/`, never in templates.

```
content/
├── _index.md                        home: hero, pillars, seven-part story
├── what-we-do/                      _index + cloudflare, aws, gcp, enterprise-workflow
├── who-we-are/                      _index + our-value, our-team
├── whats-happening/                 announcements index (no entries supplied)
├── join-us/                         roles in front matter, prose in body
├── contact-us/
├── partner-us/
└── legal/                           terms-of-use, privacy-policy
```

Navigation is generated from `menus.main` in `hugo.yaml` plus the page tree —
a menu entry whose page has children renders as a dropdown automatically, so
adding a service or a Who We Are page updates the navbar, drawer, footer,
in-section index and sitemap with no template edit.

Old URLs (`/services/`, `/about/`, `/careers/`, `/contact/`) are kept alive as
aliases, so nothing that was previously linked breaks.

### Content that still needs supplying

Three pages are deliberately incomplete, because the content framework has no
source for them. Each carries a comment block naming what is required:

- **Our Team** — no names, roles or biographies were supplied; none invented.
- **What's Happening** — no announcements; entries added under the directory
  appear in the index automatically.
- **Partner Us** — the only sourced partner fact is *Lark Global Partner*. No
  vendor tiers, certifications or partner logos are asserted.

**The two legal pages are drafts and are set `noindex: true`.** They contain the
expected headings only — including the Data Protection Officer contact the
Singapore PDPA requires — and say plainly that they are being finalised. No
binding terms or data-handling commitments have been written. They need legal
review before the `noindex` is removed.

## Layouts and components

```
layouts/
├── baseof.html            shell: stage, nav, main, footer, scripts
├── home.html              cinematic homepage journey
├── page.html              about / careers / contact
├── 404.html
├── services/
│   ├── section.html       service index
│   └── page.html          individual service template
└── _partials/
    head · schema · nav · footer · scripts · stage
    page-hero · section-head · capabilities · cta · contact-block
    peak-rule · edge-viz · topology · mountain-section
```

`peak-rule` is the mountain-peak motif used as a section divider. `mountain-section` is
the cross-section showing the edge / security / network / compute / data strata.

## Design system

`assets/css/` — `fonts`, `tokens`, `base`, `layout`, `components`, `sections`,
`editorial`. Concatenated in cascade order by `head.html`; no PostCSS dependency.

Colour derives from the brand mark: mint-ice `#1EFFD9` through cyan into electric blue
`#2764FF` on near-black. Space Grotesk / Inter / JetBrains Mono, self-hosted from
`static/fonts/`.

Two constraints are deliberate:

- `--ix-steel` is `#74839A` — labels render at 11px and need 4.5:1 on the void.
- Filled controls use `--ix-grad-solid`, which stops at azure; dark text on the full
  gradient's `#2764FF` end is only 3.96:1.

Content rows are washed with translucent ink and separated by hairlines rather than
filled as cards, so the landscape stays visible behind the page.

## The mountain

`assets/js/three/` renders one fixed canvas behind every page.

- `noise.js` — deterministic ridged fBm.
- `terrain.js` — the massif. The surrounding field stays low while the massif carries the
  height, so the peak dominates instead of the camera sitting inside a ridge field. The
  shell is translucent ice: contour bands, fresnel rim, partial opacity.
- `interior.js` — the infrastructure engineered inside the mountain: strata rings for the
  stack, risers tying them together, a data path climbing base to summit, and compute
  nodes suspended in the ice. Drawn as an x-ray pass (`depthTest: false`) so it reads
  *through* the shell; blending it underneath a 50%-opaque surface crushed it to nothing.
- `nodes.js` / `routes.js` — edge nodes and traffic paths with packets running them.
- `scene.js` — camera track, quality tiers, lifecycle.

Scroll drives one continuous camera track. Each page enters it at its own point via
`scene_start` in front matter, so the site is one space: home `0`, cloudflare `0.18`,
services `0.34`, aws `0.46`, about `0.55`, gcp `0.62`, careers `0.72`,
enterprise-workflow `0.86`, contact `1`.

### Performance

The 3D runtime is a **separate entry point** (`scene-entry.js`), imported at runtime by
URL from `data-scene-src`. Hugo's `js.Build` does not honour esbuild code splitting, so a
static dynamic import would pull all of Three.js into the first-paint bundle. Current
split: **8KB JS + 6KB CSS gzipped on the critical path**, 137KB gzipped scene fetched on
idle.

Quality tiers scale mesh segments, node/route/mote counts and DPR cap from viewport, core
count and device memory. Rendering stops on hidden tabs.

### Degradation

`prefers-reduced-motion` composes a single still frame and never loops; Lenis and the edge
animation are skipped. No WebGL, or the scene bundle fails: the stage is removed and a
static gradient stands in — every page is complete and readable without it. Reveal-on-scroll
has a fail-safe that shows anything the observer has not within 2.6s.

### Portrait

Portrait is not a cropped desktop shot. The camera widens to 62° fov and pulls back along
its view vector, and fog plus per-layer distance falloff scale by the same factor via
`setFar()` — without that the massif is pulled into fog and renders as empty void.

## Language

UK English throughout: optimise, centralised, specialising, defence, containerised.

**One deliberate exception.** The hero headline reads "Edge-First Cyber **Defense** and
Scalable Cloud Infrastructure" — US spelling — because that is the supplied headline,
reproduced verbatim as the company's own wording. Change it in `content/_index.md` if the
UK form is preferred. `Organization` in `_partials/schema.html` is the schema.org type
identifier and must keep its US spelling.

## Content discipline

Everything traces to `iceMax_SG_Website_Content_Framework.docx`. No customers, statistics,
certifications, awards, testimonials, case studies, revenue or uptime figures have been
invented. Supporting UI text is generic and functional.

The footer carries no legal or privacy links because no such copy was supplied.

## SEO and accessibility

Per-page titles and meta descriptions, canonicals, Open Graph, Organization + WebSite
JSON-LD on the home page and BreadcrumbList elsewhere, `sitemap.xml`, `robots.txt`.

Single `h1` per page, no heading-level skips, landmarks, visible focus rings, skip link,
`alt` on every image. The decorative canvas is `aria-hidden`; the edge diagram carries a
text description. The mobile drawer traps focus, closes on `Escape`, restores focus to its
trigger and releases the scroll lock when the viewport returns to desktop.
