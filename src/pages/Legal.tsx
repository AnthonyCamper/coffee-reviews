import { Link } from 'react-router-dom'

// Purpose-specific inboxes (all forward to the same mailbox via Cloudflare
// Email Routing catch-all, but read clearly to users).
const EMAIL = {
  support: 'support@taliascoffee.com',
  privacy: 'privacy@taliascoffee.com',
  safety: 'safety@taliascoffee.com',
  dmca: 'dmca@taliascoffee.com',
}
const LAST_UPDATED = 'June 19, 2026'
const MIN_AGE = 13

type LegalDoc = 'privacy' | 'terms' | 'guidelines' | 'dmca'

function Shell({ title, contact = EMAIL.support, children }: { title: string; contact?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-50">
      <header className="border-b border-cream-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-espresso-800 font-display text-lg">
            <span className="text-2xl">☕</span> Talia&rsquo;s Coffee
          </Link>
          <Link to="/" className="text-sm text-rose-500 font-medium">Back to app</Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl text-espresso-800 mb-1">{title}</h1>
        <p className="text-xs text-espresso-400 mb-8">Last updated: {LAST_UPDATED}</p>
        <div className="legal-prose space-y-5 text-sm leading-relaxed text-espresso-700">
          {children}
        </div>
        <footer className="mt-12 pt-6 border-t border-cream-200 text-xs text-espresso-400">
          Questions? Contact <a className="text-rose-500" href={`mailto:${contact}`}>{contact}</a>.
          <div className="mt-3 flex flex-wrap gap-4">
            <Link className="text-rose-500" to="/privacy">Privacy</Link>
            <Link className="text-rose-500" to="/terms">Terms</Link>
            <Link className="text-rose-500" to="/guidelines">Community Guidelines</Link>
            <Link className="text-rose-500" to="/dmca">DMCA</Link>
          </div>
        </footer>
      </main>
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg text-espresso-800 pt-4">{children}</h2>
}

function PrivacyPolicy() {
  return (
    <Shell title="Privacy Policy" contact={EMAIL.privacy}>
      <p>
        This Privacy Policy explains what Talia&rsquo;s Coffee (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects and how we use it. Privacy questions and data requests: <a className="text-rose-500" href={`mailto:${EMAIL.privacy}`}>{EMAIL.privacy}</a>.
      </p>

      <H2>Information we collect</H2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Account info:</strong> email, name, and basic profile data from Google or Apple sign-in if you use them.</li>
        <li><strong>Profile info:</strong> username, display name, bio, and avatar.</li>
        <li><strong>Content you create:</strong> reviews, ratings, tasting notes, photos, comments, reactions, and likes.</li>
        <li><strong>Social graph:</strong> the accounts you follow and that follow you.</li>
        <li><strong>Direct messages</strong> and any media you send.</li>
        <li><strong>Approximate location</strong>, only when you actively search for nearby coffee shops.</li>
        <li><strong>Technical data:</strong> device type, app version, IP address, and basic diagnostics.</li>
      </ul>
      <p>We strip embedded EXIF/GPS metadata from photos during upload, so your photos do not reveal where they were taken.</p>

      <H2>How we use it</H2>
      <p>To provide and secure the service, authenticate you, display your content and social interactions, enable messaging, and keep the community safe (moderation).</p>

      <H2>Legal bases (EEA/UK)</H2>
      <p>Performance of our contract with you; your consent (camera, photos, location); and our legitimate interests in operating and securing the app.</p>

      <H2>How we share</H2>
      <p>We use service providers who process data on our behalf: <strong>Supabase</strong> (hosting, authentication, database, storage), <strong>Google</strong> (Sign-In and the Tenor GIF API), and <strong>Apple</strong> (Sign in with Apple and platform services). We do <strong>not</strong> sell or share your personal information for advertising. We may disclose data if required by law.</p>

      <H2>Retention</H2>
      <p>We keep your data while your account is active. You can delete your account at any time from inside the app, which permanently removes your profile, content, photos, comments, likes, follows, and messages, except where we must retain limited records for legal reasons.</p>

      <H2>Your rights</H2>
      <p>Depending on where you live, you may access, correct, delete, export, or object to processing of your data, and opt out of &ldquo;sale/sharing&rdquo; (we do not sell or share). Use in-app account deletion or contact {EMAIL.privacy}. California residents: we do not sell or share personal information under the CCPA/CPRA.</p>

      <H2>Direct messages</H2>
      <p>Messages are transmitted over encrypted connections (TLS) and stored by our hosting provider. They are not end-to-end encrypted. We may access message content where necessary to respond to a report or comply with law.</p>

      <H2>Children</H2>
      <p>Talia&rsquo;s Coffee is not directed to, and may not be used by, anyone under {MIN_AGE} (or 16 where required). We do not knowingly collect data from children.</p>

      <H2>Security</H2>
      <p>We use TLS in transit, access controls, and database row-level security. No system is 100% secure.</p>

      <H2>Changes</H2>
      <p>We will post updates on this page and revise the date above.</p>
    </Shell>
  )
}

function Terms() {
  return (
    <Shell title="Terms of Service">
      <p>By creating an account or using Talia&rsquo;s Coffee (the &ldquo;App&rdquo;) you agree to these Terms and our <Link className="text-rose-500" to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the App.</p>

      <H2>Eligibility</H2>
      <p>You must be at least {MIN_AGE} years old (or older where required by local law) to use the App.</p>

      <H2>Your account</H2>
      <p>You are responsible for the accuracy of your account information and for activity under your account. New accounts are subject to manual approval, and we may decline, suspend, or terminate accounts consistent with these Terms.</p>

      <H2>Acceptable use &mdash; zero tolerance</H2>
      <p><strong>We have zero tolerance for objectionable content and abusive behavior.</strong> You agree not to post, send, or share content that is illegal; harassing, bullying, or threatening; hateful or discriminatory; sexually explicit or that sexualizes minors; infringing of intellectual property or privacy rights; or spam, scams, or impersonation.</p>
      <p>We may remove content and suspend or terminate accounts that violate this section, typically acting within 24 hours of a report. You can report content or users from inside the App, and block other users at any time.</p>

      <H2>Your content and licenses</H2>
      <p>You retain ownership of the content you create. You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, and display your content solely to operate and provide the App. You represent that you have the rights to what you post, including photos showing identifiable people or third-party trademarks.</p>

      <H2>Reviews are opinions</H2>
      <p>Reviews and ratings reflect users&rsquo; personal opinions about businesses. We do not endorse them and are not responsible for them. Do not post knowingly false statements of fact about a business.</p>

      <H2>Copyright / DMCA</H2>
      <p>We respond to valid notices under the DMCA &mdash; see our <Link className="text-rose-500" to="/dmca">DMCA Policy</Link>. We terminate the accounts of repeat infringers.</p>

      <H2>Moderation, suspension, and termination</H2>
      <p>We may remove content and suspend or terminate access for violations or to protect users, and where appropriate will provide a brief statement of the reason. You may delete your account at any time from within the App.</p>

      <H2>Disclaimers &amp; limitation of liability</H2>
      <p>THE APP AND ALL CONTENT ARE PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, ARISING FROM YOUR USE OF THE APP. You agree to indemnify us from claims arising out of your content or your violation of these Terms.</p>

      <H2>Apple</H2>
      <p>These Terms are between you and us, not Apple. Apple is not responsible for the App or its content. Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them. You are responsible for the App&rsquo;s compliance with applicable App Store usage rules.</p>

      <H2>Changes</H2>
      <p>We may update these Terms; continued use after changes means you accept them.</p>

      <H2>Contact</H2>
      <p>Questions about these Terms? Email <a className="text-rose-500" href={`mailto:${EMAIL.support}`}>{EMAIL.support}</a>.</p>
    </Shell>
  )
}

function Guidelines() {
  return (
    <Shell title="Community Guidelines" contact={EMAIL.safety}>
      <p>Talia&rsquo;s Coffee is a place to share honest coffee experiences. Keep it friendly.</p>
      <H2>Encouraged</H2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Genuine reviews, ratings, and tasting notes.</li>
        <li>Your own photos of coffee, shops, and the experience.</li>
        <li>Helpful, respectful comments and conversation.</li>
      </ul>
      <H2>Not allowed</H2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Harassment, bullying, threats, or hate speech.</li>
        <li>Sexually explicit content, or anything that sexualizes minors.</li>
        <li>Illegal content or promotion of illegal activity.</li>
        <li>Spam, scams, impersonation, or fake reviews.</li>
        <li>Posting others&rsquo; content without permission or infringing intellectual property.</li>
        <li>Sharing others&rsquo; private information without consent.</li>
      </ul>
      <H2>Reporting and blocking</H2>
      <p>Use the &bull;&bull;&bull; menu on a post, comment, profile, or conversation to <strong>Report</strong>, or <strong>block</strong> any user to hide their content and stop them messaging you. We review reports and act on them, typically within 24 hours. Violations can result in content removal and account suspension or termination.</p>
      <p>To report something urgent or appeal a moderation decision, email our safety team at <a className="text-rose-500" href={`mailto:${EMAIL.safety}`}>{EMAIL.safety}</a>.</p>
    </Shell>
  )
}

function Dmca() {
  return (
    <Shell title="DMCA / Copyright Policy" contact={EMAIL.dmca}>
      <p>We respect intellectual property rights and respond to notices of alleged infringement that comply with the Digital Millennium Copyright Act (DMCA).</p>
      <H2>Reporting an infringement</H2>
      <p>Send a written notice to our designated agent that includes: your signature; identification of the copyrighted work; identification of the allegedly infringing material and where to find it; your contact information; a good-faith-belief statement; and a statement, under penalty of perjury, that your notice is accurate and you are authorized to act.</p>
      <p>
        <strong>Designated agent:</strong> Copyright Agent, Talia&rsquo;s Coffee<br />
        <strong>Email:</strong> <a className="text-rose-500" href={`mailto:${EMAIL.dmca}`}>{EMAIL.dmca}</a>
      </p>
      <H2>Counter-notice</H2>
      <p>If your content was removed and you believe it was a mistake, you may send a counter-notice with the equivalent information.</p>
      <H2>Repeat infringers</H2>
      <p>We terminate the accounts of users who are repeat infringers.</p>
    </Shell>
  )
}

export default function Legal({ doc }: { doc: LegalDoc }) {
  switch (doc) {
    case 'privacy': return <PrivacyPolicy />
    case 'terms': return <Terms />
    case 'guidelines': return <Guidelines />
    case 'dmca': return <Dmca />
  }
}
