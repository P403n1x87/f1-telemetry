import http.server
from pathlib import Path


PORT = 20776

Handler = lambda *args: http.server.SimpleHTTPRequestHandler(
    *args, directory=str(Path(__file__).parent / "webapp")
)


def serve(org, token, host="localhost", port=PORT):
    with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
        print(
            f"Telemetry app URL: http://{host}:{port}/index.html?org={org}&token={token}&host={host}"
        )

        httpd.serve_forever()
