/* ==========================================
   ⚙️ システム設定
   ========================================== */
const CONFIG = {
    userStrokeColor: "rgba(0, 0, 0, 0.6)",   /* プレイヤーが引く線（黒の半透明） */
    adminStrokeColor: "rgba(0, 0, 0, 0.4)",  /* 管理者がお手本をなぞる時の色 */
    strokeWidth: 5,                          /* 線の太さ */
    goalTolerance: 30,                       /* ゴール位置判定の甘さ */
    startTolerance: 120                      /* スタート位置判定の甘さ */
};

/* ==========================================
   共通変数・要素定義
   ========================================== */
const menuPage = document.getElementById('menu-page');
const gamePage = document.getElementById('game-page');
const wrapper = document.getElementById('maze-wrapper');
const container = document.getElementById('canvas-container');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mazeBg = document.getElementById('maze-bg');
const adminControls = document.getElementById('admin-controls');
const ctrlImageMode = document.getElementById('ctrl-image-mode');
const ctrlTraceMode = document.getElementById('ctrl-trace-mode');
const pageTitle = document.getElementById('page-title');
const hiddenCanvas = document.getElementById('hidden-canvas');
const hiddenCtx = hiddenCanvas.getContext('2d');
const imgAnswerObj = new Image();

let isDrawing = false;
let isAdminMode = false;
let adminSubMode = 'imageMode'; 
let hasJudged = false; 
let isLandscape = false; 
let currentMode = 'draw'; 

let scale = 1; let panX = 0; let panY = 0;
let startTouchDistance = 0; let lastTouchX = 0; let lastTouchY = 0;
let strokeHistory = []; let currentStroke = []; 
let judgeSystemType = 'trace'; let savedRoute = [];
let mazeStartPoint = null; let mazeGoalPoint = null; let setupStep = 'none';
let currentStageNumber = 1;

/* ==========================================
   初期化・画像読み込みと自動フィット
   ========================================== */
window.onload = function() {
    // 起動時はまずステージ1のデータを読み込む
    loadStageData(1);

    // 画面サイズが変化した時も自動で迷路サイズをリサイズフィットさせる
    window.addEventListener('resize', adjustCanvasSize);
};

/* ✨ 新設：指定されたステージのデータをローカルストレージから読み込む関数 */
function loadStageData(stageNumber) {
    currentStageNumber = stageNumber;

    const localImage = localStorage.getItem(`stage_${stageNumber}_image`);
    const localRoute = localStorage.getItem(`stage_${stageNumber}_route`);
    const localSystem = localStorage.getItem(`stage_${stageNumber}_judge_system`);
    const localAnsImg = localStorage.getItem(`stage_${stageNumber}_answer_image`);
    const localStart = localStorage.getItem(`stage_${stageNumber}_start_pt`);
    const localGoal = localStorage.getItem(`stage_${stageNumber}_goal_pt`);

    // いったんデータをリセット
    mazeBg.src = "";
    mazeBg.style.display = 'none';
    savedRoute = [];
    imgAnswerObj.src = "";
    mazeStartPoint = null;
    mazeGoalPoint = null;
    judgeSystemType = 'trace'; // デフォルト

    // 選択されたステージのデータを反映
    if (localImage) { mazeBg.src = localImage; mazeBg.style.display = 'block'; }
    if (localSystem) { judgeSystemType = localSystem; }
    if (judgeSystemType === 'trace' && localRoute) { savedRoute = JSON.parse(localRoute); }
    if (judgeSystemType === 'color' && localAnsImg) { imgAnswerObj.src = localAnsImg; }
    if (localStart) mazeStartPoint = JSON.parse(localStart);
    if (localGoal) mazeGoalPoint = JSON.parse(localGoal);
}
mazeBg.onload = function() {
    isLandscape = mazeBg.naturalWidth > mazeBg.naturalHeight;
    adjustCanvasSize();
};

