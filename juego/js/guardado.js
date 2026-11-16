// ==========================================================
// GUARDADO Y CARGA DE PARTIDA
// El progreso completo vive en Firestore, en partidas/{uid}.
// El uid sale del login anónimo de Firebase (ver firebase.js):
// cada navegador tiene el suyo y las reglas de Firestore solo
// le dejan tocar su propio documento.
// ==========================================================

const COLECCION_PARTIDAS = 'partidas';
const VERSION_GUARDADO = 2;

// ==========================================================
// ESPERAR A QUE FIREBASE ESTÉ LISTO
// firebase.js es un módulo y carga async: puede terminar después
// que este archivo. Si en 6 segundos no respondió (sin internet,
// por ejemplo), se sigue sin guardado para no trabar el juego.
// Devuelve true si se puede guardar.
// ==========================================================
function firebaseListo() {
  return new Promise((resolve) => {
    if (window.firebaseEstado) {
      resolve(window.firebaseEstado === 'ok');
      return;
    }
    const plazo = setTimeout(() => resolve(false), 6000);
    window.addEventListener('firebaseListo', () => {
      clearTimeout(plazo);
      resolve(window.firebaseEstado === 'ok');
    }, { once: true });
  });
}

function referenciaPartida() {
  return window.firebaseDoc(window.firebaseDB, COLECCION_PARTIDAS, window.firebaseUid);
}

// ==========================================================
// GUARDAR
// ==========================================================
async function guardarPartida() {
  const datos = {
    version: VERSION_GUARDADO,
    fecha: new Date().toISOString(),

    gameState: gameState,
    caminos: caminos,
    mejoras: mejoras,
    fiado: fiado,
    economia: economia,
    armaActual: armaActual,
    metasAlcanzadas: metasAlcanzadas,

    // Desde la versión 2 también se guarda esto, que antes se perdía
    hermano: hermano,
    extorsion: extorsion,
    efectosDia: efectosDia,
    climaHoy: climaHoy,
    visitasClientes: Object.fromEntries(CLIENTES.map(c => [c.id, c.visitas]))
  };

  try {
    if (!(await firebaseListo())) return false;

    // Firestore no acepta funciones ni undefined: pasar por JSON
    // deja solo datos puros.
    const datosLimpios = JSON.parse(JSON.stringify(datos));

    await window.firebaseSetDoc(referenciaPartida(), datosLimpios);
    return true;
  } catch (e) {
    console.error('No se pudo guardar la partida:', e);
    return false;
  }
}

// ==========================================================
// GUARDADO MANUAL (con feedback al jugador)
// ==========================================================
async function guardarPartidaManual() {
  sonidoClick();

  const ok = await guardarPartida();

  if (ok) {
    alert('Partida guardada.');
  } else {
    sonidoError();
    alert(window.firebaseEstado === 'desactivado'
      ? 'El guardado no está configurado todavía (falta Firebase).'
      : 'No se pudo guardar la partida. Revisá tu conexión a internet.');
  }
}

// ==========================================================
// ¿HAY PARTIDA GUARDADA?
// ==========================================================
async function leerPartidaGuardada() {
  if (!(await firebaseListo())) return null;

  const snap = await window.firebaseGetDoc(referenciaPartida());
  if (!snap.exists()) return null;

  const datos = snap.data();
  // "vacio" lo dejaba la versión vieja al borrar: cuenta como nada
  if (datos.vacio || !datos.gameState) return null;
  return datos;
}

async function hayPartidaGuardada() {
  try {
    return (await leerPartidaGuardada()) !== null;
  } catch (e) {
    console.error('No se pudo chequear si hay partida guardada:', e);
    return false;
  }
}

// ==========================================================
// CARGAR
// ==========================================================
async function cargarPartida() {
  try {
    const datos = await leerPartidaGuardada();
    if (!datos) return false;

    // Se pisan los valores dentro de los objetos existentes,
    // en vez de reasignar, porque son const y otros archivos
    // ya tienen referencias a ellos.
    Object.assign(gameState, datos.gameState);
    Object.assign(caminos, datos.caminos);
    Object.assign(mejoras, datos.mejoras);
    Object.assign(fiado, datos.fiado);
    Object.assign(economia, datos.economia);

    armaActual = datos.armaActual || 'manos';
    metasAlcanzadas = datos.metasAlcanzadas || 0;

    if (datos.hermano)    Object.assign(hermano, datos.hermano);
    if (datos.extorsion)  Object.assign(extorsion, datos.extorsion);
    if (datos.efectosDia) Object.assign(efectosDia, datos.efectosDia);
    if (datos.climaHoy)   Object.assign(climaHoy, datos.climaHoy);
    if (datos.visitasClientes) {
      for (const c of CLIENTES) c.visitas = datos.visitasClientes[c.id] || 0;
    }

    // Partidas de la versión 1: no tenían estos campos
    if (gameState.faltantesHoy === undefined) gameState.faltantesHoy = {};
    if (gameState.clientesHoy === undefined) gameState.clientesHoy = 0;
    if (gameState.clientesEsperadosHoy === undefined) gameState.clientesEsperadosHoy = null;
    if (gameState.diaIniciado === undefined) gameState.diaIniciado = true;
    if (gameState.mensajesTiaHoy === undefined) gameState.mensajesTiaHoy = 0;

    return true;
  } catch (e) {
    console.error('No se pudo cargar la partida:', e);
    return false;
  }
}

// ==========================================================
// BORRAR PARTIDA GUARDADA
// (al empezar una nueva o cuando la partida llega a un final)
// ==========================================================
async function borrarPartidaGuardada() {
  try {
    if (!(await firebaseListo())) return false;
    await window.firebaseDeleteDoc(referenciaPartida());
    return true;
  } catch (e) {
    console.error('No se pudo borrar la partida guardada:', e);
    return false;
  }
}

// ==========================================================
// MOSTRAR BOTÓN "CONTINUAR PARTIDA" SI CORRESPONDE
// Se ejecuta solo, apenas carga la página.
// ==========================================================
document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('btnContinuar');
  if (!btn) return;

  if (await hayPartidaGuardada()) {
    btn.style.display = 'block';
  }
});
