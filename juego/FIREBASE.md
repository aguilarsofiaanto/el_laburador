# Configurar Firebase para El Laburador

Se usa para dos cosas:

- **Guardar la partida** en Firestore, con login anónimo.
- **El chatbot** (la Tía Marta), con Gemini a través de Firebase AI Logic.

Todo entra en el plan gratuito (**Spark**). No hace falta tarjeta.

> **¿Hay que importar una base de datos?** No. Firestore no necesita datos iniciales: la colección `partidas` se crea sola la primera vez que alguien guarda. Lo único que hay que "cargar" son las **reglas de seguridad** del archivo [`firestore.rules`](firestore.rules) (paso 3).

---

## 1. Crear el proyecto y la app web

1. Entrá a <https://console.firebase.google.com> → **Agregar proyecto** → ponele un nombre (por ejemplo `el-laburador-sebi`). Google Analytics no hace falta.
2. En la pantalla del proyecto, tocá el ícono **`</>`** (Web) para agregar una app web. Nombre: `El Laburador`. *No* marques Firebase Hosting.
3. Te muestra un bloque `const firebaseConfig = { ... }`. Copiá esos valores en [`js/firebase.js`](js/firebase.js), reemplazando cada `"PEGAR_ACA"`:

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "tu-proyecto.firebaseapp.com",
  projectId:         "tu-proyecto",
  storageBucket:     "tu-proyecto.firebasestorage.app",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

> La `apiKey` de Firebase **puede** estar en el código público: identifica el proyecto, no da acceso. Lo que protege los datos son las reglas del paso 3.

## 2. Activar el login anónimo

**Compilación (Build) → Authentication → Comenzar → Método de acceso (Sign-in method) → Anónimo → Habilitar → Guardar.**

Cada navegador recibe un usuario propio sin pedir mail ni contraseña. Si este paso falta, en la consola del navegador aparece *"No se pudo iniciar sesión anónima"* y la partida no se guarda.

## 3. Crear Firestore y pegar las reglas

1. **Compilación → Firestore Database → Crear base de datos.**
2. Ubicación: `southamerica-east1 (São Paulo)` es la más cercana. No se puede cambiar después.
3. Elegí **modo de producción** (no el de prueba: ese deja todo abierto y vence a los 30 días).
4. Ya creada, andá a la pestaña **Reglas**, borrá lo que hay, pegá el contenido completo de [`firestore.rules`](firestore.rules) y tocá **Publicar**.

Con esas reglas cada jugador solo puede leer, guardar y borrar **su** partida (`partidas/{uid}`).

## 4. Activar Gemini (Firebase AI Logic)

1. En el menú: **AI Logic** (puede aparecer dentro de *Compilación* o de *IA*) → **Comenzar**.
2. Elegí **Gemini Developer API**: es la que tiene nivel gratuito. *Vertex AI* pide plan Blaze.
3. Seguí el asistente. Habilita la API y Firebase guarda la clave de Gemini por vos, así que **nunca** se pone una API key de Gemini en el código.

El modelo está en `MODELO_GEMINI` dentro de `js/firebase.js` (`gemini-flash-lite-latest`, que entra en el nivel gratuito). Los límites gratuitos cambian seguido: miralos en <https://aistudio.google.com> → *Rate limits*. En el nivel gratuito Google puede usar lo que se manda para mejorar sus productos. Por eso el chat no pide ni manda datos personales.

## 5. App Check (obligatorio desde el 2/11/2026)

