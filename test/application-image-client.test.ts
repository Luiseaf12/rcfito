import test from 'node:test'
import assert from 'node:assert/strict'
import { readCaptureImage, captureImageUrl, interpretApplicationImage, MAX_CAPTURE_IMAGE_BYTES } from '../src/data/application-image'

// Browser primitive supplied only inside this isolated Node test process.
globalThis.createImageBitmap ??= async () => { throw Error('No browser decoder in Node') }

test('rechaza tipo, vacío y tamaño antes de decodificar o enviar el archivo', async () => {
  for (const file of [new File(['abc'], 'foto.gif', {type:'image/gif'}), new File([], 'vacia.png', {type:'image/png'}), new File([new Uint8Array(MAX_CAPTURE_IMAGE_BYTES+1)], 'grande.png', {type:'image/png'})]) await assert.rejects(readCaptureImage(file), /PNG|pesar/)
})
test('un archivo ilegible conserva un error entendible', async t => {
  t.mock.method(globalThis, 'createImageBitmap', async () => { throw Error('decode') })
  await assert.rejects(readCaptureImage(new File(['falso'], 'foto.png', {type:'image/png'})), /No se pudo abrir/)
})
test('rechaza exceso de píxeles y libera el bitmap antes de leer base64', async t => {
  let closed = false
  t.mock.method(globalThis, 'createImageBitmap', async () => ({width:6000,height:4000,close(){closed=true}}))
  await assert.rejects(readCaptureImage(new File(['falso'], 'foto.png', {type:'image/png'})), /20 megapíxeles/)
  assert.equal(closed,true)
})
test('envía imagen y contexto por cuerpo autenticado y valida los faltantes de la respuesta', async t => {
  const image = {mime_type:'image/png' as const,data:'ZmljdGljaW8='}
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    assert.equal(url,'/api/application-draft')
    assert.equal(new Headers(options?.headers).get('authorization'),'Bearer sesion-ficticia')
    assert.deepEqual(JSON.parse(String(options?.body)),{message:'Contexto ficticio',image})
    assert.ok(options?.signal)
    return Response.json({imageDraft:{source_text:'Texto ficticio',products:[{name:'Producto ficticio',quantity:42,unit:'L'}]}})
  })
  const result = await interpretApplicationImage('Contexto ficticio',image,'sesion-ficticia')
  assert.equal(result.products[0].quantity,42)
  assert.equal(result.products[0].presentation,'')
  assert.equal(result.crop,null)
  assert.equal(captureImageUrl(image),'data:image/png;base64,ZmljdGljaW8=')
})
test('errores del servicio o respuesta inválida no mutan la imagen para el reintento', async t => {
  const image = Object.freeze({mime_type:'image/png' as const,data:'ZmljdGljaW8='})
  t.mock.method(globalThis, 'fetch', async () => Response.json({error:'No se pudo leer el total; reintenta.'},{status:502}))
  await assert.rejects(interpretApplicationImage('',image,'sesion-ficticia'),/reintenta/)
  t.mock.method(globalThis, 'fetch', async () => new Response('interrumpida',{status:502}))
  await assert.rejects(interpretApplicationImage('',image,'sesion-ficticia'),/Conserva la imagen/)
  t.mock.method(globalThis, 'fetch', async () => Response.json({imageDraft:{products:[{quantity:-1,unit:'L'}]}}))
  await assert.rejects(interpretApplicationImage('',image,'sesion-ficticia'))
  assert.equal(image.data,'ZmljdGljaW8=')
})
test('no envía un contexto mayor de 20,000 caracteres', async t => {
  t.mock.method(globalThis,'fetch',async()=>{throw Error('No debe enviar')})
  await assert.rejects(interpretApplicationImage('x'.repeat(20001),{mime_type:'image/png',data:'ZmljdGljaW8='},'sesion-ficticia'),/20,000/)
})
