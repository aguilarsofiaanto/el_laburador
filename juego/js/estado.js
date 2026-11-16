
// ==========================================================
// ESTADO DEL JUEGO
// Todo lo que cambia durante la partida vive acá.
// Tenerlo centralizado facilita leerlo y guardarlo después.
// ==========================================================
 
const gameState = {
  // --- Tiempo ---
  semanaActual: 1,
  totalSemanas: 8,
  diaActual: 1,
  diasPorSemana: 7,
 
  // --- Economía ---
  // Calibrado con una simulación de miles de partidas: un jugador
  // "perfecto" (nunca erra un vuelto, nunca se queda sin stock) con
  // precios entre 0% y +35% del mercado llega en 3-4 semanas; con
  // precios a -20% o a +60% casi nunca llega. Un jugador real tarda
  // más. Para cambiar la dificultad, tocá estos números y DEMANDA.
  metaFianza: 50000,
  caja: 2200,
  alquilerSemanal: 9000,
  luzSemanal: 2500,
  deudaAcumulada: 0,

  // --- Ventas ---
  ventasDelDia: 0,
  ventasDeLaSemana: 0,
  clientesAtendidosHoy: 0,   // los que compraron algo
  clientesHoy: 0,            // los que vinieron (compren o no)
  clientesEsperadosHoy: null, // se fija con el primer cliente del día
  faltantesHoy: {},          // { idProducto: veces que te lo pidieron sin stock }
  diaIniciado: false,        // ya se mostró el evento del día
  mensajesTiaHoy: 0,         // consultas al chatbot en el día

  // --- Estado del jugador ---
  estres: 0,

  // --- Catálogo de productos ---
  // El costo ronda el 65% del precio de mercado: el margen de un
  // kiosco real es chico, por eso importa tanto el precio.
  // demandaBase = qué tanto lo pide la gente comparado con el resto.
  productos: [
    { id: 'alfajor',   nombre: 'Alfajor',      costo: 460,  precioJusto: 700,  precio: 700,  stock: 2, demandaBase: 9  },
    { id: 'chocolate', nombre: 'Chocolate',    costo: 620,  precioJusto: 950,  precio: 950,  stock: 1, demandaBase: 7  },
    { id: 'chicles',   nombre: 'Chicles',      costo: 230,  precioJusto: 350,  precio: 350,  stock: 3, demandaBase: 12 },
    { id: 'gaseosa',   nombre: 'Gaseosa',      costo: 780,  precioJusto: 1200, precio: 1200, stock: 1, demandaBase: 6  },
    { id: 'agua',      nombre: 'Agua',         costo: 520,  precioJusto: 800,  precio: 800,  stock: 2, demandaBase: 8  },
    { id: 'jugo',      nombre: 'Jugo',         costo: 590,  precioJusto: 900,  precio: 900,  stock: 1, demandaBase: 7  },
    { id: 'papas',     nombre: 'Papas fritas', costo: 910,  precioJusto: 1400, precio: 1400, stock: 0, demandaBase: 5  },
    { id: 'palitos',   nombre: 'Palitos',      costo: 720,  precioJusto: 1100, precio: 1100, stock: 1, demandaBase: 6  }
  ]
};
 
const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
 
function nombreDiaActual() {
  return NOMBRES_DIA[(gameState.diaActual - 1) % 7];
}
 
// ==========================================================
// ESTADO DE LOS TRES CAMINOS
// ==========================================================
const caminos = {
  // Camino 1: el capo
  pagaProteccion: false,
  confianzaCapo: 0,
  atrasosCapo: 0,
  montoProteccion: 2500,
 
  // Camino 2: el abogado
  delato: false,
  semanaDelacion: null,
  semanaSicario: null,   // cuándo viene a cobrársela (1 o 2 semanas después)
  abogadoOfrecido: false,

  // Camino 3: la policía
  vecesPolicia: 0,
  seNegoACoima: false,
  clausurado: 0,

  // Qué evento espera después del balance semanal (se guarda con
  // la partida para que recargar la página no lo saltee)
  eventoPendiente: null,   // 'final' | 'sicario' | 'abogado' | 'policia' | 'capo' | null

  // Cierre
  partidaTerminada: false,
  finalObtenido: null
};
 
// ==========================================================
// EFECTOS QUE DURAN UN DÍA
// ==========================================================
const efectosDia = {
  sinLuz: false,
  productoViral: null,
  productoProhibido: null,
  multaPendiente: 0
};
 
function limpiarEfectosDia() {
  efectosDia.sinLuz = false;
  efectosDia.productoViral = null;
  efectosDia.productoProhibido = null;
}
 
