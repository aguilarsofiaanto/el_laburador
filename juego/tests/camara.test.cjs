const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function camara() {
  const document = new EventTarget();
  const window = new EventTarget();
  const panel = { classList: { contains: () => true } };
  const canvas = { requestPointerLock() { document.pointerLockElement = canvas; } };
  document.querySelector = () => canvas;
  document.getElementById = id => id === 'phasePanel' ? panel : null;
  document.exitPointerLock = () => { document.pointerLockElement = null; };
  const contexto = {
    document, window, navigator: {}, juegoIniciado: true, dialogoAbierto: false,
    caminos: { partidaTerminada: false }, gameState: { productos: new Array(8) },
    constrain: (n, min, max) => Math.min(max, Math.max(min, n)), perspective() {}
  };
  vm.createContext(contexto);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/camara.js'), 'utf8'), contexto);
  return { contexto, document, panel, canvas, evaluar: codigo => vm.runInContext(codigo, contexto) };
}

test('la colisión detiene al jugador frente a la puerta de cada heladera', () => {
  const c = camara();
  for (const x of [480, 240, -240, -480]) {
    c.evaluar(`jugX = ${x}; jugZ = -480;`);
    for (let i = 0; i < 40; i++) c.contexto.moverJugador(0, -11);
    assert.ok(c.evaluar('jugZ') >= -499);
    assert.equal(c.evaluar('chocaConMueble(jugX, jugZ)'), false);
  }
});

test('el panel del estante principal queda bloqueado desde ambos lados', () => {
  const c = camara();
  for (const [inicio, paso] of [[-180, -7], [-370, 7]]) {
    c.evaluar(`jugX = 0; jugZ = ${inicio};`);
    for (let i = 0; i < 50; i++) c.contexto.moverJugador(0, paso);
    const z = c.evaluar('jugZ');
    assert.ok(paso < 0 ? z >= -197 : z <= -323);
    assert.equal(c.evaluar('chocaConMueble(jugX, jugZ)'), false);
  }
});

test('se desliza contra el mostrador y la diagonal mantiene la colisión', () => {
  const c = camara();
  c.evaluar('jugX = 0; jugZ = 215;');
  c.contexto.moverJugador(7, 7);
  assert.equal(c.evaluar('jugX'), 7);
  assert.equal(c.evaluar('jugZ'), 215);
});

test('el plano cercano queda dentro del radio y se vuelve a configurar al redimensionar', () => {
  const c = camara();
  const llamadas = [];
  c.contexto.perspective = (...args) => llamadas.push(args);
  c.contexto.ajustarPerspectivaJugador(1280, 720);
  c.contexto.ajustarPerspectivaJugador(390, 844);
  assert.equal(llamadas[0][0], undefined); // conserva el campo visual de p5
  assert.equal(llamadas[0][1], 1280 / 720);
  assert.equal(llamadas[1][1], 390 / 844);
  assert.ok(llamadas[0][2] < c.evaluar('RADIO_JUGADOR'));
  assert.ok(c.evaluar('VEL_MOV') > 5 && c.evaluar('VEL_MOV < VEL_CORRER'));
});

test('el mouse capturado gira con movimiento relativo y limita la inclinación', async () => {
  const c = camara();
  await c.contexto.alternarMouseFijado();
  assert.equal(c.document.pointerLockElement, c.canvas);
  const evento = new Event('mousemove');
  Object.assign(evento, { movementX: 100, movementY: -1000 });
  c.document.dispatchEvent(evento);
  assert.equal(c.evaluar('camAngulo'), 40);
  assert.equal(c.evaluar('camPitch'), 35);
});

test('abrir un diálogo o gestión libera la captura e impide girar', async () => {
  const c = camara();
  await c.contexto.alternarMouseFijado();
  c.contexto.dialogoAbierto = true;
  c.contexto.actualizarMouseFijado();
  assert.equal(c.document.pointerLockElement, null);
  await c.contexto.alternarMouseFijado();
  assert.equal(c.document.pointerLockElement, null);
  c.contexto.dialogoAbierto = false;
  await c.contexto.alternarMouseFijado();
  c.panel.classList.contains = () => false;
  c.contexto.actualizarMouseFijado();
  assert.equal(c.document.pointerLockElement, null);
});

test('un navegador que rechaza la captura deja disponible el modo arrastrar', async () => {
  const c = camara();
  c.canvas.requestPointerLock = () => Promise.reject(Error('No disponible'));
  await c.contexto.alternarMouseFijado();
  assert.equal(c.contexto.mouseEstaFijado(), false);
  Object.assign(c.contexto, { mouseX: 10, pmouseX: 0, mouseY: 5, pmouseY: 0 });
  c.contexto.mouseDragged({ target: c.canvas });
  assert.equal(c.evaluar('camAngulo'), 4);
});

test('Escape libera la captura aunque el navegador no lo haga automáticamente', async () => {
  const c = camara();
  await c.contexto.alternarMouseFijado();
  const evento = new Event('keydown');
  Object.assign(evento, { key: 'Escape' });
  c.document.dispatchEvent(evento);
  assert.equal(c.document.pointerLockElement, null);
});
