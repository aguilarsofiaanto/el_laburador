// ==========================================================
// MODELOS 3D HECHOS EN BLENDER
// Cada objeto (heladera, góndola, productos) se modeló en
// Blender y se exportó como .obj + una imagen con su textura.
// En la textura ya viene "horneada" la sombra de contacto
// (oclusión ambiental), así que se ven con volumen real.
//
// Se cargan DESPUÉS de setup(), sin trabar el arranque:
// mientras no terminan de bajar (o si falla alguno), el juego
// sigue usando los dibujos viejos hechos con box() y cylinder().
//
// Los .obj vienen empaquetados (ver paquetes.js): kiosco, personas
// y calle son 3 archivos comprimidos en vez de 85 .obj sueltos.
// ==========================================================

const RUTA_MODELOS  = 'src/modelos/';
const RUTA_TEXTURAS = 'src/texturas/';

// nombre del .obj  →  imagen con su textura
// (las que no tienen transparencia van en .jpg: pesan mucho menos)
const LISTA_MODELOS = {
  heladera:     'heladera.jpg',      // gabinete, marco y manija
  heladera_luz: 'heladera_luz.jpg',  // interior con luz propia
  gondola:      'gondola.jpg',       // machimbre, estante y panel perforado
  gondola_deco: 'gondola_deco.jpg',  // tiras de golosinas, cartel y reloj
  alfajor:      'alfajor.jpg',
  chocolate:    'chocolate.png',
  chicles:      'chicles.jpg',
  gaseosa:      'gaseosa.jpg',
  agua:         'agua.jpg',
  jugo:         'jugo.jpg',
  papas:        'papas.jpg',
  palitos:      'palitos.jpg'
};

// Acá se van guardando a medida que cargan:
// MODELOS.heladera = { geo: p5.Geometry, tex: p5.Image, listo: true }
const MODELOS = {};

// ----------------------------------------------------------
// Orden de carga: primero lo que se ve al entrar (el kiosco),
// después la gente y la calle, y recién al final la música
// (audio.js espera el aviso "graficosListos"). Así lo importante
// no comparte la conexión con la canción de 6 MB.
// ----------------------------------------------------------
async function cargarModelos3D() {
  await cargarKiosco3D();

  // La gente del barrio (personas.js) y la calle (calle3d.js), juntas
  await Promise.all([cargarPersonas3D(), cargarCalle3D()]);

  window.graficosListos = true;
  window.dispatchEvent(new Event('graficosListos'));
}

async function cargarKiosco3D() {
  const pedidos = [];
  const texturas = [];

  for (const nombre in LISTA_MODELOS) {
    const m = { geo: null, tex: null, listo: false };
    MODELOS[nombre] = m;

    // El modelo está listo recién cuando llegaron LAS DOS partes
    const revisar = () => { m.listo = (m.geo !== null && m.tex !== null); };

    pedidos.push({
      nombre,
      obj: RUTA_MODELOS + nombre + '.obj',
      alLlegar: geo => { m.geo = geo; revisar(); }
    });
    texturas.push(
      cargarImagen(RUTA_MODELOS + LISTA_MODELOS[nombre])
        .then(img => { m.tex = img; revisar(); })
        .catch(() => console.warn('No cargó la textura de ' + nombre))
    );
  }

  // Texturas de materiales renderizadas en Blender: cuando llegan,
  // reemplazan a las procedurales de generarTexturas().
  texturas.push(
    cargarTexturaMaterial('madera.jpg',        img => texturaMadera = img),
    cargarTexturaMaterial('madera_oscura.jpg', img => texturaMaderaOscura = img),
    cargarTexturaMaterial('pared.jpg',         img => texturaPared = img),
    cargarTexturaMaterial('metal.jpg',         img => texturaMetal = img),
    cargarTexturaMaterial('piso.jpg',          img => texturaPisoDetalle = img)
  );

  // Las imágenes bajan mientras se arma el paquete
  await Promise.all([cargarGrupoDeModelos('kiosco', pedidos), ...texturas]);
}

function cargarTexturaMaterial(archivo, alCargar) {
  return cargarImagen(RUTA_TEXTURAS + archivo)
    .then(alCargar)
    .catch(() => console.warn('No cargó ' + archivo + ': queda la textura procedural'));
}

function modeloListo(nombre) {
  return MODELOS[nombre] !== undefined && MODELOS[nombre].listo;
}

// Dibuja un modelo en la posición actual (usar dentro de push/pop).
// Si todavía no llegó (geometría o textura), no dibuja nada: texture()
// con una imagen que no existe es justo lo que congelaba el juego.
function dibujarModelo(nombre) {
  const m = MODELOS[nombre];
  if (!m || !m.listo) return;
  noStroke();
  texture(m.tex);
  model(m.geo);
}

// Para cosas con luz propia ya horneada (interior de la heladera):
// se apagan las luces de la escena solo para este objeto, así se
// ve la imagen tal cual salió de Blender. pop() las vuelve a prender.
function dibujarModeloConLuzPropia(nombre) {
  push();
  noLights();
  dibujarModelo(nombre);
  pop();
}

// ==========================================================
// CÓMO SE ACOMODA CADA PRODUCTO EN SU CASILLERO
// Devuelve la posición de la unidad número u (0 a 5) relativa
// al centro del casillero. Las botellas van en dos filas, las
// bolsas paradas una detrás de otra y los alfajores en pilas.
// ==========================================================
function acomodoProducto(id, u) {
  const fila = Math.floor(u / 3);   // 0 = adelante, 1 = atrás
  const col  = u % 3;               // 0, 1, 2

  switch (id) {
    case 'gaseosa':
    case 'agua':
    case 'jugo':
      return { x: (col - 1) * 34, y: 0, z: fila === 0 ? 16 : -18, giro: (u * 37) % 20 - 10, inclina: 0 };

    case 'papas':
    case 'palitos':
      // dos por fila, tres filas; un poco recostadas hacia atrás
      return { x: u % 2 === 0 ? -26 : 26, y: 0, z: 22 - Math.floor(u / 2) * 20, giro: (u % 2 === 0 ? 4 : -4), inclina: -8 };

    case 'alfajor':
      // dos pilas de tres
      return { x: u % 2 === 0 ? -24 : 24, y: -Math.floor(u / 2) * 9, z: 2, giro: u * 23, inclina: 0 };

    case 'chocolate':
      // dos pilas de tabletas, apenas desordenadas
      return { x: u % 2 === 0 ? -28 : 28, y: -Math.floor(u / 2) * 6.6, z: 2, giro: (u % 3 - 1) * 5, inclina: 0 };

    case 'chicles':
      return { x: u % 2 === 0 ? -22 : 22, y: 0, z: 20 - Math.floor(u / 2) * 20, giro: 0, inclina: 0 };
  }
  return { x: 0, y: -u * 15, z: 0, giro: 0, inclina: 0 };
}
