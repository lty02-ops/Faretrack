const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { createContainer } = require('../app');
const { createNotification } = require('../domain/notification');

const ses = new SESv2Client({});
const secrets = new SecretsManagerClient({});
let firebaseApp;

async function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.FIREBASE_SECRET_ARN }));
  const credentials = JSON.parse(result.SecretString || '{}');
  firebaseApp = getApps()[0] || initializeApp({ credential: cert(credentials) });
  return firebaseApp;
}

async function sendPush(devices, pricePoint, reasons) {
  if (!devices.length) return 0;
  const app = await getFirebaseApp();
  const formattedPrice = Number(pricePoint.price).toLocaleString('ko-KR');
  const response = await getMessaging(app).sendEachForMulticast({
    tokens: devices.map(device => device.token),
    data: {
      alertType: 'PRICE_DROP',
      destination: 'WATCHES',
      title: 'Faretrack 가격 알림',
      body: `현재 가격 ${formattedPrice}원 · ${reasons.join(', ')}`
    },
    android: { priority: 'high' }
  });
  return response.successCount;
}

async function sendFallbackEmail(alert, pricePoint, reasons) {
  if (!alert.email || !process.env.SES_FROM_EMAIL) return false;
  await ses.send(new SendEmailCommand({
    FromEmailAddress: process.env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [alert.email] },
    Content: { Simple: {
      Subject: { Data: '[Faretrack] 항공권 가격 알림', Charset: 'UTF-8' },
      Body: { Text: { Data: `현재 가격 ${Number(pricePoint.price).toLocaleString('ko-KR')}원\n알림 사유: ${reasons.join(', ')}`, Charset: 'UTF-8' } }
    } }
  }));
  return true;
}

async function processRecord(record) {
  const { alert, pricePoint, reasons } = JSON.parse(record.body);
  const { watchRepository, notificationRepository } = createContainer();
  const devices = await watchRepository.listDevices(alert.userId);
  const sent = await sendPush(devices, pricePoint, reasons);
  const emailSent = sent === 0 && await sendFallbackEmail(alert, pricePoint, reasons);
  const status = sent > 0 ? 'PUSH_SENT' : emailSent ? 'EMAIL_SENT' : 'NO_DESTINATION';
  const channel = sent > 0 ? 'PUSH' : emailSent ? 'EMAIL' : 'NONE';
  if (sent > 0 || emailSent) {
    await watchRepository.updateAlert(alert.id, {
      targetReachedNotified: Boolean(alert.targetReachedNotified || reasons.includes('TARGET_REACHED')),
      percentageDropTriggered: Boolean(alert.percentageDropTriggered || reasons.includes('PRICE_DROP')),
      lastNotifiedPrice: pricePoint.price,
      lastNotifiedAt: pricePoint.checkedAt
    });
  }
  await notificationRepository.save(createNotification(alert, pricePoint, reasons, status, channel));
}

exports.handler = async (event) => {
  const failures = [];
  for (const record of event.Records || []) {
    try { await processRecord(record); }
    catch (error) { console.error('Notification failed', { messageId: record.messageId, error }); failures.push({ itemIdentifier: record.messageId }); }
  }
  return { batchItemFailures: failures };
};
