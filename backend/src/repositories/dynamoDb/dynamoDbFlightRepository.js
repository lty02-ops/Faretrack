const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const crypto=require('node:crypto');
class DynamoDbFlightRepository {constructor(client,tableName){this.client=client;this.tableName=tableName;}async save(search){await this.client.send(new PutCommand({TableName:this.tableName,Item:{PK:`WATCH#${search.key}`,SK:`SEARCH#${search.requestedAt}#${crypto.randomUUID()}`,entityType:'FlightSearch',data:search}}));return search;}}
module.exports={DynamoDbFlightRepository};
