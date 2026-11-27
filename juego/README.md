# El Laburador

Juego educativo de gestión en 3D, hecho con [p5.js](https://p5js.org/).

Tu hermano está preso esperando juicio y la fianza es de **$50.000**. Tenés **8 semanas** y un kiosco de barrio: comprás mercadería, le ponés precio, atendés por la ventanita y calculás vos el vuelto de cada venta. Todas las semanas se pagan alquiler y luz, y en el camino aparece gente ofreciéndote atajos.

<!-- Agregá una captura: guardala en docs/captura.png y sacale el comentario a la línea de abajo -->
<!-- ![Captura del juego](docs/captura.png) -->

## Qué se aprende

- **Cálculo mental:** en cada venta sumás el total y calculás el vuelto. El juego no lo hace por vos.
- **Precio y demanda:** con precios bajos viene más gente pero ganás poco por unidad. Con precios altos ganás más por unidad, pero viene menos gente y algunos se van sin comprar.
- **Costo, margen y ganancia:** el costo ronda el 65% del precio de mercado, como en un kiosco real.
- **Gestión de stock:** si te piden algo que no tenés, perdés la venta. El clima (frío, calor, festejos) y lo que se hace viral cambian qué se pide.
- **Capital de trabajo, costos fijos e inflación:** la plata del stock no va a la fianza, el alquiler se paga sí o sí y la mercadería sube todas las semanas.
- **Vender no es cobrar:** el fiado puede volver… o no.

## Cómo jugarlo

### Online

Si está publicado en GitHub Pages: `https://<usuario>.github.io/EL_LABURADOR/` (ver [Publicar](#publicar-en-github-pages)).

### En tu compu

El juego **no anda abriendo `index.html` con doble clic**: el audio y el módulo de Firebase necesitan un servidor local. Cualquiera de estas opciones sirve:

- **Windows, lo más fácil:** doble clic en **`../iniciar-servidor.bat`**. Necesita Python. Abre el juego en `http://localhost:5517` y, para apagarlo, cerrás la ventana negra. Usá siempre esa dirección: el usuario anónimo de Firebase (y con él la partida guardada) queda asociado a ese puerto.
- **VS Code:** instalá la extensión *Live Server*, clic derecho en `index.html` → *Open with Live Server*.
- **Node.js**, desde la carpeta del juego:

```bash
npx serve .
```

- **Python**, desde la carpeta del juego (es lo mismo que hace el `.bat`):

```bash
python ../servidor.py
```

`servidor.py` es como `python -m http.server`, pero le pide al navegador que no guarde los archivos en caché. Con el servidor común, después de cambiar el código el navegador puede seguir usando la versión vieja hasta que apretás **Ctrl + F5**.

Y abrí `http://localhost:5517` (o la dirección que te muestre).

### Controles

| Teclado | Celular | Acción |
|---|---|---|
| W A S D | joystick (mitad izquierda) | Caminar |
| Shift | joystick hasta el borde | Correr |
| Arrastrar el mouse | arrastrar (mitad derecha) | Mirar |
| L | tocar el aviso | Atender al cliente |
| E | tocar el aviso | Cerrar el día (en la puerta) |
| R | — | Resetear la vista |
| 📱 | 📱 | Consultarle a la Tía Marta (chatbot) |
| 🔊 en el chat | 🔊 en el chat | Activar o silenciar la voz de la tía |
| 🔊 | 🔊 | Silenciar / activar sonido |

## El chatbot: la Tía Marta

Desde el botón 📱 le podés escribir a la **Tía Marta**, una contadora jubilada del barrio. Responde por escrito y **en voz alta, con una voz generada por IA**. Usa **Gemini** a través de **Firebase AI Logic**, así que no hace falta servidor propio ni poner una API key de Gemini en el código.

Para que no se convierta en una trampa:

- Solo ve lo que el jugador ya tiene en pantalla (caja, stock, costos, precios, ventas). **Nunca** le llega el precio de mercado exacto ni los eventos ocultos de la historia.
- **Mientras hay un cliente esperando el vuelto, el celular no se puede usar.** Eso está controlado en el código, no depende de que el modelo "obedezca".
- Sus instrucciones le prohíben calcular totales y vueltos: explica el método con otros números.
- Hay un límite de **5 consultas por día de juego**, para no gastar la cuota gratuita de todo el curso.
- Las respuestas se muestran como texto plano (`textContent`), nunca como HTML.

Las instrucciones y el límite están arriba de todo en [`js/chatbot.js`](js/chatbot.js). La explicación completa (recorrido de un mensaje, qué ve y qué no, cómo modificarla y probarla) está en **[CHATBOT.md](CHATBOT.md)**.

> ¿Por qué no una Gem de Gemini? Las Gems solo funcionan dentro de la app de Gemini: no tienen API, así que no se pueden meter en una página, y no sabrían nada de tu partida. Además, Google anunció que en noviembre de 2026 las Gems de las cuentas personales pasan a ser "skills". Lo que sí sirve es probar las instrucciones en una Gem o en Google AI Studio y después pegarlas en `INSTRUCCIONES_TIA`.

## Firebase (guardado y chatbot)

La partida se guarda en **Firestore** con login **anónimo** (cada navegador tiene su propio usuario, sin mail ni contraseña). Sin configurar Firebase el juego anda igual, pero sin guardar y sin chatbot.

Paso a paso: **[FIREBASE.md](FIREBASE.md)**. La configuración se pega en [`js/firebase.js`](js/firebase.js) y las reglas de seguridad están en [`firestore.rules`](firestore.rules).

Para que la Tía Marta responda en `localhost` hace falta el archivo `js/appcheck-debug.local.js`, con el token de depuración de App Check. **No está en GitHub** porque es secreto: se pasa aparte (por ejemplo, dentro del zip) y se registra una vez en Firebase (FIREBASE.md, paso 5.1). Sin ese archivo el juego anda, pero la tía no responde.

## Estructura

```
index.html          Página del juego (HUD, diálogos, paneles)
css/estilos.css     Estilos
js/estado.js        Datos del juego, economía y demanda (acá se ajusta la dificultad)
js/audio.js         Sonidos y música
js/guardado.js      Guardar / cargar / borrar en Firestore
js/camara.js        Primera persona, teclado y controles táctiles
js/paquetes.js      Carga de los modelos 3D empaquetados (y respaldo con los .obj)
js/modelos.js       Modelos del kiosco y orden de carga de los gráficos
js/personas.js      La gente del barrio (modelos de Blender)
js/calle3d.js       La calle y la reja del kiosco (modelos de Blender)
js/escena.js        Dibujado 3D del kiosco y la calle
js/interfaz.js      HUD, panel de gestión, metas, pantalla de inicio
js/cliente.js       Los clientes del barrio y sus historias
js/ventas.js        Pedidos, vuelto y fiado
js/eventos.js       Eventos diarios, cierre de día y de semana, mensajes del hermano
js/caminos.js       Los tres caminos (capo, abogado, policía) y los finales
js/chatbot.js       La Tía Marta (chatbot de consultas)
js/voz.js           La voz de la Tía Marta (Gemini TTS, con la del navegador de respaldo)
js/juego.js         Arranque y bucle de p5.js
js/firebase.js      Configuración de Firebase (módulo)
firestore.rules     Reglas de seguridad de la base de datos
src/audio/sonidos/  Efectos y música
src/modelos/        Modelos de Blender (.obj) y sus texturas
src/modelos/paquetes/  Los .obj empaquetados que usa el juego (se generan, no se editan)
herramientas/armar_paquetes.py  Arma los paquetes a partir de los .obj
```

## Modelos 3D: cuando cambies o agregues un .obj

El juego no baja los `.obj` sueltos: usa tres paquetes comprimidos (`kiosco`, `personas` y `calle`) que pesan 2 MB en vez de 17 MB y no hace falta leerlos línea por línea. Después de exportar un modelo desde Blender, desde la carpeta `juego/` corré:

```powershell
python herramientas/armar_paquetes.py
```

Si te olvidás, el juego igual anda: los modelos que no están en el paquete se bajan como `.obj`, solo que más lento. Las texturas sin transparencia van en `.jpg` (pesan mucho menos que en `.png`).

## Ajustar la dificultad

Todo está en [`js/estado.js`](js/estado.js):

- `alquilerSemanal`, `luzSemanal`, `caja` (plata inicial) y `metaFianza` en `gameState`.
- `costo` y `precioJusto` de cada producto.
- `DEMANDA`: clientes por día (`clientesBase`), cuánto espanta un precio alto (`elasticidad`) y desde cuándo la gente se va por caro (`toleranciaPrecio`).

Con los valores actuales, una simulación de miles de partidas dio esto: un jugador que nunca se equivoca, con precios entre el de mercado y un 35% arriba, junta la fianza en 3 o 4 semanas. Con precios 20% abajo o 60% arriba casi nunca llega. Un jugador real tarda más.

## Publicar en GitHub Pages

1. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
2. En un par de minutos queda en `https://<usuario>.github.io/EL_LABURADOR/`.
3. Agregá ese dominio (`<usuario>.github.io`) en Firebase. Está explicado en [FIREBASE.md](FIREBASE.md#7-cuando-lo-publiques-en-github-pages).

## Pendientes conocidos

- **Robos:** las armas, la cámara de seguridad y las "represalias" del capo se mencionan, pero el juego todavía no tiene un evento de robo. Hoy la única arma que cambia algo es la pistola, en el final del sicario.
- La relación con el hermano cambia los mensajes, pero no los finales.

## Créditos

- Equipo: _(completar)_
- Motor: [p5.js](https://p5js.org/) 1.9.0 + p5.sound
- Sonidos: _(completar de dónde salió cada audio y su licencia)_


### Cámara y mouse

Podés seguir mirando al arrastrar o activar **Fijar mouse (M)** durante la
partida. Al capturarlo, el movimiento del mouse gira la vista sin llegar al borde
de la pantalla. **Escape** lo libera. Los diálogos y la gestión también lo sueltan;
para retomarlo, pulsá M o el botón otra vez. En celular se mantienen los controles
táctiles. Si el navegador no admite captura, sigue disponible arrastrar.

La velocidad base de caminata pasó de 5 a 7 unidades por cuadro; Shift mantiene
la carrera a 11. La cámara usa un plano cercano de 2 unidades, menor que el radio
de colisión de 18: evita que la puerta de la heladera y el panel del estante se
recorten visualmente antes de alcanzar el mueble.

Pruebas de cuentas y cámara (desde la raíz, con Node.js):

```sh
node --test juego/tests/*.test.cjs
```
