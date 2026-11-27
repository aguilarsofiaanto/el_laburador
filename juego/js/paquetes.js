// ==========================================================
// PAQUETES DE MODELOS 3D
// Los modelos de Blender (.obj) se juntan en 3 paquetes binarios
// comprimidos con herramientas/armar_paquetes.py:
//   kiosco.bin.gz · personas.bin.gz · calle.bin.gz
//
// Antes se bajaban 85 archivos .obj (17 MB de texto sin comprimir)
// y p5 los leía línea por línea. Ahora son 3 archivos (2 MB) con
// los modelos ya armados: solo hay que pasarlos a p5.Geometry.
//
// Si un modelo no está en el paquete (por ejemplo, uno nuevo que
// todavía no se empaquetó) o si el paquete falla, se baja el .obj
// como antes. El juego nunca se queda sin un modelo por esto.
// ==========================================================

const RUTA_PAQUETES = 'src/modelos/paquetes/';

// Mismas escalas que en armar_paquetes.py
const ESCALA_POSICION = 100;
const ESCALA_UV = 10000;
const ESCALA_NORMAL = 1000;

// ----------------------------------------------------------
// Baja un paquete y devuelve sus modelos SIN armar todavía:
// { nombreModelo: { vertices, caras, posiciones, uvs, normales, deltas } }
// ----------------------------------------------------------
async function bajarPaquete(nombre) {
  const respuesta = await fetch(RUTA_PAQUETES + nombre + '.bin.gz');
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

  let bytes = new Uint8Array(await respuesta.arrayBuffer());

  // Todo archivo .gz empieza con los bytes 1F 8B. Si el servidor ya
  // lo descomprimió solo (algunos lo hacen), esos bytes no están.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    bytes = await descomprimirGzip(bytes);
  }
  return leerPaquete(bytes.buffer);
}

// El navegador trae su propio descompresor de gzip (DecompressionStream)
async function descomprimirGzip(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

// ----------------------------------------------------------
// Separa el paquete en sus modelos.
// Formato (lo arma armar_paquetes.py):
//   'ELB1' · largo del índice · índice JSON · y por cada modelo:
//   posiciones (Int32) · uvs (Uint16) · normales (Int16) · caras (Int32)
// Cada arreglo es una "vista" sobre los mismos bytes: no se copia nada.
// ----------------------------------------------------------
function leerPaquete(buffer) {
  const firma = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
  if (firma !== 'ELB1') throw new Error('No es un paquete de El Laburador');

  const largoIndice = new DataView(buffer).getUint32(4, true);
  const indice = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, largoIndice)));

  const modelos = {};
  let pos = 8 + largoIndice;
  const multiploDe4 = n => Math.ceil(n / 4) * 4;

  for (const m of indice.modelos) {
    const nv = m.vertices;
    const nc = m.caras;

    const posiciones = new Int32Array(buffer, pos, nv * 3);  pos += nv * 3 * 4;
    const uvs        = new Uint16Array(buffer, pos, nv * 2); pos += nv * 2 * 2;
    const normales   = new Int16Array(buffer, pos, nv * 3);  pos = multiploDe4(pos + nv * 3 * 2);
    const deltas     = new Int32Array(buffer, pos, nc * 3);  pos += nc * 3 * 4;

    modelos[m.nombre] = { vertices: nv, caras: nc, posiciones, uvs, normales, deltas };
  }
  return modelos;
}

// ----------------------------------------------------------
// Convierte los números del paquete en un p5.Geometry, con los
// mismos datos que deja loadModel() al leer el .obj.
// ----------------------------------------------------------
function armarGeometria(nombre, d) {
  const geo = new p5.Geometry();
  geo.gid = 'paquete|' + nombre;   // p5 usa el gid para no subir dos veces el modelo a la placa de video

  for (let i = 0; i < d.vertices; i++) {
    const p = i * 3;
    geo.vertices.push(new p5.Vector(
      d.posiciones[p] / ESCALA_POSICION,
      d.posiciones[p + 1] / ESCALA_POSICION,
      d.posiciones[p + 2] / ESCALA_POSICION
    ));
    geo.vertexNormals.push(new p5.Vector(
      d.normales[p] / ESCALA_NORMAL,
      d.normales[p + 1] / ESCALA_NORMAL,
      d.normales[p + 2] / ESCALA_NORMAL
    ));
    geo.uvs.push([d.uvs[i * 2] / ESCALA_UV, d.uvs[i * 2 + 1] / ESCALA_UV]);
  }

  // Las caras vienen como "cuánto sumarle al índice anterior"
  let indiceActual = 0;
  for (let k = 0; k < d.caras * 3; k += 3) {
    const a = indiceActual += d.deltas[k];
    const b = indiceActual += d.deltas[k + 1];
    const c = indiceActual += d.deltas[k + 2];
    geo.faces.push([a, b, c]);
  }
  return geo;
}

// ----------------------------------------------------------
// Carga un grupo de modelos. Cada pedido es:
//   { nombre: 'heladera', obj: 'src/modelos/heladera.obj', alLlegar: geo => {...} }
// Los que están en el paquete se arman ahí mismo (todos juntos
// tardan ~0,1 s). Cada 12 ms de trabajo se hace una pausa para que
// el juego pueda dibujar un cuadro: así la pantalla no se traba.
// Los que no están, se bajan como .obj. Devuelve una promesa que
// termina cuando llegaron todos (o fallaron).
// ----------------------------------------------------------
const MS_DE_TRABAJO_POR_TANDA = 12;

async function cargarGrupoDeModelos(paquete, pedidos) {
  let modelos = {};
  try {
    modelos = await bajarPaquete(paquete);
  } catch (error) {
    console.warn(`No se pudo usar el paquete "${paquete}": se bajan los .obj sueltos.`, error);
  }

  const esperandoObj = [];
  let inicioTanda = performance.now();

  for (const pedido of pedidos) {
    const datos = modelos[pedido.nombre];
    if (datos) {
      pedido.alLlegar(armarGeometria(pedido.nombre, datos));

      if (performance.now() - inicioTanda > MS_DE_TRABAJO_POR_TANDA) {
        await esperarUnCuadro();
        inicioTanda = performance.now();
      }
    } else {
      esperandoObj.push(
        cargarObj(pedido.obj)
          .then(pedido.alLlegar)
          .catch(() => console.warn('No cargó el modelo ' + pedido.nombre + ': se usa el dibujo viejo'))
      );
    }
  }

  await Promise.all(esperandoObj);
}

// La forma de antes (texto .obj), como respaldo
function cargarObj(ruta) {
  return new Promise((resolver, fallar) => loadModel(ruta, false, resolver, fallar));
}

// Carga una textura y la devuelve como p5.Image, en una promesa.
// No se usa loadImage() de p5 porque en la versión 1.9 baja cada
// imagen DOS veces (primero con fetch() para ver si es un GIF y
// después otra vez con <img>). Acá se baja una sola vez y se copia
// a un p5.Image igual que hace p5 por dentro.
function cargarImagen(ruta) {
  return new Promise((resolver, fallar) => {
    const img = new Image();
    img.onload = () => {
      const imagenP5 = createImage(img.width, img.height);
      imagenP5.drawingContext.drawImage(img, 0, 0);
      imagenP5.setModified(true);
      resolver(imagenP5);
    };
    img.onerror = () => fallar(new Error('No se pudo cargar ' + ruta));
    img.src = ruta;
  });
}

function esperarUnCuadro() {
  return new Promise(resolver => setTimeout(resolver, 0));
}
