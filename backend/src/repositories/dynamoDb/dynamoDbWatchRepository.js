const { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

class DynamoDbWatchRepository {
  constructor(client, tableName) { this.client = client; this.tableName = tableName; }
  async findTargetByKey(key) {
    const result = await this.client.send(new GetCommand({ TableName:this.tableName, Key:{ PK:`WATCH#${key}`, SK:'META' } }));
    return result.Item?.data || null;
  }
  async saveTarget(target) {
    await this.client.send(new PutCommand({ TableName:this.tableName, Item:{ PK:`WATCH#${target.key}`, SK:'META', entityType:'WatchTarget', active:target.active, data:target }, ConditionExpression:'attribute_not_exists(PK) AND attribute_not_exists(SK)' }));
    return target;
  }
  async saveAlert(alert) {
    await this.client.send(new PutCommand({ TableName:this.tableName, Item:{ PK:`WATCH#${alert.watchKey}`, SK:`ALERT#${alert.id}`, GSI1PK:`USER#${alert.userId}`, GSI1SK:`ALERT#${alert.createdAt}`, entityType:'UserAlert', alertId:alert.id, active:alert.active, data:alert } }));
    return alert;
  }
  async findAlert(id) {
    let cursor; do { const result = await this.client.send(new ScanCommand({ TableName:this.tableName, FilterExpression:'entityType = :type AND alertId = :id', ExpressionAttributeValues:{ ':type':'UserAlert', ':id':id }, ExclusiveStartKey:cursor })); if(result.Items?.[0])return result.Items[0].data;cursor=result.LastEvaluatedKey; } while(cursor); return null;
  }
  async listAlerts(userId = 'demo-user') {
    const items=[];let cursor;do{const result=await this.client.send(new QueryCommand({TableName:this.tableName,IndexName:'GSI1',KeyConditionExpression:'GSI1PK = :user',ExpressionAttributeValues:{':user':`USER#${userId}`},ExclusiveStartKey:cursor}));items.push(...(result.Items||[]));cursor=result.LastEvaluatedKey;}while(cursor);return items.map(item=>item.data);
  }
  async updateAlert(id, patch) {
    const alert = await this.findAlert(id); if (!alert) return null;
    const updated = { ...alert, ...patch };
    await this.client.send(new UpdateCommand({ TableName:this.tableName, Key:{ PK:`WATCH#${alert.watchKey}`, SK:`ALERT#${id}` }, UpdateExpression:'SET #data = :data, #active = :active', ExpressionAttributeNames:{ '#data':'data', '#active':'active' }, ExpressionAttributeValues:{ ':data':updated, ':active':updated.active } }));
    return updated;
  }
  async deleteAlert(id) {
    const alert = await this.findAlert(id); if (!alert) return false;
    await this.client.send(new DeleteCommand({ TableName:this.tableName, Key:{ PK:`WATCH#${alert.watchKey}`, SK:`ALERT#${id}` } }));
    return true;
  }
  async listActiveTargets() {
    const items=[];let cursor;do{const result=await this.client.send(new ScanCommand({TableName:this.tableName,FilterExpression:'entityType = :type AND #active = :active',ExpressionAttributeNames:{'#active':'active'},ExpressionAttributeValues:{':type':'UserAlert',':active':true},ProjectionExpression:'PK',ExclusiveStartKey:cursor}));items.push(...(result.Items||[]));cursor=result.LastEvaluatedKey;}while(cursor);
    const keys = [...new Set(items.map(item => item.PK.slice(6)))];
    return (await Promise.all(keys.map(key => this.findTargetByKey(key)))).filter(Boolean);
  }
  async alertsForTarget(key) {
    const items=[];let cursor;do{const result=await this.client.send(new QueryCommand({TableName:this.tableName,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',FilterExpression:'#active = :active',ExpressionAttributeNames:{'#active':'active'},ExpressionAttributeValues:{':pk':`WATCH#${key}`,':prefix':'ALERT#',':active':true},ExclusiveStartKey:cursor}));items.push(...(result.Items||[]));cursor=result.LastEvaluatedKey;}while(cursor);return items.map(item=>item.data);
  }
}
module.exports = { DynamoDbWatchRepository };