/* 
  画面の横幅・縦幅に合わせて、迷路の画像が画面いっぱいに「アスペクト比を維持して最大表示」
  されるようにキャンバスの大きさを1ピクセル単位で再計算します。
*/
function adjustCanvasSize() {
    if (!mazeBg.src || mazeBg.naturalWidth === 0) return;

    const screenWidth = container.clientWidth;
    const screenHeight = container.clientHeight;

    const imgWidth = mazeBg.naturalWidth;
    const imgHeight = mazeBg.naturalHeight;

    let targetWidth = screenWidth;
    let targetHeight = screenHeight;

    const screenRatio = screenWidth / screenHeight;
    const imgRatio = imgWidth / imgHeight;

    if (imgRatio > screenRatio) {
        // 画像の方が横長の場合
        targetWidth = screenWidth;
        targetHeight = screenWidth / imgRatio;
    } else {
        // 画像の方が縦長の場合
        targetHeight = screenHeight;
        targetWidth = screenHeight * imgRatio;
    }

    // キャンバスの実解像度とCSS上の表示解像度を完全に一致させ、ボケを防ぐ
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    canvas.style.width = targetWidth + 'px';
    canvas.style.height = targetHeight + 'px';

    redrawAllHistory(); 
}

function updateTransform() {
    let baseRotate = isLandscape ? 'rotate(90deg) ' : '';
    wrapper.style.transform = `${baseRotate}translate(${panX}px, ${panY}px) scale(${scale})`;
}

function setMode(mode) {
    currentMode = mode;
    document.getElementById('btn-draw').classList.toggle('selected', mode === 'draw');
    document.getElementById('btn-zoom').classList.toggle('selected', mode === 'zoom');
}

/* ==========================================
   🚪 ドロワーメニュー & 設定の開閉
   ========================================== */
function toggleDrawer() {
    document.getElementById('drawer-menu').classList.toggle('open');
}

function toggleSettings() {
    document.getElementById('settingsContent').classList.toggle('open');
}

// メニューの外側を触った時に自動でドロワーを閉じる親切設計
document.addEventListener('touchstart', function(e) {
    const drawer = document.getElementById('drawer-menu');
    const toggleBtn = document.getElementById('menu-toggle');
    if (drawer.classList.contains('open') && !drawer.contains(e.target) && e.target !== toggleBtn) {
        drawer.classList.remove('open');
    }
});

document.addEventListener('click', function(e) {
    const menu = document.querySelector('.settings-menu');
    if (menu && !menu.contains(e.target)) {
        const setCont = document.getElementById('settingsContent');
        if(setCont) setCont.classList.remove('open');
    }
});

/* ==========================================
   ゲーム状態遷移
   ========================================== */
function setSetupStep(step) {
    setupStep = step;
    document.getElementById('setup-status').innerText = step === 'start' ? "スタート位置を1回タップしてください" : "ゴール位置を1回タップしてください";
}

function startGame(stageNumber) {
    if (stageNumber) {
        loadStageData(stageNumber);
    }
    
    isAdminMode = false; setupStep = 'none';
    pageTitle.innerText = `CLan迷路ゲーム - Stage ${currentStageNumber}`; 
    setMode('draw'); adminControls.style.display = 'none';
    menuPage.classList.remove('active'); gamePage.classList.add('active');
    scale = 1; panX = 0; panY = 0; updateTransform();
    setTimeout(adjustCanvasSize, 50); setTimeout(resetCanvas, 60);
}

