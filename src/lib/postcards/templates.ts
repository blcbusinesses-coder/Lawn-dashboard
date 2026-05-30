// ─── Shared postcard HTML templates ──────────────────────────────────────────
// Used by /api/postcards/send and /api/postcards/preview
// Per Lob docs: 6x9 postcard body must be 9.25in × 6.25in (includes bleed)
// Background image recommended at 2775×1875px (300 DPI)

// Swap to a real crew photo URL when ready
export const COMPANY_PHOTO_URL =
  'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=700&h=280&fit=crop&q=80'

// Beautiful striped lawn — shows on front when no Maps key is configured
export const SAMPLE_HOUSE_PHOTO =
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=2775&h=1875&fit=crop&q=90'

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function formatQuote(amount: number): string {
  return (
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount) + '/mow'
  )
}

export interface FrontParams {
  name: string
  aiCopy: string
  quote: string
  streetViewUrl: string | null
  streetAddress: string
  totalLawns: number
  nearbyCount: number
  phone: string
}

export function buildFrontHtml(p: FrontParams): string {
  const bgPhoto = p.streetViewUrl ?? SAMPLE_HOUSE_PHOTO

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet" type="text/css">
<style>
  *, *:before, *:after { -webkit-box-sizing: border-box; box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 9.25in;
    height: 6.25in;
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: 'Roboto', Arial, sans-serif;
    position: relative;
    background-color: #0d2e1a;
  }
  /* Real <img> filling the card — headless-Chrome PDF renderers (Lob) paint
     <img> reliably, unlike CSS background-image. */
  .bgphoto {
    position: absolute;
    top: 0;
    left: 0;
    width: 9.25in;
    height: 6.25in;
    object-fit: cover;
    z-index: 0;
  }
  .oswald { font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif; }
</style>
</head>
<body>

  <!-- Background photo as a real image element -->
  <img class="bgphoto" src="${bgPhoto}" alt="" />

  <!-- Gradient overlay: dark left for text legibility, fades right so photo shows -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background:linear-gradient(to right,rgba(8,28,14,0.95) 0%,rgba(8,28,14,0.88) 30%,rgba(8,28,14,0.45) 55%,rgba(8,28,14,0.05) 100%);"></div>

  <!-- Content layer -->
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:2;display:flex;flex-direction:column;padding:28px 34px;">

    <!-- Top: wolf + company name + phone -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:auto;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:34px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));">&#128058;</span>
        <div>
          <div class="oswald" style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:3px;text-transform:uppercase;line-height:1;text-shadow:0 1px 4px rgba(0,0,0,0.5);">Gray Wolf Workers</div>
          <div style="color:rgba(255,255,255,0.8);font-size:9px;letter-spacing:2.5px;text-transform:uppercase;margin-top:3px;text-shadow:0 1px 3px rgba(0,0,0,0.6);">Professional Lawn Care &bull; Kendallville, IN</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="color:rgba(255,255,255,0.65);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Call or Text</div>
        <div class="oswald" style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px;text-shadow:0 1px 4px rgba(0,0,0,0.5);">${escapeHtml(p.phone)}</div>
      </div>
    </div>

    <!-- Center: name + estimate -->
    <div style="margin-bottom:0;">
      <div style="color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;text-shadow:0 1px 3px rgba(0,0,0,0.5);">
        A personal note for your home
      </div>
      <div class="oswald" style="color:#ffffff;font-size:76px;font-weight:700;line-height:0.9;margin-bottom:20px;text-shadow:0 3px 14px rgba(0,0,0,0.5);">
        Hey,<br/>${escapeHtml(p.name)}.
      </div>
      <!-- Quote box -->
      <div style="display:inline-block;border:2px solid rgba(255,255,255,0.45);border-radius:6px;padding:14px 22px;margin-bottom:22px;background:rgba(0,0,0,0.35);">
        <div style="color:rgba(255,255,255,0.85);font-size:9px;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px;">Your Custom Estimate</div>
        <div class="oswald" style="color:#ffffff;font-size:54px;font-weight:700;line-height:1;letter-spacing:1px;">${escapeHtml(p.quote)}</div>
        <div style="color:rgba(255,255,255,0.7);font-size:10px;margin-top:4px;">Per visit &bull; No contract &bull; Cancel anytime</div>
      </div>
      <!-- Stats -->
      <div style="display:flex;gap:28px;">
        <div style="color:rgba(255,255,255,0.88);font-size:12px;font-weight:500;text-shadow:0 1px 3px rgba(0,0,0,0.5);">
          &#127807; <span class="oswald" style="font-size:16px;font-weight:600;">${p.totalLawns}</span> lawns this season
        </div>
        <div style="color:rgba(255,255,255,0.88);font-size:12px;font-weight:500;text-shadow:0 1px 3px rgba(0,0,0,0.5);">
          &#128205; <span class="oswald" style="font-size:16px;font-weight:600;">${p.nearbyCount}</span> neighbors on our route
        </div>
      </div>
    </div>

    <!-- Bottom fine print -->
    <div style="margin-top:auto;padding-top:14px;">
      <div style="color:rgba(255,255,255,0.7);font-size:10px;letter-spacing:1px;text-shadow:0 1px 3px rgba(0,0,0,0.5);">
        Locally owned &bull; Fully insured &bull; Kendallville, IN
      </div>
    </div>

  </div>

</body>
</html>`
}

export interface BackParams {
  phone: string
  aiCopy: string
  name: string
}

export function buildBackHtml(p: BackParams): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet" type="text/css">
<style>
  *, *:before, *:after { -webkit-box-sizing: border-box; box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 9.25in;
    height: 6.25in;
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: 'Roboto', Arial, sans-serif;
    display: flex;
  }
  .oswald { font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif; }
</style>
</head>
<body>

  <!-- Left: branded letter panel (50%) -->
  <div style="width:50%;background:#0d2e1a;display:flex;flex-direction:column;padding:36px 32px;overflow:hidden;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <span style="font-size:30px;line-height:1;">&#128058;</span>
      <div>
        <div class="oswald" style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;line-height:1.1;">Gray Wolf Workers</div>
        <div style="color:rgba(255,255,255,0.7);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-top:3px;">Lawn Care &bull; Kendallville, IN</div>
      </div>
    </div>
    <div style="width:32px;height:2px;background:rgba(255,255,255,0.2);margin-bottom:22px;"></div>
    <div style="flex:1;">
      <div style="color:rgba(255,255,255,0.7);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Hey, ${escapeHtml(p.name)} &mdash;</div>
      <p style="color:rgba(255,255,255,0.9);font-size:15px;line-height:1.85;font-weight:300;">${escapeHtml(p.aiCopy)}</p>
    </div>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.12);">
      <div style="color:rgba(255,255,255,0.65);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Ready to get started?</div>
      <div class="oswald" style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">${escapeHtml(p.phone)}</div>
    </div>
  </div>

  <!-- Right: USPS address zone (50%) — keep clean, Lob prints address here -->
  <div style="width:50%;background:#ffffff;padding:20px 24px;display:flex;flex-direction:column;">
    <div>
      <div style="font-family:'Oswald',sans-serif;font-size:10px;color:#111;font-weight:600;letter-spacing:1px;line-height:2;">GRAY WOLF WORKERS</div>
      <div style="font-size:9px;color:#555;line-height:1.9;">703 East Mitchell Street</div>
      <div style="font-size:9px;color:#555;line-height:1.9;">Kendallville, IN 46755</div>
    </div>
  </div>

</body>
</html>`
}
