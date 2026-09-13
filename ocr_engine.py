import json
import os
import re
import subprocess
import sys

def clean_chinese_spacing(text):
    if not text:
        return ""
    text = re.sub(r'([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])', r'\1\2', text)
    text = re.sub(r'([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])', r'\1\2', text)
    return text.strip()

def run_ocr(image_path):
    """
    Runs Windows Media OCR via win_ocr.ps1 and post-processes the result.
    """
    if not os.path.exists(image_path):
        return {"success": False, "error": f"檔案不存在: {image_path}"}

    ps_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "win_ocr.ps1")
    
    cmd = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        f"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '{ps_script}' -ImagePath '{image_path}'"
    ]

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", timeout=30)
        if proc.returncode != 0:
            return {"success": False, "error": f"PowerShell OCR 執行錯誤: {proc.stderr.strip()}"}

        out = proc.stdout.strip()
        start_idx = out.find('{')
        end_idx = out.rfind('}')
        if start_idx == -1 or end_idx == -1:
            return {"success": False, "error": f"無法解析 OCR 輸出: {out}"}

        json_str = out[start_idx:end_idx+1]
        data = json.loads(json_str)
        if not data.get("success"):
            return data

        lines = [re.sub(r'\s+', ' ', l).strip() for l in data.get("lines", [])]
        
        extracted = {
            "success": True,
            "bulletin_id": "",
            "title": "",
            "office": "",
            "contact": "",
            "date": "",
            "doc_no": "無",
            "sign_status": "",
            "raw_text": data.get("full_text", ""),
            "lines": lines
        }

        # 1. Extract Bulletin ID
        for i, l in enumerate(lines):
            clean_l = l.replace(" ", "")
            if "公告編號" in clean_l:
                m = re.search(r'\d{5,7}', clean_l)
                if m:
                    extracted["bulletin_id"] = m.group(0)
                    break
                for next_l in lines[i+1:i+4]:
                    next_clean = next_l.replace(" ", "")
                    m2 = re.search(r'^\d{5,7}$', next_clean) or re.search(r'\d{5,7}', next_clean)
                    if m2:
                        extracted["bulletin_id"] = m2.group(0)
                        break
                if extracted["bulletin_id"]:
                    break

        if not extracted["bulletin_id"]:
            for l in lines:
                m = re.search(r'\b([1-3]\d{5})\b', l.replace(" ", ""))
                if m:
                    extracted["bulletin_id"] = m.group(1)
                    break

        # 2. Extract Office
        for l in lines:
            clean_l = l.replace(" ", "")
            if any(k in clean_l for k in ["公佈單位", "公告單位", "公布單位"]):
                val = re.sub(r'^.*?公[佈布告]單位[.:：\s]*', '', clean_l)
                val = val.replace("亖", "瑩")
                # Format department and name if possible
                val = re.sub(r'^(教網中心|資訊中心|秘書室|政風室|督學室|人事室|會計室|國小教育科|國中教育科|幼兒教育科|特幼教育科|社會教育科|體育處)(.+)$', r'\1 \2', val)
                extracted["office"] = val.strip('.:： ')
                break

        # 3. Extract Email / Contact
        for l in lines:
            m = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', l.replace(" ", "").replace("/tw", ".tw"))
            if m:
                extracted["contact"] = m.group(1)
                break

        # 4. Extract Date
        for l in lines:
            clean_l = l.replace(" ", "").replace("•", ":")
            m = re.search(r'(\d{4}/\d{1,2}/\d{1,2}(?:上午|下午)?\d{1,2}:\d{1,2}(?::\d{1,2})?)', clean_l)
            if m:
                extracted["date"] = m.group(1)
                break

        # 5. Extract Title
        title_candidates = []
        for l in lines:
            clean = l.replace(" ", "")
            if any(k in clean for k in ["公佈單位", "公告單位", "公布單位", "收發文章", "聯絡資訊", "發佈時間", "發布時間", "公告編號", "公文文號", "簽收", "列印備查"]):
                continue
            if "@" in clean or re.search(r'\d{4}/\d{1,2}/\d{1,2}', clean):
                continue
            if clean in ["公告標題", "標題"]:
                continue
            if re.match(r'^\d{5,7}$', clean):
                continue
            if clean:
                title_candidates.append(clean)

        extracted["title"] = "".join(title_candidates).strip('：: ')

        # 6. Extract Sign Status & Doc No
        for l in lines:
            clean_l = l.replace(" ", "")
            if "簽收" in clean_l:
                m = re.search(r'簽收[：:\s]*([^\s]+)', clean_l)
                if m and m.group(1) != "簽收":
                    extracted["sign_status"] = m.group(1)
                elif "準時簽收" in clean_l:
                    extracted["sign_status"] = "準時簽收"
            if "公文文號" in clean_l:
                m = re.search(r'公文文號[：:\s]*([^\s]+)', clean_l)
                if m:
                    extracted["doc_no"] = m.group(1)

        return extracted
    except Exception as e:
        return {"success": False, "error": str(e)}