/* 💡 タイトル入力に対応させた最新版の openAdmin */
function openAdmin(mode) {
    document.getElementById('settingsContent').classList.remove('open');
    isAdminMode = true; adminSubMode = mode; setupStep = 'none';
    pageTitle.innerText = mode === 'imageMode' ? `画像2枚登録 (Stage ${currentStageNumber})` : `なぞりお手本登録 (Stage ${currentStageNumber})`;
    
    document.getElementById('setup-status').innerText = "位置を指定してください";
    setMode('draw');
    
    document.getElementById('admin-controls').style.display = 'block';
    ctrlImageMode.style.display = mode === 'imageMode' ? 'block' : 'none';
    ctrlTraceMode.style.display = mode === 'traceMode' ? 'block' : 'none';
    
    // 現在のステージに保存されているタイトルがあれば、入力欄に自動でセットする
    const savedTitle = localStorage.getItem(`stage_${currentStageNumber}_title`) || "";
    const inputA = document.getElementById('stage-title-input-a');
    const inputB = document.getElementById('stage-title-input-b');
    if (inputA) inputA.value = savedTitle;
    if (inputB) inputB.value = savedTitle;
    
    menuPage.classList.remove('active'); 
    gamePage.classList.add('active');
    
    scale = 1; panX = 0; panY = 0; updateTransform();
    
    setTimeout(adjustCanvasSize, 50); 
    setTimeout(resetCanvas, 60);

    setTimeout(() => {
        document.getElementById('drawer-menu').classList.add('open');
    }, 200);
}

function goBackMenu() { stopMazeTimer(); document.getElementById('timer-display').innerText = "TIME: 00:00.00"; gamePage.classList.remove('active'); menuPage.classList.add('active'); }
function resetCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); strokeHistory = []; currentStroke = []; hasJudged = false; redrawAllHistory(); }

/* ==========================================
   描画・タッチイベント処理
   ========================================== */
function redrawAllHistory() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateTransform();
    
    if (isAdminMode && adminSubMode === 'imageMode') {
        if (mazeStartPoint) { ctx.beginPath(); ctx.arc(mazeStartPoint.x, mazeStartPoint.y, 10, 0, Math.PI*2); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill(); }
        if (mazeGoalPoint) { ctx.beginPath(); ctx.arc(mazeGoalPoint.x, mazeGoalPoint.y, 10, 0, Math.PI*2); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill(); }
    }

    for (let stroke of strokeHistory) {
        if (stroke.length === 0) continue;
        ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y);
        ctx.lineWidth = CONFIG.strokeWidth / scale;
        ctx.strokeStyle = isAdminMode ? CONFIG.adminStrokeColor : CONFIG.userStrokeColor; 
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (let i = 1; i < stroke.length; i++) { ctx.lineTo(stroke[i].x, stroke[i].y); }
        ctx.stroke();
    }
}

function undoLastLine() { if (strokeHistory.length > 0) { strokeHistory.pop(); redrawAllHistory(); } }

function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect(); const touch = e.touches[0];
    let clientX = touch.clientX - rect.left; let clientY = touch.clientY - rect.top;
    return { x: clientX * (canvas.width / rect.width), y: clientY * (canvas.height / rect.height) };
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (currentMode === 'zoom' || e.touches.length >= 2) {
        isDrawing = false;
        if (e.touches.length >= 2) { startTouchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
        else { lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
        return;
    }

    const pos = getTouchPos(e);

    if (isAdminMode && setupStep !== 'none') {
        isDrawing = false;
        if (setupStep === 'start') { mazeStartPoint = { x: pos.x, y: pos.y }; alert("スタート位置を設定しました"); }
        else if (setupStep === 'goal') { mazeGoalPoint = { x: pos.x, y: pos.y }; alert("ゴール位置を設定しました"); }
        setupStep = 'none'; document.getElementById('setup-status').innerText = "設定完了。保存してください。";
        redrawAllHistory(); return;
    }

    if (!isAdminMode && hasJudged) return; 
    isDrawing = true; 
    if (!isAdminMode && !isMazeTimerRunning) {
        startMazeTimer();
    }
    currentStroke = [pos]; 
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = CONFIG.strokeWidth / scale; 
    ctx.strokeStyle = isAdminMode ? CONFIG.adminStrokeColor : CONFIG.userStrokeColor;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (!isAdminMode) { checkRealtimeGoalTouch(pos.x, pos.y); }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (currentMode === 'zoom' || e.touches.length >= 2) {
        if (e.touches.length >= 2) {
            let currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            if (startTouchDistance > 0) { scale = Math.max(1, Math.min(scale * (currentDistance / startTouchDistance), 4)); startTouchDistance = currentDistance; updateTransform(); }
        } else {
            let deltaX = e.touches[0].clientX - lastTouchX; let deltaY = e.touches[0].clientY - lastTouchY;
            if (isLandscape) { panX += deltaY; panY -= deltaX; } else { panX += deltaX; panY += deltaY; }
            lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; updateTransform();
        } return;
    }
    if (!isDrawing || (!isAdminMode && hasJudged)) return;
    if (!isMazeTimerRunning) {
        startMazeTimer();
    }
    const pos = getTouchPos(e); currentStroke.push(pos); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    if (!isAdminMode) { checkRealtimeGoalTouch(pos.x, pos.y); }
});

