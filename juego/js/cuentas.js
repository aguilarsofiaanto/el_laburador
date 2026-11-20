// Controles de cuenta en la pantalla de inicio.
let cuentaOcupada = false;
let modoCuenta = 'ingresar';

function mensajeCuenta(texto, error = false) {
  const mensaje = document.getElementById('cuentaMensaje');
  mensaje.textContent = texto;
  mensaje.classList.toggle('cuenta-error', error);
}

function actualizarCuenta() {
  const usuario = window.firebaseUsuario;
  const registrada = usuario && !usuario.isAnonymous;
  const lista = window.firebaseEstado === 'ok';
  document.getElementById('cuentaEstado').textContent = registrada
    ? `Sesión: ${usuario.email}`
    : lista ? 'Estás jugando como invitado en este navegador.'
      : window.firebaseEstado === 'error' || window.firebaseEstado === 'desactivado'
        ? 'Sin conexión a tu cuenta. El guardado en la nube no está disponible.'
        : 'Conectando con tu cuenta…';
  document.getElementById('cuentaAcceso').hidden = !!registrada;
  document.getElementById('cuentaSesion').hidden = !registrada;
  document.getElementById('cuentaVerificar').hidden = !registrada || usuario.emailVerified;
  document.querySelectorAll('#cuentaPanel button, #cuentaPanel input').forEach(el => {
    el.disabled = cuentaOcupada || window.inicioOcupado || !lista;
  });
  document.querySelectorAll('#btnContinuar, #btnNuevaPartida').forEach(el => {
    el.disabled = cuentaOcupada || window.inicioOcupado || window.firebaseEstado === 'cargando';
  });
}

function cambiarModoCuenta(modo) {
  modoCuenta = modo;
  const registrar = modo === 'registrar';
  const recuperar = modo === 'recuperar';
  document.getElementById('cuentaClaveGrupo').hidden = recuperar;
  document.getElementById('cuentaConfirmarGrupo').hidden = !registrar;
  document.getElementById('cuentaClave').required = !recuperar;
  document.getElementById('cuentaClave').minLength = registrar ? 6 : 1;
  document.getElementById('cuentaClave').autocomplete = registrar ? 'new-password' : 'current-password';
  document.getElementById('cuentaConfirmar').required = registrar;
  document.getElementById('cuentaEnviar').textContent = registrar
    ? 'Crear cuenta y conservar mi partida' : recuperar ? 'Enviar enlace de recuperación' : 'Iniciar sesión';
  mensajeCuenta('');
}

function errorCuenta(error) {
  const mensajes = {
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Iniciá sesión o recuperá tu contraseña.',
    'auth/credential-already-in-use': 'Ese correo ya tiene una cuenta. Iniciá sesión para usarla.',
    'auth/invalid-email': 'Revisá el formato del correo.',
    'auth/weak-password': 'Elegí una contraseña de al menos 6 caracteres.',
    'auth/password-does-not-meet-requirements': 'La contraseña no cumple los requisitos del proyecto.',
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/wrong-password': 'El correo o la contraseña no son correctos.',
    'auth/user-not-found': 'El correo o la contraseña no son correctos.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada.',
    'auth/too-many-requests': 'Hubo muchos intentos. Esperá un rato y volvé a probar.',
    'auth/network-request-failed': 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.',
    'auth/operation-not-allowed': 'El acceso con correo y contraseña todavía no está habilitado en Firebase.'
  };
  return mensajes[error.code] || 'No se pudo completar la operación. Intentá nuevamente.';
}

async function operarCuenta(accion) {
  if (cuentaOcupada || window.inicioOcupado || window.firebaseEstado !== 'ok' || !window.cuentaFirebase) return;
  cuentaOcupada = true;
  actualizarCuenta();
  mensajeCuenta('Procesando…');
  try {
    await accion();
  } catch (error) {
    console.error('[Cuenta]', error.code || error.message);
    mensajeCuenta(errorCuenta(error), true);
  } finally {
    cuentaOcupada = false;
    document.getElementById('cuentaClave').value = '';
    document.getElementById('cuentaConfirmar').value = '';
    actualizarCuenta();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-modo-cuenta]').forEach(btn => {
    btn.addEventListener('click', () => cambiarModoCuenta(btn.dataset.modoCuenta));
  });
  document.getElementById('cuentaForm').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const correo = document.getElementById('cuentaCorreo').value.trim();
    const clave = document.getElementById('cuentaClave').value;
    if (modoCuenta === 'registrar' && clave !== document.getElementById('cuentaConfirmar').value) {
      mensajeCuenta('Las contraseñas no coinciden.', true);
      return;
    }
    if (modoCuenta === 'ingresar' && window.firebaseUsuario?.isAnonymous &&
        !confirm('Vas a abrir la partida de esa cuenta. Si querés conservar tu partida de invitado en una cuenta nueva, elegí Crear cuenta. ¿Iniciar sesión?')) return;
    operarCuenta(async () => {
      if (modoCuenta === 'registrar') {
        const resultado = await window.cuentaFirebase.registrar(correo, clave);
        mensajeCuenta(resultado.verificacionEnviada
          ? 'Cuenta creada. Conservás tu partida. Revisá tu correo para verificar la dirección.'
          : 'Cuenta creada y partida conservada. No pudimos enviar la verificación; podés volver a intentarlo.');
      } else if (modoCuenta === 'recuperar') {
        await window.cuentaFirebase.recuperar(correo);
        mensajeCuenta('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Revisá también spam.');
      } else {
        await window.cuentaFirebase.ingresar(correo, clave);
        mensajeCuenta('Sesión iniciada. Elegí Continuar partida o Abrir el kiosco.');
      }
    });
  });
  document.getElementById('cuentaSalir').addEventListener('click', () => operarCuenta(async () => {
    await window.cuentaFirebase.salir();
    mensajeCuenta('Sesión cerrada. Tu partida sigue guardada en tu cuenta.');
  }));
  document.getElementById('cuentaVerificar').addEventListener('click', () => operarCuenta(async () => {
    await window.cuentaFirebase.verificar();
    mensajeCuenta('Te enviamos un correo de verificación. Revisá también spam.');
  }));
  window.addEventListener('sesionCambiada', actualizarCuenta);
  window.addEventListener('firebaseListo', actualizarCuenta);
  cambiarModoCuenta('ingresar');
  actualizarCuenta();
});
