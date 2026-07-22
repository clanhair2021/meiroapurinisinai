/* ==========================================
   ⚙️ システム設定
   ========================================== */
const CONFIG = {
    userStrokeColor: "rgba(0, 191, 255, 0.85)",   /* プレイヤーが引く線（黒の半透明） */
    adminStrokeColor: "rgba(0, 191, 255, 0.85)",  /* 管理者がお手本をなぞる時の色 */
    strokeWidth: 5,                          /* 線の太さ */
    goalTolerance: 12,                       /* ゴール位置判定の甘さ */
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
let judgeSystemType = 'color'; let savedRoute = [];
let mazeStartPoint = null; let mazeGoalPoint = null; let setupStep = 'none';
let currentStageNumber = 1;

/* ==========================================
   📦 プリセット（最初から入っている）ステージデータ
   ========================================== */
const PRESET_STAGES = [
    {
        number: 1,
        title: "北海道",
        image: "stages/stage1.jpg",            // 問題画像
        answerImage: "stages/stage1_ans.jpg",  // 正解画像（赤・青・黄が入った画像）
        judgeSystem: "color"
    },
    {
        number: 2,
        title: "青森県",
        image: "stages/stage2.jpg",
        answerImage: "stages/stage2_ans.jpg",
        judgeSystem: "color"
    }
];

/* ==========================================
   初期化・画像読み込みと自動フィット
   ========================================== */
window.onload = function() {
    loadStageData(1);
    refreshStageMenu();
    window.addEventListener('resize', adjustCanvasSize);
};

/* 🔍 正解画像から「青(スタート)」「緑(ゴール)」を自動判定する処理 */
function autoDetectStartAndGoal(ansImgObj) {
    if (!ansImgObj.complete || ansImgObj.naturalWidth === 0) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = ansImgObj.naturalWidth;
    tempCanvas.height = ansImgObj.naturalHeight;
    tempCtx.drawImage(ansImgObj, 0, 0);

    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
    let foundStart = null;
    let foundGoal = null;

    // 4ピクセル単位で走査（高速化のため）
    for (let y = 0; y < tempCanvas.height; y += 4) {
        for (let x = 0; x < tempCanvas.width; x += 4) {
            const i = (y * tempCanvas.width + x) * 4;
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            if (a < 200) continue;

            // 青色判定 (スタート)
            if (!foundStart && b > 180 && r < 100 && g < 100) {
                foundStart = { x: x, y: y };
            }
            // 緑色判定 (ゴール)
            if (!foundGoal && g > 180 && r < 100 && b < 100) {
                foundGoal = { x: x, y: y };
            }

            if (foundStart && foundGoal) break;
        }
        if (foundStart && foundGoal) break;
    }

    // 表示用キャンバスの解像度スケール比率を計算して位置を補正
    const scaleX = canvas.width / tempCanvas.width;
    const scaleY = canvas.height / tempCanvas.height;

    if (foundStart) mazeStartPoint = { x: foundStart.x * scaleX, y: foundStart.y * scaleY };
    if (foundGoal) mazeGoalPoint = { x: foundGoal.x * scaleX, y: foundGoal.y * scaleY };
}

/* ✨ 指定されたステージのデータをローカルストレージ・プリセットから読み込む関数 */
function loadStageData(stageNumber) {
    currentStageNumber = stageNumber;
    const preset = PRESET_STAGES.find(s => s.number === stageNumber);

    const localImage = localStorage.getItem(`stage_${stageNumber}_image`) || (preset ? preset.image : "");
    const localRoute = localStorage.getItem(`stage_${stageNumber}_route`);
    const localSystem = localStorage.getItem(`stage_${stageNumber}_judge_system`) || (preset ? preset.judgeSystem : "color");
    const localAnsImg = localStorage.getItem(`stage_${stageNumber}_answer_image`) || (preset ? preset.answerImage : "");
    const localStart = localStorage.getItem(`stage_${stageNumber}_start_pt`);
    const localGoal = localStorage.getItem(`stage_${stageNumber}_goal_pt`);

    // いったんデータをリセット
    mazeBg.src = "";
    mazeBg.style.display = 'none';
    savedRoute = [];
    imgAnswerObj.src = "";
    mazeStartPoint = null;
    mazeGoalPoint = null;
    judgeSystemType = localSystem;

    // 選択されたステージのデータを反映
    if (localImage) { mazeBg.src = localImage; mazeBg.style.display = 'block'; }
    if (judgeSystemType === 'trace' && localRoute) { savedRoute = JSON.parse(localRoute); }
    
    // 2枚画像判定（color）の読み込みと自動スタート・ゴール位置判定
    if (localAnsImg) { 
        imgAnswerObj.src = localAnsImg;
        imgAnswerObj.onload = function() {
            if (!localStart || !localGoal) {
                autoDetectStartAndGoal(imgAnswerObj);
            }
        };
    }

    if (localStart) mazeStartPoint = JSON.parse(localStart);
    if (localGoal) mazeGoalPoint = JSON.parse(localGoal);
}

mazeBg.onload = function() {
    isLandscape = mazeBg.naturalWidth > mazeBg.naturalHeight;
    adjustCanvasSize();
};

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
        targetWidth = screenWidth;
        targetHeight = screenWidth / imgRatio;
    } else {
        targetHeight = screenHeight;
        targetWidth = screenHeight * imgRatio;
    }

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

