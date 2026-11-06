import functools
import http.server
import mimetypes
import os

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("text/css", ".css")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def send_header(self, keyword, value):
        if keyword == "Last-Modified":
            return
        super().send_header(keyword, value)


racine = os.path.dirname(os.path.abspath(__file__))
port = int(os.environ.get("PORT", "8790"))
gestionnaire = functools.partial(Handler, directory=racine)
http.server.ThreadingHTTPServer(("127.0.0.1", port), gestionnaire).serve_forever()