// ==========================================================
// SISTEMA DE ARMAS
// ==========================================================
const ARMAS = {
  manos:    { nombre: 'Manos',    costo: 0,    probDefensa: 0.15 },
  cuchillo: { nombre: 'Cuchillo', costo: 1200, probDefensa: 0.40 },
  machete:  { nombre: 'Machete',  costo: 3000, probDefensa: 0.65 },
  pistola:  { nombre: 'Pistola',  costo: 8000, probDefensa: 0.85 }
};
 
const ORDEN_ARMAS = ['manos', 'cuchillo', 'machete', 'pistola'];
 
let armaActual = 'manos';
 
function comprarArma(tipo) {
  const arma = ARMAS[tipo];
  if (armaActual === tipo) return;
 
  if (arma.costo > gameState.caja) {
    alert('No te alcanza la caja para eso.');
    return;
  }
 
  gameState.caja -= arma.costo;
  armaActual = tipo;
  actualizarHUD();
  renderFaseCompra();
}
 
// ==========================================================
// MEJORAS DEL KIOSCO (metas intermedias)
// ==========================================================
const mejoras = {
  clientelaFija: false,
  heladeraNueva: false,
  carteLuminoso: false,
  camaraSeguridad: false,
  proveedorFijo: false
};
 
// ==========================================================
// PALETAS DE COLORES
// ==========================================================
const PALETA = {
  pisoClaro:   [108, 56, 34],
  pisoOscuro:  [78, 40, 24],
  paredClara:  [96, 90, 80],
  paredSombra: [70, 65, 56],
  viga:        [52, 33, 19],
  neon:        [206, 138, 42],
  estanteMetal:       [72, 60, 44],
  estanteMetalOscuro: [46, 38, 28],
  heladeraCuerpo: [120, 124, 128],
  heladeraVidrio: [80, 110, 122],
  // --- Detalle y realismo: zócalos, molduras, madera, toldo ---
  zocalo:      [30, 26, 22],
  moldura:     [88, 80, 68],
  maderaClara: [138, 92, 50],
  maderaOscura:[74, 46, 24],
  metalBrillo: [200, 200, 208],
  toldo:       [176, 44, 40],
  toldoSombra: [126, 30, 28],
  bronce:      [196, 156, 84]
};
 
const PALETA_CALLE = {
  vereda:      [96, 92, 86],
  veredaLinea: [78, 74, 70],
  cordon:      [128, 124, 116],
  cordonPint:  [150, 130, 60],
  asfalto:     [46, 44, 44],
  lineaBlanca: [190, 186, 172],
  farolLuz:    [255, 214, 140]
};
 
const COLOR_PRODUCTO = {
  alfajor:   [150, 82, 38],
  chocolate: [92, 52, 30],
  chicles:   [188, 76, 128],
  gaseosa:   [172, 42, 44],
  agua:      [70, 140, 178],
  jugo:      [206, 138, 40],
  papas:     [196, 168, 62],
  palitos:   [88, 132, 66]
};
 
// ==========================================================
// ZONAS DE INTERACCIÓN
// ==========================================================
const ZONA_CAJA = { x: 0, z: 250, radio: 220 };
const PUERTA    = { x: 880, z: 270, radio: 200 };
 
// Estado compartido de los diálogos
let dialogoAbierto = false;
let juegoIniciado = false;
 
 
// ==========================================================
// DEMANDA: CUÁNTA GENTE VIENE Y QUÉ PIDE
// El día se acaba solo: no podés atender infinito. Cuánta gente
// viene depende de tus precios: barato atrae, caro espanta.
// ==========================================================
const DEMANDA = {
  clientesBase: 5,        // clientes por día con precios de mercado
  clientesMin: 2,
  clientesMax: 9,
  elasticidad: 1.2,       // cuánto cambia la cantidad de gente según el precio
  toleranciaPrecio: 0.15, // hasta 15% arriba del mercado nadie se va por el precio
  fugaPorSobreprecio: 1.3 // a partir de ahí, qué tan rápido sube la chance de que se vaya
};

// Cuánto más caro (positivo) o más barato (negativo) que el
// mercado está un producto. 0.2 = 20% más caro.
function sobreprecioDe(p) {
  return (p.precio - p.precioJusto) / p.precioJusto;
}

// Promedio de sobreprecio de lo que tenés en el estante,
// pesado por lo que pide la gente.
function indicePrecios() {
  const enEstante = gameState.productos.filter(p => p.stock > 0);
  const lista = enEstante.length > 0 ? enEstante : gameState.productos;
  const pesoTotal = lista.reduce((acc, p) => acc + p.demandaBase, 0);
  return lista.reduce((acc, p) => acc + sobreprecioDe(p) * p.demandaBase, 0) / pesoTotal;
}

