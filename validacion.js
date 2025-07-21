   async function enviarFormulario(event) {
      event.preventDefault();

      const form = document.getElementById('formulario');
      const mensaje = document.getElementById('mensaje-exito');
      const boton = document.getElementById('boton-enviar');
      const enviando = document.getElementById('mensaje-enviando');

      const codigo = form.querySelector('select[name="codigo"]').value;
      const numero = form.querySelector('input[name="whatsapp"]').value;
      const completo = codigo + numero;

      const datos = new FormData(form);
      datos.set("whatsapp", completo);

      boton.disabled = true;
      boton.classList.add("hidden");
      enviando.classList.remove("hidden");

      try {
        await fetch("https://script.google.com/macros/s/AKfycbz3kY0QW1TI1aICx_edBGw1VlM-3zO3JDacTLl4ScVf4uv9QyHqrxgKos0BbQtMckVhjw/exec", {
          method: "POST",
          body: datos,
        });

        form.style.display = "none";
        mensaje.style.display = "block";
      } catch (error) {
        alert("Hubo un error al enviar el formulario. Intentá de nuevo más tarde o mañana.");
        console.error(error);
      }
    }