// Tainan Edu Bulletin Assistant - Dual-Mode Frontend Logic (Local / Vercel Cloud & GitHub Pages)

let isServerMode = false;
let isCloudBackend = false;
let currentConfig = {};
let lastOcrResult = null;
let currentScreenshotPath = null;
let currentImageBase64 = null;
let customApiBase = localStorage.getItem("custom_backend_url") || "";

// DOM Elements
const runtimeModeBadge = document.getElementById("runtimeModeBadge");
const envNoticeBanner = document.getElementById("envNoticeBanner");
const envLabel = document.getElementById("envLabel");
const envDetails = document.getElementById("envDetails");
const loginBadge = document.getElementById("loginBadge");

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const uploadPrompt = document.getElementById("uploadPrompt");
const previewContainer = document.getElementById("previewContainer");
const imagePreview = document.getElementById("imagePreview");
const imageFileInfo = document.getElementById("imageFileInfo");
const btnChangeImage = document.getElementById("btnChangeImage");
const ocrLoading = document.getElementById("ocrLoading");
const ocrStatusText = document.getElementById("ocrStatusText");

const step2Card = document.getElementById("step2Card");
const inputBulletinId = document.getElementById("inputBulletinId");
const ocrTitleDisplay = document.getElementById("ocrTitleDisplay");
const ocrOfficeDisplay = document.getElementById("ocrOfficeDisplay");
const ocrDateDisplay = document.getElementById("ocrDateDisplay");
const ocrDocNoDisplay = document.getElementById("ocrDocNoDisplay");
const ocrSignDisplay = document.getElementById("ocrSignDisplay");
const ocrAttachmentStatus = document.getElementById("ocrAttachmentStatus");
const btnOpenOfficial = document.getElementById("btnOpenOfficial");
const btnFetchAndDownload = document.getElementById("btnFetchAndDownload");
const btnDownloadText = document.getElementById("btnDownloadText");

const downloadProgress = document.getElementById("downloadProgress");
const progressStatusText = document.getElementById("progressStatusText");
const progressBar = document.getElementById("progressBar");

const resultCard = document.getElementById("resultCard");
const resultTitleHeader = document.getElementById("resultTitleHeader");
const resultBulletinBadge = document.getElementById("resultBulletinBadge");
const folderPathBlock = document.getElementById("folderPathBlock");
const resultFolderPath = document.getElementById("resultFolderPath");
const btnOpenFolder = document.getElementById("btnOpenFolder");
const fileCountBadge = document.getElementById("fileCountBadge");
const downloadedFilesList = document.getElementById("downloadedFilesList");
const internalNoticeAlert = document.getElementById("internalNoticeAlert");
const btnDownloadZip = document.getElementById("btnDownloadZip");
const btnResetAll = document.getElementById("btnResetAll");

// Settings Modal Elements
const settingsModal = document.getElementById("settingsModal");
const btnSettings = document.getElementById("btnSettings");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const btnCancelSettings = document.getElementById("btnCancelSettings");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const cfgBackendUrl = document.getElementById("cfgBackendUrl");
const localConfigSection = document.getElementById("localConfigSection");
const cfgOutputDir = document.getElementById("cfgOutputDir");
const cfgAutoOpen = document.getElementById("cfgAutoOpen");
const cfgUsername = document.getElementById("cfgUsername");
const cfgPassword = document.getElementById("cfgPassword");
const cfgCookie = document.getElementById("cfgCookie");

// History Modal Elements
const historyModal = document.getElementById("historyModal");
const btnHistory = document.getElementById("btnHistory");
const btnCloseHistory = document.getElementById("btnCloseHistory");
const historyList = document.getElementById("historyList");

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    detectEnvironment();
    setupEventListeners();
});

function getApiUrl(endpoint) {
    if (customApiBase) {
        return customApiBase.replace(/\/+$/, "") + endpoint;
    }
    return endpoint;
}

