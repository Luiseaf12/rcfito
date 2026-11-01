import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publisherConfig, publishOnce } from '../scripts/tunnel-publisher.mjs';

const config = { siteUrl: 'https://rcfito.paxxa.chatgpt.site', serviceToken: 'fictitious_service_credential_123456789', updateSecret: 'fictitious_update_credential_123456789' };
const state = { url: 'https://fictitious-tunnel.trycloudflare.com', id: 'fictitious-container', startedAt: 'fictitious-start' };

test('el publicador limita el destino de credenciales al Site configurado', () => {
  assert.deepEqual(publisherConfig(config), config);
  assert.throws(() => publisherConfig({ ...config, siteUrl: 'https://foreign.example.invalid' }));
  assert.throws(() => publisherConfig({ ...config, serviceToken: 'short' }));
});

test('un motor/túnel caído no publica la URL anterior', async () => {
  let sent = false;
  await assert.rejects(publishOnce(config, () => null, async () => { sent = true; }));
  assert.equal(sent, false);
});

test('publica solo URL; las dos credenciales se envían al Site en cabeceras', async () => {
  let called = 0;
  const result = await publishOnce(config, () => state, async (url, options) => {
    called++;
    assert.equal(url, config.siteUrl + '/api/tunnel');
    assert.deepEqual(JSON.parse(options.body), { url: state.url });
    assert.equal(options.headers['OAI-Sites-Authorization'], 'Bearer ' + config.serviceToken);
    assert.equal(options.headers.authorization, 'Bearer ' + config.updateSecret);
    assert.equal(options.redirect, 'error');
    return Response.json({ ok: true, expiresAt: Date.now() + 120000 });
  });
  assert.equal(called, 1);
  assert.equal(result.url, state.url);
});

test('detecta cambio de arranque mientras se publica y rechaza éxito falso', async () => {
  let read = 0;
  await assert.rejects(publishOnce(config, () => ++read === 1 ? state : { ...state, startedAt: 'replacement-start' }, async () => Response.json({ ok: true, expiresAt: Date.now() + 120000 })));
  await assert.rejects(publishOnce(config, () => state, async () => Response.json({ ok: false }, { status: 401 })));
});
