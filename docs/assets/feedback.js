(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TimeFarmFeedback = api; api.mount(root); }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var channel = 'app-feedback-v1';
  function validEndpoint(value) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value || '');
  }
  function trustedGoogleOrigin(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && !url.port &&
        (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com' ||
          /^[a-z0-9-]+-script\.googleusercontent\.com$/.test(url.hostname));
    } catch (_) { return false; }
  }
  function acceptedAck(event, requestId) {
    var data = event.data;
    return trustedGoogleOrigin(event.origin) && data && data.channel === channel &&
      data.requestId === requestId && /^[a-f0-9]{48}$/.test(requestId) &&
      ['sent', 'rejected', 'unconfirmed'].indexOf(data.status) !== -1 ? data : null;
  }
  function mount(win) {
    var doc = win.document;
    var form = doc && doc.getElementById('feedback-form');
    if (!form) return;
    var status = doc.getElementById('feedback-status');
    var submit = doc.getElementById('feedback-submit');
    var fields = doc.getElementById('feedback-fields');
    var endpoint = (win.TIME_FARM_CONFIG || {}).feedbackEndpoint || '';
    var params = new URLSearchParams(win.location.search);
    var appId = params.get('app') || 'time-farm';
    var app = ((win.TIME_FARM_CONFIG || {}).apps || {})[appId];
    if (!app || !Object.prototype.hasOwnProperty.call((win.TIME_FARM_CONFIG || {}).apps || {}, appId)) {
      submit.disabled = true;
      status.textContent = 'The selected app is not supported by this form. Please email support.';
      return;
    }
    doc.title = app.name + ' — Support';
    doc.getElementById('app-title').textContent = app.name + ' support';
    doc.getElementById('app-footer').textContent = app.name;
    doc.documentElement.style.setProperty('--accent', app.accent);
    doc.documentElement.style.setProperty('--background', app.background);
    doc.getElementById('time-farm-help').hidden = appId !== 'time-farm';
    doc.querySelectorAll('[data-time-farm-only]').forEach(function (element) { element.hidden = appId !== 'time-farm'; });
    doc.querySelectorAll('[data-contact]').forEach(function (element) {
      element.href = 'mailto:guchenko.n@gmail.com?subject=' + encodeURIComponent(app.name + ' feedback');
    });
    var type = form.elements.type;
    var prefill = new URLSearchParams(win.location.search).get('type');
    if (['feature', 'bug', 'other'].indexOf(prefill) >= 0) type.value = prefill;
    var pending = null;
    var timer = null;
    var frame = null;
    var post = null;
    var sending = false;
    function notice(message, success) {
      status.textContent = message;
      status.className = success ? 'status success' : 'status';
    }
    function finishWaiting() {
      win.clearTimeout(timer);
      sending = false;
      fields.disabled = false;
      submit.textContent = 'Send feedback';
    }
    function cleanupTransport() {
      if (frame) frame.remove();
      if (post) post.remove();
      frame = post = null;
    }
    if (!validEndpoint(endpoint)) {
      submit.disabled = true;
      notice('The online form is not available yet. Please use the email link below.');
      return;
    }
    submit.disabled = false;
    notice('Your message goes to the ' + app.name + ' developer. No Google sign-in is needed.');
    form.addEventListener('input', function () {
      if (!sending && pending) { pending = null; cleanupTransport(); }
    });
    win.addEventListener('message', function (event) {
      if (!pending) return;
      var ack = acceptedAck(event, pending.id);
      if (!ack) return;
      finishWaiting();
      if (ack.status === 'sent') {
        notice('Thank you — your feedback was sent to the ' + app.name + ' developer.', true);
        form.reset();
        pending = null;
        cleanupTransport();
      } else {
        var messages = {
          invalid: 'Please check the message and optional reply email, then try again.',
          quota: 'The form has reached its sending limit. Please email support instead.',
          busy: 'The form is busy. Please try again in a moment.',
          unavailable: 'The online form is unavailable. Please email support instead.',
          conflict: 'Please edit your message and try again.',
        };
        notice(messages[ack.code] || 'We could not confirm delivery. Your text is still here. Retry to check the same request, or email support.');
      }
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      var values = {app: appId, type: type.value, message: form.elements.message.value.trim(),
        replyEmail: form.elements.replyEmail.value.trim(), website: form.elements.website.value,
        origin: win.location.origin};
      if (values.message.length < 10 || values.message.length > 3000) {
        notice('Please write between 10 and 3,000 characters.'); return;
      }
      var fingerprint = JSON.stringify(values);
      if (!pending || pending.fingerprint !== fingerprint) {
        var bytes = new Uint8Array(24);
        if (!win.crypto || !win.crypto.getRandomValues) {
          notice('The form cannot be sent in this browser. Please email support.'); return;
        }
        win.crypto.getRandomValues(bytes);
        pending = {id: Array.from(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join(''), fingerprint: fingerprint};
      }
      cleanupTransport();
      values.requestId = pending.id;
      frame = doc.createElement('iframe');
      frame.name = 'feedback-response-' + pending.id;
      frame.hidden = true;
      frame.title = 'Feedback response';
      doc.body.appendChild(frame);
      post = doc.createElement('form');
      post.method = 'POST'; post.action = endpoint; post.target = frame.name; post.hidden = true;
      Object.keys(values).forEach(function (name) {
        var input = doc.createElement('input');
        input.type = 'hidden'; input.name = name; input.value = values[name]; post.appendChild(input);
      });
      doc.body.appendChild(post);
      sending = true;
      fields.disabled = true;
      submit.textContent = 'Sending…';
      notice('Sending your feedback…');
      timer = win.setTimeout(function () {
        finishWaiting();
        notice('We have not received confirmation yet. Your text is safe. Retry to check delivery, or email support.');
      }, 25000);
      // A normal HTML form POST supports cross-origin submission. Never use
      // fetch(mode:no-cors): an opaque response cannot confirm email delivery.
      post.submit();
    });
  }
  return {validEndpoint: validEndpoint, trustedGoogleOrigin: trustedGoogleOrigin,
    acceptedAck: acceptedAck, mount: mount};
});
