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