function detectEnvironment() {
    const testUrl = getApiUrl("/api/config");
    fetch(testUrl, { method: "GET" })
        .then(res => {
            if (!res.ok) throw new Error("Not ok");
            return res.json();
        })
        .then(cfg => {
            isServerMode = true;
            isCloudBackend = (cfg.mode === "cloud");
            currentConfig = cfg;

            if (isCloudBackend) {
                runtimeModeBadge.textContent = "雲端全功能模式 (Vercel)";
                runtimeModeBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800";
                envDetails.textContent = "已連線雲端伺服器 • 支援在線自動下載官方附檔並打包 ZIP";
                folderPathBlock.classList.add("hidden");
                localConfigSection.classList.add("hidden");
                btnDownloadText.textContent = "雲端抓取附件並打包 ZIP";
                loginBadge.textContent = "雲端服務在線";
                loginBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800";
            } else {
                runtimeModeBadge.textContent = "本機原生模式";
                runtimeModeBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800";
                envDetails.textContent = `本機伺服器已連線 • 歸檔目錄：${cfg.output_dir || "預設"}`;
                folderPathBlock.classList.remove("hidden");
                localConfigSection.classList.remove("hidden");
                btnDownloadText.textContent = "下載公告並建立資料夾";

                if (cfg.has_cookie || cfg.username) {
                    loginBadge.textContent = cfg.username ? `已登入: ${cfg.username}` : "已套用 Cookie";
                    loginBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800";
                } else {
                    loginBadge.textContent = "未登入教網";
                    loginBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 text-slate-700";
                }
            }
        })
        .catch(() => {
            // Pure Static / GitHub Pages Mode
            isServerMode = false;
            isCloudBackend = false;
            runtimeModeBadge.textContent = "GitHub Pages 純前端模式";
            runtimeModeBadge.className = "px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800";

            envDetails.textContent = "純前端靜態環境 • 支援手機/筆電移動 OCR 辨識 • 附檔請配合官方連結或雲端部署";
            folderPathBlock.classList.add("hidden");
            localConfigSection.classList.add("hidden");
            btnDownloadText.textContent = "打包下載簽收摘要包 (ZIP)";
            loginBadge.textContent = "純前端免安裝";
            loginBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-100 text-indigo-700";
        });
}

// --- Event Listeners ---
function setupEventListeners() {
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageFile(e.target.files[0]);
        }
    });

    btnChangeImage.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Drag and drop
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dropzone-active");
    });
    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dropzone-active");
    });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dropzone-active");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });

    // Clipboard Paste (Ctrl+V) anywhere on the page
    window.addEventListener("paste", (e) => {
        const items = e.clipboardData ? e.clipboardData.items : [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                handleImageFile(blob);
                break;
            }
        }
    });

    // Open Official Bulletin directly in new tab
    btnOpenOfficial.addEventListener("click", () => {
        const bid = inputBulletinId.value.trim();
        if (!bid) {
            alert("請先輸入公告編號！");
            return;
        }
        window.open(`https://bulletin.tn.edu.tw/ViewDetail.aspx?bid=${bid}`, "_blank");
    });

    // Download action
    btnFetchAndDownload.addEventListener("click", startDownloadProcess);

    // Open folder action (local mode)
    btnOpenFolder.addEventListener("click", () => {
        const folder = resultFolderPath.value;
        if (folder && isServerMode && !isCloudBackend) {
            fetch(getApiUrl("/api/open-folder"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folder_path: folder })
            })
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    alert("開啟失敗: " + data.error);
                }
            });
        }
    });

    // Reset button
    btnResetAll.addEventListener("click", resetInterface);

    // Settings Modal
    btnSettings.addEventListener("click", () => {
        cfgBackendUrl.value = customApiBase;
        cfgOutputDir.value = currentConfig.output_dir || "";
        cfgAutoOpen.checked = currentConfig.auto_open !== false;
        cfgUsername.value = currentConfig.username || "";
        cfgPassword.value = "";
        cfgCookie.value = currentConfig.cookie || "";
        settingsModal.classList.remove("hidden");
    });

    const closeSettings = () => settingsModal.classList.add("hidden");
    btnCloseSettings.addEventListener("click", closeSettings);
    btnCancelSettings.addEventListener("click", closeSettings);

    btnSaveSettings.addEventListener("click", () => {
        const newBackend = cfgBackendUrl.value.trim();
        if (newBackend !== customApiBase) {
            customApiBase = newBackend;
            localStorage.setItem("custom_backend_url", customApiBase);
        }

        const payload = {
            output_dir: cfgOutputDir.value.trim(),
            auto_open: cfgAutoOpen.checked,
            cookie: cfgCookie.value.trim(),
            username: cfgUsername.value.trim(),
            password: cfgPassword.value.trim()
        };

        if (isServerMode || customApiBase) {
            fetch(getApiUrl("/api/config"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            .then(() => {
                if (payload.username && payload.password) {
                    return fetch(getApiUrl("/api/login"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: payload.username, password: payload.password })
                    }).then(r => r.json());
                }
                return { success: true };
            })
            .then(res => {
                closeSettings();
                detectEnvironment();
                if (res && !res.success) {
                    alert("教網登入提示: " + res.error);
                }
            })
            .catch(err => {
                closeSettings();
                detectEnvironment();
            });
        } else {
            closeSettings();
            detectEnvironment();
        }
    });

    // History Modal
    btnHistory.addEventListener("click", () => {
        historyModal.classList.remove("hidden");
        loadHistory();
    });
    btnCloseHistory.addEventListener("click", () => {
        historyModal.classList.add("hidden");
    });
}

