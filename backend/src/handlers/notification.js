const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const { createContainer } = require('../app');
const { createNotification } = require('../domain/notification');

const ses = new SESv2Client({});

async function processRecord(record) {
  const { alert, pricePoint, reasons } = JSON.parse(record.body);
  const recipient = alert.email;
  const sender = process.env.SES_FROM_EMAIL;
  let status = 'QUEUED_TEST';

  if (recipient && sender) {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: sender,
      Destination: { ToAddresses: [recipient] },
      Content: {
        Simple: {
          Subject: { Data: '[Faretrack] 항공권 가격 알림', Charset: 'UTF-8' },
          Body: {
            Text: {
              Data: `현재 관측 가격: ${pricePoint.price.toLocaleString('ko-KR')}원\n알림 사유: ${reasons.join(', ')}`,
              Charset: 'UTF-8'
            }
          }
        }
      }
    }));
    status = 'SENT';
  }

  const { notificationRepository } = createContainer();
  await notificationRepository.save(createNotification(alert, pricePoint, reasons, status));
}

exports.handler = async (event) => {
  const failures = [];
  for (const record of event.Records || []) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('Notification failed', { messageId: record.messageId, error });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
};
