// ==========================================================
// FIREBASE — guardado en la nube + chatbot (Gemini)
//
// Este archivo es un módulo (type="module") porque así se usa el
// SDK de Firebase. Los demás scripts del juego NO son módulos, así
// que todo lo que necesitan se deja colgado de window.
//
// Si la configuración no está pegada, el juego anda igual, pero
// sin guardado y sin chatbot. La guía completa está en FIREBASE.md
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { inicializarSesion } from "./sesion.js";
import {
  initializeAppCheck, ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js";
import {
  getAI, getGenerativeModel, GoogleAIBackend, ResponseModality
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-ai.js";


// ----------------------------------------------------------
// >>> PEGÁ ACÁ LA CONFIGURACIÓN DE TU PROYECTO <<<
// Firebase console → ⚙ Configuración del proyecto → General →
// "Tus apps" → la app web → "Configuración del SDK" (npm/CDN).
// Esta clave SÍ puede ser pública: lo que protege los datos son
// las reglas de Firestore (firestore.rules).
// ----------------------------------------------------------
const firebaseConfig = {
  apiKey:            "AIzaSyC8ruXf5rULfQOtbN68pGuFP6J6CYspZ7g",
  authDomain:        "el-laburador-9af36.firebaseapp.com",
  projectId:         "el-laburador-9af36",
  storageBucket:     "el-laburador-9af36.firebasestorage.app",
  messagingSenderId: "430551829036",
  appId:             "1:430551829036:web:23786161f827ccdd159f89",
  measurementId:     "G-01C09NRGS3"
};

// Clave de sitio de reCAPTCHA Enterprise (Google Cloud "Fraud Defense")
// para App Check. Protege la cuota de Gemini para que nadie la use
// desde afuera del juego. Es pública: va en el código sin problema.
// Desde el 2/11/2026 Firebase exige App Check para usar AI Logic,
// así que no se puede apagar. En localhost se usa el token de
// depuración fijo de js/appcheck-debug.local.js (ver FIREBASE.md, paso 5).
const RECAPTCHA_SITE_KEY = "6LdD4fctAAAAAFrDQ5VRhTFuI7jhCfOlkUiyBKhk";

// Modelo de Gemini del chatbot. "-latest" apunta siempre al
// Flash-Lite más nuevo, que entra en el nivel gratuito.
const MODELO_GEMINI = "gemini-flash-lite-latest";

// Voz de la tía: modelo de texto a voz de Gemini y la voz elegida.
// "Gacrux" es una voz femenina "madura"; otras: Sulafat (cálida),
// Achernar (suave), Kore (firme). Lista completa en la documentación
// de Gemini TTS. Si el modelo cambia de nombre, se cambia acá.
const MODELO_VOZ = "gemini-3.1-flash-tts-preview";
const VOZ_TIA = "Gacrux";


// ==========================================================
// De acá para abajo no hace falta tocar nada
// ==========================================================

const configurado = !Object.values(firebaseConfig).some(v => String(v).includes('PEGAR_ACA'));

// Le avisa al resto del juego (guardado.js) que Firebase terminó
// de arrancar, bien o mal: 'ok' | 'desactivado' | 'error'
function avisarListo(estado) {
  window.firebaseEstado = estado;
  window.dispatchEvent(new Event('firebaseListo'));
}

function prepararChatbot(app) {
  try {
    // useLimitedUseAppCheckTokens: AI Logic tiene activada la "protección
    // contra repetición" (replay protection) y solo acepta tokens de App
    // Check de UN SOLO USO. Con tokens normales responde 401
    // "Firebase App Check token is invalid" aunque el token sea válido.
    const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
    const modelo = getGenerativeModel(ai, {
      model: MODELO_GEMINI,
      systemInstruction: window.INSTRUCCIONES_TIA || ''
    });

    let charla = modelo.startChat();

    // Una charla nueva por día de juego: así el historial no crece
    // sin límite (y no se gastan tokens de más)
    window.tiaNuevaCharla = () => { charla = modelo.startChat(); };
    window.tiaEnviar = async (texto) => {
      const resultado = await charla.sendMessage(texto);
      return resultado.response.text();
    };
    window.tiaDisponible = true;

    // Voz: el modelo de texto a voz devuelve audio PCM crudo (24 kHz,
    // mono, 16 bits) en pedacitos. tiaVozStream los va entregando a
    // medida que llegan, así js/voz.js los reproduce sin esperar al final.
    const modeloVoz = getGenerativeModel(ai, {
      model: MODELO_VOZ,
      generationConfig: {
        responseModalities: [ResponseModality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ_TIA } } }
      }
    });
    window.tiaVozStream = async function* (texto) {
      const resultado = await modeloVoz.generateContentStream(texto);
      for await (const pedazo of resultado.stream) {
        const partes = (pedazo.candidates && pedazo.candidates[0] && pedazo.candidates[0].content &&
                        pedazo.candidates[0].content.parts) || [];
        for (const parte of partes) {
          if (parte.inlineData) yield parte.inlineData;   // { mimeType, data (base64) }
        }
      }
    };
  } catch (e) {
    console.error('[Firebase] No se pudo preparar el chatbot:', e);
    window.tiaDisponible = false;
  }
}

if (!configurado) {
  console.warn('[Firebase] Falta pegar la configuración en js/firebase.js. ' +
               'El juego anda, pero sin guardado ni chatbot.');
  window.tiaDisponible = false;
  avisarListo('desactivado');
} else {
  try {
    const app = initializeApp(firebaseConfig);

    if (RECAPTCHA_SITE_KEY) {
      // En tu compu (localhost) App Check no usa reCAPTCHA sino un
      // "token de depuración" registrado en Firebase console → App Check
      // → Apps → ⋮ → Administrar tokens de depuración.
      // Si existe js/appcheck-debug.local.js se usa el token FIJO que
      // tiene adentro: se registra una sola vez y anda en cualquier
      // compu que tenga ese archivo. El archivo es secreto (daría acceso
      // a cualquiera), por eso está en .gitignore y no se sube a GitHub.
      // Si no existe, el navegador genera un token propio y lo imprime
      // en la consola (F12): hay que registrar ese.
      if (['localhost', '127.0.0.1'].includes(location.hostname)) {
        const local = await import('./appcheck-debug.local.js').catch(() => null);
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = (local && local.TOKEN_DEPURACION) || true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    }

    // Firestore: como el resto del juego no son módulos, las
    // funciones se dejan en window para usarlas desde guardado.js
    window.firebaseDB = getFirestore(app);
    window.firebaseDoc = doc;
    window.firebaseSetDoc = setDoc;
    window.firebaseGetDoc = getDoc;
    window.firebaseDeleteDoc = deleteDoc;

    prepararChatbot(app);

    inicializarSesion(app, avisarListo);
  } catch (e) {
    console.error('[Firebase] Error al iniciar:', e);
    window.tiaDisponible = false;
    avisarListo('error');
  }
}