// --- Image Handling & OCR ---
function handleImageFile(file) {
    if (!file || !file.type.startsWith("image/")) {
        alert("請上傳或貼上圖片檔案！");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        currentImageBase64 = dataUrl;

        // Preview
        imagePreview.src = dataUrl;
        imageFileInfo.textContent = `${file.name || "截圖"} (${Math.round(file.size / 1024)} KB)`;
        uploadPrompt.classList.add("hidden");
        previewContainer.classList.remove("hidden");

        step2Card.classList.add("hidden");
        resultCard.classList.add("hidden");
        downloadProgress.classList.add("hidden");

        // Trigger OCR
        performOCR(dataUrl);
    };
    reader.readAsDataURL(file);
}

function performOCR(dataUrl) {
    ocrLoading.classList.remove("hidden");

    if (isServerMode && !isCloudBackend) {
        // Fast local WinRT OCR
        ocrStatusText.textContent = "正在進行 Windows 原生繁體中文 OCR 辨識...";
        fetch(getApiUrl("/api/ocr"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl })
        })
        .then(res => res.json())
        .then(data => {
            ocrLoading.classList.add("hidden");
            if (!data.success) {
                alert("辨識失敗: " + (data.error || "未知錯誤"));
                return;
            }
            applyOcrResults(data);
        })
        .catch(err => {
            console.warn("Local OCR failed, falling back to in-browser Tesseract.js:", err);
            runClientSideOcr(dataUrl);
        });
    } else {
        // Client-Side Tesseract.js
        runClientSideOcr(dataUrl);
    }
}