canvas.addEventListener('touchend', () => { if (isDrawing && currentStroke.length > 0) { strokeHistory.push(currentStroke); } isDrawing = false; startTouchDistance = 0; });

/* ==========================================
   画像アップロードと保存
   ========================================== */
document.getElementById('img-question').addEventListener('change', (e) => { loadImgToBg(e.target.files[0]); });
document.getElementById('img-single').addEventListener('change', (e) => { loadImgToBg(e.target.files[0]); });
document.getElementById('img-answer').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) { 
        imgAnswerObj.src = event.target.result; 
        localStorage.setItem(`stage_${currentStageNumber}_answer_image`, event.target.result); 
    };
    reader.readAsDataURL(file);
});
function loadImgToBg(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) { 
        mazeBg.src = event.target.result; 
        mazeBg.style.display = 'block'; 
        localStorage.setItem(`stage_${currentStageNumber}_image`, event.target.result); 
    };
    reader.readAsDataURL(file);
}

/* 💡 タイトル入力に対応させた最新版の saveImageModeData */
function saveImageModeData() {
    if(!mazeBg.src || !imgAnswerObj.src) { alert("問題と答えの両方の画像をセットしてください。"); return; }
    if(!mazeStartPoint || !mazeGoalPoint) { alert("スタート位置とゴール位置を画面上で指定してください。"); return; }
    
    const titleInput = document.getElementById('stage-title-input-a').value.trim();
    const finalTitle = titleInput || `ステージ ${currentStageNumber}`;

    localStorage.setItem(`stage_${currentStageNumber}_title`, finalTitle);
    localStorage.setItem(`stage_${currentStageNumber}_judge_system`, 'color'); 
    judgeSystemType = 'color';
    localStorage.setItem(`stage_${currentStageNumber}_start_pt`, JSON.stringify(mazeStartPoint)); 
    localStorage.setItem(`stage_${currentStageNumber}_goal_pt`, JSON.stringify(mazeGoalPoint));
    
    alert(`ステージ ${currentStageNumber} の登録が完了しました！`); 
    goBackMenu();
}

function getAllPoints() { return strokeHistory.flat(); }

/* 💡 タイトル入力に対応させた最新版の saveTraceModeData */
function saveTraceModeData() {
    const allPts = getAllPoints(); if (allPts.length < 5) { alert("ルートがなぞられていません。"); return; }
    savedRoute = allPts.filter((_, idx) => idx % 3 === 0); savedRoute.push(allPts[allPts.length - 1]);
    
    const titleInput = document.getElementById('stage-title-input-b').value.trim();
    const finalTitle = titleInput || `ステージ ${currentStageNumber}`;

    localStorage.setItem(`stage_${currentStageNumber}_title`, finalTitle);
    localStorage.setItem(`stage_${currentStageNumber}_route`, JSON.stringify(savedRoute)); 
    localStorage.setItem(`stage_${currentStageNumber}_judge_system`, 'trace'); 
    judgeSystemType = 'trace';
    
    alert(`ステージ ${currentStageNumber} のお手本ルート保存が完了しました！`); 
    goBackMenu();
}

