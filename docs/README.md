# Shared support pages

GitHub Pages source: `main` branch, `/docs` directory. No build step.

- `/?app=time-farm` and `/?app=habit-streaks` open the form for that app. Without `app` the page asks which app.
- `&type=feature` preselects Feature; `bug` (default) and `other` work the same way.
- `/support/` and `/time-farm/support/` redirect to the form, keeping the query.
- `/privacy.html` is the feedback privacy notice (`/support/privacy.html` redirects there).
- `/time-farm/policy/` contains the Time Farm privacy policy.

Per-app names and icons are in `assets/config.js`, colors in `assets/support.css`. App IDs must also be allowlisted in `../apps-script/Code.gs`.

Configure the deployed Apps Script `/exec` URL in `assets/config.js`. Until configured, the form offers email and cannot submit. See `../apps-script/README.md` for deployment, authorization and delivery semantics.
