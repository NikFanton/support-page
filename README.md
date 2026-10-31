# Shared app support

GitHub Pages source: `main` / `docs`, custom domain `support.productive-lab.com`.

- [Time Farm](https://support.productive-lab.com/?app=time-farm)
- [Habit Streaks](https://support.productive-lab.com/?app=habit-streaks)
- Request a feature: add `&type=feature` (also `bug`, the default, or `other`).

Backend and deployment instructions: [apps-script/README.md](apps-script/README.md).

Local checks: `node --test apps-script/feedback.test.cjs` (mail is stubbed).

Pages and Apps Script are deployed; the form endpoint is configured. No real test email has been sent and inbox delivery has not been verified.
