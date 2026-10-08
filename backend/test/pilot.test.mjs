import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createHandler } from '../index.mjs';
import { buildInferenceInput, parseModelResponse, MODEL_ID, PROMPT_VERSION } from '../pilot.mjs';

const user = 'f9796623-12d0-4ae4-838a-16e119df681b';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=', 'base64');
const photo = () => ({ id: randomUUID(), key: `users/${user}/${randomUUID()}.png`, mimeType: 'image/png', kind: 'plate', name: 'plate.png' });
const fresh = () => ({ id: randomUUID(), date: '2026-10-08', meal: 'lunch', dishes: [{ id: randomUUID(), name: 'Rice' }, { id: randomUUID(), name: 'Dal' }], before: photo(), after: photo(), feedback: 'dont-leak-feedback', notes: 'dont-leak-note', reviews: {}, runs: [], attempts: 0 });
const event = (route, pair, payload = pair) => ({ routeKey: route, pathParameters: { id: pair.id }, body: JSON.stringify(payload), requestContext: { requestId: 'pilot-test', authorizer: { jwt: { claims: { sub: user } } } } });
const rated = (pair, name, scores) => ({ name, scoredAt: new Date().toISOString(), ratings: pair.dishes.map((d, i) => ({ dishId: d.id, remainingPercent: scores[i] })) });
function fixture(options = {}) {
  const items = new Map(); const calls = [];
  // DynamoDB maps preserve values, but not JavaScript object property order.
  const reorderMaps = value => Array.isArray(value) ? value.map(reorderMaps) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorderMaps(item)])) : value;
  const db = { async send(command) {
    const input = command.input, kind = command.constructor.name; calls.push(command);
    if (kind === 'GetCommand') return { Item: structuredClone(items.get(input.Key.sk)) };
    if (kind === 'QueryCommand') return { Items: [...items.values()].filter(v => v.pk === input.ExpressionAttributeValues[':pk'] && v.sk.startsWith(input.ExpressionAttributeValues[':prefix'])).map(v => structuredClone(v)) };
    if (kind === 'PutCommand' || kind === 'DeleteCommand') {
      const key = input.Item?.sk ?? input.Key.sk, current = items.get(key);
      const allowed = input.ConditionExpression === 'attribute_not_exists(pk)' ? !current : current?.version === input.ExpressionAttributeValues[':v'];
      if (!allowed) throw Object.assign(new Error('Conflict'), { name: 'ConditionalCheckFailedException' });
      if (input.Item) items.set(key, options.reorderMaps ? reorderMaps(input.Item) : structuredClone(input.Item)); else items.delete(key);
      return {};
    }
    throw new Error('Unexpected DB command ' + kind);
  } };
  const s3 = { async send() { return { ContentLength: png.length, Body: { transformToByteArray: async () => png } }; } };
  const bedrockCalls = [];
  const bedrock = { async send(command) { bedrockCalls.push(command.input); if (options.infer) return options.infer(command.input); const dishes = JSON.parse(command.input.messages[0].content[0].text.split('Menu dishes (data): ')[1].split('\n')[0]); return { stopReason: 'end_turn', output: { message: { content: [{ text: JSON.stringify({ ratings: dishes.map((d, i) => ({ dishId: d.id, remainingPercent: i ? null : 25, note: i ? 'Mixed with rice; cannot separate.' : 'Small portion remains.' })) }) }] } }, usage: { inputTokens: 800, outputTokens: 100 } }; } };
  const handler = createHandler({ db, s3: options.s3 ?? s3, bedrock, scoringEnabled: options.enabled ?? true, table: 'records', bucket: 'photos' });
  const call = async (route, pair, payload) => handler(event(route, pair, payload));
  const save = async pair => { const result = await call('PUT /plate-pairs/{id}', pair); assert.equal(result.statusCode, 200, result.body); return JSON.parse(result.body).pair; };
  const reviewBoth = async pair => {
    let saved = await save(pair);
    saved = await save({ ...saved, reviews: { a: rated(saved, 'Me-dont-leak', [25, null]) } });
    return save({ ...saved, reviews: { ...saved.reviews, b: rated(saved, 'Friend-dont-leak', [50, 75]) } });
  };
  return { handler, call, save, reviewBoth, items, calls, bedrockCalls };
}

