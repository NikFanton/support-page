# Shared support pages

GitHub Pages source: `main` branch, `/docs` directory. No build step.

- `/support/?app=time-farm`
- `/support/?app=habit-streaks`
- Add `&type=feature` to preselect a feature suggestion.
- `/time-farm/support/` redirects to the shared form.
- `/time-farm/policy/` contains the supplied Time Farm privacy policy.

Configure the deployed Apps Script `/exec` URL in `assets/config.js`. Until configured, the form offers email and cannot submit. See `../apps-script/README.md` for deployment, authorization and delivery semantics. No real email test has been performed.
