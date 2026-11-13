const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Jenkins } = require('./jenkins-client');

const env = {
  JENKINS_URL: 'https://ci.example.test/jenkins/', JENKINS_USER: 'deploy', JENKINS_API_TOKEN: 'private-token',
  TF_VAR_google_client_id: 'google', TF_VAR_google_client_secret: 'a<&secret',
  TF_VAR_kakao_client_id: 'kakao', TF_VAR_kakao_client_secret: 'private', SERPAPI_API_KEY: 'key'
};
const json = value => new Response(JSON.stringify(value), { status: 200 });

test('rejects unsafe credential destinations before issuing requests', async () => {
  assert.throws(() => new Jenkins({ ...env, JENKINS_URL: 'http://public.example.test' }), /HTTPS/);
  let called = false;
  const client = new Jenkins(env, async () => { called = true; });
  await assert.rejects(client.call('https://other.example.test/queue/1'), /outside/);
  await assert.rejects(client.call('https://ci.example.test/outside/'), /outside/);
  assert.equal(called, false);
});

test('creates a folder-scoped credential set and a manual main-branch job', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faretrack-jenkins-'));
  try {
    const file = path.join(dir, 'fixture.json');
    fs.writeFileSync(file, '{"fixture":true}');
    const requests = [];
    const client = new Jenkins({ ...env, FIREBASE_SERVICE_ACCOUNT_FILE: file, GOOGLE_SERVICES_FILE: file }, async (url, options) => {
      requests.push({ url: url.href, ...options });
      if (url.pathname.endsWith('/whoAmI/api/json')) return json({ authenticated: true });
      if (options.method === 'GET') return new Response(null, { status: 404 });
      return new Response(null, { status: 200 });
    });
    await client.setup();
    const credentials = requests.filter(r => r.url.endsWith('/createCredentials'));
    assert.equal(credentials.length, 9);
    assert.ok(credentials.every(r => r.url.includes('/job/faretrack-deploy/credentials/store/folder/')));
    assert.ok(credentials.some(r => r.body.includes('a&lt;&amp;secret')));
    assert.ok(credentials.some(r => r.body.includes(Buffer.from('{"fixture":true}').toString('base64'))));
    const job = requests.find(r => r.url.includes('createItem?name=faretrack-deploy-dev'));
    assert.match(job.body, /Jenkinsfile.deploy/);
    assert.match(job.body, /\*\/main/);
    assert.match(job.body, /<triggers\/>/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('retains an existing deployment job and updates credentials', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faretrack-jenkins-'));
  try {
    const file = path.join(dir, 'fixture.json');
    fs.writeFileSync(file, '{}');
    const posts = [];
    const client = new Jenkins({ ...env, FIREBASE_SERVICE_ACCOUNT_FILE: file, GOOGLE_SERVICES_FILE: file }, async (url, options) => {
      if (options.method === 'POST') { posts.push(url.href); return new Response(null, { status: 200 }); }
      if (url.pathname.includes('whoAmI')) return json({ authenticated: true });
      if (url.pathname.endsWith('/job/faretrack-deploy/api/json')) return json({ _class: 'com.cloudbees.hudson.plugins.folder.Folder' });
      return json({ _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob' });
    });
    await client.setup();
    assert.equal(posts.length, 9);
    assert.ok(posts.every(url => url.endsWith('/config.xml') && url.includes('/credential/')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tracks the exact queued build and reports completion', async () => {
  const client = new Jenkins(env, async (url, options) => {
    if (options.method === 'POST') return new Response(null, { status: 201, headers: { location: 'https://ci.example.test/jenkins/queue/item/12/' } });
    if (url.pathname.includes('/queue/')) return json({ executable: { url: 'https://ci.example.test/jenkins/job/faretrack-deploy/job/faretrack-deploy-dev/7/' } });
    if (url.pathname.includes('/7/')) return json({ building: false, result: 'SUCCESS' });
    return json({ _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob', buildable: true });
  });
  await client.build();
});

test('fails on an unsuccessful build instead of reporting deployment success', async () => {
  const client = new Jenkins(env, async (url, options) => {
    if (options.method === 'POST') return new Response(null, { status: 201, headers: { location: 'queue/item/1/' } });
    if (url.pathname.includes('/queue/')) return json({ executable: { url: 'https://ci.example.test/jenkins/job/faretrack-deploy/job/faretrack-deploy-dev/2/' } });
    if (url.pathname.includes('/2/')) return json({ building: false, result: 'FAILURE' });
    return json({ _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob', buildable: true });
  });
  await assert.rejects(client.build(), /FAILURE/);
});

test('does not echo a server error body containing credentials', async () => {
  const client = new Jenkins(env, async () => new Response('private-token', { status: 403 }));
  await assert.rejects(client.check(), error => error.message.includes('403') && !error.message.includes('private-token'));
});
