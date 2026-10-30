import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Gray Wolf Workers',
  description: 'How Gray Wolf Workers collects, uses, and protects your information.',
}

const EMAIL = 'graywolfworkers@gmail.com'
const PHONE = '(260) 599-4253'

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-12 text-zinc-800">
      <Link href="/" className="text-sm text-green-800 hover:underline">&larr; Back to Gray Wolf Workers</Link>
      <h1 className="text-3xl font-bold mt-4 mb-2">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: October 30, 2026</p>

      <div className="space-y-6 leading-relaxed">
        <p>
          Gray Wolf Workers (&quot;we,&quot; &quot;us&quot;) is a lawn care and mowing business serving Kendallville,
          Indiana and surrounding communities. This policy explains what information we collect through our
          website, quote forms, and communications, and how we use it.
        </p>

        <section>
          <h2 className="text-xl font-semibold mb-2">Information we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Contact details you give us, such as your name, phone number, email address, and service address.</li>
            <li>Details about your request, such as lawn size, services wanted, notes, and photos you choose to share.</li>
            <li>Messages you send us by text, email, or through our forms, including lead forms from ads on Facebook or Instagram.</li>
            <li>Basic technical data such as browser type and pages visited, collected through standard web hosting logs.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">How we use it</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To respond to quote requests and schedule, perform, and bill for lawn care services.</li>
            <li>To send estimates, invoices, appointment reminders, and service updates by email or text.</li>
            <li>To improve our website and services, and to measure how our advertising performs.</li>
          </ul>
          <p className="mt-2">We do not sell your personal information. We do not send marketing texts without your consent.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Who we share it with</h2>
          <p>
            We share information only with service providers who help us run the business, such as website hosting,
            database storage, email and text-message delivery, payment processing, and advertising platforms
            (for example Meta, when you submit a lead form on their platforms). These providers may only use your
            information to provide services to us. We may also disclose information if required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Text messages</h2>
          <p>
            If you give us your phone number, we may text you about your quote or service. Message and data rates
            may apply. Reply STOP at any time to opt out. Mobile opt-in information is not shared with third
            parties for their marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Cookies</h2>
          <p>
            Our site uses only cookies needed for it to function (such as keeping staff logged in) and may use
            basic analytics or advertising pixels to understand site visits and ad performance. You can block
            cookies in your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Data retention and security</h2>
          <p>
            We keep your information for as long as needed to provide services and meet business and legal
            obligations. We use reasonable safeguards to protect it, but no method of transmission or storage
            is completely secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Your choices</h2>
          <p>
            You may ask to access, correct, or delete the personal information we hold about you, or opt out of
            messages, by contacting us below. Our services are not directed to children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Changes to this policy</h2>
          <p>We may update this policy from time to time. The date above shows when it was last revised.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Contact us</h2>
          <p>
            Gray Wolf Workers, Kendallville, Indiana<br />
            Email: <a className="text-green-800 underline" href={`mailto:${EMAIL}`}>{EMAIL}</a><br />
            Phone: {PHONE}
          </p>
        </section>
      </div>
    </main>
  )
}
