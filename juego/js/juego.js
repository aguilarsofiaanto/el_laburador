// ==========================================================
// EL LABURADOR — Punto de entrada
// Juego educativo de gestión de un kiosco de barrio
//
// Este archivo solo arranca el juego y coordina el bucle.
// Toda la lógica está repartida en los demás archivos:
//   estado.js    → los datos del juego
//   audio.js     → sonidos y música
//   camara.js    → primera persona y movimiento
//   escena.js    → dibujado 3D
//   interfaz.js  → HUD y panel de gestión
//   ventas.js    → clientes y cálculo de vuelto
//   eventos.js   → eventos diarios y ciclo de días
//   caminos.js   → los tres caminos y los finales
//   chatbot.js   → la Tía Marta (consultas con Gemini)
//   guardado.js  → guardar y cargar en Firestore
//   firebase.js  → configuración de Firebase (módulo)
// ==========================================================

// p5.js ejecuta preload() ANTES de setup(), para cargar assets
function preload() {
  precargarAudio();
}

// p5.js ejecuta setup() UNA vez, al cargar la página
function setup() {
  configurarMouseInvertido();
  const { w, h } = obtenerDimensiones();

  setAttributes('antialias', true);          // bordes suaves, no dentados
  pixelDensity(Math.min(2, window.devicePixelRatio || 1)); // nitidez en pantallas retina

  const cnv = createCanvas(w, h, WEBGL);
  cnv.parent('canvasWrapper');

  angleMode(DEGREES);      // trabajar en grados, no en radianes
  ajustarPerspectivaJugador(w, h);

  generarColoresClutter(); // colores fijos de la mercadería
  generarTexturas();       // texturas procedurales (madera, pared, piso)
  cargarModelos3D();       // Modelos y texturas de Blender
  actualizarHUD();

  audioListoInicializar(); // deja música y sonidos de pasos configurados

  inicializarControlesTactiles(); // joystick + mirar con el dedo, si es celular

  // Algunos navegadores móviles no disparan 'resize' cuando aparece
  // o desaparece la barra de direcciones; visualViewport sí lo nota.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', windowResized);
  }
}

// p5.js ejecuta draw() ~60 veces por segundo.
// Todo lo que se ve se redibuja en cada pasada.
//
// IMPORTANTE: si draw() tira un error, p5 deja de llamarlo y el juego
// queda congelado para siempre (eso pasaba al arrancar, cuando un
// modelo 3D llegaba antes que otro). Por eso el cuadro va dentro de
// un try/catch: si algo falla, se pierde ESE cuadro y nada más.
let erroresDeDibujo = 0;

function draw() {
  // Cuántos push() hay abiertos al empezar el cuadro. Si un error corta
  // el cuadro a la mitad, quedan push() sin su pop(): se cierran en el
  // catch para que no se acumulen cuadro tras cuadro.
  const pushAbiertos = p5.instance._styles.length;

  try {
    background(10, 9, 8);

    actualizarMouseFijado();
    aplicarIluminacion();
    aplicarCamaraPrimeraPersona();

    dibujarEscena();

    actualizarPromptInteraccion();
    actualizarPromptPuerta();
    actualizarControlesTactiles();
    actualizarBotonCelular();
  } catch (error) {
    while (p5.instance._styles.length > pushAbiertos) pop();

    // Se avisa una sola vez, para no llenar la consola 60 veces por segundo
    erroresDeDibujo++;
    if (erroresDeDibujo === 1) {
      console.error('Falló un cuadro del dibujo (el juego sigue andando):', error);
    }
  }
}

// Se ejecuta cuando cambia el tamaño de la ventana
function windowResized() {
  const { w, h } = obtenerDimensiones();
  resizeCanvas(w, h);
  ajustarPerspectivaJugador(w, h);
}