// Cuántos clientes vienen en promedio con los precios de ahora
function clientesPromedioDelDia() {
  const factorPrecio = Math.min(1.5, Math.max(0.4, 1 - DEMANDA.elasticidad * indicePrecios()));
  let n = DEMANDA.clientesBase * factorPrecio;

  if (climaHoy.tipo === 'festejo') n *= climaHoy.multiplicador;
  if (mejoras.carteLuminoso) n += 2;

  return n;
}

function limitarClientes(n) {
  return Math.min(DEMANDA.clientesMax, Math.max(DEMANDA.clientesMin, n));
}

// El número real del día: se redondea al azar (4,4 → 4 o 5, más
// seguido 4) para que subir un poco el precio no te saque siempre
// un cliente entero.
function calcularClientesDelDia() {
  return limitarClientes(Math.floor(clientesPromedioDelDia() + Math.random()));
}

// Lo que se ve en el HUD: si el día ya arrancó, el número fijo;
// si no, la estimación con los precios de ahora mismo.
function clientesEsperadosHoy() {
  return gameState.clientesEsperadosHoy !== null
    ? gameState.clientesEsperadosHoy
    : limitarClientes(Math.round(clientesPromedioDelDia()));
}

// Qué tanto quiere la gente cada producto hoy
function pesoDemanda(p) {
  let peso = p.demandaBase * Math.max(0.2, 1 - 1.5 * sobreprecioDe(p));
  if (climaHoy.productos.includes(p.id)) peso *= climaHoy.multiplicador;
  if (p.id === efectosDia.productoViral) peso *= 4;
  return peso;
}

// Probabilidad de que el cliente vea los precios y se vaya
function chanceDeIrsePorPrecio(sobrePrecio) {
  const exceso = sobrePrecio - DEMANDA.toleranciaPrecio;
  return Math.min(0.9, Math.max(0, exceso * DEMANDA.fugaPorSobreprecio));
}

function reiniciarContadoresDelDia() {
  gameState.ventasDelDia = 0;
  gameState.clientesAtendidosHoy = 0;
  gameState.clientesHoy = 0;
  gameState.clientesEsperadosHoy = null;
  gameState.faltantesHoy = {};
  gameState.diaIniciado = false;
  gameState.mensajesTiaHoy = 0;
  // Charla nueva con el chatbot cada día (ver chatbot.js / firebase.js)
  if (typeof window.tiaNuevaCharla === 'function') window.tiaNuevaCharla();
}

// ==========================================================
// CLIMA Y EVENTOS QUE AFECTAN LA DEMANDA
// ==========================================================
const climaHoy = {
  tipo: null,        // 'frio' | 'calor' | 'festejo' | null
  productos: [],     // qué productos se piden más (vacío = ninguno en especial)
  multiplicador: 1   // frío/calor: cuánto más se piden esos productos
                     // festejo: cuánta más gente viene
};

function limpiarClima() {
  climaHoy.tipo = null;
  climaHoy.productos = [];
  climaHoy.multiplicador = 1;
}
 
// ==========================================================
// INFLACIÓN
// Los precios de reposición suben todas las semanas.
// Si no ajustás tus precios de venta, perdés margen.
// ==========================================================
const economia = {
  inflacionAcumulada: 0   // en porcentaje
};
 
function aplicarInflacionSemanal() {
  // Entre 4% y 9% por semana: la mercadería sube sola
  const tasa = 0.04 + Math.random() * 0.05;
  economia.inflacionAcumulada += tasa * 100;
 
  for (const p of gameState.productos) {
    p.costo = Math.round((p.costo * (1 + tasa)) / 10) * 10;
    // El precio de mercado también sube, pero un poco menos
    p.precioJusto = Math.round((p.precioJusto * (1 + tasa * 0.85)) / 10) * 10;
  }
 
  return Math.round(tasa * 100);
}
 
// ==========================================================
// EXTORSIÓN DEL POLICÍA
// Si le pagaste una coima, vuelve a pedirte mercadería gratis.
// ==========================================================
const extorsion = {
  vecesEstaSemana: 0,
  vecesQueTeNegaste: 0
};
 
 
 
 
 
 
// ==========================================================
// FIADO — cuentas por cobrar
// Enseña un concepto real: vender no es lo mismo que cobrar.
// ==========================================================
const fiado = {
  deudas: [],        // { cliente, monto, semanaFiado }
  totalFiado: 0,     // cuánto te deben en total
  cobrado: 0,        // cuánto te pagaron de vuelta
  perdido: 0         // cuánto no volvió nunca
};
 
function totalPorCobrar() {
  return fiado.deudas.reduce((acc, d) => acc + d.monto, 0);
}