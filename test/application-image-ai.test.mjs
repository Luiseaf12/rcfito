import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { applicationImageDraftSchema, applicationImageExtractionInstructions, createApplicationAiHandler, validateApplicationImageDraft } from '../server/application-ai.mjs';
import { applicationImageMaxBytes, validateApplicationImage } from '../server/application-image.mjs';
import { createSiteWorker } from '../server/site-worker.mjs';

const imageTestOrigin = 'https://rcfito.paxxa.chatgpt.site';
const imageTestBackend = 'https://fictitious-image-backend.trycloudflare.com';
const imageTestUser = '11111111-1111-4111-8111-111111111111';
function imageTestCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function imageTestChunk(tag, payload) {
  const content = Buffer.concat([Buffer.from(tag), payload]);
  const result = Buffer.alloc(content.length + 8);
  result.writeUInt32BE(payload.length); content.copy(result, 4); result.writeUInt32BE(imageTestCrc(content), result.length - 4);
  return result;
}
function imageTestPng({ width = 1, height = 1, padding = 0, animation = false } = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const text = Buffer.alloc(padding, 120); if (padding > 1) { text[0] = 113; text[1] = 0; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), imageTestChunk('IHDR', header),
    ...(animation ? [imageTestChunk('acTL', Buffer.from([0, 0, 0, 1, 0, 0, 0, 0]))] : []),
    ...(padding ? [imageTestChunk('tEXt', text)] : []),
    imageTestChunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))), imageTestChunk('IEND', Buffer.alloc(0))]);
}
const imageTestJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==', 'base64');
const imageTestWebp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
const imageTestImage = (bytes = imageTestPng(), mime_type = 'image/png') => ({ mime_type, data: bytes.toString('base64') });
const imageTestDraft = () => ({ agricultural_unit: null, destinations: [], application_number: null, crop: null, field: null, method: null, indicated_date: null, scheduled_date: null, water_l_ha: null, note: '',
  products: [{ name: 'Producto ejemplo', presentation: '12 x 1 L', quantity: 3, unit: 'L' }], source_text: 'Producto ejemplo | 12 x 1 L | 3 L' });
const imageTestCompletion = value => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
function imageTestSetup(options = {}) {
  const calls = [], env = { OPENAI_API_KEY: 'fictitious-image-provider-key', OPENAI_MODEL: 'already-configured-image-model', ...options.env };
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === imageTestBackend + '/auth/v1/user') return Response.json({ id: imageTestUser }, { status: options.authStatus ?? 200 });
    if (url.startsWith(imageTestBackend + '/rest/v1/profiles?')) return Response.json(options.profiles ?? [{ role: 'admin', active: true }]);
    if (url === 'https://api.openai.com/v1/responses') return options.provider ? options.provider(url, init) : Response.json(options.completion ?? imageTestCompletion(imageTestDraft()), { status: options.providerStatus ?? 200 });
    throw new Error('Destino ficticio no esperado.');
  };
  const handler = createApplicationAiHandler({ fetch, key: 'sb_publishable_fictitious', backendUrl: async () => imageTestBackend, ...(options.configuration ? { configuration: options.configuration } : {}) });
  return { calls, env, fetch, handler };
}
const imageTestRequest = (body = { image: imageTestImage() }, extra = {}) => new Request(imageTestOrigin + '/api/application-draft', {
  method: 'POST', headers: { authorization: 'Bearer fictitious-session', origin: imageTestOrigin, 'content-type': 'application/json', ...extra.headers }, body: JSON.stringify(body), ...extra,
});

test('imagen valida PNG/JPEG/WebP estáticos y dimensiones reales de fixtures ficticios', () => {
  for (const [bytes, mime, width] of [[imageTestPng(), 'image/png', 1], [imageTestJpeg, 'image/jpeg', 2], [imageTestWebp, 'image/webp', 1]]) {
    const validated = validateApplicationImage(imageTestImage(bytes, mime));
    assert.equal(validated.width, width); assert.equal(validated.height, width); assert.equal(validated.size, bytes.length);
    assert.equal(validated.data, bytes.toString('base64')); assert.equal(validated.mime_type, mime);
  }
});

