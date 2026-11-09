"""Test server for the SW update test: serves dist (v1) or a copy with a new version (v2), and can make one file fail.
GET /__mode?v=1|2&fail=<path or empty>   switches mode.  usage: python3 tests/two_version_server.py DIST PORT"""
import http.server, os, re, shutil, sys, tempfile, urllib.parse, json
DIST, PORT = os.path.abspath(sys.argv[1]), int(sys.argv[2])
V2 = tempfile.mkdtemp(prefix='rs1v2-'); shutil.rmtree(V2); shutil.copytree(DIST, V2)
sw = open(f'{V2}/sw.js', encoding='utf-8').read(); old = re.search(r"const VERSION = '([^']+)'", sw).group(1)
open(f'{V2}/sw.js', 'w', encoding='utf-8').write(sw.replace(f"const VERSION = '{old}'", "const VERSION = 'testv2'"))
al = json.load(open(f'{V2}/asset-list.json')); al['version'] = 'testv2'; json.dump(al, open(f'{V2}/asset-list.json', 'w'))
MODE = {'v': '1', 'fail': ''}
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        root = DIST if MODE['v'] == '1' else V2
        rel = urllib.parse.unquote(urllib.parse.urlparse(path).path).lstrip('/')
        return os.path.join(root, rel)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/__mode':
            q = urllib.parse.parse_qs(u.query); MODE['v'] = q.get('v', ['1'])[0]; MODE['fail'] = q.get('fail', [''])[0]
            self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(MODE).encode()); return
        if MODE['fail'] and u.path.endswith(MODE['fail']):
            self.send_response(503); self.end_headers(); return
        return super().do_GET()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
