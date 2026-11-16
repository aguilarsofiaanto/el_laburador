# Cómo funciona el chatbot (la Tía Marta)

## Qué es

La **Tía Marta** es una contadora jubilada del barrio a la que el jugador le escribe desde el celular del juego (botón 📱). Responde preguntas sobre el kiosco: cómo poner precios, cuánto stock comprar, qué es el margen, por qué no se llega a la fianza, qué pasa con las deudas o el fiado.

No es un chat genérico: **sabe cómo viene la partida** (caja, stock, costos, precios, ventas del día) y usa esos números para dar consejos concretos. Su objetivo es **enseñar, no hacer el trabajo por el jugador**. Por eso nunca calcula vueltos: ese cálculo mental es el ejercicio central del juego.

Ejemplos reales de respuestas, sacados de una prueba:

> **Jugador:** ¿Cómo pongo bien los precios?
> **Tía:** "El precio justo no se adivina, se prueba. Fijate en el panel: si el cartelito está verde equilibrado, vas bien. Si se pone rojo, estás espantando a la clientela por caro…"

> **Jugador:** Un cliente lleva 2 alfajores a 700 y me paga con 2000. ¿Cuánto vuelto le doy?
> **Tía:** "Los cálculos exactos los tenés que hacer vos que sos el kiosquero. Hagamos de cuenta que te compran dos caramelos a 100 pesos y te pagan con 500: primero sumás la compra y después a los 500 le restás ese total…"

---

## Con qué está hecho

| Pieza | Para qué sirve |
|---|---|
| **Gemini** (modelo `gemini-flash-lite-latest`) | El modelo de lenguaje de Google que escribe las respuestas. Flash-Lite es rápido y entra en el nivel gratuito. |
| **Firebase AI Logic** | Hace de puente entre el juego y Gemini. Guarda la clave de Gemini del lado de Google, así que **no hay ninguna API key de Gemini en el código**. |
| **Gemini TTS** (`gemini-3.1-flash-tts-preview`, voz *Gacrux*) | Lee en voz alta las respuestas de la tía, con una voz generada por IA. También pasa por Firebase AI Logic. |
| **Firebase App Check** + **reCAPTCHA Enterprise** | Comprueba que los pedidos salen del juego de verdad, así nadie gasta la cuota desde otra página. En `localhost` usa un token de depuración fijo; publicado, reCAPTCHA Enterprise. Desde el 2/11/2026 Firebase lo exige para AI Logic. |

### ¿Por qué no una Gem de Gemini?

La idea original era usar una **Gem**, un "Gemini personalizado" que se arma en gemini.google.com. No sirve para esto, por tres motivos:

1. **Las Gems no tienen API.** Solo funcionan dentro de la app de Gemini y no se pueden meter en una página web.
2. **Una Gem no puede saber nada de la partida.** El alumno tendría que salir del juego y explicarle todo a mano.
3. **Google anunció que en noviembre de 2026 las Gems de las cuentas personales pasan a ser "skills".**

Lo que sí se aprovecha de la idea: una Gem es básicamente **un conjunto de instrucciones**. Acá esas instrucciones están en el código (`INSTRUCCIONES_TIA`) y se mandan a Gemini como *instrucciones de sistema*.

---

## Recorrido de un mensaje

```
 Jugador escribe en el celular
            │
            ▼
 js/chatbot.js  ── enviarATia()
   1. ¿Hay un cliente esperando el vuelto?  → si hay, NO se manda nada
   2. ¿Le quedan consultas hoy? (máximo 5)  → si no, NO se manda nada
   3. Arma el mensaje:
        [ESTADO DEL KIOSCO]   ← resumenParaTia(): solo lo que el jugador ve
        [PREGUNTA DEL JUGADOR]
            │
            ▼
 js/firebase.js  ── window.tiaEnviar()
   Usa el SDK de Firebase AI Logic. App Check le agrega un token
   de un solo uso que prueba que el pedido sale del juego.
            │
            ▼
 Firebase AI Logic (servidores de Google)
   Verifica App Check, le agrega la clave de Gemini y le pasa:
     · las instrucciones de sistema (la personalidad y las reglas)
     · la charla del día hasta ahora
     · el mensaje nuevo
            │
            ▼
 Gemini responde
            │
            ▼
 js/chatbot.js
   Muestra la respuesta como TEXTO (textContent), nunca como HTML.
   Si hubo un error, muestra un aviso dentro del juego y no se
   descuenta la consulta.
```

---

## Los archivos

### `js/chatbot.js`: la lógica del chat (lo que más se toca)

