// Firebase conserva la sesión en el navegador. Nunca almacenamos contraseñas.
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  EmailAuthProvider, linkWithCredential, signOut,
  sendPasswordResetEmail, sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

export function inicializarSesion(app, avisarListo) {
  const auth = getAuth(app);
  let creandoInvitado = false;

  function publicar(usuario) {
    // Otra pestaña puede cambiar la cuenta. Nunca guardar el juego que
    // estaba en memoria en la cuenta nueva.
    const cambioEnPartida = typeof juegoIniciado !== 'undefined' && juegoIniciado &&
      window.partidaUid !== usuario?.uid;
    const cambioDuranteInicio = window.inicioOcupado && window.firebaseUid &&
      window.firebaseUid !== usuario?.uid;
    if (cambioEnPartida || cambioDuranteInicio) {
      window.firebaseUid = null;
      window.firebaseEstado = 'cargando';
      location.reload();
      return;
    }
    window.firebaseUsuario = usuario;
    window.firebaseUid = usuario?.uid || null;
    avisarListo(usuario ? 'ok' : 'cargando');
    window.dispatchEvent(new Event('sesionCambiada'));
  }

  onAuthStateChanged(auth, async (usuario) => {
    if (usuario) {
      publicar(usuario);
    } else {
      publicar(null);
      if (creandoInvitado) return;
      creandoInvitado = true;
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error('[Firebase] No se pudo crear la sesión de invitado:', error);
        avisarListo('error');
      } finally {
        creandoInvitado = false;
      }
    }
  }, (error) => {
    console.error('[Firebase] Error de sesión:', error);
    avisarListo('error');
  });

  window.cuentaFirebase = {
    async registrar(correo, clave) {
      const usuario = auth.currentUser;
      if (usuario && !usuario.isAnonymous) throw new Error('Ya tenés una sesión iniciada.');
      const resultado = usuario
        ? await linkWithCredential(usuario, EmailAuthProvider.credential(correo, clave))
        : await createUserWithEmailAndPassword(auth, correo, clave);
      // Vincular conserva el uid y la partida anónima; no copia ni pisa datos.
      publicar(resultado.user);
      let verificacionEnviada = true;
      try {
        await sendEmailVerification(resultado.user);
      } catch (error) {
        console.error('[Firebase] Cuenta creada; no se pudo enviar la verificación:', error);
        verificacionEnviada = false;
      }
      return { verificacionEnviada };
    },
    async ingresar(correo, clave) {
      const resultado = await signInWithEmailAndPassword(auth, correo, clave);
      publicar(resultado.user);
    },
    salir: () => signOut(auth),
    recuperar: (correo) => sendPasswordResetEmail(auth, correo),
    verificar: () => sendEmailVerification(auth.currentUser)
  };
}
