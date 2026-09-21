# Lead Notifications & Meta Ads — Setup

This covers the instant lead alerts (Pushover) and the Meta (Facebook/Instagram)
lead-ads connection. Manage everything from **Dashboard → Leads & CRM →
Notifications**.

All secrets live in environment variables (Vercel → Project → Settings →
Environment Variables, and your local `.env.local`). None are stored in the
database. After adding/changing any of these, **redeploy**.

---

## 1. Pushover — instant alerts on phone + computer

Pushover sends one push to **all** your registered devices at once — your phone
and the desktop app — so a new lead pings every screen you're looking at.

**Env vars to add:**

| Variable | Where to get it |
| --- | --- |
| `PUSHOVER_USER_KEY`  | pushover.net → your dashboard, "Your User Key" |
| `PUSHOVER_APP_TOKEN` | pushover.net → Create an Application/API Token → copy the token |

**One-time steps:**

1. Sign up at [pushover.net](https://pushover.net) (free 30-day trial, then a
   one-time ~$5 per platform).
2. Install the **Pushover app on your phone** and the **desktop client on your
   computer**, and log into both.
3. Copy your **User Key** → `PUSHOVER_USER_KEY`.
4. Create an Application (e.g. "Gray Wolf Workers") → copy its **API Token** →
   `PUSHOVER_APP_TOKEN`.
5. Redeploy, then open the Notifications tab and click **Send test
   notification** — it should hit your phone and computer.

Toggle alerts on/off any time from the Notifications tab (no redeploy needed).

---

## 2. Meta Lead Ads — Facebook & Instagram

Lead-form submissions flow straight into the pipeline and trigger a Pushover
alert. The webhook route already exists at `/api/leads/facebook-webhook`.

**Env vars to add:**

| Variable | What it is |
| --- | --- |
| `FACEBOOK_VERIFY_TOKEN`      | Any secret string you choose; paste the same value into Meta's webhook "Verify Token" field |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Long-lived Page Access Token for your business page |
| `NEXT_PUBLIC_APP_URL`        | Your deployed base URL, e.g. `https://your-app.vercel.app` (used to build the callback URL and the "Open Leads" deep link) |

**One-time steps (Meta for Developers):**

1. Create/open your app at [developers.facebook.com](https://developers.facebook.com).
2. Add the **Webhooks** and **Lead Ads** products.
3. Under **Webhooks → Page**, set the callback URL to
   `https://YOUR_DOMAIN/api/leads/facebook-webhook` (the Notifications tab shows
   the exact URL with a copy button) and the Verify Token to your
   `FACEBOOK_VERIFY_TOKEN`.
4. Generate a **long-lived Page Access Token** for your page →
   `FACEBOOK_PAGE_ACCESS_TOKEN`.
5. Subscribe the page to the **`leadgen`** field.
6. Use Meta's "Lead Ads Testing Tool" to fire a test lead — it should appear in
   **Leads** tagged **Facebook Ads** and ping you.

---

## 3. Source auto-detection

Every lead is tagged with where it came from automatically:

- **Facebook / Instagram** — via the Meta webhook.
- **Nextdoor, Google, others** — from the ad link's `?utm_source=` tag or the
  referring website. When you post your quote link on Nextdoor, use
  `https://YOUR_DOMAIN/get-a-quote?utm_source=nextdoor` and those leads tag
  themselves as Nextdoor.
- **Website / self-service / self-scheduling** — tagged by which form was used.

Filter the full feed by source on the **Leads** tab.