/* ==========================================
   判定ロジック本体
   ========================================== */
function checkRealtimeGoalTouch(x, y) {
    if (hasJudged) return;
    if (judgeSystemType === 'color') {
        if (!mazeGoalPoint) return;
        if (Math.hypot(x - mazeGoalPoint.x, y - mazeGoalPoint.y) < CONFIG.goalTolerance) { isDrawing = false; hasJudged = true; setTimeout(checkAnswerColor, 100); }
    } else if (judgeSystemType === 'trace') {
        if (savedRoute.length === 0) return;
        const correctEnd = savedRoute[savedRoute.length - 1];
        if (Math.hypot(x - correctEnd.x, y - correctEnd.y) < CONFIG.goalTolerance) { isDrawing = false; hasJudged = true; setTimeout(checkAnswerTrace, 100); }
    }
}

function checkAnswerColor() {
    hiddenCanvas.width = canvas.width; 
    hiddenCanvas.height = canvas.height;
    hiddenCtx.drawImage(imgAnswerObj, 0, 0, canvas.width, canvas.height);
    
    const allPts = getAllPoints();
    
    if (mazeStartPoint && allPts.length > 0) {
        if (Math.hypot(allPts[0].x - mazeStartPoint.x, allPts[0].y - mazeStartPoint.y) > CONFIG.startTolerance) {
            alert("残念！スタート地点から正しく描き始められていないようです。"); 
            hasJudged = false; 
            return;
        }
    }
    
    let totalCheckPoints = 0;
    let onRedRouteCount = 0;

    for (let stroke of strokeHistory) {
        if (stroke.length === 0) continue;
        for (let i = 0; i < stroke.length; i++) {
            let pt = stroke[i];
            totalCheckPoints++; 
            
            const pixel = hiddenCtx.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data;
            const r = pixel[0]; 
            const g = pixel[1]; 
            const b = pixel[2]; 
            const a = pixel[3]; 

            if (r > 150 && g < 100 && b < 100 && a > 200) {
                onRedRouteCount++; 
            }
        }
    }

    const traceAccuracy = totalCheckPoints > 0 ? (onRedRouteCount / totalCheckPoints) : 0;

    if (traceAccuracy >= 0.80) { 
        stopMazeTimer();
        alert("正解！おめでとうございます！"); 
        resetCanvas(); 
        goBackMenu(); 
    } else { 
        alert("残念！正しいルートを大きく外れてしまっているようです。\nメニューの「1つ戻る」ボタンでやり直せますよ！"); 
        hasJudged = false; 
    }
}

function checkAnswerTrace() {
    const allPts = getAllPoints();
    if (Math.hypot(allPts[0].x - savedRoute[0].x, allPts[0].y - savedRoute[0].y) > CONFIG.startTolerance) {
        alert("残念！スタート位置から正しくなぞれていないみたい。"); hasJudged = false; return;
    }
    let currentTargetIndex = 0; let maxReachedIndex = 0;
    for (let uPt of allPts) {
        if (currentTargetIndex < savedRoute.length) {
            if (Math.hypot(uPt.x - savedRoute[currentTargetIndex].x, uPt.y - savedRoute[currentTargetIndex].y) < CONFIG.startTolerance) {
                currentTargetIndex++; if (currentTargetIndex > maxReachedIndex) { maxReachedIndex = currentTargetIndex; }
            }
        }
    }
    if ((maxReachedIndex / savedRoute.length) >= 0.80) { stopMazeTimer();alert("正解！おめでとうございます！"); resetCanvas(); goBackMenu(); }
    else { alert("残念！正しいルートを大きく外れてしまっているようです。\nメニューの「1つ戻る」ボタンでやり直せますよ！"); hasJudged = false; }
}

