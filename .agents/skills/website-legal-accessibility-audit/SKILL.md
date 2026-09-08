---
name: website-legal-accessibility-audit
description: Audit a "vibe coded" or newly built website for legal, privacy, accessibility, and trust risks before launch, and generate the missing pieces (privacy policy, terms & conditions, cookie policy, refund policy, consent forms). Use this whenever a user says something like "check my site before I launch," "will I get sued for this website," "add a privacy policy / terms / cookie policy," "is my site GDPR/CCPA compliant," "check accessibility," "add alt text," "check color contrast," "remove fake reviews," or otherwise wants a pre-launch legal + compliance + accessibility sweep of a website or web app. Trigger proactively any time a user asks Claude to build, review, or ship a public-facing website, landing page, or web app, even if they don't explicitly mention "legal" or "compliance" — flag these risks before the site goes live rather than waiting to be asked.
---

# Website Legal & Accessibility Pre-Launch Audit

A structured audit + remediation workflow for indie/vibe-coded websites. Goal: reduce the site owner's legal exposure and make the site accessible and trustworthy, without pretending to be a substitute for a lawyer.

**Always state up front, once, briefly:** this produces a solid best-effort pass, not legal advice, and high-stakes sites (real payments, health data, EU/children's data, or lots of traffic) should get a human lawyer's eyes before launch. Don't repeat this disclaimer after every section — say it once, then get to work.

## Step 0: Scope the site

Before auditing, quickly establish (ask only what you can't infer from the code/content):
- What does the site do — content only, lead gen, e-commerce/payments, SaaS signup, user accounts?
- Where is the business based, and roughly where are visitors expected to come from (just this country, or global/EU/UK/California too)?
- What data does it currently collect (forms, cookies, analytics, embeds)?

If the user already dropped a repo/URL/files in the conversation, read/crawl those first instead of asking. Only ask what's truly unknown, and bundle it into one question set via `ask_user_input_v0` if useful (e.g. business location + who's expected to visit + whether payments are involved).

## Step 1: Inventory the site

Before writing anything, build a quick inventory — this drives every later step:
- All pages/routes
- All forms (contact, signup, checkout, newsletter) and what fields they collect
- All analytics/tracking scripts (Google Analytics, Meta Pixel, PostHog, Hotjar, etc.)
- All third-party embeds (maps, video, chat widgets, fonts, payment processors, social embeds)
- All cookies/localStorage set (first-party and third-party)
- All images/media and where they came from
- Any testimonials/reviews, stats, or claims ("#1", "trusted by 10,000+ users", "clinically proven," etc.)

Use `bash_tool`/`view` to grep the codebase for script tags, `<img>` tags, fetch/form actions, and known tracker snippets (`gtag`, `fbq`, `analytics`, `hotjar`, `posthog`, `Intercom`, iframe embeds) rather than relying on memory of what "usually" gets added.

## Step 2: Legal documents

Generate or update each of these as real pages (not just a checklist) — pick file names that match the site's stack (e.g. `privacy.html`, `/legal/privacy` route, or a CMS page). Use the docx/html/markdown skill conventions already available in this session for file creation.

**Privacy policy** — must cover, in plain language:
- What personal data is collected (from Step 1's inventory) and why
- Legal basis for processing (if EU/UK visitors possible)
- Third parties data is shared with (analytics vendors, embeds, payment processor, email tool)
- Cookies/tracking (link to the cookie policy)
- Data retention, and how users can request access/deletion
- Children's data statement (say clearly if the site isn't intended for under-13s / under-16s where relevant)
- Contact method for privacy questions
- Last-updated date

**Terms & conditions / terms of service** — cover:
- What the service is and isn't (disclaim guarantees)
- Acceptable use / prohibited conduct
- Account terms if there are accounts
- IP ownership (site content vs. user-submitted content)
- Limitation of liability and disclaimer of warranties
- Governing law/jurisdiction (matches Step 0's business location)
- Termination terms
- Changes-to-terms clause

**Cookie policy** — list actual cookies found in Step 1 (name, purpose, first/third-party, duration), not a generic template. Separate strictly-necessary vs. analytics vs. marketing.

**Refund/cancellation policy** — only if the site sells something. Cover: refund window, conditions, how to request, processing time, any non-refundable items, subscription cancellation terms. Many jurisdictions (e.g. EU consumer law) mandate specific withdrawal-right language for online sales — flag this rather than guessing at it.

For every generated policy: fill it from the site's *actual* inventory, not boilerplate placeholders. Leave a clear `[REVIEW: ...]` marker anywhere you had to guess or the user needs to confirm a legal fact (jurisdiction-specific liability caps, business entity name, etc.) — don't silently invent legal specifics.

## Step 3: Cookie consent

1. Determine if consent is actually required:
   - Strictly-necessary cookies (session, cart, load balancing) → no consent needed, just disclosure.
   - Analytics/marketing/third-party cookies + any plausible EU/UK/California visitors → consent banner needed, and for EU/UK it must be *opt-in before* non-essential cookies fire (no pre-ticked boxes, reject must be as easy as accept).
   - US-only sites with no sale/sharing of data for cross-context advertising may only need a simpler notice — say so, don't over-build.
2. If consent is required and missing, add a real consent banner that blocks non-essential scripts until accepted (not just a cosmetic banner sitting next to scripts that already fire on load — check this in the code, it's the single most common vibe-coded mistake here).
3. Wire the banner's "reject/manage" choice to actually gate the analytics/marketing scripts found in Step 1.

## Step 4: Data minimization pass

For every form and every analytics/tracking call in the inventory, ask "is this field/event necessary for the stated purpose?" Flag and recommend removing:
- Extra form fields not needed to fulfill the request (e.g. asking for a phone number on a newsletter signup)
- Analytics events capturing more than needed (full keystroke capture, session replay tools recording form input including passwords/payment fields — flag this as high severity if found)
- Third-party embeds that load trackers the user didn't realize (embedded YouTube/Maps/fonts pulling from third-party domains, social share buttons that track before any click)

## Step 5: Form consent

For every form that collects personal data or sends marketing:
- Add an explicit checkbox/statement for marketing opt-in, separate from the action being taken (don't bundle "submit" with "sign me up for emails")
- Link to the privacy policy near the submit button
- For anything sensitive (health, financial, children), flag that extra consent language or age-gating may be legally required and note this for the user to confirm rather than asserting a specific rule.

## Step 6: Accessibility (WCAG-oriented pass)

Work through the actual rendered site/code, not a generic checklist:
- **Alt text**: every `<img>` and meaningful background/decorative image gets alt text (empty `alt=""` for purely decorative images, descriptive alt for meaningful ones). Icons used as the only label for a button/link need alt text or `aria-label`.
- **Color contrast**: check text vs. background for body text (4.5:1) and large text/UI components (3:1). Compute actual contrast ratios from the site's CSS colors rather than eyeballing; flag every failing pair with its ratio and a compliant alternative color.
- **Keyboard-friendly forms**: every input, button, and interactive control must be reachable and operable via Tab/Shift+Tab/Enter/Space, with a visible focus state. Flag any `onClick`-only handlers with no keyboard equivalent, any missing `<label>`/`for` pairing, and any focus traps.
- **Clear button/link labels**: flag vague labels ("Click here," "Learn more," "Submit" with no context) and rewrite them to describe the action/destination. Icon-only buttons need accessible names.
- **Other quick wins while you're in there**: heading hierarchy (no skipped levels), form error messages tied to their fields via `aria-describedby`, sufficient touch target size, and no content conveyed by color alone.

## Step 7: Trust & content integrity

- **Fake/placeholder reviews or testimonials**: search the codebase/content for review blocks; if they're clearly placeholder/fabricated (lorem-ipsum names, stock photos with generic quotes, suspiciously round numbers), flag and remove or replace with real ones — don't leave fabricated social proof live, in most jurisdictions this is a deceptive-practices issue, not just a style nit.
- **Unsupported claims**: flag superlative/absolute claims ("#1," "clinically proven," "guaranteed results," "trusted by X customers") that aren't backed by a citation or data the user actually has. Either cite the support or soften the language.
- **Business details**: confirm the site discloses legal business name, physical/registered address, and a working contact method (many consumer-protection and e-commerce laws require this, especially for anything selling goods/services). Add a simple "About/Contact" or footer block if missing.
- **Image copyright**: for every image in the inventory, check whether it's the user's own, a licensed stock asset, or an unattributed find (reverse-image-search or ask if unclear). Flag anything that looks scraped from another site or AI-generated without disclosure, and recommend swapping to licensed/owned assets.

## Step 8: Jurisdiction-specific flags

Based on Step 0's business location and expected audience, do a targeted web search rather than relying on memory (laws in this space change) for anything applicable, such as: GDPR/ePrivacy (EU visitors), UK GDPR/PECR, CCPA/CPRA (California visitors), ADA/WCAG accessibility expectations (US), accessibility laws like the EU Accessibility Act, and any local e-commerce/consumer-protection or unfair-advertising rules relevant to the business location. Summarize what applies and why in plain terms — don't dump generic law names without tying each one to something specific on the site.

## Step 9: Final risk summary

Close every audit with a single prioritized list, roughly:
1. **Blockers** — likely to cause real legal/regulatory exposure if launched as-is (e.g. no privacy policy + collecting emails; consent-required cookies firing before consent; fake reviews live; payment/refund terms missing on a store).
2. **Should fix before launch** — accessibility failures, unsupported claims, missing business details, weak consent language.
3. **Good practice, not urgent** — minor contrast tweaks, nice-to-have policy clarity.

For each item, state what's wrong, why it matters, and what was done or what the user still needs to decide/confirm. Never claim the site is now "fully compliant" or "lawsuit-proof" — say what was addressed and what still needs a professional (lawyer, accessibility auditor) for anything genuinely high-stakes.
