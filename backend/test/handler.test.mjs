import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../index.mjs';
const user='f9796623-12d0-4ae4-838a-16e119df681b';
const id='504c1d4e-62b0-498e-9ad7-369932b08676';
const record={id,date:'2026-10-08',wasteKg:12.5,scope:'unknown',coverage:'All meals',menu:{breakfast:'',lunch:'Rice',dinner:''},notes:'',photos:[]};
const event=(route,extra={})=>({routeKey:route,requestContext:{requestId:'request-test',authorizer:{jwt:{claims:{sub:user}}}},...extra});
const make=(send,extra={})=>createHandler({db:{send},s3:{},table:'records',bucket:'photos',...extra});

test('unauthenticated requests cannot read records or obtain upload access',async()=>{
  const handler=make(()=>{throw new Error('Database should not be called');});
  for(const route of ['GET /records','POST /uploads','GET /health']) assert.equal((await handler({routeKey:route})).statusCode,401);
});
test('list pagination stays in the authenticated user partition',async()=>{
  const requests=[];
  const handler=make(async command=>{requests.push(command.input);return requests.length===1?{Items:[{record,createdAt:'2026-10-08T12:00:00Z',updatedAt:'2026-10-08T12:00:00Z'}],LastEvaluatedKey:{pk:'USER#'+user,sk:'next'}}:{Items:[]};});
  const result=await handler(event('GET /records'));
  assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).records.length,1);
  assert.equal(requests.length,2);assert.equal(requests[0].ExpressionAttributeValues[':pk'],'USER#'+user);assert.equal(requests[1].ExclusiveStartKey.sk,'next');
});
test('save atomically reserves the date alongside the new record',async()=>{
  let transaction;
  const handler=make(async command=>{if(command.constructor.name==='GetCommand')return{};transaction=command.input;return{};});
  const result=await handler(event('PUT /records/{id}',{pathParameters:{id},body:JSON.stringify(record)}));
  assert.equal(result.statusCode,200);assert.equal(transaction.TransactItems.length,2);
  assert.equal(transaction.TransactItems[1].Put.Item.sk,'DATE#2026-10-08');assert.equal(transaction.TransactItems[0].Put.Item.pk,'USER#'+user);
  assert.ok(JSON.parse(result.body).record.createdAt);
});
test('moving an entry to another day removes the old date reservation',async()=>{
  let transaction;
  const previous={record,version:'old-version',createdAt:'2026-10-08T12:00:00Z'};
  const handler=make(async command=>{if(command.constructor.name==='GetCommand')return{Item:previous};transaction=command.input;return{};});
  const result=await handler(event('PUT /records/{id}',{pathParameters:{id},body:JSON.stringify({...record,date:'2026-10-09'})}));
  assert.equal(result.statusCode,200);assert.equal(transaction.TransactItems.length,3);
  assert.equal(transaction.TransactItems[2].Delete.Key.sk,'DATE#2026-10-08');
});
test('date collision gives a useful conflict and malformed JSON is rejected',async()=>{
  const handler=make(async command=>{if(command.constructor.name==='GetCommand')return{};throw Object.assign(new Error('collision'),{name:'TransactionCanceledException'});});
  assert.equal((await handler(event('PUT /records/{id}',{pathParameters:{id},body:JSON.stringify(record)}))).statusCode,409);
  assert.equal((await handler(event('PUT /records/{id}',{pathParameters:{id},body:'{invalid'}))).statusCode,400);
});
test('presigned uploads enforce owner prefix, image type and byte limit',async()=>{
  let options;
  const handler=make(()=>{}, {presignPost:async(_client,value)=>{options=value;return{url:'https://photos.example',fields:{key:value.Key}};}});
  const result=await handler(event('POST /uploads',{body:JSON.stringify({name:'board.jpg',mimeType:'image/jpeg',sizeBytes:100})}));
  assert.equal(result.statusCode,200);assert.ok(options.Key.startsWith('users/'+user+'/'));
  assert.equal(options.Fields['Content-Type'],'image/jpeg');assert.deepEqual(options.Conditions[0],['content-length-range',1,5*1024*1024]);
});
test('another account cannot request a signed photo URL',async()=>{
  let signed=false;const handler=make(()=>{}, {signUrl:async()=>{signed=true;return'url';}});
  const result=await handler(event('GET /photos',{queryStringParameters:{key:'users/another-user/'+id+'.jpg'}}));
  assert.equal(result.statusCode,400);assert.equal(signed,false);
});
