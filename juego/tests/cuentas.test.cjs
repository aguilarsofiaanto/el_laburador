const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const leer = nombre => fs.readFileSync(path.join(__dirname, '../js', nombre), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function sesion(usuario) {
  const auth = { currentUser: usuario };
  const window = new EventTarget();
  const llamadas = { anonimas: 0, recargas: 0 };
  let observar;
  const contexto = {
    window, Event, console: { error() {} }, juegoIniciado: false,
    location: { reload() { llamadas.recargas++; } },
    getAuth: () => auth,
    onAuthStateChanged: (_, callback) => { observar = callback; },
    signInAnonymously: async () => {
      llamadas.anonimas++;
      auth.currentUser = { uid: 'invitado-nuevo', isAnonymous: true };
      await observar(auth.currentUser);
    },
    EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
    linkWithCredential: async (actual, credencial) => {
      auth.currentUser = { ...actual, email: credencial.email, isAnonymous: false };
      return { user: auth.currentUser };
    },
    createUserWithEmailAndPassword: async () => { throw Error('No debería crear otro uid'); },
    signInWithEmailAndPassword: async (_, email, clave) => {
      if (clave === 'incorrecta') throw { code: 'auth/invalid-credential' };
      auth.currentUser = { uid: 'cuenta-existente', email, isAnonymous: false };
      await observar(auth.currentUser);
      return { user: auth.currentUser };
    },
    signOut: async () => { auth.currentUser = null; await observar(null); },
    sendEmailVerification: async () => {}, sendPasswordResetEmail: async () => {}
  };
  vm.createContext(contexto);
  vm.runInContext(leer('sesion.js').replace(/import\s*\{[\s\S]*?\}\s*from\s*'[^']+';/, '').replace('export function', 'function'), contexto);
  contexto.inicializarSesion({}, estado => { window.firebaseEstado = estado; });
  return { contexto, window, llamadas, observar, auth };
}

test('una sesión existente no se reemplaza por una anónima', async () => {
  const s = sesion({ uid: 'cuenta', isAnonymous: false });
  await s.observar(s.auth.currentUser);
  assert.equal(s.window.firebaseUid, 'cuenta');
  assert.equal(s.llamadas.anonimas, 0);
});

test('registrar vincula el invitado y conserva el uid de su partida', async () => {
  const s = sesion({ uid: 'invitado-original', isAnonymous: true });
  await s.observar(s.auth.currentUser);
  await s.window.cuentaFirebase.registrar('persona@example.com', 'secreto');
  assert.equal(s.window.firebaseUid, 'invitado-original');
  assert.equal(s.window.firebaseUsuario.isAnonymous, false);
});

test('si falla el correo de verificación, la cuenta y el uid se conservan', async () => {
  const s = sesion({ uid: 'invitado', isAnonymous: true });
  s.contexto.sendEmailVerification = async () => { throw Error('Sin conexión'); };
  const resultado = await s.window.cuentaFirebase.registrar('persona@example.com', 'secreto');
  assert.equal(resultado.verificacionEnviada, false);
  assert.equal(s.window.firebaseUid, 'invitado');
});

test('ingresar cambia de cuenta y cerrar sesión crea un invitado nuevo', async () => {
  const s = sesion({ uid: 'invitado', isAnonymous: true });
  await s.observar(s.auth.currentUser);
  await s.window.cuentaFirebase.ingresar('persona@example.com', 'secreto');
  assert.equal(s.window.firebaseUid, 'cuenta-existente');
  await s.window.cuentaFirebase.salir();
  assert.equal(s.window.firebaseUid, 'invitado-nuevo');
});

test('un ingreso fallido conserva la sesión de invitado', async () => {
  const s = sesion({ uid: 'invitado', isAnonymous: true });
  await s.observar(s.auth.currentUser);
  await assert.rejects(s.window.cuentaFirebase.ingresar('persona@example.com', 'incorrecta'));
  assert.equal(s.window.firebaseUid, 'invitado');
});

test('un cambio de cuenta en otra pestaña bloquea escrituras y recarga el juego', async () => {
  const s = sesion({ uid: 'original', isAnonymous: false });
  await s.observar(s.auth.currentUser);
  s.contexto.juegoIniciado = true;
  s.window.partidaUid = 'original';
  await s.observar({ uid: 'otra', isAnonymous: false });
  assert.equal(s.window.firebaseUid, null);
  assert.equal(s.llamadas.recargas, 1);
});

function guardado() {
  const window = new EventTarget();
  const btn = { style: {} };
  Object.assign(window, {
    firebaseUid: 'A', partidaUid: 'A', firebaseEstado: 'ok',
    firebaseDoc: (_, coleccion, uid) => `${coleccion}/${uid}`,
    firebaseSetDoc: async (ref, datos) => { escritos.push({ ref, datos }); }
  });
  const escritos = [];
  const contexto = {
    window, Event, console: { error() {} }, setTimeout, clearTimeout,
    document: { addEventListener() {}, getElementById: () => btn },
    gameState: { caja: 2200 }, caminos: {}, mejoras: {}, fiado: {}, economia: {},
    armaActual: 'manos', metasAlcanzadas: 0, hermano: {}, extorsion: {}, efectosDia: {}, climaHoy: {}, CLIENTES: []
  };
  vm.createContext(contexto);
  vm.runInContext(leer('guardado.js'), contexto);
  return { contexto, window, escritos, btn };
}

test('guarda solamente en el documento del dueño de la partida', async () => {
  const s = guardado();
  assert.equal(await s.contexto.guardarPartida(), true);
  assert.equal(s.escritos[0].ref, 'partidas/A');
  s.window.firebaseUid = 'B';
  assert.equal(await s.contexto.guardarPartida(), false);
  assert.equal(s.escritos.length, 1);
});

test('una lectura pendiente de otra cuenta no carga su progreso', async () => {
  const s = guardado();
  let responder;
  s.window.firebaseGetDoc = () => new Promise(resolve => { responder = resolve; });
  const cargando = s.contexto.cargarPartida();
  await tick();
  s.window.firebaseUid = 'B';
  responder({ exists: () => true, data: () => ({ gameState: { caja: 9999 } }) });
  assert.equal(await cargando, false);
  assert.equal(s.contexto.gameState.caja, 2200);
});

test('una consulta vieja no vuelve a mostrar Continuar al cambiar de cuenta', async () => {
  const s = guardado();
  const pendientes = [];
  s.window.firebaseGetDoc = () => new Promise(resolve => pendientes.push(resolve));
  const primera = s.contexto.actualizarBotonContinuar();
  await tick();
  s.window.firebaseUid = 'B';
  const segunda = s.contexto.actualizarBotonContinuar();
  await tick();
  pendientes[1]({ exists: () => false });
  await segunda;
  pendientes[0]({ exists: () => true, data: () => ({ gameState: {} }) });
  await primera;
  assert.equal(s.btn.style.display, 'none');
});
