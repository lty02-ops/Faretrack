const { PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
class DynamoDbNotificationRepository {
  constructor(client,tableName){this.client=client;this.tableName=tableName;}
  async exists(key){const result=await this.client.send(new ScanCommand({TableName:this.tableName,FilterExpression:'entityType = :type AND deduplicationKey = :key',ExpressionAttributeValues:{':type':'NotificationHistory',':key':key},Limit:1}));return(result.Items||[]).length>0;}
  async save(item){if(await this.exists(item.deduplicationKey))return null;await this.client.send(new PutCommand({TableName:this.tableName,Item:{PK:`ALERT#${item.alertId}`,SK:`NOTICE#${item.createdAt}#${item.id}`,entityType:'NotificationHistory',deduplicationKey:item.deduplicationKey,data:item},ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)'}));return item;}
  async list(){const result=await this.client.send(new ScanCommand({TableName:this.tableName,FilterExpression:'entityType = :type',ExpressionAttributeValues:{':type':'NotificationHistory'}}));return(result.Items||[]).map(item=>item.data);}
}
module.exports={DynamoDbNotificationRepository};