App Check comprueba que los pedidos a Gemini salen del juego de verdad, así nadie gasta la cuota del proyecto desde otra página. **Desde el 2 de noviembre de 2026, Firebase lo exige para usar AI Logic y no se puede desactivar** ([fuente](https://firebase.google.com/docs/ai-logic/app-check)).

Funciona distinto según dónde se abra el juego:

| Dónde | Cómo se verifica |
| --- | --- |
| `localhost` (tu compu, la del colegio) | Con un **token de depuración** registrado en Firebase. El juego usa un token **fijo** guardado en `js/appcheck-debug.local.js`. |
| GitHub Pages | Con **reCAPTCHA Enterprise**, usando la clave `RECAPTCHA_SITE_KEY` de `js/firebase.js`. |

### 5.1 Token de depuración fijo (para jugar en localhost)

Antes, cada navegador generaba su propio token y había que registrarlos uno por uno. Si faltaba alguno, el chat fallaba con `401 Firebase App Check token is invalid`. Con el token fijo se registra **uno solo** y anda en cualquier compu que tenga el archivo.

1. Abrí `js/appcheck-debug.local.js` y copiá el valor de `TOKEN_DEPURACION` (lo que está entre comillas).
2. Firebase console → **Seguridad → App Check → pestaña Apps** → menú **⋮** al lado de la app web → **Administrar tokens de depuración** → **Agregar token de depuración**.
3. Nombre: `El Laburador (token fijo)`. Valor: pegá el token → **Guardar**.
4. En el navegador, recargá el juego con **Ctrl + F5**.

Sobre el archivo:

- **Es secreto:** con ese token cualquiera podría usar la cuota de Gemini. Está en `.gitignore`, así que **no se sube a GitHub**. Pasalo a otra compu dentro del zip o por un medio privado, nunca por un chat público.
- Si se filtra: borralo en *Administrar tokens de depuración*, generá uno nuevo (cualquier UUID sirve, por ejemplo con el botón *Generar* de esa misma pantalla), pegalo en el archivo y registralo.
- Si el archivo no está, el juego no se rompe: el navegador genera un token propio y lo imprime en la consola (F12) como *"Firebase App Check debug token: …"*. Ese también se puede registrar.

### 5.2 reCAPTCHA Enterprise (para cuando esté publicado)

> **reCAPTCHA v3 "clásico" ya no sirve.** App Check muestra *"reCAPTCHA Classic está obsoleto"*. Hay que usar **reCAPTCHA Enterprise**, que Google ahora incluye dentro de **Google Cloud Fraud Defense**. Tiene 10.000 verificaciones gratis por mes y **no usa clave secreta**. El juego ya viene preparado para Enterprise (`ReCaptchaEnterpriseProvider` en `js/firebase.js`).

1. **La clave.** Tiene que ser una clave **Web**, **basada en puntuación**: sin "casilla de verificación".
   - La que está en `RECAPTCHA_SITE_KEY` (`js/firebase.js`) es `6LdD4fctAAAAAFrDQ5VRhTFuI7jhCfOlkUiyBKhk`. Todavía no se probó en GitHub Pages.
   - Si Firebase no la acepta en el paso 2, creá una nueva en <https://console.cloud.google.com/security/recaptcha>. Arriba elegí el proyecto **el-laburador-9af36** → **Crear clave** → tipo **Web** → destildá la casilla de verificación → dominios. Pegá la nueva en `RECAPTCHA_SITE_KEY`.
   - Dominios de la clave: el de GitHub Pages (`<usuario>.github.io`). En `localhost` App Check no usa reCAPTCHA sino el token de depuración (5.1), así que `localhost` no hace falta (Google recomienda no dejarlo en la clave de producción).
2. **Registrar la app.** Firebase console → **App Check** → **Apps** → tu app web → elegí **reCAPTCHA Enterprise** (no "reCAPTCHA") → pegá la **clave de sitio** → Guardar. No pide clave secreta.
3. **Aplicación forzosa.** **App Check → APIs → Firebase AI Logic** tiene que figurar como *Aplicada* (*Enforced*); desde el 2/11/2026 lo está siempre. Si está *Sin aplicar*, tocá la fila → **Configurar** → **Aplicada** → **Continuar**.

Si App Check falla, la tía responde *"No me llegan tus mensajes: falta habilitar algo en Firebase"* y en la consola (F12) aparece `401 Firebase App Check token is invalid`. En `localhost` casi siempre es porque el token de `js/appcheck-debug.local.js` no está registrado (5.1), o porque el navegador tiene la versión vieja del código: probá con **Ctrl + F5**.

Dos cosas que ya están resueltas en el código, por si vuelven a aparecer:

- **Protección contra repetición (*replay protection*).** AI Logic la tiene activada y solo acepta tokens de App Check **de un solo uso**: con tokens normales responde `401 Firebase App Check token is invalid` aunque el token sea válido. Por eso `js/firebase.js` crea el modelo con `useLimitedUseAppCheckTokens: true`.
- **Registrar el token sin errores de copiado.** Con la CLI de Firebase (`firebase login` y después `firebase appcheck:debugtokens:create <token> --app <app id> --project el-laburador-9af36`) se registra sin pasar por la consola.

## 6. Probar

1. Levantá el juego con un servidor local (ver [README](README.md#en-tu-compu)). Con doble clic en `index.html` no anda.
2. Empezá una partida, cerrá un día (así se autoguarda) y recargá la página: tiene que aparecer **"Continuar partida"**.
3. En Firestore → **Datos** vas a ver `partidas/<uid>` con la partida.
4. Tocá 📱 y preguntale algo a la tía.

Si algo falla, abrí la consola del navegador (F12). Todos los avisos de Firebase empiezan con `[Firebase]`.

## 7. Cuando lo publiques en GitHub Pages

Agregá el dominio `<usuario>.github.io` en:

- **Authentication → Configuración (Settings) → Dominios autorizados**
- Los dominios de la clave de **reCAPTCHA Enterprise** (paso 5.2), en <https://console.cloud.google.com/security/recaptcha>, proyecto `el-laburador-9af36`

## Opcional: usar la CLI en vez de copiar y pegar

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase use --add
```

```bash
firebase deploy --only firestore:rules
```

[`firebase.json`](firebase.json) ya apunta a `firestore.rules`.
