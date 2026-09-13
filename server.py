import base64
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import zipfile
from http.server import HTTPServer, BaseHTTPRequestHandler

import ocr_engine
from bulletin_client import BulletinClient

PORT = 8088
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
DEFAULT_DOWNLOADS = os.path.join(BASE_DIR, "downloads")
TEMP_DIR = os.path.join(BASE_DIR, ".temp")
os.makedirs(DEFAULT_DOWNLOADS, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# Global client
bulletin_client = BulletinClient()

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {
        "output_dir": DEFAULT_DOWNLOADS,
        "username": "",
        "cookie": "",
        "auto_open": True
    }

def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

# Initialize client with saved cookies or credentials
cfg = load_config()
if cfg.get("cookie"):
    bulletin_client.set_cookie_string(cfg["cookie"])

class BulletinAppHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, message, status=400):
        self._send_json({"success": False, "error": message}, status)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/config":
            c = load_config()
            # mask sensitive info
            safe_c = dict(c)
            safe_c["has_cookie"] = bool(c.get("cookie"))
            self._send_json(safe_c)
            return

        if path.startswith("/api/bulletin/"):
            bid = path.replace("/api/bulletin/", "").strip()
            info = bulletin_client.get_bulletin_detail(bid)
            self._send_json(info)
            return

        if path == "/api/history":
            c = load_config()
            out_dir = c.get("output_dir", DEFAULT_DOWNLOADS)
            history = []
            if os.path.exists(out_dir):
                for item in sorted(os.listdir(out_dir), reverse=True):
                    sub = os.path.join(out_dir, item)
                    if os.path.isdir(sub):
                        meta_file = os.path.join(sub, "metadata.json")
                        if os.path.exists(meta_file):
                            try:
                                with open(meta_file, "r", encoding="utf-8") as f:
                                    meta = json.load(f)
                                    history.append(meta)
                                    continue
                            except:
                                pass
                        # Fallback if no metadata.json
                        m = re.match(r'^\[(\d+)\]\s*(.*)$', item)
                        if m:
                            history.append({
                                "bulletin_id": m.group(1),
                                "title": m.group(2),
                                "folder_name": item,
                                "folder_path": sub,
                                "files": [{"filename": f, "size": os.path.getsize(os.path.join(sub, f))} for f in os.listdir(sub)]
                            })
            self._send_json({"success": True, "history": history[:30]})
            return

        if path.startswith("/api/zip/"):
            bid = path.replace("/api/zip/", "").strip()
            c = load_config()
            out_dir = c.get("output_dir", DEFAULT_DOWNLOADS)
            target_folder = None
            if os.path.exists(out_dir):
                for item in os.listdir(out_dir):
                    if item.startswith(f"[{bid}]"):
                        target_folder = os.path.join(out_dir, item)
                        break

            if not target_folder or not os.path.exists(target_folder):
                self._send_error("找不到該公告的資料夾", 404)
                return

            zip_filename = f"公告_{bid}.zip"
            zip_tmp = os.path.join(TEMP_DIR, zip_filename)
            with zipfile.ZipFile(zip_tmp, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, _, files in os.walk(target_folder):
                    for file in files:
                        p = os.path.join(root, file)
                        rel_p = os.path.relpath(p, target_folder)
                        zf.write(p, rel_p)

            with open(zip_tmp, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            encoded_fn = urllib.parse.quote(zip_filename)
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{encoded_fn}")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        # Static files
        if path == "/" or path == "/index.html":
            file_path = os.path.join(STATIC_DIR, "index.html")
        else:
            rel_path = path.lstrip("/")
            file_path = os.path.join(STATIC_DIR, rel_path)

        if os.path.exists(file_path) and os.path.isfile(file_path):
            ctype, _ = mimetypes.guess_type(file_path)
            if not ctype:
                ctype = "application/octet-stream"
            if ctype.startswith("text/") or ctype in ["application/javascript", "application/json"]:
                ctype += "; charset=utf-8"

            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_len)

        try:
            req_data = json.loads(post_body.decode('utf-8')) if post_body else {}
        except:
            req_data = {}

        if path == "/api/ocr":
            # Expects { "image": "data:image/...;base64,..." }
            img_b64 = req_data.get("image", "")
            if not img_b64:
                self._send_error("未提供圖片資料")
                return

            # Strip data url prefix
            if "," in img_b64:
                img_b64 = img_b64.split(",", 1)[1]

            try:
                img_bytes = base64.b64decode(img_b64)
                temp_img_path = os.path.join(TEMP_DIR, "current_receipt.jpg")
                with open(temp_img_path, "wb") as f:
                    f.write(img_bytes)

                # Run OCR
                res = ocr_engine.run_ocr(temp_img_path)
                res["temp_image_path"] = temp_img_path
                self._send_json(res)
            except Exception as e:
                self._send_error(f"圖片解析或 OCR 失敗: {str(e)}")
            return

        if path == "/api/download":
            bid = req_data.get("bulletin_id")
            if not bid:
                self._send_error("請提供公告編號")
                return

            screenshot_path = req_data.get("screenshot_path")
            if not screenshot_path or not os.path.exists(screenshot_path):
                # Check if current_receipt exists
                default_receipt = os.path.join(TEMP_DIR, "current_receipt.jpg")
                if os.path.exists(default_receipt):
                    screenshot_path = default_receipt

            fallback_meta = req_data.get("fallback_meta", {})
            c = load_config()
            out_root = c.get("output_dir", DEFAULT_DOWNLOADS)

            try:
                res = bulletin_client.download_bulletin(
                    bid=bid,
                    output_root=out_root,
                    screenshot_path=screenshot_path,
                    fallback_meta=fallback_meta
                )

                # Auto open folder if enabled
                if c.get("auto_open", True) and res.get("folder_path"):
                    try:
                        subprocess.Popen(["explorer.exe", res["folder_path"]])
                    except Exception as ex:
                        print(f"Failed to auto-open explorer: {ex}")

                self._send_json(res)
            except Exception as e:
                self._send_error(f"下載失敗: {str(e)}")
            return

        if path == "/api/open-folder":
            fpath = req_data.get("folder_path")
            if not fpath or not os.path.exists(fpath):
                self._send_error("資料夾路徑不存在")
                return

            try:
                subprocess.Popen(["explorer.exe", fpath])
                self._send_json({"success": True, "message": "已開啟資料夾"})
            except Exception as e:
                self._send_error(f"開啟資料夾失敗: {str(e)}")
            return

        if path == "/api/config":
            c = load_config()
            if "output_dir" in req_data:
                new_dir = req_data["output_dir"].strip()
                if new_dir:
                    os.makedirs(new_dir, exist_ok=True)
                    c["output_dir"] = new_dir
            if "auto_open" in req_data:
                c["auto_open"] = bool(req_data["auto_open"])
            if "cookie" in req_data:
                c["cookie"] = req_data["cookie"].strip()
                bulletin_client.set_cookie_string(c["cookie"])
            save_config(c)
            self._send_json({"success": True, "config": c})
            return

        if path == "/api/login":
            user = req_data.get("username", "").strip()
            pwd = req_data.get("password", "").strip()
            cookie_str = req_data.get("cookie", "").strip()

            c = load_config()
            if cookie_str:
                bulletin_client.set_cookie_string(cookie_str)
                c["cookie"] = cookie_str
                save_config(c)
                self._send_json({"success": True, "message": "已套用自訂 Cookie"})
                return

            if not user or not pwd:
                self._send_error("請輸入帳號與密碼")
                return

            login_res = bulletin_client.login(user, pwd)
            if login_res.get("success"):
                c["username"] = user
                # save cookies
                cookies = "; ".join([f"{k}={v}" for k, v in bulletin_client.session.cookies.items()])
                c["cookie"] = cookies
                save_config(c)
            self._send_json(login_res)
            return

        self._send_error("未知的 API 端點", 404)

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, BulletinAppHandler)
    print(f"==================================================")
    print(f" 臺南市教育公告 OCR 自動下載助手伺服器已啟動")
    print(f" 網頁網址: http://localhost:{PORT}")
    print(f" 預設下載目錄: {DEFAULT_DOWNLOADS}")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n伺服器已停止。")

if __name__ == '__main__':
    run_server()
