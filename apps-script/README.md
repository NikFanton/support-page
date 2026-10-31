# Shared app feedback — deployable package

GitHub Pages is published from `main` → `/docs`. Apps Script version 1 is deployed as owner with anonymous access, and its `/exec` URL is configured in `docs/assets/config.js`.

**No real test email has been sent; inbox delivery has not been verified.** The public endpoint's GET response was checked without sign-in.

Canonical Pages URL after publishing this package in `NikFanton/support-page`:

- `https://support.productive-lab.com/?app=time-farm`
- `https://support.productive-lab.com/?app=habit-streaks&type=feature`

`/support/` and `/time-farm/support/` remain backwards-compatible redirects. One shared renderer lives at the site root; assets and the app allowlist live under `/assets/`. Unknown app IDs are rejected on the server. The recipient is fixed to **guchenko.n@gmail.com**; callers cannot choose recipients or email subjects.

## Publish

1. Create a standalone Apps Script project while signed in as the owner. Copy `Code.gs` and `appsscript.json` into it.
2. In Project settings → Script properties, set **ALLOWED_ORIGINS** to exactly `https://nikfanton.github.io` (no repository path or trailing slash). Optional **DAILY_LIMIT** defaults to 30 and is capped at 50 across all apps. Add any future custom HTTPS origin as a comma-separated value.
3. Deploy → New deployment → Web app, execute as **Me**, access **Anyone** (anonymous). The manifest records those intended settings; verify them in the deployment UI. This requires the owner to explicitly approve the new `script.send_mail` OAuth permission. The code does not request access to read Gmail, Drive or Sheets. Do not bypass a browser security warning or approve unexpected permissions.
4. Copy the deployed URL ending in `/exec` into `docs/assets/config.js` → `feedbackEndpoint`. It is a public URL, not a secret. Use `/exec`, not the editor-only `/dev` URL.
5. Set GitHub Pages to deploy from branch `main`, directory `/docs`. Preserve `support/`, `assets/` and `time-farm/` relative paths. The client stays disabled with an email fallback until an endpoint is configured.
6. Open the public form in a signed-out browser. Check both app names, categories, responsive layout and optional email. Previewing does not send mail. Only perform a real submission after the owner authorizes a test email; verify arrival and the success acknowledgment. A successful local test is not proof of a deployed email flow.

Adding another app requires updating both `FEEDBACK_APPS` in `Code.gs` and `apps` in `assets/config.js`, then redeploying the Apps Script version. Never accept arbitrary app names or recipients from a query string.

## Delivery protocol and limits

A normal HTML form POST targets a hidden iframe. Apps Script returns a sandboxed `HtmlOutput` acknowledgment with `ALLOWALL` framing and posts only status, code and the random request ID to the exact claimed HTTPS support origin. The parent checks Google's response origin, protocol marker and its 192-bit request ID. Google's sandbox can nest an extra iframe, so the parent does not incorrectly require `event.source` to equal the outer iframe window. No feedback contents are sent through `postMessage`.

**Success appears only after MailApp.sendEmail returns and the server records the sent status.** An iframe load or opaque `fetch(no-cors)` response is never treated as success. Timeout retains the text and the same request ID; retry checks delivery without sending the same request twice. An ambiguous mail error stays unconfirmed. “Sent” means accepted by the mail service, not a guarantee against spam filtering or later email delivery failure.

Server checks app/category, message length (10–3,000 characters), optional reply address, duplicate fields, payload size and honeypot. A script lock protects the quota and deduplication state. Daily mail-service quota is checked at runtime. Only bounded hashes/IDs/status and day counters persist in Script Properties, with older day records pruned after a successful submission (they can remain during inactivity); no message body or address is logged or saved there. Email content is plain text. No auto-reply is sent.

This is an anonymous public endpoint. The origin field and honeypot are **not authentication** and cannot stop a determined bot from using the public endpoint or exhausting the configured quota. The fixed recipient and low daily limit bound its impact. Increase limits only after observing legitimate demand; a high-volume service should use stronger abuse controls.

## Local checks (no mail or cloud writes)

Run `node --test apps-script/feedback.test.cjs` from the app repository. Tests execute Code.gs with stubbed Google services and a mail stub; they never call Google or send email.

Primary references: [Apps Script web-app access](https://developers.google.com/apps-script/manifest/web-app-api-executable), [HtmlOutput and iframe support](https://developers.google.com/apps-script/reference/html/html-output), [MailApp and its send-only permission](https://developers.google.com/apps-script/reference/mail/mail-app).
