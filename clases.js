// Abre el video de cada clase dentro de la misma página. Sin JS, el panel
// muestra el enlace a YouTube, así que nadie se queda sin la clase.
(function () {
  var lecciones = document.querySelectorAll("details.leccion");
  if (!lecciones.length) return;

  var lang = (document.documentElement.lang || "en").slice(0, 2);
  // Código de la pista de subtítulos subida a YouTube, que no siempre es el del
  // idioma: el español está subido como es-419. Viene del JSON de cada idioma.
  var ccLang = document.documentElement.getAttribute("data-cc-lang") || lang;

  function caja(d) { return d.querySelector(".leccion-video"); }

  function mostrar(d) {
    var box = caja(d);
    if (!box || box.querySelector("iframe")) return;
    var id = d.getAttribute("data-video");
    if (!id) return;
    var titulo = d.querySelector("summary h3, summary");
    var iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube.com/embed/" + id +
      "?autoplay=1&rel=0&hl=" + lang +
      "&cc_load_policy=1&cc_lang_pref=" + encodeURIComponent(ccLang);
    iframe.title = titulo ? titulo.textContent.trim() : "Diálogo";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "");
    box.textContent = "";
    box.appendChild(iframe);
  }

  function ocultar(d) {
    var box = caja(d);
    if (!box) return;
    var respaldo = box.getAttribute("data-fallback");
    if (respaldo !== null) box.innerHTML = respaldo;
  }

  lecciones.forEach(function (d) {
    var box = caja(d);
    if (box) box.setAttribute("data-fallback", box.innerHTML);

    d.addEventListener("toggle", function () {
      if (!d.open) { ocultar(d); return; }
      // una sola clase abierta a la vez: cerrar las otras detiene sus videos
      lecciones.forEach(function (otra) {
        if (otra !== d && otra.open) { otra.open = false; ocultar(otra); }
      });
      mostrar(d);
    });
  });
})();
