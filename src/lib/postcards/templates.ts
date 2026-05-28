// ─── Shared postcard HTML templates ──────────────────────────────────────────
// Used by both /api/postcards/send and /api/postcards/preview
// 6x9 landscape = 9in wide × 6in tall

export const COMPANY_PHOTO_URL =
  'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=700&h=280&fit=crop&q=80'

// A nice house exterior used as the preview placeholder (no Maps key needed)
export const SAMPLE_HOUSE_PHOTO =
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&h=500&fit=crop&q=80'

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
  streetViewUrl: string | null   // null = no Maps key → dark gradient fallback
  streetAddress: string
  totalLawns: number
  nearbyCount: number
  phone: string
}

export function buildFrontHtml(p: FrontParams): string {
  const photoLayer = p.streetViewUrl
    ? `<img src="${p.streetViewUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#0d2e1a 0%,#1a4a2e 50%,#0d2e1a 100%);"></div>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 9in; height: 6in; overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    display: flex; flex-direction: column;
    background: #1a4a2e;
  }
</style>
</head>
<body>

  <!-- TOP HEADER -->
  <div style="background:#1a4a2e;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-bottom:3px solid rgba(255,255,255,0.12);">
    <div>
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:3px;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Professional Lawn Care &bull; Kendallville, IN</div>
      <div style="color:#ffffff;font-size:34px;font-weight:900;letter-spacing:2px;line-height:1;">GRAY WOLF WORKERS</div>
    </div>
    <div style="text-align:right;">
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Call or Text</div>
      <div style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:1px;">${escapeHtml(p.phone)}</div>
    </div>
  </div>

  <!-- MIDDLE: house photo full-width -->
  <div style="flex:1;position:relative;overflow:hidden;">
    ${photoLayer}
    <div style="position:absolute;inset:0;background:rgba(0,0,0,0.52);"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:28px 40px;">
      <div style="color:rgba(255,255,255,0.65);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">A personal note for you</div>
      <div style="color:#ffffff;font-size:52px;font-weight:900;line-height:1;margin-bottom:14px;">Hey, ${escapeHtml(p.name)}.</div>
      <div style="color:rgba(255,255,255,0.55);font-size:12px;margin-bottom:22px;">${escapeHtml(p.streetAddress)}</div>
      <div style="width:48px;height:3px;background:rgba(255,255,255,0.4);margin-bottom:22px;"></div>
      <div style="display:flex;gap:14px;">
        <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:5px;padding:10px 18px;">
          <div style="color:rgba(255,255,255,0.6);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Neighbors on our route</div>
          <div style="color:#ffffff;font-size:26px;font-weight:900;line-height:1;">${p.nearbyCount}</div>
        </div>
        <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:5px;padding:10px 18px;">
          <div style="color:rgba(255,255,255,0.6);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Lawns this season</div>
          <div style="color:#ffffff;font-size:26px;font-weight:900;line-height:1;">${p.totalLawns}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- BOTTOM STRIP: estimate + CTA -->
  <div style="background:#1a4a2e;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-top:3px solid rgba(255,255,255,0.12);">
    <div style="display:flex;align-items:center;gap:20px;">
      <div>
        <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Your Custom Estimate</div>
        <div style="color:#ffffff;font-size:36px;font-weight:900;line-height:1;">${escapeHtml(p.quote)}</div>
      </div>
      <div style="width:1px;height:44px;background:rgba(255,255,255,0.2);"></div>
      <div style="color:rgba(255,255,255,0.5);font-size:11px;line-height:1.6;">Per visit &bull; No contract<br/>Cancel anytime</div>
    </div>
    <div style="background:#ffffff;color:#1a4a2e;padding:12px 28px;border-radius:5px;text-align:center;">
      <div style="font-size:10px;letter-spacing:1.5px;font-weight:bold;text-transform:uppercase;opacity:0.6;margin-bottom:2px;">Call or Text Now</div>
      <div style="font-size:22px;font-weight:900;letter-spacing:0.5px;">${escapeHtml(p.phone)}</div>
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
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 9in; height: 6in; overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    display: flex;
  }
</style>
</head>
<body>

  <!-- LEFT: personalized blurb (50%) -->
  <div style="width:50%;background:#1a4a2e;padding:36px 32px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
    <div>
      <div style="color:#ffffff;font-weight:900;font-size:20px;letter-spacing:2.5px;line-height:1.1;">GRAY WOLF WORKERS</div>
      <div style="color:rgba(255,255,255,0.45);font-size:10px;letter-spacing:1.5px;margin-top:5px;text-transform:uppercase;">Lawn Care &bull; Kendallville, IN</div>
      <div style="width:36px;height:2px;background:rgba(255,255,255,0.25);margin:20px 0;"></div>
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Hey, ${escapeHtml(p.name)} &mdash;</div>
      <p style="color:#ffffff;font-size:15px;line-height:1.8;">${escapeHtml(p.aiCopy)}</p>
    </div>
    <div>
      <div style="color:rgba(255,255,255,0.45);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Ready? Give us a call.</div>
      <div style="color:#ffffff;font-size:26px;font-weight:900;letter-spacing:0.5px;">${escapeHtml(p.phone)}</div>
    </div>
  </div>

  <!-- RIGHT: USPS address zone (50%) -->
  <div style="width:50%;background:#ffffff;padding:18px 22px;display:flex;flex-direction:column;">
    <div>
      <div style="font-size:9px;color:#222;font-weight:bold;line-height:1.8;">GRAY WOLF WORKERS</div>
      <div style="font-size:9px;color:#555;line-height:1.8;">703 East Mitchell Street</div>
      <div style="font-size:9px;color:#555;line-height:1.8;">Kendallville, IN 46755</div>
    </div>
  </div>

</body>
</html>`
}
