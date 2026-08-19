const { createNotification } = require('../domain/notification');
class NotificationService { constructor(repository){this.repository=repository;} async send(alert,pricePoint,reasons){return this.repository.save(createNotification(alert,pricePoint,reasons));} }
module.exports = { NotificationService };
