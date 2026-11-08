const fs = require('node:fs');
if (!process.env.SERPAPI_API_KEY?.trim()) throw new Error('SerpAPI API key is required');
const firebase = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8'));
if (firebase.type !== 'service_account' || !firebase.project_id || !firebase.client_email ||
    !firebase.private_key?.includes('BEGIN PRIVATE KEY')) {
  throw new Error('Firebase Admin service account JSON is invalid');
}
const android = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICES_FILE, 'utf8'));
if (android.project_info?.project_id !== firebase.project_id) {
  throw new Error('Firebase Admin and Android configuration must use the same Firebase project');
}
if (!android.client?.some(client => client.client_info?.android_client_info?.package_name === 'com.faretrack.app')) {
  throw new Error('google-services.json must include com.faretrack.app');
}
console.log('Deployment credentials validated (contents omitted).');
