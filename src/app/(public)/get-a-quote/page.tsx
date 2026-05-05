'use client'

import { useEffect, useState } from 'react'

function GrassRow() {
  return (
    <svg viewBox="0 0 1440 90" className="w-full block" preserveAspectRatio="none" aria-hidden>
      <rect x="0" y="70" width="1440" height="20" fill="#2d5a1b" />
      {[
        [20,70,30,30],[50,70,58,15],[80,70,88,38],[110,70,118,22],[140,70,148,45],[170,70,178,20],
        [200,70,208,35],[230,70,238,18],[260,70,265,42],[290,70,298,28],[320,70,328,15],[350,70,358,50],
        [380,70,390,25],[410,70,418,38],[440,70,445,20],[470,70,478,44],[500,70,505,18],[530,70,538,36],
        [560,70,568,22],[590,70,598,48],[620,70,628,16],[650,70,655,40],[680,70,688,28],[710,70,718,18],
        [740,70,748,52],[770,70,778,24],[800,70,808,38],[830,70,835,20],[860,70,868,44],[890,70,898,16],
        [920,70,928,36],[950,70,955,28],[980,70,988,20],[1010,70,1018,46],[1040,70,1048,18],[1070,70,1078,34],
        [1100,70,1105,22],[1130,70,1138,50],[1160,70,1168,26],[1190,70,1198,18],[1220,70,1228,42],
        [1250,70,1255,20],[1280,70,1288,36],[1310,70,1318,24],[1340,70,1348,48],[1370,70,1375,18],
        [1400,70,1408,38],[1430,70,1435,22],
      ].map(([x1,y1,x2,y2], i) => (
        <path key={i}
          d={`M${x1} ${y1} Q${(x1+x2)/2} ${y2} ${x2} ${y1}`}
          stroke={i%3===0?'#3a7a22':i%3===1?'#2d5a1b':'#4a9030'}
          strokeWidth="3" fill="none" strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

const PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? ''
const SMS_BODY = 'Hey Gray Wolf, I would like a quote. My address is: '

export default function GetAQuotePage() {
  const [smsUrl, setSmsUrl] = useState(`sms:${PHONE}`)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent)
    const encoded = encodeURIComponent(SMS_BODY)
    setSmsUrl(isIOS ? `sms:${PHONE}&body=${encoded}` : `sms:${PHONE}?body=${encoded}`)
  }, [])

  return (
    <div className="min-h-screen bg-[#eef3e8] flex flex-col overflow-x-hidden">
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">

          {/* Logo + heading */}
          <div className="text-center mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Gray Wolf Workers" className="w-16 h-16 object-contain mx-auto mb-3" />
            <h1 className="text-3xl font-bold text-[#1e3d12] tracking-tight">Get a Free Quote</h1>
            <p className="text-[#5a7a4a] mt-2 text-sm leading-relaxed max-w-xs mx-auto">
              We&apos;ll text you back a custom price in under a minute — no forms, no waiting.
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="h-1.5 bg-[#2d5a1b]" />
            <div className="p-6 space-y-6">

              {/* Steps */}
              <div className="space-y-4">
                {[
                  { n: '1', text: 'Tap the button below to open your messages' },
                  { n: '2', text: 'Fill in your property address at the end of the message' },
                  { n: '3', text: 'Hit send — we\'ll text your quote right back!' },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#eef3e8] border border-[#c8dfc0] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-[#2d5a1b]">{n}</span>
                    </div>
                    <p className="text-sm text-zinc-600 leading-snug pt-1">{text}</p>
                  </div>
                ))}
              </div>

              {/* Big SMS button */}
              <a
                href={smsUrl}
                className="flex items-center justify-center gap-2.5 w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold hover:bg-[#1e3d12] active:scale-[0.98] transition-all shadow-sm select-none"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Text Us for a Quote!
              </a>

              <p className="text-xs text-zinc-400 text-center leading-relaxed">
                Opens your messages app with the text pre-filled —
                just add your address and hit send.
              </p>
            </div>
          </div>

          {/* Trust footer */}
          <p className="text-center text-xs text-[#7a9a6a]">
            Locally owned &amp; operated &nbsp;·&nbsp; Kendallville &amp; surrounding areas &nbsp;·&nbsp; No contracts
          </p>
        </div>
      </div>

      <div className="pointer-events-none overflow-hidden">
        <GrassRow />
      </div>
    </div>
  )
}
