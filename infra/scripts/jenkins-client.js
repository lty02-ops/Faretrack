const fs = require('node:fs');
const { setTimeout: sleep } = require('node:timers/promises');
const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
})[char]);

class Jenkins {
  constructor(env, request = fetch) {
    for (const name of ['JENKINS_URL', 'JENKINS_USER', 'JENKINS_API_TOKEN']) {
      if (!env[name]?.trim() || env[name].includes('your-')) throw new Error(`Set ${name} in .env`);
    }
    this.env = env;
    this.base = new URL(env.JENKINS_URL.replace(/\/+$/, '') + '/');
    const url = this.base;
    if (url.username || url.password || url.search || url.hash) throw new Error('Use JENKINS_URL without embedded credentials, query or fragment');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      throw new Error('Use HTTPS for Jenkins, or HTTP localhost through a secure tunnel');
    }
    this.folder = env.JENKINS_DEPLOY_FOLDER || 'faretrack-deploy';
    this.job = env.JENKINS_DEPLOY_JOB || 'faretrack-deploy-dev';
    if (![this.folder, this.job].every(v => /^[A-Za-z0-9_-]+$/.test(v))) throw new Error('Use single folder/job names containing letters, digits, _ or -');
    this.folderPath = `job/${this.folder}/`;
    this.jobPath = `${this.folderPath}job/${this.job}/`;
    this.request = request;
  }

  safeUrl(path) {
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin || !url.pathname.startsWith(this.base.pathname)) {
      throw new Error('Jenkins returned a URL outside JENKINS_URL; check Jenkins Location configuration');
    }
    return url;
  }

  async call(path, { method = 'GET', body, type, allow404 = false } = {}) {
    const response = await this.request(this.safeUrl(path), {
      method, body, redirect: 'manual', signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.env.JENKINS_USER}:${this.env.JENKINS_API_TOKEN}`).toString('base64')}`,
        ...(type ? { 'Content-Type': type } : {})
      }
    });
    if (allow404 && response.status === 404) return null;
    if (response.status < 200 || response.status >= 400 || (method === 'GET' && response.status >= 300)) {
      throw new Error(`Jenkins ${method} failed (HTTP ${response.status}). Check URL, API token, permissions and plugins.`);
    }
    return response;
  }

  async json(path) { return (await this.call(path)).json(); }
  async check() {
    if (!(await this.json('whoAmI/api/json')).authenticated) throw new Error('Jenkins authentication failed');
    for (const name of ['TF_VAR_google_client_id', 'TF_VAR_google_client_secret', 'TF_VAR_kakao_client_id', 'TF_VAR_kakao_client_secret', 'SERPAPI_API_KEY']) {
      if (!this.env[name]?.trim()) throw new Error(`Set ${name} in .env`);
    }
    console.log('Jenkins connection and required variables verified.');
  }

  async setup() {
    await this.check();
    const exists = await this.call(`${this.folderPath}api/json`, { allow404: true });
    if (!exists) {
      await this.call(`createItem?name=${this.folder}`, { method: 'POST', type: 'application/xml',
        body: '<com.cloudbees.hudson.plugins.folder.Folder><description>Faretrack deployment</description><properties/></com.cloudbees.hudson.plugins.folder.Folder>' });
    } else if ((await exists.json())._class !== 'com.cloudbees.hudson.plugins.folder.Folder') {
      throw new Error('Deployment folder name is used by another item type');
    }
    const texts = {
      'faretrack-google-client-id': this.env.TF_VAR_google_client_id,
      'faretrack-google-client-secret': this.env.TF_VAR_google_client_secret,
      'faretrack-kakao-client-id': this.env.TF_VAR_kakao_client_id,
      'faretrack-kakao-client-secret': this.env.TF_VAR_kakao_client_secret,
      'faretrack-serpapi-api-key': this.env.SERPAPI_API_KEY,
      'faretrack-ses-from-email': this.env.TF_VAR_ses_from_email || '',
      'faretrack-monitoring-alert-email': this.env.TF_VAR_monitoring_alert_email || ''
    };
    const entries = Object.entries(texts).map(([id, value]) => [id,
      `<org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl><scope>GLOBAL</scope><id>${id}</id><description>Faretrack</description><secret>${escapeXml(value)}</secret></org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>`]);
    for (const [id, file] of [
      ['faretrack-firebase-service-account', this.env.FIREBASE_SERVICE_ACCOUNT_FILE],
      ['faretrack-android-google-services', this.env.GOOGLE_SERVICES_FILE]
    ]) {
      entries.push([id, `<org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl><scope>GLOBAL</scope><id>${id}</id><description>Faretrack</description><fileName>${id}.json</fileName><secretBytes>${fs.readFileSync(file).toString('base64')}</secretBytes></org.jenkinsci.plugins.plaincredentials.impl.FileCredentialsImpl>`]);
    }
    const store = `${this.folderPath}credentials/store/folder/domain/_/`;
    for (const [id, body] of entries) {
      const existing = await this.call(`${store}credential/${id}/api/json`, { allow404: true });
      await this.call(existing ? `${store}credential/${id}/config.xml` : `${store}createCredentials`,
        { method: 'POST', type: 'application/xml', body });
    }
    const job = await this.call(`${this.jobPath}api/json`, { allow404: true });
    if (!job) {
      const repo = this.env.JENKINS_REPOSITORY_URL || 'https://github.com/lty02-ops/Faretrack.git';
      const credential = this.env.JENKINS_SCM_CREDENTIALS_ID || '';
      await this.call(`${this.folderPath}createItem?name=${this.job}`, { method: 'POST', type: 'application/xml',
        body: `<flow-definition plugin="workflow-job"><description>Manual Faretrack dev deployment</description><keepDependencies>false</keepDependencies><properties/><definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps"><scm class="hudson.plugins.git.GitSCM" plugin="git"><configVersion>2</configVersion><userRemoteConfigs><hudson.plugins.git.UserRemoteConfig><url>${escapeXml(repo)}</url><credentialsId>${escapeXml(credential)}</credentialsId></hudson.plugins.git.UserRemoteConfig></userRemoteConfigs><branches><hudson.plugins.git.BranchSpec><name>*/main</name></hudson.plugins.git.BranchSpec></branches><doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations><submoduleCfg class="empty-list"/><extensions/></scm><scriptPath>Jenkinsfile.deploy</scriptPath><lightweight>true</lightweight></definition><triggers/><disabled>false</disabled></flow-definition>` });
      console.log('Created manual deployment pipeline from main.');
    } else if ((await job.json())._class !== 'org.jenkinsci.plugins.workflow.job.WorkflowJob') {
      throw new Error('Existing deployment job is not a Pipeline');
    }
    console.log('Deployment job ready. Existing job configuration is retained. Folder credentials synchronized (values omitted).');
  }

  async build() {
    const info = await this.json(`${this.jobPath}api/json`);
    if (info._class !== 'org.jenkinsci.plugins.workflow.job.WorkflowJob' || !info.buildable) throw new Error('Run setup.sh and enable the deployment Pipeline first');
    const response = await this.call(`${this.jobPath}build`, { method: 'POST' });
    const location = response.headers.get('location');
    if (!location) throw new Error('No queue URL returned. Check Jenkins before retrying to avoid duplicate builds.');
    const queueUrl = this.safeUrl(location).href.replace(/\/$/, '');
    console.log('Deployment queued. Builds committed main; local changes are not uploaded.');
    const deadline = Date.now() + 90 * 60 * 1000;
    let buildUrl;
    while (Date.now() < deadline) {
      const queue = await this.json(`${queueUrl}/api/json`);
      if (queue.cancelled) throw new Error('Deployment cancelled in queue');
      if (queue.executable?.url) { buildUrl = this.safeUrl(queue.executable.url).href; break; }
      await sleep(5000);
    }
    if (!buildUrl) throw new Error('Queue wait timed out. Check Jenkins before retrying.');
    console.log(`Jenkins build: ${buildUrl}`);
    while (Date.now() < deadline) {
      const result = await this.json(`${buildUrl.replace(/\/$/, '')}/api/json`);
      if (!result.building && result.result) {
        if (result.result !== 'SUCCESS') throw new Error(`Deployment ${result.result}. See the Jenkins build log.`);
        console.log(`Deployment complete. APK and deployment-info.json: ${buildUrl}artifact/`);
        console.log('Register socialProviderCallbackUrl from deployment-info.json in Google/Kakao consoles.');
        return;
      }
      await sleep(10000);
    }
    throw new Error('Wait timed out; Jenkins may still be running. Check the build URL.');
  }
}

if (require.main === module) {
  (async () => {
    const action = process.argv[2];
    if (!['check', 'setup', 'build'].includes(action)) throw new Error('Usage: jenkins-client.js check|setup|build');
    await new Jenkins(process.env)[action]();
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { Jenkins, escapeXml };
