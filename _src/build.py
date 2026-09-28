#!/usr/bin/env python3
"""Genera las paginas del sitio, una por idioma, desde _src/plantilla.html
y los textos de _src/textos/<codigo>.json.

    python3 _src/build.py

El ingles vive en la raiz; cada otro idioma en su carpeta (/es/, /fr/, ...).
No edites los index.html a mano: se pisan al regenerar."""

import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "_src"
PREDETERMINADO = "en"

# Orden en que se muestran los idiomas y como se llama cada uno en el suyo.
IDIOMAS = ["es", "en", "fr", "de", "pt", "it", "zh", "hi", "ja", "ar"]

# Las clases son las mismas en todos los idiomas: solo cambian titulo y texto.
VIDEOS = [
    ("FuQt50J9T2I", "♟️"),
    ("qVxvzTLY3pM", "🐍"),
    ("oypNK7dX_rY", "👻"),
    ("AfAFcP5FNVg", "🧠"),
    ("VLwuOLksRy0", "🚀"),
    ("3AMOQ4n1YU0", "🔢"),
    ("ei_hErKm0IM", "🏁"),
]

SCRIPT_IDIOMA = '''
  <!-- Detección de idioma. El inglés es el predeterminado; a quien tenga el
       navegador en uno de los idiomas de abajo se lo manda a esa versión en la
       primera visita. Lo elegido con los enlaces de idioma (?lang=xx) queda en
       localStorage y pesa más que el navegador. Para agregar un idioma, se
       publica /<código>/index.html y se lo suma a AVAILABLE. -->
  <script>
    (function () {
      var AVAILABLE = %s;
      var DEFAULT = "en";
      var params = new URLSearchParams(location.search);
      var store = function (code) { try { localStorage.setItem("dialogo-lang", code); } catch (e) {} };
      var stored = function () { try { return localStorage.getItem("dialogo-lang"); } catch (e) { return null; } };

      // Los enlaces viejos de validación (?token=...) son de la página en español.
      if (params.has("token")) { location.replace("/es/" + location.search); return; }

      var chosen = params.get("lang");
      if (chosen) {
        if (chosen === DEFAULT || AVAILABLE[chosen]) store(chosen);
        if (AVAILABLE[chosen]) { location.replace(AVAILABLE[chosen] + location.hash); return; }
        params.delete("lang");
        var q = params.toString();
        history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
        return;
      }

      var pref = stored();
      if (pref) { if (AVAILABLE[pref]) location.replace(AVAILABLE[pref] + location.hash); return; }

      var langs = navigator.languages || [navigator.language || ""];
      for (var i = 0; i < langs.length; i++) {
        var code = String(langs[i]).toLowerCase().split("-")[0];
        if (code === DEFAULT) return;
        if (AVAILABLE[code]) { location.replace(AVAILABLE[code] + location.hash); return; }
      }
    })();
  </script>
'''

RECUERDA_IDIOMA = '''
  <!-- Idioma elegido: la raíz lo usa para no volver a redirigir -->
  <script>try { localStorage.setItem("dialogo-lang", "%s"); } catch (e) {}</script>
'''

def ruta_de(codigo):
    return "/" if codigo == PREDETERMINADO else "/%s/" % codigo

def cargar(codigo):
    with open(FUENTE / "textos" / ("%s.json" % codigo), encoding="utf-8") as f:
        return json.load(f)

def nav_idiomas(codigo, textos):
    partes = []
    for otro in IDIOMAS:
        nombre = textos[otro]["nombre"]
        if otro == codigo:
            partes.append('        <span class="idioma-actual" aria-current="true" lang="%s">%s</span>' % (otro, nombre))
        else:
            destino = "/?lang=en" if otro == PREDETERMINADO else ruta_de(otro)
            partes.append('        <a href="%s" lang="%s" hreflang="%s" class="text-link hover:text-subtitulo transition">%s</a>'
                          % (destino, otro, otro, nombre))
    return "\n".join(partes)

def hreflangs():
    lineas = ['  <link rel="alternate" hreflang="%s" href="https://dialog.ar%s" />' % (c, ruta_de(c)) for c in IDIOMAS]
    lineas.append('  <link rel="alternate" hreflang="x-default" href="https://dialog.ar/" />')
    return "\n".join(lineas)

def lista(items):
    return "\n".join('          <li>%s</li>' % item for item in items)

def clases(t):
    salida = []
    for (video, emoji), clase in zip(VIDEOS, t["clases"]):
        salida.append('''        <details class="leccion leccion-card bg-white shadow-md rounded-2xl border-l-4 border-indigo-500 transition hover:shadow-xl" data-video="%s">
          <summary class="p-6">
            <h3 class="font-semibold text-xl mb-1 text-subtitulo">%s %s</h3>
            <p class="text-gray-700">%s</p>
          </summary>
          <div class="px-6 pb-6">
            <div class="leccion-video">
              <a href="https://youtu.be/%s" target="_blank" rel="noopener" class="text-link underline">%s</a>
            </div>
          </div>
        </details>''' % (video, emoji, clase["titulo"], clase["texto"], video, t["watch_youtube"]))
    return "\n".join(salida)

def construir(codigo, textos):
    t = textos[codigo]
    plantilla = (FUENTE / "plantilla.html").read_text(encoding="utf-8")

    if codigo == PREDETERMINADO:
        disponibles = {c: ruta_de(c) for c in IDIOMAS if c != PREDETERMINADO}
        script = SCRIPT_IDIOMA % json.dumps(disponibles, ensure_ascii=False)
    else:
        script = RECUERDA_IDIOMA % codigo

    valores = {
        "lang": codigo,
        "dir_attr": ' dir="rtl"' if t.get("dir") == "rtl" else "",
        "url": "https://dialog.ar" + ruta_de(codigo),
        "og_locale": t["og_locale"],
        "og_alternates": "\n".join('  <meta property="og:locale:alternate" content="%s" />' % textos[o]["og_locale"]
                                   for o in IDIOMAS if o != codigo),
        "cc_lang": t.get("cc_lang", codigo),
        "hreflangs": hreflangs(),
        "lang_script": script,
        "language_nav": nav_idiomas(codigo, textos),
        "learners_items": lista(t["para_chicos"]),
        "teachers_items": lista(t["para_docentes"]),
        "lessons": clases(t),
        "id_download": t["ids"]["descarga"],
        "id_course": t["ids"]["curso"],
        "id_research": t["ids"]["investigacion"],
        "extra_scripts": t.get("scripts_extra", ""),
        "step1_label": t["step_format"].replace("{n}", "1"),
        "step2_label": t["step_format"].replace("{n}", "2"),
        "step3_label": t["step_format"].replace("{n}", "3"),
    }
    for clave, valor in t.items():
        if isinstance(valor, str):
            valores.setdefault(clave, valor)

    pagina = plantilla
    for clave, valor in valores.items():
        pagina = pagina.replace("{{%s}}" % clave, str(valor))

    sobrantes = set(__import__("re").findall(r"\{\{(\w+)\}\}", pagina))
    if sobrantes:
        raise SystemExit("faltan textos en %s.json: %s" % (codigo, ", ".join(sorted(sobrantes))))

    destino = RAIZ / "index.html" if codigo == PREDETERMINADO else RAIZ / codigo / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(pagina, encoding="utf-8")
    return destino

def main():
    textos = {c: cargar(c) for c in IDIOMAS}
    for codigo in IDIOMAS:
        destino = construir(codigo, textos)
        print("%-3s -> %s" % (codigo, destino.relative_to(RAIZ)))

if __name__ == "__main__":
    main()
