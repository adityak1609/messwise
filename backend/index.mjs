import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MAX_PHOTO_BYTES, PHOTO_TYPES, ValidationError, validateId, validateRecord, validatePhotoKey, validateUpload } from './validation.mjs';
const response = (statusCode, value) => ({statusCode, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}, ...(statusCode === 204 ? {} : {body: JSON.stringify(value)})});
function body(event) { if (!event.body || event.body.length > 150000) throw new ValidationError('Provide a JSON body under 150 KB.'); try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch { throw new ValidationError('Request body must be valid JSON.'); } }
function recordOf(item) { return {...item.record, createdAt:item.createdAt, updatedAt:item.updatedAt}; }
export function createHandler({db, s3, table, bucket, presignPost = createPresignedPost, signUrl = getSignedUrl}) {
return async function handler(event, context) {
  const requestId = event.requestContext?.requestId ?? context?.awsRequestId ?? 'unknown';
  // API Gateway validates JWT signature, issuer, expiry, and audience before invocation.
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof userId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(userId)) return response(401, {message:'Sign in to use AWS storage.', requestId});
  const pk = 'USER#' + userId;
  try {
    switch (event.routeKey) {
      case 'GET /health': return response(200, {mode:'aws', service:'MessWise', requestId});
      case 'GET /records': {
        const items = []; let cursor;
        do { const page = await db.send(new QueryCommand({TableName:table, KeyConditionExpression:'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues:{':pk':pk, ':prefix':'RECORD#'}, ExclusiveStartKey:cursor, ConsistentRead:true})); items.push(...(page.Items ?? [])); cursor = page.LastEvaluatedKey; } while (cursor);
        const records = items.map(recordOf).sort((a,b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
        return response(200, {records});
      }
      case 'PUT /records/{id}': {
        const id = validateId(event.pathParameters?.id); const record = validateRecord(body(event), id, userId); const now = new Date().toISOString();
        const key = {pk,sk:'RECORD#'+id};
        const previous = (await db.send(new GetCommand({TableName:table, Key:key, ConsistentRead:true}))).Item;
        const item = {...key, record, createdAt:previous?.createdAt ?? now, updatedAt:now, version:randomUUID()};
        const writes = [
          {Put:{TableName:table, Item:item, ConditionExpression:previous ? '#version = :version' : 'attribute_not_exists(pk)', ...(previous ? {ExpressionAttributeNames:{'#version':'version'}, ExpressionAttributeValues:{':version':previous.version}} : {})}},
          {Put:{TableName:table, Item:{pk,sk:'DATE#'+record.date,recordId:id}, ConditionExpression:'attribute_not_exists(pk) OR recordId = :id', ExpressionAttributeValues:{':id':id}}}
        ];
        if (previous && previous.record.date !== record.date) writes.push({Delete:{TableName:table, Key:{pk,sk:'DATE#'+previous.record.date}, ConditionExpression:'recordId = :id', ExpressionAttributeValues:{':id':id}}});
        await db.send(new TransactWriteCommand({TransactItems:writes}));
        return response(200, {record:recordOf(item)});
      }
      case 'DELETE /records/{id}': {
        const id = validateId(event.pathParameters?.id); const key = {pk,sk:'RECORD#'+id};
        const previous = (await db.send(new GetCommand({TableName:table, Key:key, ConsistentRead:true}))).Item;
        if (previous) await db.send(new TransactWriteCommand({TransactItems:[
          {Delete:{TableName:table, Key:key, ConditionExpression:'#version = :version', ExpressionAttributeNames:{'#version':'version'}, ExpressionAttributeValues:{':version':previous.version}}},
          {Delete:{TableName:table, Key:{pk,sk:'DATE#'+previous.record.date}, ConditionExpression:'recordId = :id', ExpressionAttributeValues:{':id':id}}}
        ]}));
        // Photo evidence remains private in S3; records may share photo references.
        return response(204);
      }
      case 'POST /uploads': {
        const file = validateUpload(body(event)); const key = 'users/' + userId + '/' + randomUUID() + '.' + PHOTO_TYPES[file.mimeType];
        const signed = await presignPost(s3, {Bucket:bucket, Key:key, Expires:300, Fields:{'Content-Type':file.mimeType, 'success_action_status':'204', 'x-amz-server-side-encryption':'AES256'}, Conditions:[['content-length-range',1,MAX_PHOTO_BYTES]]});
        return response(200, {key, uploadUrl:signed.url, fields:signed.fields, expiresIn:300});
      }
      case 'GET /photos': {
        const key = validatePhotoKey(event.queryStringParameters?.key, userId); const url = await signUrl(s3, new GetObjectCommand({Bucket:bucket, Key:key}), {expiresIn:900}); return response(200, {url, expiresIn:900});
      }
      default: return response(404, {message:'Route not found.', requestId});
    }
  } catch (error) {
    if (error instanceof ValidationError) return response(400, {message:error.message, requestId});
    if (error?.name === 'TransactionCanceledException') return response(409, {message:'There is already an entry for this date, or this record changed. Reload records and try again.', requestId});
    console.error(JSON.stringify({requestId, route:event.routeKey, errorName:error?.name ?? 'Error'}));
    return response(500, {message:'AWS could not complete the request. Try again.', requestId});
  }
};
}
export const handler = createHandler({
  db: DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }),
  s3: new S3Client({}), table: process.env.RECORDS_TABLE, bucket: process.env.PHOTOS_BUCKET,
});
