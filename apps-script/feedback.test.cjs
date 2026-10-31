const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const client = require('../docs/assets/feedback.js');
function server(options = {}) {
  const data = {ALLOWED_ORIGINS: 'https://nikfanton.github.io', ...options.properties};
  const sent = []; let releases = 0; let writes = 0;
  const properties = {getProperty: k => data[k], getProperties: () => ({...data}), deleteProperty: k => delete data[k],
    setProperty(k, v) { if (++writes === options.failWrite) throw Error('write'); data[k] = v; }};
  const context = {PropertiesService: {getScriptProperties: () => properties},
    LockService: {getScriptLock: () => ({tryLock: () => options.lock !== false, releaseLock: () => releases++})},
    Utilities: {DigestAlgorithm: {SHA_256: 'sha256'}, computeDigest: (_, s) => [...crypto.createHash('sha256').update(s).digest()],
      formatDate: d => d.toISOString().slice(0,10)},
    MailApp: {getRemainingDailyQuota: () => options.quota ?? 100, sendEmail: mail => {sent.push(mail); if (options.mailThrow) throw Error('mail');}},
    HtmlService: {XFrameOptionsMode: {ALLOWALL: 1}, createHtmlOutput: html => ({html, setXFrameOptionsMode() {return this;}})}};
  vm.createContext(context); vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), context);
  return {context, sent, data, releases: () => releases};
}
function event(overrides = {}) {
  const parameter = {app: 'time-farm', type: 'feature', message: 'Please add a useful feature.', replyEmail: 'reply@example.com', website: '',
    requestId: 'a'.repeat(48), origin: 'https://nikfanton.github.io', ...overrides};
  return {parameter, parameters: Object.fromEntries(Object.entries(parameter).map(([k,v]) => [k,[v]])), contentLength: 100};
}
test('both apps use fixed recipient, subject and reply address; retries do not resend', () => {
  for (const [app, name] of [['time-farm','Time Farm'], ['habit-streaks','Habit Streaks']]) {
    const s = server(); const e = event({app});
    assert.equal(s.context.processFeedback_(e).status, 'sent');
    assert.equal(s.context.processFeedback_(e).status, 'sent');
    assert.equal(s.sent.length, 1); assert.equal(s.sent[0].to, 'guchenko.n@gmail.com');
    assert.equal(s.sent[0].subject, '[' + name + '] Feature suggestion'); assert.equal(s.sent[0].replyTo, 'reply@example.com');
    assert.equal(s.releases(), 2);
    assert.equal(s.context.processFeedback_(event({app: app === 'time-farm' ? 'habit-streaks' : 'time-farm'})).code, 'conflict');
  }
});
test('invalid app/type, injection, bounds, honeypot, origin, nonce and duplicate fields reject without mail', () => {
  for (const patch of [{app:'evil'}, {app:'__proto__'}, {type:'bad'}, {replyEmail:'x@example.com\nBcc:bad@example.com'},
    {message:'short'}, {message:'a'.repeat(3001)}, {message:'valid length\u0000'}, {website:'bot'}, {origin:'https://evil.test'}, {requestId:'bad'}]) {
    const s = server(); assert.equal(s.context.processFeedback_(event(patch)).status, 'rejected'); assert.equal(s.sent.length,0);
  }
  for (const mutate of [e => e.parameters.app.push('habit-streaks'), e => e.contentLength=50001, e => e.postData={contents:'x'.repeat(50001)}]) {
    const s=server(); const e=event(); mutate(e); assert.equal(s.context.processFeedback_(e).code,'invalid'); assert.equal(s.sent.length,0);
  }
});
test('quota and lock failure prevent sending', () => {
  for (const options of [{quota:0}, {lock:false}]) {const s=server(options); assert.equal(s.context.processFeedback_(event()).status,'rejected'); assert.equal(s.sent.length,0);}
  const s=server({properties:{DAILY_LIMIT:'1'}}); s.context.processFeedback_(event());
  assert.equal(s.context.processFeedback_(event({requestId:'b'.repeat(48)})).code,'quota'); assert.equal(s.sent.length,1);
});
test('ambiguous sends or failed sent-state persistence never report success or resend', () => {
  for (const options of [{mailThrow:true},{failWrite:2}]) {
    const s=server(options); assert.equal(s.context.processFeedback_(event()).status,'unconfirmed');
    assert.equal(s.context.processFeedback_(event()).status,'unconfirmed'); assert.equal(s.sent.length,1); assert.equal(s.releases(),2);
  }
  const s=server({failWrite:1}); assert.equal(s.context.processFeedback_(event()).status,'rejected'); assert.equal(s.sent.length,0);
});
test('ACK contains no submitted content and old metadata is pruned after sending', () => {
  const s=server({properties:{feedback_day_2000:'ignore','feedback_day_2000-01-01':'{}'}});
  const result=s.context.doPost(event({message:'Private text </script> example'}));
  assert.ok(result.html.includes('postMessage')); assert.ok(!result.html.includes('Private text')); assert.ok(!result.html.includes('reply@example.com'));
  assert.equal(s.data['feedback_day_2000-01-01'], undefined);
});
test('client validates endpoint, ACK origin, channel and exact pending ID', () => {
  assert.ok(client.validEndpoint('https://script.google.com/macros/s/example_123/exec'));
  assert.ok(!client.validEndpoint('https://script.google.com/macros/s/example/dev'));
  const e={origin:'https://script.googleusercontent.com',data:{channel:'app-feedback-v1',requestId:'a'.repeat(48),status:'sent'}};
  assert.ok(client.acceptedAck(e,'a'.repeat(48)));
  for (const origin of ['https://evil.test','https://script.googleusercontent.com.evil.test','http://script.google.com','null']) assert.equal(client.acceptedAck({...e,origin},'a'.repeat(48)),null);
  assert.equal(client.acceptedAck(e,'b'.repeat(48)),null);
  assert.equal(client.acceptedAck({...e,data:{...e.data,channel:'wrong'}},'a'.repeat(48)),null);
});
test('client deep links: allowlisted app only, type defaults to bug', () => {
  const apps = {'time-farm': {}, 'habit-streaks': {}};
  assert.equal(client.appFromQuery('?app=habit-streaks&type=feature', apps), 'habit-streaks');
  for (const search of ['', '?app=other', '?app=toString', '?app=__proto__']) assert.equal(client.appFromQuery(search, apps), null);
  assert.equal(client.typeFromQuery('?app=habit-streaks&type=feature'), 'feature');
  assert.equal(client.typeFromQuery('?type=other'), 'other');
  for (const search of ['', '?type=FEATURE', '?type=spam']) assert.equal(client.typeFromQuery(search), 'bug');
});
