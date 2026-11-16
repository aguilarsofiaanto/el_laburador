// ==========================================================
// VOZ DE LA TÍA MARTA
//
// Las respuestas de la tía se leen en voz alta con una voz generada
// por IA (Gemini TTS, a través de Firebase AI Logic; ver firebase.js).
// El audio llega en pedacitos (streaming) y se va reproduciendo a
// medida que llega: empieza a sonar en 1 o 2 segundos aunque la
// respuesta dure 20.
//
// Si Gemini no responde (se agotó la cuota, no hay internet, el
// modelo cambió), se usa la voz del navegador (speechSynthesis) para
// que la tía no quede muda.
//
// No hace falta p5.sound: el navegador reproduce el audio solo con la
// Web Audio API.
// ==========================================================

const CLAVE_VOZ_TIA = 'elLaburador_vozTia';

// Indicación de estilo para la voz de IA (no se lee en voz alta:
// el modelo la usa para el tono y el ritmo).
const ESTILO_VOZ_TIA = 'Leelo como una tía argentina de unos 65 años, cálida y con humor de barrio: ';

const voz = {
  activa: leerPreferenciaVoz(),
  ctx: null,          // AudioContext (se crea con el primer clic, como piden los navegadores)
  fuentes: [],        // pedazos de audio programados, para poder cortarlos
  proximo: 0,         // en qué momento arranca el próximo pedazo
  turno: 0            // cada respuesta nueva corta la anterior
};

// La preferencia se recuerda en este navegador (si no hay
// localStorage, queda activada)
function leerPreferenciaVoz() {
  try { return localStorage.getItem(CLAVE_VOZ_TIA) !== '0'; } catch (e) { return true; }
}

function guardarPreferenciaVoz() {
  try { localStorage.setItem(CLAVE_VOZ_TIA, voz.activa ? '1' : '0'); } catch (e) {}
}

// ---- Se llama dentro del clic de "Enviar": los navegadores solo
//      dejan arrancar el audio si viene de una acción del jugador ----
function prepararAudioVoz() {
  if (!voz.activa) return;
  try {
    if (!voz.ctx) voz.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (voz.ctx.state === 'suspended') voz.ctx.resume();
  } catch (e) {
    console.warn('Voz: no se pudo preparar el audio', e);
  }
}

// ---- Corta lo que esté diciendo ----
function callarTia() {
  voz.turno++;
  for (const f of voz.fuentes) { try { f.stop(); } catch (e) {} }
  voz.fuentes = [];
  voz.proximo = 0;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// ---- Lee una respuesta de la tía ----
async function hablarTia(texto) {
  if (!voz.activa || (typeof audioState !== 'undefined' && audioState.silenciado)) return;
  if (!texto) return;

  callarTia();
  const miTurno = voz.turno;

  if (window.tiaVozStream && voz.ctx) {
    let sono = false;
    try {
      for await (const audio of window.tiaVozStream(ESTILO_VOZ_TIA + texto)) {
        if (miTurno !== voz.turno) return;   // llegó otra respuesta o se cerró el chat
        reproducirPedazoPCM(audio.data, tasaDeMuestreo(audio.mimeType));
        sono = true;
      }
      if (sono) return;
    } catch (e) {
      console.warn('Voz: Gemini no respondió, uso la voz del navegador.', e && e.message);
      if (miTurno !== voz.turno) return;
      if (sono) return;   // ya había empezado a hablar: mejor cortar que repetir con otra voz
    }
  }

  if (miTurno === voz.turno) hablarConNavegador(texto);
}

// "audio/l16; rate=24000; channels=1" → 24000
function tasaDeMuestreo(mime) {
  const m = /rate=(\d+)/.exec(mime || '');
  return m ? Number(m[1]) : 24000;
}

// ---- Convierte un pedazo de PCM 16 bits (base64) en sonido y lo
//      pone en la fila, pegado al anterior ----
function reproducirPedazoPCM(base64, tasa) {
  const binario = atob(base64);
  const n = Math.floor(binario.length / 2);
  if (n === 0) return;

  const muestras = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = binario.charCodeAt(2 * i) | (binario.charCodeAt(2 * i + 1) << 8);   // little endian
    if (v >= 0x8000) v -= 0x10000;
    muestras[i] = v / 0x8000;
  }

  const buffer = voz.ctx.createBuffer(1, n, tasa);
  buffer.copyToChannel(muestras, 0);

  const fuente = voz.ctx.createBufferSource();
  fuente.buffer = buffer;
  fuente.connect(voz.ctx.destination);

  // El primer pedazo arranca con un pequeño colchón para que la red
  // no lo deje "trabado"; los demás van uno detrás del otro
  const ahora = voz.ctx.currentTime;
  if (voz.proximo < ahora) voz.proximo = ahora + 0.25;
  fuente.start(voz.proximo);
  voz.proximo += buffer.duration;

  voz.fuentes.push(fuente);
  fuente.onended = () => { voz.fuentes = voz.fuentes.filter(f => f !== fuente); };
}

// ---- Respaldo: la voz del sistema / navegador ----
function hablarConNavegador(texto) {
  if (!window.speechSynthesis) return;
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = 'es-AR';
  const voces = window.speechSynthesis.getVoices();
  const elegida = voces.find(v => v.lang === 'es-AR') ||
                  voces.find(v => /^es[-_](US|MX|419)/i.test(v.lang)) ||
                  voces.find(v => /^es/i.test(v.lang));
  if (elegida) frase.voice = elegida;
  window.speechSynthesis.speak(frase);
}

// ---- Botón 🔊 del chat ----
function alternarVozTia() {
  voz.activa = !voz.activa;
  guardarPreferenciaVoz();
  if (voz.activa) prepararAudioVoz(); else callarTia();
  actualizarBotonVoz();
}

function actualizarBotonVoz() {
  const btn = document.getElementById('ctVoz');
  if (!btn) return;
  btn.textContent = voz.activa ? '🔊' : '🔇';
  btn.title = voz.activa ? 'Voz de la tía: activada (tocá para silenciarla)' : 'Voz de la tía: silenciada (tocá para activarla)';
  btn.setAttribute('aria-label', btn.title);
}

document.addEventListener('DOMContentLoaded', actualizarBotonVoz);
