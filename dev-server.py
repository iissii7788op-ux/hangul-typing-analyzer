# 개발용 정적 서버.
#
# python -m http.server 는 캐시 관련 헤더를 보내지 않아서, 브라우저가 알아서
# css/js 를 캐시해 둔다. 그래서 파일을 고쳐도 화면이 그대로인 일이 생긴다.
# 여기서는 "저장하지 말고 매번 새로 받아라" 헤더를 붙여 그 문제를 막는다.
#
# 실행: python dev-server.py   ->  http://localhost:8000

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    print(f'http://localhost:{PORT} 에서 실행 중 · 멈추려면 Ctrl+C')
    ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler).serve_forever()
