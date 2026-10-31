// Public deployment URL, not a secret. Paste the deployed Apps Script /exec URL.
// Leave empty until deployment; the page will offer email instead of pretending
// an unconfigured form can send messages.
window.TIME_FARM_CONFIG = Object.freeze({
  feedbackEndpoint: '',
  apps: Object.freeze({
    'time-farm': Object.freeze({name: 'Time Farm', accent: '#29613c', background: '#faf7ee'}),
    'habit-streaks': Object.freeze({name: 'Habit Streaks', accent: '#5d5ae6', background: '#f5f4fc'}),
  }),
});
