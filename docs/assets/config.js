// Public deployment URL, not a secret. Paste the deployed Apps Script /exec URL.
// Leave empty until deployment; the page will offer email instead of pretending
// an unconfigured form can send messages. Colors live in support.css per app.
window.TIME_FARM_CONFIG = Object.freeze({
  feedbackEndpoint: 'https://script.google.com/macros/s/AKfycbx0-wrOTIOut30dvd74lK7TrySKujiXnRpdosFj5ulXWZLKqsiRC_wVVKcityK5oXSv/exec',
  apps: Object.freeze({
    'time-farm': Object.freeze({name: 'Time Farm', icon: 'assets/icons/time-farm.png'}),
    'habit-streaks': Object.freeze({name: 'Habit Streaks', icon: 'assets/icons/habit-streaks.png'}),
  }),
});