/* ==========================================
   ⏱️ 高精度ミリ秒タイマーの設定
   ========================================== */
let mazeStartTime = 0;      
let mazeTimerInterval = null; 
let isMazeTimerRunning = false; 

function startMazeTimer() {
    if (isMazeTimerRunning) return; 
    isMazeTimerRunning = true;
    mazeStartTime = Date.now(); 
    
    mazeTimerInterval = setInterval(() => {
        const elapsedTime = Date.now() - mazeStartTime; 
        document.getElementById('timer-display').innerText = "TIME: " + formatMazeTime(elapsedTime);
    }, 10);
}

function stopMazeTimer() {
    if (!isMazeTimerRunning) return;
    isMazeTimerRunning = false;
    clearInterval(mazeTimerInterval); 
}

function formatMazeTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10); 
    
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const msm = String(milliseconds).padStart(2, '0');
    
    return `${mm}:${ss}.${msm}`;
}

function adminSelectStage(stageNumber) {
    loadStageData(stageNumber);
    pageTitle.innerText = adminSubMode === 'imageMode' ? `画像2枚登録 (Stage ${stageNumber})` : `なぞりお手本登録 (Stage ${stageNumber})`;
    resetCanvas();
    alert(`編集対象を ステージ ${stageNumber} に切り替えました。画像をアップロードして登録してください。`);
}

/* ==========================================
   ✨ ステージリストの自動組み立てと新規追加
   ========================================== */
const oldOnload = window.onload;
window.onload = function() {
    if (typeof oldOnload === 'function') oldOnload();
    refreshStageMenu();
};

function refreshStageMenu() {
    const stageContainer = document.querySelector('.stage-container');
    if (!stageContainer) return;

    stageContainer.innerHTML = "";

    let maxStage = 1;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const match = key.match(/^stage_(\d+)_image$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxStage) maxStage = num;
        }
    }

    for (let i = 1; i <= maxStage; i++) {
        const hasImg = localStorage.getItem(`stage_${i}_image`);
        
        const customTitle = localStorage.getItem(`stage_${i}_title`);
        const titleText = hasImg ? (customTitle || `ステージ ${i}`) : `（未登録のステージです）`;

        let imageBoxHtml = `<div class="image-placeholder">STAGE ${i}</div>`;
        if (hasImg) {
            imageBoxHtml = `<div class="image-placeholder" style="background-image: url('${hasImg}'); background-size: cover; background-position: center; color: transparent;">STAGE ${i}</div>`;
        }

        const card = document.createElement('div');
        card.className = 'stage-card';
        card.setAttribute('onclick', `startGame(${i})`);
        card.innerHTML = `
            <div class="stage-image-box">
                ${imageBoxHtml}
            </div>
            <div class="stage-info">
                <div class="stage-number">Stage ${String(i).padStart(2, '0')}</div>
                <div class="stage-title">${titleText}</div>
            </div>
        `;
        stageContainer.appendChild(card);
    }

    const addCard = document.createElement('div');
    addCard.className = 'stage-card';
    addCard.style.borderStyle = 'dashed';
    addCard.style.background = '#fafafa';
    addCard.setAttribute('onclick', `addNewStageAction(${maxStage + 1})`);
    addCard.innerHTML = `
        <div class="stage-image-box" style="border-style: dashed;">
            <div class="image-placeholder" style="font-size: 20px;">＋</div>
        </div>
        <div class="stage-info">
            <div class="stage-number" style="color: #666;">NEW STAGE</div>
            <div class="stage-title" style="color: #666;">新しいステージを追加する</div>
        </div>
    `;
    stageContainer.appendChild(addCard);
}

function addNewStageAction(nextStageNumber) {
    loadStageData(nextStageNumber);
    openAdmin('imageMode'); 
}

const originalGoBackMenu = goBackMenu;
goBackMenu = function() {
    if (typeof originalGoBackMenu === 'function') originalGoBackMenu();
    refreshStageMenu();
};
