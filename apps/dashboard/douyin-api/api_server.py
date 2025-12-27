#!/usr/bin/env python3
"""
抖音登录 API 服务
运行在 VPS 上，供后端调用
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import os
import threading

PORT = 9876
login_process = None  # 后台登录进程

class DouyinAPIHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        
        try:
            data = json.loads(body) if body else {}
        except:
            data = {}
        
        action = data.get('action', 'get-qrcode')
        
        if self.path == '/douyin/qrcode' or action == 'get-qrcode':
            result = self.get_qrcode()
        elif self.path == '/douyin/status' or action == 'check-status':
            result = self.check_status()
        elif self.path == '/douyin/validate' or action == 'validate':
            result = self.validate_cookies()
        elif self.path == '/douyin/scrape':
            result = self.scrape_data()
        else:
            result = {'error': 'Unknown endpoint'}
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
    
    def do_GET(self):
        if self.path == '/health':
            result = {'status': 'ok'}
        elif self.path == '/douyin/status':
            result = self.check_status()
        elif self.path == '/douyin/validate':
            result = self.validate_cookies()
        else:
            result = {'error': 'Use POST'}
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def get_qrcode(self):
        global login_process
        try:
            # 如果有旧的登录进程，先终止
            if login_process and login_process.poll() is None:
                login_process.terminate()
                login_process.wait(timeout=5)
                login_process = None

            script_path = '/app/login.py' if os.path.exists('/app/login.py') else os.path.expanduser('~/.douyin/login.py')

            # 使用 --wait-login 模式，同一个浏览器会话获取二维码并等待登录
            # 设置 unbuffered 输出
            env = os.environ.copy()
            env['PYTHONUNBUFFERED'] = '1'

            login_process = subprocess.Popen(
                ['python3', '-u', script_path, '--wait-login', '--timeout', '300'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )

            # 读取第一行输出（二维码 JSON）
            # 设置超时
            import select
            ready, _, _ = select.select([login_process.stdout], [], [], 90)
            if ready:
                first_line = login_process.stdout.readline()
                if first_line:
                    return json.loads(first_line.strip())

            return {'success': False, 'error': 'Timeout waiting for QR code'}
        except Exception as e:
            if login_process:
                login_process.terminate()
            return {'success': False, 'error': str(e)}
    
    def check_status(self):
        try:
            script_path = '/app/login.py' if os.path.exists('/app/login.py') else os.path.expanduser('~/.douyin/login.py')
            result = subprocess.run(
                ['python3', script_path, '--check-status'],
                capture_output=True, text=True, timeout=30
            )
            return json.loads(result.stdout) if result.stdout else {'success': False, 'error': 'No output'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def validate_cookies(self):
        try:
            script_path = '/app/login.py' if os.path.exists('/app/login.py') else os.path.expanduser('~/.douyin/login.py')
            result = subprocess.run(
                ['python3', script_path, '--validate'],
                capture_output=True, text=True, timeout=90
            )
            return json.loads(result.stdout) if result.stdout else {'success': False, 'error': 'No output'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def scrape_data(self):
        try:
            result = subprocess.run(
                ['python3', os.path.expanduser('~/.douyin/creator_scraper.py')],
                capture_output=True, text=True, timeout=120
            )
            return json.loads(result.stdout)
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def log_message(self, format, *args):
        pass  # 静默日志

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), DouyinAPIHandler)
    print(f'Douyin API Server running on port {PORT}')
    server.serve_forever()
