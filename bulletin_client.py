import json
import os
import re
import shutil
import urllib.parse
import requests
from bs4 import BeautifulSoup
import urllib3
urllib3.disable_warnings()

BASE_URL = "https://bulletin.tn.edu.tw"

class BulletinClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        })
        self.is_logged_in = False
        self.logged_in_user = None

    def set_cookie_string(self, cookie_str):
        if not cookie_str:
            return
        parts = cookie_str.split(';')
        for p in parts:
            if '=' in p:
                k, v = p.strip().split('=', 1)
                self.session.cookies.set(k, v)

    def login(self, username, password):
        """
        Logs in to Tainan Education Bulletin via Login.aspx
        """
        login_url = f"{BASE_URL}/Login.aspx"
        try:
            r = self.session.get(login_url, verify=False, timeout=15)
            soup = BeautifulSoup(r.text, 'html.parser')
            form = soup.find('form')
            if not form:
                return {"success": False, "error": "無法取得登入表單"}

            action = form.get('action', './Login.aspx')
            post_url = urllib.parse.urljoin(login_url, action)

            data = {}
            for inp in form.find_all('input'):
                name = inp.get('name')
                val = inp.get('value', '')
                if name and inp.get('type') not in ['submit', 'image']:
                    data[name] = val

            data['ctl00$ContentPlaceHolder1$ucLogin1$txtUserID'] = username
            data['ctl00$ContentPlaceHolder1$ucLogin1$txtPassword'] = password
            data['ctl00$ContentPlaceHolder1$ucLogin1$imgGo.x'] = '25'
            data['ctl00$ContentPlaceHolder1$ucLogin1$imgGo.y'] = '10'

            headers = {
                'Referer': login_url,
                'Origin': BASE_URL,
            }

            r2 = self.session.post(post_url, data=data, headers=headers, verify=False, timeout=15)
            # Check login result
            if "登出" in r2.text or "SignOut" in r2.text or "lblUser" in r2.text:
                self.is_logged_in = True
                self.logged_in_user = username
                return {"success": True, "message": "登入成功"}

            # Check if there is an alert or failure text
            soup2 = BeautifulSoup(r2.text, 'html.parser')
            err_span = soup2.find(id=lambda x: x and ('lblError' in x or 'lab_Alert' in x))
            err_msg = err_span.get_text(strip=True) if err_span else "帳號或密碼錯誤"
            return {"success": False, "error": err_msg}
        except Exception as e:
            return {"success": False, "error": f"登入連線異常: {str(e)}"}

    def get_bulletin_detail(self, bid):
        """
        Fetches metadata, content, and attachment links for the given bulletin ID.
        """
        url = f"{BASE_URL}/ViewDetail.aspx?bid={bid}"
        try:
            r = self.session.get(url, verify=False, timeout=15)
            r.encoding = 'utf-8'
            soup = BeautifulSoup(r.text, 'html.parser')

            # Check if login is required
            needs_login = False
            alert_elem = soup.find(id="lab_NoDataAlert")
            if alert_elem and "登入" in alert_elem.get_text():
                needs_login = True

            # Extract rules table if present
            rules = []
            rule_table = soup.find(id="gv_BrowserRule")
            if rule_table:
                for row in rule_table.find_all('tr')[1:]:
                    cols = [c.get_text(strip=True) for c in row.find_all(['td', 'th'])]
                    if len(cols) >= 3:
                        rules.append({'target': cols[0], 'view': cols[1], 'download': cols[2]})

            # Title
            title_elem = soup.find(id=lambda x: x and "lab3" in x) or soup.find(id=lambda x: x and "Subject" in x)
            title = title_elem.get_text(strip=True) if title_elem else ""

            # Fields from table
            office = ""
            poster = ""
            date_range = ""
            date_posted = ""
            sign_status = ""
            doc_no = ""
            recipients = ""

            for tr in soup.find_all('tr'):
                text = tr.get_text(separator=' | ', strip=True)
                if "公告單位" in text:
                    m = re.search(r'公告單位[:：\s]*([^|]+)', text)
                    if m: office = m.group(1).strip()
                if "公告人" in text:
                    m = re.search(r'公告人[:：\s]*([^|]+)', text)
                    if m: poster = m.group(1).strip()
                if "公告期間" in text:
                    m = re.search(r'公告期間[:：\s]*([^|]+)', text)
                    if m: date_range = m.group(1).strip()
                if "發佈日" in text:
                    m = re.search(r'發佈日[:：\s]*([^|]+)', text)
                    if m: date_posted = m.group(1).strip()
                if "公文文號" in text:
                    m = re.search(r'公文文號[:：\s]*([^|]+)', text)
                    if m: doc_no = m.group(1).strip()
                if "受文單位" in text:
                    m = re.search(r'受文單位[:：\s]*([^|]+)', text)
                    if m: recipients = m.group(1).strip()

            # Content body
            content_html = ""
            content_text = ""
            content_td = soup.find('td', bgcolor="#efefe7")
            if content_td:
                # Remove views span
                for s in content_td.find_all('span', style=lambda st: st and "background:white" in st):
                    s.decompose()
                content_html = str(content_td)
                content_text = content_td.get_text(separator='\n', strip=True)

            # Attachments
            attachments = []
            dl_panel = soup.find(id=lambda x: x and "dl_Files" in x)
            if dl_panel:
                for a in dl_panel.find_all('a'):
                    href = a.get('href', '')
                    fname = a.get_text(strip=True)
                    m = re.search(r"__doPostBack\('([^']+)'", href)
                    if m:
                        target = m.group(1)
                        attachments.append({
                            'filename': fname,
                            'target': target,
                            'ext': os.path.splitext(fname)[1].lower()
                        })

            return {
                "success": True,
                "bulletin_id": str(bid),
                "title": title,
                "office": office,
                "poster": poster,
                "date_range": date_range,
                "date_posted": date_posted,
                "doc_no": doc_no,
                "sign_status": sign_status,
                "recipients": recipients,
                "content_html": content_html,
                "content_text": content_text,
                "rules": rules,
                "needs_login": needs_login,
                "attachments": attachments,
                "html_raw": r.text
            }
        except Exception as e:
            return {"success": False, "error": f"取得公告資訊失敗: {str(e)}"}

    def download_bulletin(self, bid, output_root="d:\\agy\\20260913\\downloads", screenshot_path=None, fallback_meta=None, cookie_str=None):
        """
        Creates folder and downloads all attachments and content.
        """
        if cookie_str:
            self.set_cookie_string(cookie_str)

        bid = str(bid).strip()
        info = self.get_bulletin_detail(bid)

        # Merge fallback metadata from OCR if official page is restricted or missing info
        if fallback_meta:
            if not info.get("title") and fallback_meta.get("title"):
                info["title"] = fallback_meta["title"]
            if not info.get("office") and fallback_meta.get("office"):
                info["office"] = fallback_meta["office"]
            if not info.get("date_posted") and fallback_meta.get("date"):
                info["date_posted"] = fallback_meta["date"]
            if not info.get("doc_no") and fallback_meta.get("doc_no"):
                info["doc_no"] = fallback_meta["doc_no"]
            if not info.get("sign_status") and fallback_meta.get("sign_status"):
                info["sign_status"] = fallback_meta["sign_status"]

        title = info.get("title", "").strip() or f"公告_{bid}"
        safe_title = re.sub(r'[\\/*?:"<>|]', '_', title)[:70].strip()
        folder_name = f"[{bid}] {safe_title}"
        target_dir = os.path.join(output_root, folder_name)
        os.makedirs(target_dir, exist_ok=True)

        downloaded_files = []

        # 1. Copy screenshot if provided
        if screenshot_path and os.path.exists(screenshot_path):
            ext = os.path.splitext(screenshot_path)[1] or ".jpg"
            dest_img = os.path.join(target_dir, f"簽收聯_{bid}{ext}")
            try:
                shutil.copy2(screenshot_path, dest_img)
                downloaded_files.append({
                    "filename": f"簽收聯_{bid}{ext}",
                    "size": os.path.getsize(dest_img),
                    "type": "簽收憑證截圖"
                })
            except:
                pass

        # 2. Download Attachments
        attachments = info.get("attachments", [])
        if attachments and info.get("html_raw"):
            soup = BeautifulSoup(info["html_raw"], 'html.parser')
            form = soup.find('form')
            if form:
                action = form.get('action', f'./ViewDetail.aspx?bid={bid}')
                post_url = urllib.parse.urljoin(f"{BASE_URL}/ViewDetail.aspx?bid={bid}", action)

                base_data = {}
                for inp in form.find_all('input'):
                    name = inp.get('name')
                    val = inp.get('value', '')
                    if name and inp.get('type') not in ['submit', 'image']:
                        base_data[name] = val

                for att in attachments:
                    data = dict(base_data)
                    data['__EVENTTARGET'] = att['target']
                    data['__EVENTARGUMENT'] = ''

                    try:
                        att_res = self.session.post(
                            post_url,
                            data=data,
                            headers={'Referer': f"{BASE_URL}/ViewDetail.aspx?bid={bid}", 'Origin': BASE_URL},
                            verify=False,
                            timeout=60
                        )

                        if att_res.status_code == 200 and ('content-disposition' in att_res.headers or len(att_res.content) > 100):
                            disp = att_res.headers.get('content-disposition', '')
                            fname = att['filename']
                            if 'filename=' in disp:
                                raw_fn = disp.split('filename=')[-1].strip('; "\'')
                                try:
                                    decoded = urllib.parse.unquote(raw_fn)
                                    if decoded and not decoded.startswith('--'):
                                        fname = decoded
                                except:
                                    pass

                            safe_fname = re.sub(r'[\\/*?:"<>|]', '_', fname)
                            file_path = os.path.join(target_dir, safe_fname)
                            with open(file_path, 'wb') as f:
                                f.write(att_res.content)

                            downloaded_files.append({
                                "filename": safe_fname,
                                "size": len(att_res.content),
                                "type": "公告附件"
                            })
                    except Exception as e:
                        print(f"Error downloading attachment {att['filename']}: {e}")

        # 3. Generate summary text file
        summary_lines = [
            "=" * 60,
            f"臺南市教育局公告 - 公告編號: {bid}",
            "=" * 60,
            f"公告標題: {title}",
            f"公告單位: {info.get('office', '')}",
            f"公 告 人: {info.get('poster', '')}",
            f"發 佈 日: {info.get('date_posted', '')}",
            f"公告期間: {info.get('date_range', '')}",
            f"公文文號: {info.get('doc_no', '無')}",
            f"簽收狀態: {info.get('sign_status', '無')}",
            f"受文單位: {info.get('recipients', '')}",
            "-" * 60,
            "【公告內容】",
            info.get('content_text', '(無公告內文或需登入教網帳號瀏覽)'),
            "-" * 60,
            "【附件清單】"
        ]
        if downloaded_files:
            for df in downloaded_files:
                summary_lines.append(f" - {df['filename']} ({df['size']} bytes) [{df['type']}]")
        else:
            summary_lines.append(" (本公告無附件)")

        summary_txt_path = os.path.join(target_dir, f"公告內容_{bid}.txt")
        with open(summary_txt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(summary_lines))

        downloaded_files.append({
            "filename": f"公告內容_{bid}.txt",
            "size": os.path.getsize(summary_txt_path),
            "type": "公告文字摘要"
        })

        # 4. Save metadata.json
        meta_data = {
            "bulletin_id": bid,
            "title": title,
            "office": info.get("office", ""),
            "poster": info.get("poster", ""),
            "date_posted": info.get("date_posted", ""),
            "doc_no": info.get("doc_no", ""),
            "sign_status": info.get("sign_status", ""),
            "needs_login": info.get("needs_login", False),
            "folder_path": target_dir,
            "folder_name": folder_name,
            "files": downloaded_files
        }
        with open(os.path.join(target_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(meta_data, f, ensure_ascii=False, indent=2)

        att_files = [f for f in downloaded_files if f.get('type') == '公告附件']
        return {
            "success": True,
            "bulletin_id": bid,
            "title": title,
            "folder_name": folder_name,
            "folder_path": target_dir,
            "downloaded_files": downloaded_files,
            "attachments_count": len(att_files),
            "is_text_only": (len(att_files) == 0),
            "needs_login": info.get("needs_login", False),
            "office": info.get("office", ""),
            "date_posted": info.get("date_posted", ""),
            "rules": info.get("rules", [])
        }