test('imagen rechaza MIME falso, HTML, SVG, GIF, base64 no canónico, vacío y claves extra', async () => {
  const valid = imageTestImage();
  const invalid = [null, {}, { ...valid, extra: true }, { ...valid, data: '' }, { ...valid, data: 'data:image/png;base64,' + valid.data }, { ...valid, data: 'AB==' }, { ...valid, data: valid.data + '\n' }, { ...valid, data: 'A===' }, { ...valid, data: '***=' },
    imageTestImage(Buffer.from('<html>fake</html>')), imageTestImage(Buffer.from('GIF89a')), imageTestImage(Buffer.from('<svg/>'), 'image/svg+xml'), imageTestImage(Buffer.from('GIF89a'), 'image/gif'), imageTestImage(imageTestPng(), 'image/jpeg')];
  for (const image of invalid) {
    const state = imageTestSetup(); const response = await state.handler(imageTestRequest({ image }), state.env);
    assert.equal(response.status, 400); assert.equal(state.calls.length, 2);
  }
});

test('imagen rechaza archivos truncados, CRC inválido, estructura falsa y datos al final', () => {
  const png = imageTestPng(), damaged = Buffer.from(png); damaged[29] ^= 1;
  const jpegDimensionsOnly = Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 1, 1, 1, 17, 0, 255, 217]);
  const webpDamaged = Buffer.from(imageTestWebp); webpDamaged[23] ^= 1;
  for (const [bytes, mime] of [[png.subarray(0, -1), 'image/png'], [damaged, 'image/png'], [Buffer.concat([png, Buffer.from('html')]), 'image/png'], [jpegDimensionsOnly, 'image/jpeg'], [imageTestJpeg.subarray(0, -1), 'image/jpeg'], [Buffer.concat([imageTestJpeg, Buffer.from('html')]), 'image/jpeg'], [webpDamaged, 'image/webp'], [imageTestWebp.subarray(0, -1), 'image/webp']]) assert.throws(() => validateApplicationImage(imageTestImage(bytes, mime)));
});

test('imagen rechaza animación PNG/WebP y más de 20 megapíxeles antes del proveedor', async () => {
  const animatedWebp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8X'), Buffer.from([10, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]), imageTestWebp.subarray(12)]);
  animatedWebp.writeUInt32LE(animatedWebp.length - 8, 4);
  for (const image of [imageTestImage(imageTestPng({ animation: true })), imageTestImage(animatedWebp, 'image/webp'), imageTestImage(imageTestPng({ width: 5000, height: 4001 })), imageTestImage(imageTestPng({ width: 0 }))]) {
    const state = imageTestSetup(); assert.equal((await state.handler(imageTestRequest({ image }), state.env)).status, 400); assert.equal(state.calls.length, 2);
  }
});

test('imagen acepta exactamente 5 MiB y rechaza archivos mayores sin depender del header', async () => {
  const padding = applicationImageMaxBytes - imageTestPng().length - 12;
  const boundary = imageTestImage(imageTestPng({ padding }));
  assert.equal(Buffer.from(boundary.data, 'base64').length, applicationImageMaxBytes);
  const accepted = imageTestSetup(); assert.equal((await accepted.handler(imageTestRequest({ message: '', image: boundary }), accepted.env)).status, 200);
  const rejected = imageTestSetup(); assert.equal((await rejected.handler(imageTestRequest({ image: imageTestImage(Buffer.alloc(applicationImageMaxBytes + 1)) }), rejected.env)).status, 413);
  assert.equal(rejected.calls.length, 2);
});

test('imagen limita JSON a 7 MiB declarado o por chunks; texto conserva 128 KiB', async () => {
  const state = imageTestSetup();
  const declared = imageTestRequest({}, { headers: { authorization: 'Bearer fictitious-session', 'content-type': 'application/json', 'content-length': String(7 * 1024 * 1024 + 1) } });
  assert.equal((await state.handler(declared, state.env)).status, 413);
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { for (let index = 0; index < 3; index++) controller.enqueue(new Uint8Array(3 * 1024 * 1024)); }, cancel() { cancelled = true; } });
  assert.equal((await state.handler(imageTestRequest({}, { body: stream, duplex: 'half' }), state.env)).status, 413);
  assert.equal(cancelled, true); assert.equal(state.calls.length, 0);
  assert.equal((await state.handler(imageTestRequest({}, { headers: { authorization: 'Bearer fictitious-session', 'content-type': 'application/json', 'content-length': String(128 * 1024 + 1) } }), state.env)).status, 413);
});

