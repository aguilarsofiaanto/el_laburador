// Cuando tengan el link del juego, cambiar el "#" de la línea de abajo
const LINK_DEL_JUEGO = "#";

document.querySelectorAll(".btn-jugar").forEach(function (b) {
  b.href = LINK_DEL_JUEGO;
  if (LINK_DEL_JUEGO !== "#") b.target = "_blank";
});

const burger = document.getElementById("burger");
const menu = document.getElementById("menu");
burger.addEventListener("click", function () {
  menu.classList.toggle("abierto");
});
menu.querySelectorAll("a").forEach(function (a) {
  a.addEventListener("click", function () {
    menu.classList.remove("abierto");
  });
});

const observador = new IntersectionObserver(function (items) {
  items.forEach(function (it) {
    if (it.isIntersecting) {
      it.target.classList.add("visible");
      observador.unobserve(it.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(function (el) {
  observador.observe(el);
});

const pista = document.getElementById("pista");
const slides = pista.querySelectorAll(".slide");
let pausa = false;

function mover(dir) {
  const ancho = slides[0].offsetWidth + 14;
  const llegoAlFinal = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 5;
  if (dir > 0 && llegoAlFinal) {
    pista.scrollTo({ left: 0, behavior: "smooth" });
  } else if (dir < 0 && pista.scrollLeft <= 5) {
    pista.scrollTo({ left: pista.scrollWidth, behavior: "smooth" });
  } else {
    pista.scrollBy({ left: dir * ancho, behavior: "smooth" });
  }
}
document.getElementById("next").addEventListener("click", function () { mover(1); });
document.getElementById("prev").addEventListener("click", function () { mover(-1); });

["mouseenter", "touchstart"].forEach(function (e) {
  pista.addEventListener(e, function () { pausa = true; }, { passive: true });
});
["mouseleave", "touchend"].forEach(function (e) {
  pista.addEventListener(e, function () { pausa = false; }, { passive: true });
});
setInterval(function () {
  if (!pausa) mover(1);
}, 4000);

const temas = [
  {
    nombre: "Objetivo",
    claves: ["objetivo", "meta", "fianza", "hermano", "ganar", "ganó", "juntar"],
    respuesta: "Tenés que juntar la fianza para sacar a tu hermano. Al principio eran $50.000, pero al acortar la partida se bajó a $20.000."
  },
  {
    nombre: "Duración",
    claves: ["duracion", "dura", "semana", "semanas", "dias", "clientes", "cuanto tarda"],
    respuesta: "Una partida dura 2 semanas de 6 días (de lunes a sábado). Por día podés atender hasta 10 clientes."
  },
  {
    nombre: "Vuelto",
    claves: ["vuelto", "cambio", "calcular", "total", "cuenta", "venta", "vender", "plata"],
    respuesta: "El juego no te muestra el total ni el vuelto. Lo calculás vos con los precios del pedido y la plata que te da el cliente. Si te equivocás, perdés plata o se te sube el estrés."
  },
  {
    nombre: "Controles",
    claves: ["controles", "mover", "moverse", "teclado", "mouse", "celular", "tactil", "joystick", "camara", "como se juega", "como juego"],
    respuesta: "En compu te movés con el teclado y girás la cámara con el mouse. En celular o tablet hay un joystick flotante para caminar y con la parte derecha de la pantalla movés la cámara."
  },
  {
    nombre: "Caminos",
    claves: ["camino", "caminos", "capo", "abogado", "policia", "final", "finales"],
    respuesta: "Hay tres caminos: el capo, el abogado y la policía. Cada uno tiene su final, que también depende de la plata que tengas y de si llegaste a la meta."
  },
  {
    nombre: "Estrés y deudas",
    claves: ["estres", "deuda", "deudas", "recargo", "dormir", "gastos", "alquiler", "luz"],
    respuesta: "El estrés sube con los errores, los rechazos y la falta de stock, y baja cuando dormís. Si no llegás a pagar los gastos (alquiler y luz) se arma una deuda con un 20% de recargo."
  },
  {
    nombre: "Equipo",
    claves: ["equipo", "integrantes", "quien", "quienes", "creadores", "docente", "profe", "hizo"],
    respuesta: "El equipo es Tobías Juárez (programación y gráficos), Sebastián López (líder y base de datos) y Sofía Aguilar (portal y documentación). El docente es Diego Callamullo."
  },
  {
    nombre: "Saludo",
    claves: ["hola", "buenas", "buen dia", "buenas tardes", "gracias", "chau"],
    respuesta: "¡Hola! Si querés saber algo del juego, tocá uno de los temas de abajo o escribime tu duda.",
    oculto: true
  }
];

const chat = document.getElementById("chat");
const mensajes = document.getElementById("chatMensajes");
const entrada = document.getElementById("chatTexto");
const rapidas = document.getElementById("chatRapidas");

function normalizar(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function agregar(texto, clase) {
  const d = document.createElement("div");
  d.className = "msj " + clase;
  d.textContent = texto;
  mensajes.appendChild(d);
  mensajes.scrollTop = mensajes.scrollHeight;
  return d;
}

function buscarRespuesta(pregunta) {
  const q = normalizar(pregunta);
  const palabras = q.split(" ");
  let mejor = null;
  let max = 0;
  temas.forEach(function (t) {
    let puntos = 0;
    t.claves.forEach(function (c) {
      const clave = normalizar(c);
      if (clave.indexOf(" ") > -1 ? q.indexOf(clave) > -1 : palabras.indexOf(clave) > -1) puntos++;
    });
    if (puntos > max) { max = puntos; mejor = t; }
  });
  if (mejor) return mejor.respuesta;
  const lista = temas.filter(function (t) { return !t.oculto; }).map(function (t) { return t.nombre.toLowerCase(); });
  return "No entendí bien tu pregunta. Probá con alguno de estos temas: " + lista.join(", ") + ".";
}

function enviar(texto) {
  texto = texto.trim();
  if (!texto) return;
  agregar(texto, "yo");
  entrada.value = "";
  const escribiendo = agregar("escribiendo...", "bot escribiendo");
  setTimeout(function () {
    escribiendo.remove();
    agregar(buscarRespuesta(texto), "bot");
  }, 600);
}

temas.filter(function (t) { return !t.oculto; }).forEach(function (t) {
  const b = document.createElement("button");
  b.textContent = t.nombre;
  b.addEventListener("click", function () { enviar(t.nombre); });
  rapidas.appendChild(b);
});

let saludado = false;
function abrirChat() {
  chat.classList.add("abierto");
  if (!saludado) {
    agregar("¡Hola! Soy el asistente de El Laburador. Elegí un tema o escribime tu consulta.", "bot");
    saludado = true;
  }
}
document.getElementById("chatBoton").addEventListener("click", function () {
  if (chat.classList.contains("abierto")) chat.classList.remove("abierto");
  else abrirChat();
});
document.getElementById("chatCerrar").addEventListener("click", function () {
  chat.classList.remove("abierto");
});
document.getElementById("chatEnviar").addEventListener("click", function () { enviar(entrada.value); });
entrada.addEventListener("keydown", function (e) {
  if (e.key === "Enter") enviar(entrada.value);
});
