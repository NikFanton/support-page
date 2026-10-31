/* Time Farm feedback. No request contents are written to logs or Sheets. */
var FEEDBACK_RECIPIENT = 'guchenko.n@gmail.com';
var FEEDBACK_CHANNEL = 'app-feedback-v1';
var FEEDBACK_APPS = {'time-farm': 'Time Farm', 'habit-streaks': 'Habit Streaks'};

function doGet() {
  return HtmlService.createHtmlOutput('Time Farm feedback service. Please use the support page.');
}

function doPost(event) {
  var response = processFeedback_(event || {});
  // HtmlService executes inside Google's sandbox iframe. top is the original
  // support page, whereas parent can be another Google sandbox wrapper.
  var payload = JSON.stringify({channel: FEEDBACK_CHANNEL, requestId: response.id,
    status: response.status, code: response.code}).replace(/</g, '\\u003c');
  var origin = JSON.stringify(response.origin).replace(/</g, '\\u003c');
  var bridge = response.origin ? '<script>window.top.postMessage(' + payload + ',' + origin + ');</script>' : '';
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><p>Feedback request processed.</p>' + bridge)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function processFeedback_(event) {
  var fields = event.parameter || {};
  var origin = /^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(String(fields.origin || '')) ? String(fields.origin) : '';
  var id = /^[a-f0-9]{48}$/.test(String(fields.requestId || '')) ? String(fields.requestId) : '';
  function answer(status, code) { return {id: id, origin: origin, status: status, code: code}; }
  var lock;
  var locked = false;
  var mailInvoked = false;
  try {
    var properties = PropertiesService.getScriptProperties();
    var allowed = String(properties.getProperty('ALLOWED_ORIGINS') || '').split(',').map(function(value) { return value.trim(); });
    if (!origin || allowed.indexOf(origin) < 0) return answer('rejected', 'unavailable');
    if (!id || Number(event.contentLength || 0) > 50000 ||
        String((event.postData || {}).contents || '').length > 50000) return answer('rejected', 'invalid');
    var names = ['app', 'type', 'message', 'replyEmail', 'website', 'requestId', 'origin'];
    for (var n = 0; n < names.length; n++) {
      var values = (event.parameters || {})[names[n]];
      if (values && values.length !== 1) return answer('rejected', 'invalid');
    }
    var app = String(fields.app || '');
    var type = String(fields.type || '');
    var message = String(fields.message || '').trim();
    var reply = String(fields.replyEmail || '').trim();
    if (!Object.prototype.hasOwnProperty.call(FEEDBACK_APPS, app) || ['feature', 'bug', 'other'].indexOf(type) < 0 || String(fields.website || '') !== '' ||
        message.length < 10 || message.length > 3000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message) ||
        reply.length > 254 || (reply && !/^[^\s@<>\\",;:]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(reply))) {
      return answer('rejected', 'invalid');
    }
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      id + '\n' + app + '\n' + type + '\n' + reply + '\n' + message);
    var hash = digest.slice(0, 16).map(function(value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); }).join('');
    var now = new Date();
    var day = Utilities.formatDate(now, 'UTC', 'yyyy-MM-dd');
    var yesterday = Utilities.formatDate(new Date(now.getTime() - 86400000), 'UTC', 'yyyy-MM-dd');
    var key = 'feedback_day_' + day;
    lock = LockService.getScriptLock();
    locked = lock.tryLock(5000);
    if (!locked) return answer('rejected', 'busy');
    var state = JSON.parse(properties.getProperty(key) || '{"count":0,"requests":{}}');
    var previous = JSON.parse(properties.getProperty('feedback_day_' + yesterday) || '{"count":0,"requests":{}}');
    var existing = state.requests[id] || previous.requests[id];
    if (existing) {
      if (existing.hash !== hash) return answer('rejected', 'conflict');
      return existing.status === 'sent' ? answer('sent', 'accepted') : answer('unconfirmed', 'delivery_unconfirmed');
    }
    var configured = Number(properties.getProperty('DAILY_LIMIT') || 30);
    var limit = isFinite(configured) ? Math.max(1, Math.min(50, Math.floor(configured))) : 30;
    if (state.count >= limit || MailApp.getRemainingDailyQuota() < 1) return answer('rejected', 'quota');
    // Reserve before sending. A crash/ambiguous send cannot lead a retry to
    // send the same request twice. Only a completed send gets a sent ack.
    state.count++;
    state.requests[id] = {hash: hash, status: 'reserved'};
    properties.setProperty(key, JSON.stringify(state));
    var labels = {feature: 'Feature suggestion', bug: 'Issue report', other: 'Feedback'};
    var mail = {to: FEEDBACK_RECIPIENT, subject: '[' + FEEDBACK_APPS[app] + '] ' + labels[type],
      name: 'App feedback', body: 'App: ' + FEEDBACK_APPS[app] + '\nType: ' + labels[type] + '\nRequest: ' + id +
        '\nReply email: ' + (reply || 'Not provided') + '\n\n' + message};
    if (reply) mail.replyTo = reply;
    mailInvoked = true;
    MailApp.sendEmail(mail);
    state.requests[id].status = 'sent';
    properties.setProperty(key, JSON.stringify(state));
    // Keep only today/yesterday's bounded hashes, IDs and status. Never store
    // message text or reply addresses in Script Properties.
    var stored = properties.getProperties();
    Object.keys(stored).forEach(function(name) {
      if (/^feedback_day_\d{4}-\d{2}-\d{2}$/.test(name) && name !== key && name !== 'feedback_day_' + yesterday) {
        properties.deleteProperty(name);
      }
    });
    return answer('sent', 'accepted');
  } catch (_) {
    return answer(mailInvoked ? 'unconfirmed' : 'rejected', 'delivery_unconfirmed');
  } finally {
    if (locked) lock.releaseLock();
  }
}