// Client-side OCR via Tesseract.js (runs anywhere in browser)
function runClientSideOcr(dataUrl) {
    ocrStatusText.textContent = "載入瀏覽器繁體中文 OCR 引擎辨識中 (首次載入約需數秒)...";

    if (typeof Tesseract === "undefined") {
        ocrLoading.classList.add("hidden");
        alert("尚未載入 OCR 庫，請檢查網路連線。");
        return;
    }

    Tesseract.recognize(dataUrl, 'chi_tra+eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                ocrStatusText.textContent = `瀏覽器 OCR 辨識中... ${Math.round(m.progress * 100)}%`;
            }
        }
    })
    .then(result => {
        ocrLoading.classList.add("hidden");
        const fullText = result.data.text || "";
        const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

        // Smart client-side extraction
        let bid = "";
        for (const l of lines) {
            const clean = l.replace(/\s+/g, "");
            if (clean.includes("公告編號") || clean.includes("編號")) {
                const m = clean.match(/\d{5,7}/);
                if (m) { bid = m[0]; break; }
            }
        }
        if (!bid) {
            for (const l of lines) {
                const m = l.replace(/\s+/g, "").match(/\b([1-3]\d{5})\b/);
                if (m) { bid = m[1]; break; }
            }
        }

        // Title candidates
        let titleParts = [];
        for (const l of lines) {
            const c = l.replace(/\s+/g, "");
            if (c.includes("公告標題") || c.startsWith("請各校") || (c.includes("學年度") && c.length > 10)) {
                titleParts.push(l.replace(/公告標題[：:]*/, "").trim());
            }
        }
        const title = titleParts.join(" ").replace(/\s+/g, "") || "";

        // Office
        let office = "";
        for (const l of lines) {
            const c = l.replace(/\s+/g, "");
            if (c.includes("公佈單位") || c.includes("公告單位") || c.includes("公布單位")) {
                office = l.replace(/.*公[佈布告]單位[.:：\s]*/, "").replace(/\s+/g, "").trim();
            }
        }

        // Date
        let dateStr = "";
        for (const l of lines) {
            const m = l.replace(/\s+/g, "").match(/(\d{4}\/\d{1,2}\/\d{1,2}.*?\d{1,2}:\d{1,2})/);
            if (m) { dateStr = m[1]; break; }
        }

        const data = {
            success: true,
            bulletin_id: bid,
            title: title,
            office: office,
            date: dateStr,
            doc_no: "無",
            sign_status: fullText.includes("準時簽收") ? "準時簽收" : "已簽收",
            lines: lines,
            raw_text: fullText
        };

        applyOcrResults(data);
    })
    .catch(err => {
        ocrLoading.classList.add("hidden");
        alert("瀏覽器端 OCR 失敗: " + err);
    });
}

function applyOcrResults(data) {
    lastOcrResult = data;
    currentScreenshotPath = data.temp_image_path || null;

    inputBulletinId.value = data.bulletin_id || "";
    ocrTitleDisplay.textContent = data.title || "(未從截圖中完整辨識出標題，可直接查詢)";
    ocrOfficeDisplay.textContent = data.office || "--";
    ocrDateDisplay.textContent = data.date || "--";
    ocrDocNoDisplay.textContent = data.doc_no || "無";
    ocrSignDisplay.textContent = data.sign_status || "正常";

    if (ocrAttachmentStatus) {
        if (isServerMode && data.bulletin_id) {
            ocrAttachmentStatus.innerHTML = `<span class="text-blue-600 animate-pulse font-medium">連線教育局查詢附件中...</span>`;
            fetch(getApiUrl("/api/bulletin/" + data.bulletin_id))
                .then(r => r.json())
                .then(info => {
                    if (info.success) {
                        if (info.title && (!data.title || data.title.includes("未從截圖"))) {
                            ocrTitleDisplay.textContent = info.title;
                        }
                        if (info.office && (!data.office || data.office === "--")) ocrOfficeDisplay.textContent = info.office;
                        if (info.date_posted && (!data.date || data.date === "--")) ocrDateDisplay.textContent = info.date_posted;
                        
                        const atts = info.attachments || [];
                        if (atts.length > 0) {
                            ocrAttachmentStatus.innerHTML = `<span class="text-rose-600 font-bold">📎 官方共有 ${atts.length} 個附件 (${atts.map(a => a.filename).join(', ')})</span>`;
                        } else {
                            ocrAttachmentStatus.innerHTML = `<span class="text-amber-700 font-bold">ℹ️ 官方無附件（純文字公文，下載權限：X）</span>`;
                        }
                    }
                })
                .catch(() => {
                    ocrAttachmentStatus.innerHTML = `<span class="text-slate-500">下載時將自動連線取得附件</span>`;
                });
        } else {
            ocrAttachmentStatus.innerHTML = `<span class="text-indigo-600 font-medium">純前端靜態模式 • 可透過直連官方頁面下載</span>`;
        }
    }

    step2Card.classList.remove("hidden");
    step2Card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// --- Download & Packaging Execution ---
function startDownloadProcess() {
    const bid = inputBulletinId.value.trim();
    if (!bid) {
        alert("請輸入或確認公告編號！");
        inputBulletinId.focus();
        return;
    }

    btnFetchAndDownload.disabled = true;
    downloadProgress.classList.remove("hidden");
    resultCard.classList.add("hidden");
    downloadProgress.scrollIntoView({ behavior: "smooth", block: "nearest" });

    if (isServerMode) {
        // Mode 1: Local or Cloud Backend Server (can scrape bulletin.tn.edu.tw)
        progressStatusText.textContent = `正在連線至臺南教育公告 [${bid}] 下載官方資料與附件...`;
        fetch(getApiUrl("/api/download"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                bulletin_id: bid,
                screenshot_path: currentScreenshotPath,
                screenshot_base64: currentImageBase64,
                fallback_meta: lastOcrResult || {},
                cookie: (currentConfig && currentConfig.cookie) || localStorage.getItem("bulletin_cookie") || ""
            })
        })
        .then(res => res.json())
        .then(data => {
            btnFetchAndDownload.disabled = false;
            downloadProgress.classList.add("hidden");
            if (!data.success) {
                alert("下載失敗: " + (data.error || "未知錯誤"));
                return;
            }

            // If cloud backend returned zip base64, auto download zip
            if (data.zip_base64) {
                const byteCharacters = atob(data.zip_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/zip" });
                saveAs(blob, data.zip_filename || `[${bid}]_公告歸檔.zip`);
            }

            renderResult(data);
        })
        .catch(err => {
            btnFetchAndDownload.disabled = false;
            downloadProgress.classList.add("hidden");
            alert("下載異常: " + err);
        });
    } else {
        // Mode 2: GitHub Pages Pure Client-Side Mode
        progressStatusText.textContent = `正在以純前端模式打包 [${bid}] 資料...`;
        createClientSideZip(bid);
    }
}