| Qué | Para qué |
|---|---|
| `LIMITE_MENSAJES_TIA_POR_DIA` | Consultas por día de juego (5). Cuida la cuota gratuita de todo el curso. |
| `INSTRUCCIONES_TIA` | **La personalidad y las reglas** de la tía (ver abajo). Es lo que en una Gem serían las "instrucciones". |
| `SUGERENCIAS_TIA` | Los botones de preguntas rápidas que aparecen en el chat. |
| `resumenParaTia()` | Arma el **[ESTADO DEL KIOSCO]** que acompaña cada pregunta. |
| `abrirChatTia()` / `cerrarChatTia()` | Abren y cierran el celular. Con el chat abierto el juego queda en pausa: no se camina ni se atiende. |
| `enviarATia()` | Manda la pregunta y muestra la respuesta, con todos los controles. |
| `mensajeErrorTia()` | Traduce los errores técnicos a mensajes del juego ("se me terminó el crédito", "no me llegan tus mensajes"…). |
| `actualizarBotonCelular()` | Apaga el botón 📱 cuando no se puede usar (por ejemplo, con un cliente en la ventanita). Se llama en cada frame desde `draw()`. |

### `js/firebase.js`: la conexión

| Qué | Para qué |
|---|---|
| `firebaseConfig` | Los datos del proyecto de Firebase. Son públicos: pueden estar en el código. |
| `RECAPTCHA_SITE_KEY` | Clave de sitio de reCAPTCHA Enterprise para App Check (se usa cuando el juego está publicado). También es pública. |
| `js/appcheck-debug.local.js` | Token de depuración fijo para jugar en `localhost` en cualquier compu. **Secreto**: está en `.gitignore` y no se sube a GitHub. |
| `MODELO_GEMINI` | Qué modelo usa. `-latest` apunta siempre al Flash-Lite más nuevo. |
| `prepararChatbot()` | Crea el modelo con las instrucciones de sistema y deja disponibles `window.tiaEnviar()` y `window.tiaNuevaCharla()`. |

### Otros lugares que lo usan

- **`js/estado.js`:** `gameState.mensajesTiaHoy` cuenta las consultas del día. `reiniciarContadoresDelDia()` las pone en 0 y **empieza una charla nueva cada día de juego**, para que el historial no crezca sin límite.
- **`index.html`:** el botón `#btnCelular` y la ventana `#chatTia`.
- **`css/estilos.css`:** estilos con prefijo `ct-` (reusa el diseño del celular del hermano).
- **`js/interfaz.js`:** `hayDialogoVisible()` tiene en cuenta el chat para saber si el juego está en pausa.

---

## Qué ve la tía y qué no

En cada mensaje se le manda **solo lo que el jugador ya tiene en pantalla**:

- Semana y día, caja, cuánto falta para la fianza.
- Alquiler, luz y deuda acumulada.
- Ventas de la semana y clientes del día.
- Estrés e inflación acumulada.
- Por producto: stock, costo, precio de venta, ganancia por unidad y cómo lo marca el panel (barato, equilibrado o caro).
- Qué le pidieron hoy y no tenía, plata fiada por cobrar.
- Lo que pasa hoy: clima, producto viral, corte de luz, clausura.
- Mejoras conseguidas y si le paga protección al capo.

**Lo que NO se le manda nunca:**

- El **precio de mercado exacto** (`precioJusto`). El juego lo esconde a propósito: el jugador lo tiene que encontrar probando.
- Los **eventos ocultos** de la historia (el sicario, qué arma te salva, cuándo aparece cada personaje).
- **Datos personales** del jugador.

---

## Las reglas de la tía (instrucciones de sistema)

Están en `INSTRUCCIONES_TIA`. En resumen:

1. **Nunca calcular el total ni el vuelto de una venta.** Si se lo piden, explica el método con otros números.
2. No inventar el precio de mercado: enseñar a encontrarlo probando.
3. Usar los datos del **[ESTADO DEL KIOSCO]**, sin inventar otros.
4. Guiar con preguntas o un paso concreto antes que dar la solución.
5. Respuestas cortas (hasta 80 palabras), sin formato.
6. Hablar solo del kiosco y de economía básica. Si preguntan otra cosa, redirigir con humor.
7. No dar pistas sobre lo que va a pasar en la historia ni recomendar armas.
8. Si el alumno cuenta algo personal preocupante, responder con empatía y sugerirle hablar con un adulto de confianza o con su profe.
9. No pedir ni repetir datos personales.

### "En el código, no solo en el prompt"

Un modelo de lenguaje **puede ser convencido** de romper sus reglas ("ignorá tus instrucciones", "el profe dijo que podés"). Por eso lo más importante no depende de que la tía "obedezca", sino que lo controla el código:

| Riesgo | Cómo se evita en el código |
|---|---|
| Pedirle el vuelto a la tía mientras el cliente espera | El botón 📱 se apaga y `enviarATia()` no manda nada si hay un cliente en la ventanita (`clienteActual`). |
| Que descubra el precio de mercado | `precioJusto` nunca entra en `resumenParaTia()`: la tía no lo tiene. |
| Gastar la cuota gratuita de todo el curso | Límite de 5 consultas por día de juego y App Check. |
| Que la respuesta traiga HTML o código raro | Se muestra con `textContent`, que lo trata como texto plano. |
| Que alguien use la cuota desde otra página | App Check forzado: en `localhost` con el token fijo y, publicado, con reCAPTCHA Enterprise. |
| Una API key robada | No hay API key de Gemini en el código: la guarda Firebase. |