document.addEventListener('touchstart', function(e) {
    const drawer = document.getElementById('drawer-menu');
    const toggleBtn = document.getElementById('menu-toggle');
    if (drawer && drawer.classList.contains('open') && !drawer.contains(e.target) && e.target !== toggleBtn) {
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

function openAdmin(mode) {
    const setCont = document.getElementById('settingsContent');
    if (setCont) setCont.classList.remove('open');
    isAdminMode = true; adminSubMode = mode; setupStep = 'none';
    pageTitle.innerText = mode === 'imageMode' ? `画像2枚登録 (Stage ${currentStageNumber})` : `なぞりお手本登録 (Stage ${currentStageNumber})`;
    
    const statusEl = document.getElementById('setup-status');
    if (statusEl) statusEl.innerText = "位置を指定してください";
    
    setMode('draw');
    
    document.getElementById('admin-controls').style.display = 'block';
    ctrlImageMode.style.display = mode === 'imageMode' ? 'block' : 'none';
    ctrlTraceMode.style.display = mode === 'traceMode' ? 'block' : 'none';
    
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
        const drawer = document.getElementById('drawer-menu');
        if (drawer) drawer.classList.add('open');
    }, 200);
}

function goBackMenu() { 
    stopMazeTimer(); 
    document.getElementById('timer-display').innerText = "TIME: 00:00.00"; 
    gamePage.classList.remove('active'); 
    menuPage.classList.add('active'); 
    refreshStageMenu();
}

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

function undoLastLine() { 
    if (strokeHistory.length > 0) { 
        strokeHistory.pop()
        hasJudged = false;
        redrawAllHistory(); } }

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
    const pos = getTouchPos(e); 
    currentStroke.push(pos); 
    ctx.lineTo(pos.x, pos.y); 
    ctx.stroke();

    // ⭕️ ゴール判定の前に今描いている線を履歴に保存（ゴールに達したらそのまま描き終わりにさせる）
    if (!isAdminMode) { 
        if (strokeHistory.indexOf(currentStroke) === -1) {
            strokeHistory.push(currentStroke);
        }
        checkRealtimeGoalTouch(pos.x, pos.y); 
    }
});


canvas.addEventListener('touchend', () => { 
    if (isDrawing && currentStroke.length > 0) { 
        strokeHistory.push(currentStroke); 
    } 
    isDrawing = false; 
    startTouchDistance = 0; 
});

/* ==========================================
   画像アップロードと保存
   ========================================== */
