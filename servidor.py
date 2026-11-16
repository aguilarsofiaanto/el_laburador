# ==========================================================
# Servidor local para jugar El Laburador.
# Es igual que "python -m http.server", pero le pide al navegador
# que NO guarde los archivos en caché: así, cada vez que se cambia
# el código, al recargar la página se ve la versión nueva.
#
# Uso:  python servidor.py          (puerto 5517)
#       python servidor.py 8080     (otro puerto)
# ==========================================================

import http.server
import os
import sys


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 5517
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f'El Laburador en http://localhost:{puerto} (Ctrl+C para apagar)', flush=True)
    http.server.ThreadingHTTPServer(('', puerto), SinCache).serve_forever()