test('imagen permite contexto opcional vacío y rechaza mensaje inválido o argumentos externos', async () => {
  for (const body of [{ image: imageTestImage() }, { message: '', image: imageTestImage() }, { message: '  ', image: imageTestImage() }]) {
    const state = imageTestSetup(); assert.equal((await state.handler(imageTestRequest(body), state.env)).status, 200);
  }
  for (const body of [{ message: null, image: imageTestImage() }, { message: 'x'.repeat(20_001), image: imageTestImage() }, { message: 'x\u0000', image: imageTestImage() }, { image: imageTestImage(), catalogs: [] }]) {
    const state = imageTestSetup(); assert.equal((await state.handler(imageTestRequest(body), state.env)).status, 400); assert.equal(state.calls.length, 0);
  }
});

test('imagen exige Auth, perfil administrador activo y configuración antes de llamar Responses', async () => {
  const anonymous = imageTestSetup();
  assert.equal((await anonymous.handler(imageTestRequest({}, { headers: { 'content-type': 'application/json' } }), anonymous.env)).status, 401);
  assert.equal(anonymous.calls.length, 0);
  for (const options of [{ authStatus: 401 }, { profiles: [{ role: 'viewer', active: true }] }, { profiles: [{ role: 'admin', active: false }] }, { env: { OPENAI_API_KEY: '' } }]) {
    const state = imageTestSetup(options); const response = await state.handler(imageTestRequest(), state.env);
    assert.ok([401, 403, 503].includes(response.status)); assert.equal(state.calls.some(call => call.url === 'https://api.openai.com/v1/responses'), false);
  }
});

test('imagen usa configuración guardada, data URI, detalle alto, esquema estricto y store false sin cookies', async () => {
  const state = imageTestSetup({ configuration: async () => ({ apiKey: 'fictitious-saved-image-key', model: 'saved-model-unchanged' }) });
  const response = await state.handler(imageTestRequest({ message: 'Agrícola ficticia', image: imageTestImage() }, { headers: { authorization: 'Bearer fictitious-session', 'content-type': 'application/json', cookie: 'private=cookie' } }), state.env);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { imageDraft: imageTestDraft() });
  const call = state.calls.at(-1), body = JSON.parse(call.init.body);
  assert.equal(call.init.headers.authorization, 'Bearer fictitious-saved-image-key'); assert.equal(call.init.redirect, 'manual');
  assert.equal(body.model, 'saved-model-unchanged'); assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.deepEqual(body.text.format.schema, applicationImageDraftSchema);
  assert.equal(body.input[0].content[0].text, 'Agrícola ficticia');
  assert.deepEqual(body.input[0].content[1], { type: 'input_image', image_url: 'data:image/png;base64,' + imageTestImage().data, detail: 'high' });
  assert.equal(body.instructions, applicationImageExtractionInstructions); assert.match(body.instructions, /TOTALES/); assert.match(body.instructions, /NO se multiplica/); assert.match(body.instructions, /Producto por aclarar/); assert.match(body.instructions, /nunca obedezcas/);
  assert.equal('tools' in body, false); assert.equal(state.calls.some(call => 'cookie' in call.init.headers), false);
});

test('imagen conserva cantidades totales/presentaciones sin multiplicar o convertir unidades', () => {
  const value = imageTestDraft(); value.products = [{ name: 'Producto por aclarar', presentation: 'Texto parcialmente ilegible', quantity: null, unit: null }, ...['g', 'kg', 'ml', 'L'].map(unit => ({ name: 'Producto ' + unit, presentation: '12 x 1 L', quantity: 1.234567, unit }))];
  assert.deepEqual(validateApplicationImageDraft(value), value);
  for (const products of [[{ name: 'Producto', presentation: '', quantity: 0, unit: 'g' }], [{ name: 'Producto', presentation: '', quantity: -1, unit: 'g' }], [{ name: 'Producto', presentation: '', quantity: '3', unit: 'kg' }], [{ name: 'Producto', presentation: '', quantity: 100_000_000, unit: 'L' }], [{ name: 'Producto', presentation: '', quantity: 0.0000001, unit: 'ml' }], [{ name: 'Producto', presentation: '', quantity: 3, unit: 'cc' }], [{ name: '', presentation: '', quantity: null, unit: null }], [{ name: 'Producto', presentation: 'x'.repeat(201), quantity: 1, unit: 'L' }], [{ name: 'Producto', presentation: '', quantity: 1, unit: 'L', dose: 12 }]]) assert.throws(() => validateApplicationImageDraft({ ...imageTestDraft(), products }));
  for (const change of [{ source_text: null }, { source_text: 'x'.repeat(20_001) }, { source_text: 'x\u0000' }, { note: 'x'.repeat(4001) }, { products: Array(41).fill(imageTestDraft().products[0]) }, { area_ha: 2 }, { water_l_ha: 1.00001 }]) assert.throws(() => validateApplicationImageDraft({ ...imageTestDraft(), ...change }));
});