document.getElementById('img-question')?.addEventListener('change', (e) => { loadImgToBg(e.target.files[0]); });
document.getElementById('img-single')?.addEventListener('change', (e) => { loadImgToBg(e.target.files[0]); });
document.getElementById('img-answer')?.addEventListener('change', (e) => {
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

function saveImageModeData() {
    if(!mazeBg.src || !imgAnswerObj.src) { alert("問題と答えの両方の画像をセットしてください。"); return; }
    if(!mazeStartPoint || !mazeGoalPoint) { alert("スタート位置とゴール位置を画面上で指定してください。"); return; }
    
    const inputEl = document.getElementById('stage-title-input-a');
    const titleInput = inputEl ? inputEl.value.trim() : "";
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

function saveTraceModeData() {
    const allPts = getAllPoints(); if (allPts.length < 5) { alert("ルートがなぞられていません。"); return; }
    savedRoute = allPts.filter((_, idx) => idx % 3 === 0); savedRoute.push(allPts[allPts.length - 1]);
    
    const inputEl = document.getElementById('stage-title-input-b');
    const titleInput = inputEl ? inputEl.value.trim() : "";
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
        if (Math.hypot(x - mazeGoalPoint.x, y - mazeGoalPoint.y) < CONFIG.goalTolerance) { 
            isDrawing = false; 
            hasJudged = true; 
            checkAnswerColor(); // ⭕️ setTimeout をやめて即時実行！
        }
    } else if (judgeSystemType === 'trace') {
        if (savedRoute.length === 0) return;
        const correctEnd = savedRoute[savedRoute.length - 1];
        if (Math.hypot(x - correctEnd.x, y - correctEnd.y) < CONFIG.goalTolerance) { 
            isDrawing = false; 
            hasJudged = true; 
            checkAnswerTrace(); // ⭕️ setTimeout をやめて即時実行！
        }
    }
}


function checkAnswerColor() {
    hiddenCanvas.width = canvas.width; 
    hiddenCanvas.height = canvas.height;
    hiddenCtx.drawImage(imgAnswerObj, 0, 0, canvas.width, canvas.height);
    
    // 全ての線データを取得
    const allPts = getAllPoints();
    if (allPts.length === 0) {
        hasJudged = false;
        return;
    }
    
    // ① スタート地点のチェック
    if (mazeStartPoint) {
        if (Math.hypot(allPts[0].x - mazeStartPoint.x, allPts[0].y - mazeStartPoint.y) > CONFIG.startTolerance) {
            alert("残念！スタート地点から正しく描き始められていないようです。"); 
            hasJudged = false; 
            return;
        }
    }

    // ② 正解画像（隠しキャンバス）のピクセルデータを取得
    const imgData = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height).data;
    const waypoints = [];
    const step = 15;

    for (let y = 0; y < hiddenCanvas.height; y += step) {
        for (let x = 0; x < hiddenCanvas.width; x += step) {
            const idx = (y * hiddenCanvas.width + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            if (r > 180 && g > 180 && b < 100 && a > 200) {
                waypoints.push({ x: x, y: y, passed: false });
            }
        }
    }

    if (waypoints.length === 0) {
        alert("正解ルート（黄色）が画像から検出できませんでした。正解画像を確認してください。");
        hasJudged = false;
        return;
    }

    // ③ 通過チェック
    let passedCount = 0;
    const tolerance = 35;

    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        for (let j = 0; j < allPts.length; j++) {
            const pt = allPts[j];
            if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
                if (Math.hypot(pt.x - wp.x, pt.y - wp.y) < tolerance) {
                    passedCount++;
                    break;
                }
            }
        }
    }

    // ④ 通過率の計算と判定
    const passRate = waypoints.length > 0 ? (passedCount / waypoints.length) : 0;

    if (passRate >= 0.80) {
        stopMazeTimer();
        alert("正解！おめでとうございます！"); 
        resetCanvas(); 
        goBackMenu(); 
    } else { 
        alert(`残念！正解ルートを通っていません。（通過率: ${Math.round(passRate * 100)}%）\n「1つ戻る」でやり直せますよ！`); 
        hasJudged = false; 
    }
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
function refreshStageMenu() {
    const stageContainer = document.querySelector('.stage-container');
    if (!stageContainer) return;

    stageContainer.innerHTML = "";

    let maxStage = PRESET_STAGES.length;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const match = key.match(/^stage_(\d+)_image$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxStage) maxStage = num;
        }
    }

    for (let i = 1; i <= maxStage; i++) {
        const preset = PRESET_STAGES.find(s => s.number === i);
        const hasImg = localStorage.getItem(`stage_${i}_image`) || (preset ? preset.image : null);
        
        const customTitle = localStorage.getItem(`stage_${i}_title`) || (preset ? preset.title : null);
        const titleText = hasImg ? (customTitle || `ステージ ${i}`) : `（未登録のステージです）`;

        let imageBoxHtml = `<div class="image-placeholder">STAGE ${i}</div>`;
        if (hasImg) {
            imageBoxHtml = `<div class="image-placeholder" style="background-image: url('${hasImg}'); background-size: contain; background-repeat: no-repeat; background-position: center;"></div>`;
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

function checkAnswerTrace() {
    stopMazeTimer(); alert("正解！おめでとうございます！"); resetCanvas(); goBackMenu();
}
