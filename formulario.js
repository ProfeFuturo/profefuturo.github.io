 window.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      mostrarCartelCarga();

      try {
        const resp = await fetch(`https://script.google.com/macros/s/AKfycbzvYAQFCKzzIQI6orJseiBruRGl9EYmqY-9bf_LdtoBZUC10pcgejfgupQAdiKluc_wKg/exec?token=${token}`);
        const texto = await resp.text();
        if (texto.trim() === "OK") {
          mostrarCartelVerificado();
        } else {
          mostrarCartelError();
        }
      } catch (e) {
        console.error("Error al verificar el token:", e);
        mostrarCartelError();
      }
    }
  });

  function mostrarCartelCarga() {
    const cartel = document.createElement("div");
    cartel.id = "cartel-validacion";
    cartel.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    cartel.innerHTML = `
<div class="bg-white rounded-xl p-6 shadow-lg w-full max-w-md mx-4 text-center animate-pulse">
        <p class="text-lg text-gray-700">🔄 Validando tu email...</p>
      </div>
    `;
    document.body.appendChild(cartel);
  }

  function mostrarCartelVerificado() {
    const cartel = document.getElementById("cartel-validacion");
    cartel.innerHTML = `
<div class="bg-white rounded-xl p-6 shadow-lg w-full max-w-md mx-4 text-center animate-pulse">
        <h2 class="text-2xl font-semibold text-green-600">🎉 ¡Felicitaciones!</h2>
        <p class="mt-2 text-gray-700">Validaste tu email correctamente.</p>
        <p class="mt-2 text-sm text-gray-500">El <strong>1 de agosto</strong> te enviaremos el acceso a <strong>Diálogo</strong>.</p>
        <button onclick="document.getElementById('cartel-validacion').remove()" class="w-full bg-acento hover:bg-subtitulo text-white font-bold py-3 rounded-xl shadow-md transition">Cerrar</button>
      </div>
    `;
  }

  function mostrarCartelError() {
    const cartel = document.getElementById("cartel-validacion");
    cartel.innerHTML = `
<div class="bg-white rounded-xl p-6 shadow-lg w-full max-w-md mx-4 text-center animate-pulse">
        <h2 class="text-2xl font-semibold text-red-600">❌ Token inválido</h2>
        <p class="mt-2 text-gray-700">El enlace de validación es incorrecto o ya fue usado.</p>
        <button onclick="document.getElementById('cartel-validacion').remove()" class="mt-4 px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600">Cerrar</button>
      </div>
    `;
  }