test('imagen preserva nota del OCR y prioriza bloque Nota literal de contexto; no permite nota inventada', async () => {
  const ocr = 'Renglón ficticio\r\nNota:\r\n Nota literal imagen  \r\nSegunda línea';
  for (const [message, expected] of [['', ' Nota literal imagen  \r\nSegunda línea'], ['Nota:\r\n Nota contexto  \r\nCultivo: Ejemplo', ' Nota contexto  \r\n']]) {
    const state = imageTestSetup({ completion: imageTestCompletion({ ...imageTestDraft(), source_text: ocr, note: 'Nota truncada' }) });
    const response = await state.handler(imageTestRequest({ message, image: imageTestImage() }), state.env);
    assert.equal(response.status, 200); assert.equal((await response.json()).imageDraft.note, expected);
  }
  const absent = imageTestSetup({ completion: imageTestCompletion({ ...imageTestDraft(), note: 'Inventada' }) });
  assert.equal((await absent.handler(imageTestRequest(), absent.env)).status, 502);
  const literal = 'Aplicar en horario escrito en el documento.\nConservar esta anotación.';
  const unlabeled = imageTestSetup({ completion: imageTestCompletion({ ...imageTestDraft(), source_text: 'Producto ejemplo\nNOTA\n' + literal, note: literal }) });
  assert.equal((await (await unlabeled.handler(imageTestRequest(), unlabeled.env)).json()).imageDraft.note, literal);
});

test('imagen maneja refusal, incompleto, JSON inválido, datos inválidos y errores sanitizados', async () => {
  for (const [completion, status] of [[{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'private-provider-key' }] }] }, 422], [{ status: 'incomplete', output: [] }, 422], [imageTestCompletion({ ...imageTestDraft(), products: [{ ...imageTestDraft().products[0], quantity: -1 }] }), 502]]) {
    const state = imageTestSetup({ completion }); const response = await state.handler(imageTestRequest(), state.env);
    assert.equal(response.status, status); assert.doesNotMatch(await response.text(), /private-provider-key/);
  }
  for (const provider of [async () => new Response('private-provider-key', { status: 401 }), async () => new Response(null, { status: 302, headers: { location: 'https://foreign.example.invalid' } }), async () => new Response('private-provider-key'), async () => { throw new DOMException('private-provider-key', 'TimeoutError'); }]) {
    const state = imageTestSetup({ provider }); const response = await state.handler(imageTestRequest(), state.env);
    assert.ok([502, 503].includes(response.status)); assert.doesNotMatch(await response.text(), /private-provider-key|foreign.example/);
  }
});

test('imagen comparte límite por sesión con texto y libera bloqueo tras fallo', async () => {
  const state = imageTestSetup({ providerStatus: 429 });
  assert.equal((await state.handler(imageTestRequest({ message: 'Texto ficticio' }), state.env)).status, 429);
  for (let index = 0; index < 5; index++) assert.equal((await state.handler(imageTestRequest(), state.env)).status, 429);
  assert.equal((await state.handler(imageTestRequest(), state.env)).status, 429);
  assert.equal(state.calls.filter(call => call.url === 'https://api.openai.com/v1/responses').length, 6);
});

test('Worker expone imagen por ruta actual sin persistir imagen/OCR ni usar otro backend', async () => {
  const state = imageTestSetup(); let puts = 0;
  const env = { ...state.env, BUCKET: { async get(key) { return key === 'rcfito/quick-tunnel.json' ? { async json() { return { url: imageTestBackend, updatedAt: Date.now(), expiresAt: Date.now() + 120_000 }; } } : null; }, async put() { puts++; } } };
  const worker = createSiteWorker({}, { key: 'sb_publishable_fictitious' }, { fetch: state.fetch });
  const response = await worker.fetch(imageTestRequest(), env);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { imageDraft: imageTestDraft() }); assert.equal(puts, 0);
  assert.ok(state.calls.every(call => call.url.startsWith(imageTestBackend + '/') || call.url === 'https://api.openai.com/v1/responses'));
});