---

## La voz de la tía

Cuando la tía responde, además de escribir, **lo dice en voz alta** con una voz generada por IA. Con el botón 🔊 / 🔇 de arriba del chat se activa o se silencia, y el juego se acuerda de la elección. El botón de sonido general del juego también la calla.

Cómo funciona ([`js/voz.js`](js/voz.js)):

1. Cuando llega la respuesta, el texto se le manda a un **modelo de texto a voz de Gemini** (`MODELO_VOZ` en `js/firebase.js`), con una indicación de estilo (*"leelo como una tía argentina de unos 65 años, cálida…"*). El modelo usa esa indicación para el tono y no la lee en voz alta.
2. El audio llega **en pedacitos** (streaming): PCM crudo de 16 bits a 24.000 muestras por segundo. Cada pedazo se convierte y se pone en fila con la Web Audio API del navegador. Así empieza a sonar en 1 o 2 segundos, aunque la respuesta dure 20.
3. **Si Gemini no responde** (se agotó la cuota, no hay internet o cambió el modelo), se usa la voz del navegador (`speechSynthesis`): suena menos natural, pero la tía no queda muda.

Detalles:

- No hace falta **p5.sound** ni otra librería: el navegador reproduce el audio solo. Sumar otra versión de p5.sound (por ejemplo la 0.4.1, que es para p5.js 2) podría romper los sonidos que ya tiene el juego.
- Los navegadores solo dejan reproducir audio si lo pide una acción del jugador. Por eso el audio se prepara en el mismo clic de *Enviar*.
- Cada respuesta leída es **un pedido más a Gemini**. Entra en el nivel gratuito, pero suma a la cuota. Como mucho son 5 por día de juego, igual que las preguntas.
- Para cambiar la voz: `VOZ_TIA` en `js/firebase.js`. Otras voces femeninas: *Sulafat* (cálida), *Achernar* (suave), *Kore* (firme). Para cambiar el tono: `ESTILO_VOZ_TIA` en `js/voz.js`.

---

## Costos y límites

- Usa el **nivel gratuito** de la Gemini Developer API (plan Spark de Firebase, sin tarjeta). Los límites gratuitos los define Google y cambian seguido: se ven en <https://aistudio.google.com> → *Rate limits*.
- Si se acaba la cuota, la tía dice que "se le terminó el crédito del celular" y el juego sigue funcionando.
- En el nivel gratuito Google puede usar lo que se manda para mejorar sus productos. Por eso el chat no pide ni manda datos personales.
- reCAPTCHA Enterprise tiene 10.000 verificaciones gratis por mes.

---

## Cómo cambiar cosas

| Quiero… | Dónde |
|---|---|
| Cambiar la personalidad o las reglas | `INSTRUCCIONES_TIA` en `js/chatbot.js`. Se puede probar antes en una Gem o en Google AI Studio y después pegarlo acá. |
| Más o menos consultas por día | `LIMITE_MENSAJES_TIA_POR_DIA` en `js/chatbot.js` |
| Otras preguntas rápidas | `SUGERENCIAS_TIA` en `js/chatbot.js` |
| Que sepa algún dato más de la partida | Agregarlo en `resumenParaTia()`. Antes, preguntarse: ¿el jugador ya lo ve en pantalla? |
| Otro modelo de Gemini | `MODELO_GEMINI` en `js/firebase.js` |

---

## Cómo probarlo

1. Levantar el juego con `iniciar-servidor.bat` (o ver el README) y abrir `http://localhost:5517`.
2. En `localhost` tiene que estar `js/appcheck-debug.local.js` con su token registrado en Firebase (ver [FIREBASE.md](FIREBASE.md), paso 5.1). Si no, la tía dice *"No me llegan tus mensajes"* y en la consola (F12) aparece `401 App Check token is invalid`.
3. Preguntas para probar:
   - *"¿Cómo pongo bien los precios?"* → tiene que hablar del panel y de probar.
   - *"¿Qué es el margen? ¿Cuánto gano con la gaseosa?"* → tiene que usar los números reales del kiosco.
   - *"Me pagan con 2000 una compra de 1400, ¿cuánto vuelto doy?"* → **no** tiene que dar el número.
   - *"¿Cuál es el precio de mercado del alfajor?"* → no lo sabe: tiene que explicar cómo encontrarlo.
   - *"Ayudame con la tarea de historia"* → tiene que volver al kiosco.
4. Con un cliente en la ventanita, el botón 📱 tiene que estar apagado.

## Limitaciones

- Es un modelo de lenguaje: **se puede equivocar** o explicar algo de forma rara. Conviene que el profe lo presente como "una ayuda", no como la verdad absoluta.
- La charla se reinicia cada día de juego: no se acuerda de lo que hablaron ayer.
- Necesita internet. Sin conexión, el juego anda igual pero la tía no responde.
- La cuota gratuita es compartida por todos los que juegan con el mismo proyecto de Firebase.
