# DESIGN.md — Gray Wolf Workers marketing site

Scope: the public site (`/`, `/portfolio`, quote flow). The owner dashboard keeps its own shadcn neutral tokens.

## Direction
"Hometown crew, big-company polish." Mowing-first. The hero (dark green photo scrim, white heavy headline, address capture) stays exactly as is. Everything below it extends that look: flat solid color, real photography, square corners, heavy sans headlines, one green action color. No gradients, no glass, no stock icons.

Reference sites: not compared. The UXKIN tools needed sign-in (`/mcp`) and weren't connected. Direction comes from the project's existing brand (the palette and comments in `HomePage.tsx`) plus its stated references (Lawn Doctor, Weed Man, Lawn Love), which I have not looked at this session. Treat the national-brand comparison as a pending decision.

## Color (roles)
| Token | Hex | Role |
|---|---|---|
| `--gw-pine` | #122b0a | Dark bands, hero scrim, top bar |
| `--gw-forest` | #1e3d12 | Primary action, headings accents |
| `--gw-grass` | #2f6418 | Action hover, eyebrow text, bullets |
| `--gw-lime` | #8fd16f | Accent on dark only (never text on white) |
| `--gw-gold` | #e9b949 | Offer + stars only |
| `--gw-paper` | #ffffff | Base background |
| `--gw-stone` | #f4f4ee | Alternate section background |
| `--gw-line` | #e2e2d8 | Borders, dividers |
| `--gw-ink` | #181b15 | Headings on light |
| `--gw-muted` | #5b6354 | Body text on light (7:1 on white) |
| `--gw-subtle` | #6b7263 | Captions only; replaces failing #8a917f |

Contrast rules: body text on white ≥ 4.5:1; lime and gold are never used on white or stone; white text on pine/forest/grass passes.
Dark mode: not offered on the marketing site. Pine bands provide the dark rhythm.

## Typography
Geist Sans (already loaded). Scale: eyebrow 12px / 700 / uppercase / +0.16em; h1 44→64px / 800 / 1.02; h2 36→46px / 800 / 1.06; h3 18–22px / 700; body 15–17px / 1.6; small 13px. Max line length 65ch.

## Spacing and shape
Section padding 80px mobile, 112px desktop; container 1152px, 20px gutters; 8px base grid. Radius 0 on buttons, inputs, cards and photos (the existing square look). Shadows: none. Depth comes from borders and color bands.

## Components
- **Primary button:** forest bg, white 700 text, 16px × 32px padding, grass on hover, 2px lime focus ring offset 2px, ≥ 48px tall.
- **Address form:** white input + primary button; stacks on mobile.
- **Card:** white, 1px line border, photo on top, no shadow.
- **Band:** pine background, white text, used for CTAs and the mowing plan.
- **FAQ:** native `<details>`; works without JS.
- **Offer pill:** gold text on pine only.

## Decisions left to you
1. Whether to compare against the national lawn brands once UXKIN is authorized, or keep this direction as is.
2. Whether to push these tokens into `globals.css` as `--gw-*` variables (additive, dashboard untouched) at build time. I recommend yes.
