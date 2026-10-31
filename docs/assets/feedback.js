(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TimeFarmFeedback = api; api.mount(root); }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var channel = 'app-feedback-v1';
  var types = ['bug', 'feature', 'other'];
  var copy = {
    bug: {label: 'What went wrong?', submit: 'Send report',
      placeholder: 'What happened and what did you expect? Your app version and device help too.'},
    feature: {label: 'What would you like to see?', submit: 'Send request',
      placeholder: 'Describe the feature and how you would use it.'},
    other: {label: 'Your message', submit: 'Send message',
      placeholder: 'Questions, thoughts, anything else.'},
  };
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
  // Only allowlisted app IDs are used; anything else falls back to the app picker.
  function appFromQuery(search, apps) {
    var id = new URLSearchParams(search).get('app');
    return id && Object.prototype.hasOwnProperty.call(apps || {}, id) ? id : null;
  }
  function typeFromQuery(search) {
    var type = new URLSearchParams(search).get('type');
    return types.indexOf(type) >= 0 ? type : 'bug';
  }
  function mount(win) {
    var doc = win.document;
    var form = doc && doc.getElementById('feedback-form');
    if (!form) return;
    var config = win.TIME_FARM_CONFIG || {};
    var apps = config.apps || {};
    var status = doc.getElementById('feedback-status');
    var submit = doc.getElementById('feedback-submit');
    var fields = doc.getElementById('feedback-fields');
    var done = doc.getElementById('feedback-done');
    var message = form.elements.message;
    var endpoint = config.feedbackEndpoint || '';
    var appId = appFromQuery(win.location.search, apps);
    var initialType = typeFromQuery(win.location.search);
    var pending = null;
    var timer = null;
    var frame = null;
    var post = null;
    var sending = false;

    function applyApp(id) {
      appId = id;
      var app = apps[id];
      doc.documentElement.dataset.app = id;
      doc.title = app.name + ' Support';
      doc.getElementById('app-name').textContent = app.name;
      var icon = doc.getElementById('app-icon');
      icon.src = app.icon;
      doc.querySelectorAll('[data-contact]').forEach(function (element) {
        element.href = 'mailto:guchenko.n@gmail.com?subject=' + encodeURIComponent(app.name + ' support');
      });
    }
    function applyType() {
      var text = copy[form.elements.type.value] || copy.bug;
      doc.getElementById('message-label').textContent = text.label;
      message.placeholder = text.placeholder;
      if (!sending) submit.textContent = text.submit;
    }
    function notice(text, error) {
      status.textContent = text;
      status.className = error ? 'status error' : 'status';
    }

    if (appId) applyApp(appId);
    else {
      // Shared entry without ?app=: ask which app the message is about.
      var picker = doc.getElementById('app-picker');
      picker.hidden = false;
      Array.prototype.forEach.call(form.elements.appChoice, function (radio) {
        radio.required = true;
        radio.addEventListener('change', function () {
          applyApp(radio.value);
          var params = new URLSearchParams(win.location.search);
          params.set('app', radio.value);
          win.history.replaceState(null, '', '?' + params.toString());
        });
      });
    }
    form.elements.type.value = initialType;
    applyType();
    Array.prototype.forEach.call(form.elements.type, function (radio) {
      radio.addEventListener('change', applyType);
    });

    function finishWaiting() {
      win.clearTimeout(timer);
      sending = false;
      fields.disabled = false;
      applyType();
    }
    function cleanupTransport() {
      if (frame) frame.remove();
      if (post) post.remove();
      frame = post = null;
    }
    if (!validEndpoint(endpoint)) {
      submit.disabled = true;
      notice('The form is offline right now. Please email us instead.', true);
      return;
    }
    submit.disabled = false;
    doc.getElementById('feedback-again').addEventListener('click', function () {
      done.hidden = true;
      fields.hidden = false;
      message.focus();
    });
    form.addEventListener('input', function () {
      if (!sending && pending) { pending = null; cleanupTransport(); }
    });
    win.addEventListener('message', function (event) {
      if (!pending) return;
      var ack = acceptedAck(event, pending.id);
      if (!ack) return;
      finishWaiting();
      if (ack.status === 'sent') {
        var type = form.elements.type.value;
        form.reset();
        form.elements.type.value = type;
        if (appId && form.elements.appChoice) form.elements.appChoice.value = appId;
        applyType();
        notice('');
        pending = null;
        cleanupTransport();
        fields.hidden = true;
        done.hidden = false;
        done.focus();
      } else {
        var messages = {
          invalid: 'Please check your message and email, then try again.',
          quota: 'The form is busy today. Please email us instead.',
          busy: 'The form is busy. Please try again in a moment.',
          unavailable: 'The form is unavailable. Please email us instead.',
          conflict: 'Please edit your message and try again.',
        };
        notice(messages[ack.code] || 'We couldn’t confirm delivery. Your text is still here — try again or email us.', true);
      }
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      if (!appId) { notice('Choose an app first.', true); return; }
      var values = {app: appId, type: form.elements.type.value, message: message.value.trim(),
        replyEmail: form.elements.replyEmail.value.trim(), website: form.elements.website.value,
        origin: win.location.origin};
      if (values.message.length < 10 || values.message.length > 3000) {
        notice('Please write between 10 and 3,000 characters.', true); return;
      }
      var fingerprint = JSON.stringify(values);
      if (!pending || pending.fingerprint !== fingerprint) {
        var bytes = new Uint8Array(24);
        if (!win.crypto || !win.crypto.getRandomValues) {
          notice('This browser can’t send the form. Please email us instead.', true); return;
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
      notice('');
      timer = win.setTimeout(function () {
        finishWaiting();
        notice('No confirmation yet. Your text is safe — try again to check, or email us.', true);
      }, 25000);
      // A normal HTML form POST supports cross-origin submission. Never use
      // fetch(mode:no-cors): an opaque response cannot confirm email delivery.
      post.submit();
    });
  }
  return {validEndpoint: validEndpoint, trustedGoogleOrigin: trustedGoogleOrigin,
    acceptedAck: acceptedAck, appFromQuery: appFromQuery, typeFromQuery: typeFromQuery, mount: mount};
});
