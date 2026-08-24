const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { createNotification } = require('../domain/notification');

class NotificationService {
  constructor(repository, { queueUrl = process.env.NOTIFICATION_QUEUE_URL, sqs = new SQSClient({}) } = {}) {
    this.repository = repository;
    this.queueUrl = queueUrl;
    this.sqs = sqs;
  }

  async send(alert, pricePoint, reasons) {
    if (this.queueUrl) {
      await this.sqs.send(new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ alert, pricePoint, reasons })
      }));
      return true;
    }
    return this.repository.save(createNotification(alert, pricePoint, reasons));
  }
}
module.exports = { NotificationService };
