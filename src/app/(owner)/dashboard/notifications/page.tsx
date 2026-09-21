'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Bell, BellRing, Smartphone, Monitor, Check, X, Copy, RefreshCw,
  Send, Megaphone, Info, KeyRound, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NotifSettings {
  pushover_configured: boolean
  pushover_enabled: boolean
  notify_new_lead: boolean
}

interface MetaStatus {
  callback_url: string
  app_url_set: boolean
  verify_token_set: boolean
  page_access_token_set: boolean
  connected: boolean
}

function StatusPill({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
    }`}>
      {ok ? <Check size={11} /> : <X size={11} />}
      {ok ? okText : badText}
    </span>
  )
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        on ? 'bg-green-500' : 'bg-zinc-300'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 min-w-0 truncate bg-zinc-900 text-zinc-100 text-xs rounded-md px-3 py-2 font-mono">{value}</code>
      <Button
        size="sm" variant="outline" className="h-auto px-3 gap-1.5 text-xs shrink-0"
        onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      >
        {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotifSettings | null>(null)
  const [meta, setMeta] = useState<MetaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, mRes] = await Promise.all([
        fetch('/api/notifications/settings'),
        fetch('/api/notifications/meta'),
      ])
      if (sRes.ok) setSettings(await sRes.json())
      if (mRes.ok) setMeta(await mRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function setFlag(key: keyof NotifSettings, value: boolean) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setSavingKey(key)
    const res = await fetch('/api/notifications/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    setSavingKey(null)
    if (!res.ok) { toast.error('Failed to save'); load() }
    else toast.success('Saved')
  }

  async function sendTest() {
    setTesting(true)
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' })
      const data = await res.json()
      if (res.ok) toast.success('Test sent — check your phone and computer!')
      else toast.error(data.error ?? 'Failed to send test')
    } catch {
      toast.error('Network error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <BellRing size={22} className="text-blue-500" /> Notifications
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Get pinged on your phone and computer the second a lead comes in — from Meta ads, the website, and more.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* ── Pushover card ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 mb-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Bell size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-900">Pushover Alerts</h2>
              <p className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1"><Smartphone size={11} /> Phone</span>
                <span className="flex items-center gap-1"><Monitor size={11} /> Computer</span>
              </p>
            </div>
          </div>
          {settings && (
            <StatusPill ok={settings.pushover_configured} okText="Connected" badText="Keys needed" />
          )}
        </div>

        {settings && !settings.pushover_configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 mb-4">
            <p className="font-medium flex items-center gap-1.5"><KeyRound size={14} /> Add your Pushover keys to turn this on</p>
            <ol className="list-decimal ml-5 mt-2 space-y-1 text-amber-700">
              <li>Create a free account at <span className="font-mono">pushover.net</span> and install the Pushover app on your phone <span className="italic">and</span> the desktop client on your computer.</li>
              <li>On pushover.net, copy your <span className="font-medium">User Key</span>, then create an Application/API Token.</li>
              <li>Send me those two values — I&apos;ll add them as <span className="font-mono">PUSHOVER_USER_KEY</span> and <span className="font-mono">PUSHOVER_APP_TOKEN</span>.</li>
            </ol>
          </div>
        )}

        {/* Toggles */}
        <div className="divide-y divide-zinc-100">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-zinc-800">Lead notifications</p>
              <p className="text-xs text-zinc-500">Master switch for all Pushover alerts.</p>
            </div>
            <Toggle
              on={!!settings?.pushover_enabled}
              disabled={!settings || savingKey === 'pushover_enabled'}
              onChange={(v) => setFlag('pushover_enabled', v)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-zinc-800">Ping me on every new lead</p>
              <p className="text-xs text-zinc-500">Facebook/Instagram ads, website form, self-service, self-scheduling.</p>
            </div>
            <Toggle
              on={!!settings?.notify_new_lead}
              disabled={!settings || !settings.pushover_enabled || savingKey === 'notify_new_lead'}
              onChange={(v) => setFlag('notify_new_lead', v)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={sendTest} disabled={testing || !settings?.pushover_configured} className="gap-2">
            {testing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            Send test notification
          </Button>
          {!settings?.pushover_configured && (
            <p className="text-xs text-zinc-400 mt-2">Add the keys above, then the test button will light up.</p>
          )}
        </div>
      </section>

      {/* ── Meta / Facebook lead ads card ─────────────────────────────── */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5 mb-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Megaphone size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-900">Meta Lead Ads</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Facebook &amp; Instagram lead forms flow straight into your pipeline.</p>
            </div>
          </div>
          {meta && <StatusPill ok={meta.connected} okText="Connected" badText="Setup needed" />}
        </div>

        {meta && (
          <>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Webhook Callback URL</p>
                <CopyField value={meta.callback_url} />
                <p className="text-xs text-zinc-400 mt-1">Paste this into Meta → your App → Webhooks → Page → <span className="font-mono">leadgen</span>.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="rounded-lg border border-zinc-200 p-2.5">
                  <p className="text-xs text-zinc-500 mb-1">App URL</p>
                  <StatusPill ok={meta.app_url_set} okText="Set" badText="Missing" />
                </div>
                <div className="rounded-lg border border-zinc-200 p-2.5">
                  <p className="text-xs text-zinc-500 mb-1">Verify Token</p>
                  <StatusPill ok={meta.verify_token_set} okText="Set" badText="Missing" />
                </div>
                <div className="rounded-lg border border-zinc-200 p-2.5">
                  <p className="text-xs text-zinc-500 mb-1">Page Access Token</p>
                  <StatusPill ok={meta.page_access_token_set} okText="Set" badText="Missing" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 mt-4">
              <p className="font-medium text-zinc-800 flex items-center gap-1.5 mb-2"><Info size={14} /> How to connect</p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>In <span className="font-medium">Meta for Developers</span>, create/open your app and add the <span className="font-medium">Webhooks</span> + <span className="font-medium">Lead Ads</span> products.</li>
                <li>Under Webhooks, choose <span className="font-medium">Page</span> and paste the callback URL above.</li>
                <li>Set a <span className="font-medium">Verify Token</span> (any secret string) — send it to me for <span className="font-mono">FACEBOOK_VERIFY_TOKEN</span>.</li>
                <li>Generate a long-lived <span className="font-medium">Page Access Token</span> for your business page — send it for <span className="font-mono">FACEBOOK_PAGE_ACCESS_TOKEN</span>.</li>
                <li>Subscribe the page to the <span className="font-mono">leadgen</span> field. New form submissions then appear in <span className="font-medium">Leads</span> and ping you here.</li>
              </ol>
            </div>
          </>
        )}
      </section>

      {/* ── Source auto-detection note ────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900">Automatic Source Tracking</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Every lead is tagged with where it came from — no manual work.</p>
          </div>
        </div>
        <ul className="text-sm text-zinc-600 space-y-1.5 ml-1">
          <li>📘 <span className="font-medium">Facebook / Instagram</span> — detected automatically via Meta lead ads.</li>
          <li>🏘️ <span className="font-medium">Nextdoor, Google, etc.</span> — detected from the ad link&apos;s <span className="font-mono">?utm_source=</span> tag or the referring site.</li>
          <li>🌐 <span className="font-medium">Website / self-service / self-scheduling</span> — tagged by which form was used.</li>
        </ul>
        <p className="text-xs text-zinc-400 mt-3">
          Tip: when you post your quote link on Nextdoor, add <span className="font-mono">?utm_source=nextdoor</span> to the URL and those leads tag themselves. See the full feed in <span className="font-medium">Leads</span>.
        </p>
      </section>
    </div>
  )
}