// Pure client-side packaging with JSZip for GitHub Pages
async function createClientSideZip(bid) {
    try {
        const zip = new JSZip();
        const title = (lastOcrResult && lastOcrResult.title) ? lastOcrResult.title : `公告_${bid}`;
        const safeTitle = title.replace(/[\\/*?:"<>|]/g, "_").slice(0, 60);
        const folderName = `[${bid}] ${safeTitle}`;
        const zipFolder = zip.folder(folderName);

        const files = [];

        // 1. Screenshot if present
        if (currentImageBase64) {
            const b64Data = currentImageBase64.includes(",") ? currentImageBase64.split(",")[1] : currentImageBase64;
            zipFolder.file(`簽收聯_${bid}.jpg`, b64Data, { base64: true });
            files.push({
                filename: `簽收聯_${bid}.jpg`,
                size: Math.round(b64Data.length * 0.75),
                type: "簽收憑證截圖"
            });
        }

        // 2. Summary text file
        const summaryText = [
            "============================================================",
            `臺南市教育局公告 - 公告編號: ${bid}`,
            "============================================================",
            `公告標題: ${title}`,
            `公告單位: ${(lastOcrResult && lastOcrResult.office) || ""}`,
            `發 佈 日: ${(lastOcrResult && lastOcrResult.date) || ""}`,
            `公文文號: ${(lastOcrResult && lastOcrResult.doc_no) || "無"}`,
            `簽收狀態: ${(lastOcrResult && lastOcrResult.sign_status) || "正常"}`,
            `官方公告網址: https://bulletin.tn.edu.tw/ViewDetail.aspx?bid=${bid}`,
            "------------------------------------------------------------",
            "【附檔下載說明】",
            "1. 若本公告在教育局系統有附件檔案，請點擊上方官方網址直接下載。",
            "2. 若需由網頁自動在線抓取所有附件打包，建議將本專案部署至 Vercel（免費支援 Python 雲端爬蟲）。",
            "============================================================"
        ].join("\n");

        zipFolder.file(`公告內容_${bid}.txt`, summaryText);
        files.push({
            filename: `公告內容_${bid}.txt`,
            size: summaryText.length,
            type: "公告文字摘要"
        });

        // 3. metadata.json
        const metaObj = {
            bulletin_id: bid,
            title: title,
            office: (lastOcrResult && lastOcrResult.office) || "",
            date: (lastOcrResult && lastOcrResult.date) || "",
            source_url: `https://bulletin.tn.edu.tw/ViewDetail.aspx?bid=${bid}`,
            client_generated_at: new Date().toISOString()
        };
        zipFolder.file("metadata.json", JSON.stringify(metaObj, null, 2));

        // Generate Zip
        const content = await zip.generateAsync({ type: "blob" });
        const zipFileName = `${folderName}.zip`;

        btnFetchAndDownload.disabled = false;
        downloadProgress.classList.add("hidden");

        // Trigger immediate download
        saveAs(content, zipFileName);

        // Render Result Card
        renderResult({
            bulletin_id: bid,
            title: title,
            folder_name: folderName,
            folder_path: "已透過瀏覽器下載 ZIP 歸檔包至本機下載資料夾",
            downloaded_files: files,
            zipBlob: content,
            zipFileName: zipFileName,
            isClientZip: true,
            isStaticNotice: true
        });

    } catch (err) {
        btnFetchAndDownload.disabled = false;
        downloadProgress.classList.add("hidden");
        alert("打包失敗: " + err);
    }
}

function renderResult(data) {
    resultBulletinBadge.textContent = data.bulletin_id;
    resultFolderPath.value = data.folder_path || "";

    if (data.isClientZip || data.is_cloud_download) {
        resultTitleHeader.textContent = "ZIP 歸檔包已下載！";
        btnDownloadZip.onclick = () => {
            if (data.zipBlob) saveAs(data.zipBlob, data.zipFileName);
            else if (data.bulletin_id) {
                window.location.href = getApiUrl(`/api/zip/${data.bulletin_id}`);
            }
        };
    } else {
        resultTitleHeader.textContent = "歸檔完成！資料夾已自動建置";
        btnDownloadZip.onclick = null;
        btnDownloadZip.href = getApiUrl(`/api/zip/${data.bulletin_id}`);
    }

    if (data.needs_login) {
        internalNoticeAlert.classList.remove("hidden");
    } else {
        internalNoticeAlert.classList.add("hidden");
    }

    const files = data.downloaded_files || [];
    const attFiles = files.filter(f => f.type === "公告附件");
    fileCountBadge.textContent = `共 ${files.length} 個檔案`;
    downloadedFilesList.innerHTML = "";

    // 1. If announcement has NO attachments on the official education website (e.g. 290612)
    if (data.is_text_only || (attFiles.length === 0 && !data.isStaticNotice)) {
        const textOnlyDiv = document.createElement("div");
        textOnlyDiv.className = "col-span-full p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1";
        textOnlyDiv.innerHTML = `
            <div class="font-bold flex items-center space-x-1 text-amber-800">
                <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>【官方公告狀態：純文字公文，無夾帶附檔】</span>
            </div>
            <p class="text-amber-800 leading-relaxed">
                經查臺南市教育局官方系統，公告 <b>[${data.bulletin_id}]</b> 官方權限設定為「<b>下載 X</b>」，公文發佈單位<b>本來就沒有上傳任何附件檔案</b>。<br>
                系統已自動為您完整歸檔「簽收聯截圖」與「公文內容文字摘要」！
            </p>
        `;
        downloadedFilesList.appendChild(textOnlyDiv);
    } else if (attFiles.length > 0) {
        const attDiv = document.createElement("div");
        attDiv.className = "col-span-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between";
        attDiv.innerHTML = `
            <span class="font-bold flex items-center space-x-1.5 text-emerald-800">
                <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>已成功下載並封裝 ${attFiles.length} 個官方附件（PDF / 文件）！</span>
            </span>
            <span class="text-emerald-700 font-mono text-[11px] font-bold">附件下載成功</span>
        `;
        downloadedFilesList.appendChild(attDiv);
    }

    // 2. If static notice on GitHub Pages
    if (data.isStaticNotice) {
        const noticeDiv = document.createElement("div");
        noticeDiv.className = "col-span-full p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-2";
        noticeDiv.innerHTML = `
            <div class="font-bold flex items-center space-x-1.5 text-indigo-800 text-sm">
                <svg class="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>💡 GitHub Pages 純前端模式附檔說明</span>
            </div>
            <p class="text-indigo-800 leading-relaxed">
                GitHub Pages 純前端網頁受限於瀏覽器跨網域安全政策 (CORS)，無法在前端無伺服器下直接抓取教育局官方附檔。<br>
                <b>【解決方式】</b>：若本公告含有附檔，請點擊下方按鈕前往官方頁面下載；若需手機/線上「全自動抓取附檔打包 ZIP」，建議將本專案 1 鍵免費部署到 Vercel 雲端伺服器！
            </p>
            <div class="pt-1 flex flex-wrap gap-2">
                <a href="https://bulletin.tn.edu.tw/ViewDetail.aspx?bid=${data.bulletin_id}" target="_blank" class="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-colors">
                    <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    前往官方公告頁面下載附檔
                </a>
            </div>
        `;
        downloadedFilesList.appendChild(noticeDiv);
    }

    files.forEach(f => {
        const fileDiv = document.createElement("div");
        fileDiv.className = "flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs hover:bg-blue-50/50 transition-colors";
        
        let iconColor = "text-blue-500";
        if (f.filename.endsWith(".pdf")) iconColor = "text-rose-500";
        else if (f.filename.endsWith(".txt")) iconColor = "text-emerald-500";
        else if (f.filename.endsWith(".jpg") || f.filename.endsWith(".png")) iconColor = "text-purple-500";

        fileDiv.innerHTML = `
            <div class="flex items-center space-x-2 truncate pr-2">
                <svg class="w-4 h-4 ${iconColor} flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <span class="truncate font-medium text-slate-800" title="${f.filename}">${f.filename}</span>
            </div>
            <span class="text-[11px] text-slate-400 font-mono whitespace-nowrap">${formatBytes(f.size)}</span>
        `;
        downloadedFilesList.appendChild(fileDiv);
    });

    resultCard.classList.remove("hidden");
    resultCard.scrollIntoView({ behavior: "smooth" });
}

function loadHistory() {
    if (!isServerMode || isCloudBackend) {
        historyList.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">線上模式請於瀏覽器下載紀錄中檢視 ZIP 檔案</div>`;
        return;
    }
    historyList.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">載入歷史紀錄中...</div>`;
    fetch(getApiUrl("/api/history"))
        .then(r => r.json())
        .then(data => {
            const list = data.history || [];
            if (list.length === 0) {
                historyList.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">目前尚無歸檔紀錄</div>`;
                return;
            }

            historyList.innerHTML = "";
            list.forEach(item => {
                const itemDiv = document.createElement("div");
                itemDiv.className = "p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:border-blue-300 transition-colors";
                itemDiv.innerHTML = `
                    <div class="space-y-1 truncate pr-4">
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded font-mono text-[11px]">${item.bulletin_id}</span>
                            <span class="font-bold text-slate-800 truncate">${item.title || item.folder_name}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 truncate">${item.folder_path}</p>
                    </div>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        <button class="btn-open-hist px-3 py-1.5 bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-700 font-medium transition-colors" data-path="${item.folder_path}">
                            開啟
                        </button>
                        <a href="${getApiUrl('/api/zip/' + item.bulletin_id)}" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors">
                            ZIP
                        </a>
                    </div>
                `;
                historyList.appendChild(itemDiv);
            });

            document.querySelectorAll(".btn-open-hist").forEach(btn => {
                btn.addEventListener("click", () => {
                    const fpath = btn.getAttribute("data-path");
                    fetch(getApiUrl("/api/open-folder"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ folder_path: fpath })
                    });
                });
            });
        })
        .catch(err => {
            historyList.innerHTML = `<div class="text-center py-4 text-red-500 text-xs">載入紀錄失敗: ${err}</div>`;
        });
}

function resetInterface() {
    fileInput.value = "";
    uploadPrompt.classList.remove("hidden");
    previewContainer.classList.add("hidden");
    step2Card.classList.add("hidden");
    resultCard.classList.add("hidden");
    downloadProgress.classList.add("hidden");
    lastOcrResult = null;
    currentScreenshotPath = null;
    currentImageBase64 = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