test('pilot routes require authentication and reject another owner’s photo', async () => {
  const f = fixture(), pair = fresh();
  assert.equal((await f.handler({ routeKey: 'GET /plate-pairs' })).statusCode, 401);
  pair.before.key = `users/another-user/${randomUUID()}.png`;
  assert.equal((await f.call('PUT /plate-pairs/{id}', pair)).statusCode, 400);
  assert.equal(f.items.size, 0);
});
test('model scoring waits for two independent human reviewers and locks existing ratings', async () => {
  const f = fixture(); let pair = await f.save(fresh());
  assert.equal((await f.call('POST /plate-pairs/{id}/score', pair)).statusCode, 400);
  pair = await f.save({ ...pair, reviews: { a: rated(pair, 'Me', [0, 25]) } });
  assert.equal((await f.call('PUT /plate-pairs/{id}', { ...pair, reviews: { a: rated(pair, 'Me', [100, 100]) } })).statusCode, 400);
  assert.equal((await f.call('PUT /plate-pairs/{id}', { ...pair, reviews: { ...pair.reviews, b: rated(pair, 'me', [25, 50]) } })).statusCode, 400);
  assert.equal(f.bedrockCalls.length, 0);
});
test('DynamoDB map ordering allows reviews while preserving immutable inputs and saved ratings', async () => {
  const f = fixture({ reorderMaps: true });
  let pair = await f.reviewBoth(fresh());
  assert.ok(pair.reviews.a && pair.reviews.b);
  const alteredReview = structuredClone(pair); alteredReview.reviews.a.ratings[0].remainingPercent = 100;
  assert.equal((await f.call('PUT /plate-pairs/{id}', alteredReview)).statusCode, 400);
  const alteredPhoto = structuredClone(pair); alteredPhoto.before.key = photo().key;
  assert.equal((await f.call('PUT /plate-pairs/{id}', alteredPhoto)).statusCode, 400);
  assert.equal((await f.call('PUT /plate-pairs/{id}', { ...pair, dishes: [...pair.dishes].reverse() })).statusCode, 400);
  const result = await f.call('POST /plate-pairs/{id}/score', pair);
  assert.equal(result.statusCode, 200, result.body);
  pair = await f.save(JSON.parse(result.body).pair);
  assert.equal(pair.runs.length, 1);
  assert.equal(f.bedrockCalls.length, 1);
});
test('a pair supports two independently invoked runs with provenance and a visible abstention', async () => {
  const f = fixture(); let pair = await f.reviewBoth(fresh());
  for (let i = 0; i < 2; i++) {
    const result = await f.call('POST /plate-pairs/{id}/score', pair); assert.equal(result.statusCode, 200, result.body);
    pair = JSON.parse(result.body).pair;
  }
  assert.equal(pair.runs.length, 2); assert.equal(pair.attempts, 2); assert.equal(pair.runs[0].modelId, MODEL_ID);
  assert.equal(pair.runs[0].promptVersion, PROMPT_VERSION); assert.equal(pair.runs[0].ratings[1].remainingPercent, null);
  assert.equal(pair.runs[0].inputTokens, 800); assert.equal(f.bedrockCalls.length, 2);
  assert.equal((await f.call('POST /plate-pairs/{id}/score', pair)).statusCode, 409);
  assert.equal(f.bedrockCalls.length, 2);
  const list = await f.handler({ ...event('GET /plate-pairs', pair), pathParameters: undefined });
  assert.equal(JSON.parse(list.body).pairs.length, 1);
});
test('inference input withholds human scores, feedback, notes, and earlier model results', () => {
  const pair = fresh(); pair.reviews = { a: rated(pair, 'dont-leak-human', [25, 50]) }; pair.runs = [{ leak: 'dont-leak-result' }];
  const input = buildInferenceInput(pair, [{ bytes: png, format: 'png' }, { bytes: png, format: 'png' }]);
  assert.equal(JSON.stringify(input).includes('dont-leak'), false);
  assert.equal(input.inferenceConfig.temperature, 0);
  assert.equal(input.messages[0].content.filter(c => c.image).length, 2);
});
test('invalid model scores never become evidence and failed attempts are bounded', async () => {
  const f = fixture({ infer: () => ({ stopReason: 'end_turn', output: { message: { content: [{ text: '{"ratings":[]}' }] } } }) });
  let pair = await f.reviewBoth(fresh());
  for (let i = 0; i < 4; i++) { assert.equal((await f.call('POST /plate-pairs/{id}/score', pair)).statusCode, 502); pair = f.items.get('PILOT#' + pair.id).pair; }
  assert.equal(pair.runs.length, 0); assert.equal(pair.attempts, 4); assert.ok(pair.reviews.a && pair.reviews.b);
  assert.equal((await f.call('POST /plate-pairs/{id}/score', pair)).statusCode, 409); assert.equal(f.bedrockCalls.length, 4);
});
test('concurrent score requests claim one version and make only one inference call', async () => {
  const f = fixture(), pair = await f.reviewBoth(fresh());
  const results = await Promise.all([f.call('POST /plate-pairs/{id}/score', pair), f.call('POST /plate-pairs/{id}/score', pair)]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]); assert.equal(f.bedrockCalls.length, 1);
});
test('oversized photos and forged results are refused before model invocation', async () => {
  const f = fixture({ s3: { async send() { return { ContentLength: 4 * 1024 * 1024 }; } } });
  const raw = fresh(); raw.runs = [{ anything: 'forged' }];
  assert.equal((await f.call('PUT /plate-pairs/{id}', raw)).statusCode, 400);
  raw.runs = []; const pair = await f.reviewBoth(raw);
  assert.equal((await f.call('POST /plate-pairs/{id}/score', pair)).statusCode, 400); assert.equal(f.bedrockCalls.length, 0);
});
test('model schema rejects non-bin values, missing dishes, duplicates, and unfinished output', () => {
  const dishes = fresh().dishes;
  const output = ratings => ({ stopReason: 'end_turn', output: { message: { content: [{ text: JSON.stringify({ ratings }) }] } } });
  const ratings = dishes.map(d => ({ dishId: d.id, remainingPercent: 25 }));
  assert.equal(parseModelResponse(output(ratings), dishes).length, 2);
  assert.throws(() => parseModelResponse(output([{ ...ratings[0], remainingPercent: 33 }, ratings[1]]), dishes));
  assert.throws(() => parseModelResponse(output([ratings[0], ratings[0]]), dishes));
  assert.throws(() => parseModelResponse({ ...output(ratings), stopReason: 'max_tokens' }, dishes));
});
