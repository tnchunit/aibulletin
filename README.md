# 臺南市教育公告 OCR 自動下載與歸檔助手 (Tainan Edu Bulletin Assistant)

專為學校行政、資訊組長及教師打造的工作網頁工具。支援公文簽收聯截圖貼上即辨識、公告附件自動下載歸檔、以及純前端 GitHub Pages 移動辦公！

---

## 🌟 特色功能

- 📸 **剪貼簿直接貼上 (Ctrl+V)**：使用 Windows 剪取工具 (Win+Shift+S) 或手機拍照截圖後，直接貼上即可自動辨識。
- 🔍 **雙模 OCR 辨識**：
  - **線上 / 移動端**：透過瀏覽器端 WebAssembly (Tesseract.js) 純前端辨識，免安裝任何後端，可在手機、平板、Mac、筆電跨平台使用。
  - **本機端**：透過 Windows 原生 WinRT 繁中 OCR 引擎超高速辨識。
- 🎯 **自動擷取關鍵公文資訊**：自動識別「公告編號 (6碼)」、標題、公佈單位、發佈時間、簽收狀態與文號。
- 📂 **自動歸檔建夾 (本機模式)**：自動在指定資料夾下建立 `[公告編號] 公告標題` 資料夾，下載所有附件檔案，並可一鍵在 Windows 檔案總管中開啟。
- 📦 **ZIP 一鍵打包 (線上模式)**：在 GitHub Pages 上運作時，純前端自動將截圖與公文摘要打包成 ZIP 供移動辦公下載。

---

## 🚀 部署到 GitHub Pages (3 分鐘快速上線)

本專案支援**純靜態免伺服器部署**，完全免費、永久有效：

### 步驟 1：建立 GitHub 倉庫並上傳
1. 登入您的 [GitHub](https://github.com/) 帳號，點擊右上角 **New repository**。
2. 設定專案名稱（例如 `tainan-bulletin-helper`），選擇 **Public**（公開），點擊 **Create repository**。
3. 將本目錄中的檔案（或解壓縮 `臺南市教育公告助手_GitHub佈署包.zip` 內的檔案）直接拖曳上傳至該倉庫根目錄並 Commit。

### 步驟 2：開啟 GitHub Pages 服務
1. 進入您剛建立的 GitHub 倉庫頁面，點選上方的 **Settings**（設定）。
2. 在左側選單點選 **Pages**。
3. 在 **Build and deployment** 下方的 **Branch**：
   - 選擇 **`main`**（或 `master`）。
   - 資料夾保持 **`/ (root)`**。
4. 點擊 **Save**（儲存）。

### 步驟 3：完成！隨時隨地移動辦公
- 稍等約 1 分鐘，GitHub Pages 即會為您產生專屬線上網址：
  ```
  https://<您的GitHub帳號>.github.io/tainan-bulletin-helper/
  ```
- 您可以直接將此網址加入手機或筆電瀏覽器書籤，移動辦公時隨時截圖辨識！

---

## 💻 本機端使用方式 (Windows 自動建夾與深層連動)

若您在學校或辦公室的 Windows 電腦上使用，可獲得更強大的本機整合功能：

1. 雙擊執行目錄下的 **`啟動公告下載器.bat`**（或桌面上的捷徑）。
2. 系統會自動啟動後端伺服器並在瀏覽器中開啟 `http://localhost:8088`。
3. 貼上截圖點擊下載後，系統會自動在 `downloads/` 建立資料夾、下載官方原始附件，並自動彈出 Windows 檔案總管！

---

## 📁 檔案結構說明

```
├── index.html              # 網頁首頁 (支援 GitHub Pages 根目錄)
├── app.js                  # 前端雙模控制邏輯 (Tesseract.js + JSZip)
├── style.css               # 介面樣式
├── static/                 # 靜態資源鏡像目錄
├── server.py               # 本機 Python 伺服器 (提供本機深層功能)
├── bulletin_client.py      # 臺南教育公告 PostBack 附件下載核心
├── ocr_engine.py           # Windows 原生 OCR 模組
├── win_ocr.ps1             # WinRT 繁中 OCR 腳本
├── 啟動公告下載器.bat       # Windows 一鍵啟動批次檔
└── README.md               # 專案與佈署說明
```
