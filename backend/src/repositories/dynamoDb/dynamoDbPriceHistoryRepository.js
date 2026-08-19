const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
class DynamoDbPriceHistoryRepository {
  constructor(client,tableName){this.client=client;this.tableName=tableName;}
  async save(point){await this.client.send(new PutCommand({TableName:this.tableName,Item:{PK:`WATCH#${point.watchKey}`,SK:`PRICE#${point.checkedAt}#${point.id}`,entityType:'PriceHistory',data:point}}));return point;}
  async listByWatchKey(key){const items=[];let cursor;do{const result=await this.client.send(new QueryCommand({TableName:this.tableName,KeyConditionExpression:'PK = :pk AND begins_with(SK, :prefix)',ExpressionAttributeValues:{':pk':`WATCH#${key}`,':prefix':'PRICE#'},ScanIndexForward:true,ExclusiveStartKey:cursor}));items.push(...(result.Items||[]));cursor=result.LastEvaluatedKey;}while(cursor);return items.map(item=>item.data);}
}
module.exports={DynamoDbPriceHistoryRepository};
