const firebaseConfig = {
  apiKey: "AIzaSyDZvkVWeZKYcVAzMIxViwq2l7PVlSb6S3M",
  authDomain: "smart-waste-db.firebaseapp.com",
  databaseURL: "https://smart-waste-db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-waste-db",
  storageBucket: "smart-waste-db.firebasestorage.app",
  messagingSenderId: "744812148870",
  appId: "1:744812148870:web:162d9d749d623970887907"
};

// ============================================================
// 🔑 MULTI-KEY LOAD BALANCING
// ============================================================
const GROQ_API_KEYS = [
    "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",
    "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",
    "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",
];

let _groqKeyIndex = 0;

function getNextGroqKey() {
  const key = GROQ_API_KEYS[_groqKeyIndex % GROQ_API_KEYS.length];
  _groqKeyIndex++;
  return key;
}

// ============================================================
// ⏱️ COOLDOWN CONFIG
// ============================================================
const SCAN_COOLDOWN_MS = 8000;
let lastScanTime = 0;
let isScanInProgress = false;

// ============================================================
// 🖼️ IMAGE RESIZE CONFIG
// ============================================================
const IMG_MAX_PX   = 512;
const IMG_QUALITY  = 0.65;

// --- INIT FIREBASE ---
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

// --- VARIABLES ---
let currentLang = 'en';
let isSoundOn = true;
let userData = { score: 0, firstName: "", lastName: "", username: "", password: "", profilePic: "", inventory: [], activeXpBuff: null, activeLuckBuff: null };
let userId = "";
let isRegisterMode = false;
let tempProfilePic = "";

let deferredPrompt = null;
let wasteDonutChart = null;
let wasteBarChart = null;

let webcam, isRunning = false, animationId;
let useBackCamera = true; 

const textData = {
    en: {
        appName: "Smart Waste<br>Classifier",
        auth: { title: "Welcome Back", sub: "Sign in to continue", regTitle: "Create Account", regSub: "Join us today" },
        btnStart: "START CAMERA", btnScan: "SCAN OBJECT", loading: "Opening Camera...",
        analyzing: "Analyzing..."
    },
    th: {
        appName: "นักแยกขยะ<br>อัจฉริยะ",
        auth: { title: "ยินดีต้อนรับ", sub: "เข้าสู่ระบบเพื่อใช้งาน", regTitle: "สมัครสมาชิก", regSub: "สร้างบัญชีใหม่" },
        btnStart: "เริ่มเปิดกล้อง", btnScan: "กดเพื่อสแกน", loading: "กำลังเปิดกล้อง...",
        analyzing: "กำลังวิเคราะห์..."
    }
};

const RANK_SYSTEM = [
    { name: "Novice", minScore: 0, class: "rank-novice" },
    { name: "Eco Scout", minScore: 50, class: "rank-scout" },        
    { name: "Green Ranger", minScore: 150, class: "rank-ranger" },   
    { name: "Waste Hero", minScore: 300, class: "rank-hero" },       
    { name: "Eco Warrior", minScore: 600, class: "rank-warrior" },   
    { name: "Earth Guardian", minScore: 1000, class: "rank-guardian" },
    { name: "Waste Master", minScore: 2000, class: "rank-master" },
    { name: "Eco Legend", minScore: 5000, class: "rank-legend" }     
];

const ITEM_DB = [
    { id: "xp01", name: "Energy Drink", icon: "⚡", rarity: "Common", desc: "XP x1.5 (10 Mins)", type: "xp_boost", duration: 10, val: 1.5 },
    { id: "xp02", name: "Textbook", icon: "📚", rarity: "Rare", desc: "XP x2.0 (20 Mins)", type: "xp_boost", duration: 20, val: 2.0 },
    { id: "xp03", name: "Golden Brain", icon: "🧠", rarity: "Epic", desc: "XP x3.0 (30 Mins)", type: "xp_boost", duration: 30, val: 3.0 },
    { id: "xp04", name: "Alien Chip", icon: "👽", rarity: "Legendary", desc: "XP x5.0 (1 Hour)", type: "xp_boost", duration: 60, val: 5.0 },
    { id: "luk01", name: "Glass Eye", icon: "👁️", rarity: "Common", desc: "Drop Chance +5% (10 Mins)", type: "luck_boost", duration: 10, val: 5 },
    { id: "luk02", name: "Magnet", icon: "🧲", rarity: "Rare", desc: "Drop Chance +10% (20 Mins)", type: "luck_boost", duration: 20, val: 10 },
    { id: "luk03", name: "Lucky Cat", icon: "🐱", rarity: "Epic", desc: "Drop Chance +20% (30 Mins)", type: "luck_boost", duration: 30, val: 20 }
];

let pendingItem = null;

function rollItemDrop() {
    const baseChance = 12; 
    let luckBonus = 0;

    if (userData.activeLuckBuff) {
        if (Date.now() < userData.activeLuckBuff.expireAt) {
            luckBonus = userData.activeLuckBuff.val;
        } else {
            db.ref('users/' + userId).update({ activeLuckBuff: null });
            userData.activeLuckBuff = null;
        }
    }

    const finalChance = baseChance + luckBonus;
    console.log(`Drop Rate: ${finalChance}% (Base: ${baseChance} + Bonus: ${luckBonus})`);

    if (Math.random() * 100 > finalChance) return null; 

    const rRoll = Math.random() * 100;
    let rarityPool = [];
    
    if (rRoll < 70) rarityPool = ITEM_DB.filter(i => i.rarity === "Common");
    else if (rRoll < 95) rarityPool = ITEM_DB.filter(i => i.rarity === "Rare");
    else if (rRoll < 99.5) rarityPool = ITEM_DB.filter(i => i.rarity === "Epic");
    else rarityPool = ITEM_DB.filter(i => i.rarity === "Legendary");

    if (rarityPool.length === 0) return ITEM_DB[0];
    return rarityPool[Math.floor(Math.random() * rarityPool.length)];
}

function useItem(itemIdToUse) {
    if(!userId) return;

    db.ref('users/' + userId).once('value').then(snapshot => {
        const u = snapshot.val();
        let inv = u.inventory || [];
        
        const index = inv.findIndex(i => i.id === itemIdToUse);
        if (index === -1) return;

        const dbItem = ITEM_DB.find(x => x.id === itemIdToUse);
        if (!dbItem) return;

        const confirmMsg = currentLang === 'en' 
            ? `Activate ${dbItem.name}? (${dbItem.duration} mins)` 
            : `ยืนยันใช้ "${dbItem.name}" หรือไม่?\n(มีผล ${dbItem.duration} นาที)`;
        
        if (confirm(confirmMsg)) {
            inv.splice(index, 1);
            
            const expireTime = Date.now() + (dbItem.duration * 60 * 1000);
            const newBuff = { itemId: dbItem.id, expireAt: expireTime, val: dbItem.val, name: dbItem.name };
            
            let updates = { inventory: inv };

            if (dbItem.type === 'xp_boost') { updates.activeXpBuff = newBuff; } 
            else if (dbItem.type === 'luck_boost') { updates.activeLuckBuff = newBuff; }

            db.ref('users/' + userId).update(updates).then(() => {
                userData.inventory = inv;
                if(dbItem.type === 'xp_boost') userData.activeXpBuff = newBuff;
                if(dbItem.type === 'luck_boost') userData.activeLuckBuff = newBuff;
                
                alert(currentLang === 'en' ? "Buff Activated!" : "เริ่มใช้งานไอเทมแล้ว! รีบสแกนเลย!");
                openInventory(); 
            });
        }
    });
}

function calculateXPWithBuff(baseXP) {
    let multiplier = 1;
    let isBuffActive = false;

    if (userData.activeXpBuff) {
        if (Date.now() < userData.activeXpBuff.expireAt) {
            multiplier = userData.activeXpBuff.val;
            isBuffActive = true;
        } else {
            db.ref('users/' + userId).update({ activeXpBuff: null });
            userData.activeXpBuff = null;
        }
    }
    const finalXP = Math.floor(baseXP * multiplier);
    return { total: finalXP, multiplier: multiplier, active: isBuffActive };
}

function showItemDropModal(item) {
    document.getElementById('drop-animation').innerText = item.icon;
    document.getElementById('drop-name').innerText = item.name;
    document.getElementById('drop-desc').innerText = item.desc;
    
    const rBadge = document.getElementById('drop-rarity');
    rBadge.innerText = item.rarity.toUpperCase();
    rBadge.className = "rank-badge";
    rBadge.classList.remove("rank-novice", "rank-scout", "rank-guardian", "rank-legend");
    
    if(item.rarity === "Common") rBadge.classList.add("rank-novice");
    else if(item.rarity === "Rare") rBadge.classList.add("rank-scout");
    else if(item.rarity === "Epic") rBadge.classList.add("rank-guardian");
    else if(item.rarity === "Legendary") rBadge.classList.add("rank-legend");

    document.getElementById('item-drop-modal').style.display = 'flex';
}

function closeItemDropModal() { document.getElementById('item-drop-modal').style.display = 'none'; }

function saveItemToInventory(item) {
    if(!userId) return;
    db.ref('users/' + userId + '/inventory').once('value').then(snapshot => {
        let inv = snapshot.val() || [];
        if(!Array.isArray(inv)) inv = [];
        inv.push(item);
        db.ref('users/' + userId).update({ inventory: inv });
    });
}

function openInventory() {
    const modal = document.getElementById('inventory-modal');
    const grid = document.getElementById('inventory-grid');
    const buffContainer = document.getElementById('active-buff-container');
    
    grid.innerHTML = '<p>Loading...</p>';
    modal.style.display = 'flex';

    if(!userId) {
        grid.innerHTML = '<p>Please Login first.</p>';
        return;
    }

    db.ref('users/' + userId).once('value').then(snapshot => {
        const u = snapshot.val();
        const inv = u.inventory || [];
        userData.activeXpBuff = u.activeXpBuff || null;
        userData.activeLuckBuff = u.activeLuckBuff || null;

        grid.innerHTML = '';
        buffContainer.innerHTML = '';

        let buffsHtml = '';
        
        if (userData.activeXpBuff && Date.now() < userData.activeXpBuff.expireAt) {
            const timeLeft = Math.ceil((userData.activeXpBuff.expireAt - Date.now()) / 60000);
            buffsHtml += `<div style="background:#fff3bf; border:1px solid #f08c00; color:#e67700; padding:8px; border-radius:8px; margin-bottom:5px; font-size:0.85rem;"><b>⚡ XP Boost x${userData.activeXpBuff.val}</b> (${timeLeft} mins left)</div>`;
        }

        if (userData.activeLuckBuff && Date.now() < userData.activeLuckBuff.expireAt) {
            const timeLeft = Math.ceil((userData.activeLuckBuff.expireAt - Date.now()) / 60000);
            buffsHtml += `<div style="background:#d3f9d8; border:1px solid #2b8a3e; color:#2b8a3e; padding:8px; border-radius:8px; margin-bottom:5px; font-size:0.85rem;"><b>🍀 Drop Rate +${userData.activeLuckBuff.val}%</b> (${timeLeft} mins left)</div>`;
        }

        buffContainer.innerHTML = buffsHtml || `<div style="text-align:center; color:#999; font-size:0.8rem;">No active buffs</div>`;

        if(inv.length === 0) {
            grid.innerHTML += '<p style="grid-column: 1/-1; text-align: center; color:#999;">Bag is empty. Scan waste to find items!</p>';
            return;
        }

        const stackedItems = {};
        inv.forEach(item => {
            if (stackedItems[item.id]) {
                stackedItems[item.id].count++;
            } else {
                stackedItems[item.id] = { ...item, count: 1 };
            }
        });

        Object.values(stackedItems).forEach((itemObj) => {
            const itemData = ITEM_DB.find(x => x.id === itemObj.id);
            if (!itemData) return;

            const div = document.createElement('div');
            div.className = `item-slot rarity-${itemData.rarity.toLowerCase()}`;
            
            const countBadge = itemObj.count > 1 ? `<div class="item-count">x${itemObj.count}</div>` : '';

            div.innerHTML = `
                ${countBadge}
                <div style="position:absolute; top:5px; right:5px; background:#f08c00; color:white; font-size:0.6rem; padding:2px 5px; border-radius:4px;">USE</div>
                <span class="item-icon">${itemData.icon}</span>
                <div class="item-name">${itemData.name}</div>
                <div style="font-size:0.65rem; color:#666;">${itemData.desc}</div>
            `;
            
            div.onclick = () => useItem(itemData.id);
            grid.appendChild(div);
        });
    });
}

function closeInventory() { document.getElementById('inventory-modal').style.display = 'none'; }

function openTutorial() { document.getElementById('tutorial-modal').style.display = 'flex'; }
function closeTutorial() { document.getElementById('tutorial-modal').style.display = 'none'; }

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    updateAuthText();
    const regNames = document.getElementById('register-names');
    const regPic = document.getElementById('reg-pic-container');
    const errorDiv = document.getElementById('auth-error');
    const toggle = document.getElementById('toggle-text');
    const btn = document.getElementById('btn-auth');

    errorDiv.innerText = "";
    if (isRegisterMode) {
        btn.innerText = (currentLang === 'en') ? "REGISTER" : "สมัครสมาชิก";
        toggle.innerHTML = (currentLang === 'en') ? "Already have an account? <b>Login</b>" : "มีบัญชีแล้ว? <b>เข้าสู่ระบบ</b>";
        regNames.style.display = "block";
        regPic.style.display = "block";
    } else {
        btn.innerText = (currentLang === 'en') ? "LOGIN" : "เข้าสู่ระบบ";
        toggle.innerHTML = (currentLang === 'en') ? "Don't have an account? <b>Register</b>" : "ยังไม่มีบัญชี? <b>สมัครสมาชิก</b>";
        regNames.style.display = "none";
        regPic.style.display = "none";
    }
}

function updateAuthText() {
    const t = textData[currentLang].auth;
    document.getElementById('auth-title').innerText = isRegisterMode ? t.regTitle : t.title;
    document.getElementById('auth-subtitle').innerText = isRegisterMode ? t.regSub : t.sub;
}

function handleImageUpload(input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxSize = 200; 
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
                else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
                canvas.width = w; canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                tempProfilePic = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById(previewId).src = tempProfilePic;
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function handleAuthAction() {
    const userIn = document.getElementById('username-input').value.trim();
    const passIn = document.getElementById('password-input').value.trim();
    const errorDiv = document.getElementById('auth-error');
    
    if(!userIn || !passIn) return errorDiv.innerText = (currentLang === 'en') ? "Please fill all fields" : "กรุณากรอกข้อมูลให้ครบ";

    const safeId = userIn.replace(/[.#$/\[\]]/g, "_");
    const btn = document.getElementById('btn-auth');
    btn.disabled = true; btn.innerText = "...";

    db.ref('users/' + safeId).once('value').then(snapshot => {
        if (isRegisterMode) {
            if (snapshot.exists()) {
                errorDiv.innerText = (currentLang === 'en') ? "Username taken" : "ชื่อนี้ถูกใช้แล้ว";
                btn.disabled = false; btn.innerText = "REGISTER";
            } else {
                const first = document.getElementById('reg-firstname').value.trim() || userIn;
                const last = document.getElementById('reg-lastname').value.trim() || "";
                const newUser = { 
                    username: userIn, password: passIn, firstName: first, lastName: last, 
                    score: 0, profilePic: tempProfilePic, 
                    inventory: [], activeXpBuff: null, activeLuckBuff: null 
                };
                db.ref('users/' + safeId).set(newUser).then(() => loginSuccess(safeId, newUser));
            }
        } else {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.password === passIn) loginSuccess(safeId, data);
                else { errorDiv.innerText = (currentLang === 'en') ? "Wrong password" : "รหัสผ่านผิด"; btn.disabled = false; btn.innerText = "LOGIN"; }
            } else {
                errorDiv.innerText = (currentLang === 'en') ? "User not found" : "ไม่พบผู้ใช้"; btn.disabled = false; btn.innerText = "LOGIN";
            }
        }
    });
}

function loginSuccess(id, data) {
    userId = id; userData = data;
    updateUI(false);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'flex';
    loadDailyQuests();
    initIoTListener();
}

function logout() { location.reload(); }

function openProfileSettings() {
    document.getElementById('edit-firstname').value = userData.firstName || "";
    document.getElementById('edit-lastname').value = userData.lastName || "";
    document.getElementById('edit-password').value = userData.password || "";
    document.getElementById('edit-preview').src = userData.profilePic || "https://placehold.co/100x100/eee/999?text=U";
    tempProfilePic = userData.profilePic || ""; 
    document.getElementById('settings-modal').style.display = 'flex';
}
function closeProfileSettings() { document.getElementById('settings-modal').style.display = 'none'; }

function saveProfileChanges() {
    const newFirst = document.getElementById('edit-firstname').value.trim();
    const newLast = document.getElementById('edit-lastname').value.trim();
    const newPass = document.getElementById('edit-password').value.trim();
    if(!newFirst || !newPass) return alert("Required fields missing");

    const updates = { firstName: newFirst, lastName: newLast, password: newPass, profilePic: tempProfilePic || userData.profilePic };
    db.ref('users/' + userId).update(updates).then(() => {
        userData = { ...userData, ...updates };
        updateUI();
        closeProfileSettings();
        alert((currentLang === 'en') ? "Profile Updated!" : "อัปเดตข้อมูลแล้ว!");
    });
}

function getRank(score) {
    for (let i = RANK_SYSTEM.length - 1; i >= 0; i--) {
        if (score >= RANK_SYSTEM[i].minScore) {
            return RANK_SYSTEM[i];
        }
    }
    return RANK_SYSTEM[0];
}

function updateUI(checkLevelUp = false) {
    document.getElementById('display-name').innerText = userData.firstName;
    document.getElementById('big-score-val').innerText = (userData.score || 0);
    const imgUrl = userData.profilePic || "https://placehold.co/100x100/eee/999?text=" + (userData.firstName.charAt(0) || "U");
    document.getElementById('topbar-img').src = imgUrl;
    
    const t = textData[currentLang];
    document.getElementById('btn-lang').innerText = currentLang.toUpperCase();
    document.getElementById('login-lang-btn').innerText = currentLang.toUpperCase();
    document.querySelector('.app-title-login').innerHTML = t.appName;

    const oldRankEl = document.getElementById('user-rank');
    const oldRankName = oldRankEl.innerText;
    const currentRankObj = getRank(userData.score || 0);
    oldRankEl.innerText = currentRankObj.name;
    oldRankEl.className = `rank-badge ${currentRankObj.class}`;

    if (checkLevelUp && oldRankName !== currentRankObj.name && oldRankName !== "Beginner") {
         showLevelUpModal(currentRankObj.name);
    }

    const btnMain = document.getElementById('btn-main');
    const txtBtn = document.getElementById('txt-btn-start');
    if(isRunning) {
        txtBtn.innerText = textData[currentLang].btnScan;
    } else {
        txtBtn.innerText = textData[currentLang].btnStart;
    }
}

function showLevelUpModal(rankName) {
    const modal = document.getElementById('levelup-modal');
    document.getElementById('lvl-rank-name').innerText = rankName;
    modal.style.display = 'flex';
    for(let i=0; i<50; i++) { createConfetti(modal); }
}

function createConfetti(container) {
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f'];
    const conf = document.createElement('div');
    conf.classList.add('confetti');
    conf.style.left = Math.random() * 100 + '%';
    conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
    container.appendChild(conf);
    setTimeout(() => { conf.remove(); }, 5000);
}

function closeLevelUpModal() { document.getElementById('levelup-modal').style.display = 'none'; }
function toggleLanguage() { currentLang = (currentLang==='en')?'th':'en'; updateUI(); }
function toggleSound() { isSoundOn = !isSoundOn; document.getElementById('btn-sound').classList.toggle('active'); }

async function handleMainButton() {
    if (!isRunning) { startCamera(); } else { captureAndAnalyzeWithGroq(); }
}

async function startCamera() {
    const btn = document.getElementById('btn-main');
    const container = document.getElementById('webcam-container');
    const txtBtn = document.getElementById('txt-btn-start');

    btn.disabled = true; 
    txtBtn.innerText = textData[currentLang].loading;

    try {
        if (webcam && webcam.canvas) { webcam.stop(); webcam = null; }
        container.innerHTML = ""; 

        const size = IMG_MAX_PX;
        const flip = !useBackCamera; 
        
        webcam = new tmImage.Webcam(size, size, flip);
        let constraints = { facingMode: useBackCamera ? { exact: "environment" } : "user" };

        try { await webcam.setup(constraints); } catch (err) {
            constraints = { facingMode: useBackCamera ? "environment" : "user" };
            await webcam.setup(constraints);
        }

        await webcam.play();
        webcam.canvas.style.width = "100%"; webcam.canvas.style.height = "100%"; webcam.canvas.style.objectFit = "cover";
        webcam.canvas.setAttribute("playsinline", true);
        container.appendChild(webcam.canvas);

        isRunning = true;
        btn.classList.add('scanning-mode'); 
        btn.innerHTML = `<i class="bi bi-bullseye"></i> <span id="txt-btn-start">${textData[currentLang].btnScan}</span>`;
        btn.disabled = false;
        document.getElementById('btn-stop-cam').style.display = 'inline-flex';
        animationId = window.requestAnimationFrame(loop);

    } catch (e) {
        console.error(e);
        alert("Camera Error: " + e.message);
        stopScanning();
    }
}

function stopScanning() {
    isRunning = false; 
    cancelAnimationFrame(animationId);
    if(webcam) { webcam.stop(); webcam = null; }
    
    document.getElementById('scan-line').style.display = 'none';
    document.getElementById('btn-stop-cam').style.display = 'none'; 
    const btn = document.getElementById('btn-main');
    btn.classList.remove('scanning-mode');
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-camera-fill"></i> <span id="txt-btn-start">${textData[currentLang].btnStart}</span>`;
    
    const container = document.getElementById('webcam-container');
    if(container) {
        container.innerHTML = `<div id=\"placeholder-ui\" class=\"placeholder-content\"><div class=\"pulse-ring\"></div><i class=\"bi bi-camera-video-fill\"></i><p>Ready to Scan</p></div>`;
    }
}

function switchCameraMode() {
    useBackCamera = !useBackCamera;
    if(isRunning) { stopScanning(); setTimeout(() => { startCamera(); }, 500); }
}

async function loop() {
    if(isRunning && webcam) { webcam.update(); animationId = window.requestAnimationFrame(loop); }
}

function resizeCanvasForAI(srcCanvas) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const maxPx = IMG_MAX_PX;

    if (w <= maxPx && h <= maxPx) {
        return srcCanvas.toDataURL("image/jpeg", IMG_QUALITY);
    }

    const scale = maxPx / Math.max(w, h);
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width  = newW;
    offscreen.height = newH;
    offscreen.getContext('2d').drawImage(srcCanvas, 0, 0, newW, newH);

    return offscreen.toDataURL("image/jpeg", IMG_QUALITY);
}

async function captureAndAnalyzeWithGroq() {
    if (!webcam || !webcam.canvas) return;
    if (isScanInProgress) return;

    const now = Date.now();
    const elapsed = now - lastScanTime;
    if (elapsed < SCAN_COOLDOWN_MS) {
        const wait = Math.ceil((SCAN_COOLDOWN_MS - elapsed) / 1000);
        const msg = currentLang === 'en'
            ? `Please wait ${wait}s before scanning again.`
            : `รอ ${wait} วินาทีก่อนสแกนใหม่นะครับ`;
        alert(msg);
        return;
    }

    if (!GROQ_API_KEYS.length || GROQ_API_KEYS[0].includes("YOUR_GROQ")) {
        alert("Please set your GROQ_API_KEY in script.js first!");
        return;
    }

    isScanInProgress = true;
    lastScanTime = now;
    const btn = document.getElementById('btn-main');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${textData[currentLang].analyzing}`;
    document.getElementById('scan-line').style.display = 'block';

    const imageBase64 = resizeCanvasForAI(webcam.canvas);
    const usedKey = getNextGroqKey();
    console.log(`[Scan] Using Key index ${(_groqKeyIndex - 1) % GROQ_API_KEYS.length + 1}/${GROQ_API_KEYS.length}`);

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${usedKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Identify the waste object in this image.
Classify it STRICTLY based on Thai waste sorting rules:
1. "Recyclable" (Yellow Bin): Clean plastic bottles, glass, metal cans, paper, cardboard.
2. "Organic" (Green Bin): Food scraps, fruit peels, leaves.
3. "Hazardous" (Red Bin): Batteries, electronics, light bulbs, chemicals, medicine containers.
4. "General" (Blue Bin): Dirty plastic, snack wrappers, foam, tissues, wooden sticks, toothpaste tubes.

Return JSON ONLY with this exact structure, no markdown:
{"category":"Recyclable|Organic|Hazardous|General|Unknown","name_en":"...","name_th":"...","desc_en":"...","desc_th":"...","howto_en":"...","howto_th":"...","knowledge_en":"...","knowledge_th":"..."}`
                            },
                            { type: "image_url", image_url: { url: imageBase64 } }
                        ]
                    }
                ],
                temperature: 0.1,
                max_tokens: 400,
                response_format: { type: "json_object" }
            })
        });

        if (response.status === 429) {
            const retryKey = getNextGroqKey();
            console.warn(`[Scan] 429 Rate Limit! Retrying with next key...`);

            const retryRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${retryKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-4-scout-17b-16e-instruct",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `Identify the waste object in this image.
Classify STRICTLY based on Thai waste sorting rules:
1. "Recyclable": Clean plastic, glass, metal, paper.
2. "Organic": Food scraps, fruit peels, leaves.
3. "Hazardous": Batteries, electronics, chemicals.
4. "General": Dirty plastic, foam, tissues.
Return JSON ONLY: {"category":"...","name_en":"...","name_th":"...","desc_en":"...","desc_th":"...","howto_en":"...","howto_th":"...","knowledge_en":"...","knowledge_th":"..."}`
                                },
                                { type: "image_url", image_url: { url: imageBase64 } }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 400,
                    response_format: { type: "json_object" }
                })
            });

            if (!retryRes.ok) {
                const errJson = await retryRes.json().catch(() => ({}));
                throw new Error(errJson.error?.message || `HTTP ${retryRes.status} — Rate limit on all keys. Please wait a moment.`);
            }

            const retryJson = await retryRes.json();
            if (retryJson.error) throw new Error(retryJson.error.message);
            handleAIResult(JSON.parse(retryJson.choices[0].message.content), btn, originalText);
            return;
        }

        const json = await response.json();
        if (json.error) throw new Error(json.error.message);

        const resultData = JSON.parse(json.choices[0].message.content);
        handleAIResult(resultData, btn, originalText);

    } catch (error) {
        console.error("AI Error:", error);
        document.getElementById('scan-line').style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = originalText;

        const isRateLimit = error.message && error.message.toLowerCase().includes("rate limit");
        const userMsg = isRateLimit
            ? (currentLang === 'en'
                ? "⚠️ AI is busy right now. Please wait 10–15 seconds and try again."
                : "⚠️ AI ยุ่งอยู่ กรุณารอ 10-15 วินาทีแล้วลองใหม่ครับ")
            : "AI Error: " + error.message;

        alert(userMsg);
    } finally {
        isScanInProgress = false;
    }
}

function handleAIResult(resultData, btn, originalText) {
    document.getElementById('scan-line').style.display = 'none';
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (!resultData || resultData.category === "Unknown") {
        alert(currentLang === 'en' ? "No waste detected. Try again." : "ไม่พบขยะในภาพ ลองใหม่อีกครั้ง");
    } else {
        pendingItem = rollItemDrop();
        showResultPopupFromAI(resultData);
    }
}

function showResultPopupFromAI(aiData) {
    const card = document.getElementById('modal-card-content');
    
    const wasteStandards = {
        "Recyclable": { xp: 10, colorClass: "theme-yellow", icon: "bi-recycle", binNameEN: "Yellow Bin (Recycle)", binNameTH: "ถังเหลือง (รีไซเคิล)" },
        "Organic": { xp: 5, colorClass: "theme-green", icon: "bi-flower1", binNameEN: "Green Bin (Organic)", binNameTH: "ถังเขียว (อินทรีย์)" },
        "Hazardous": { xp: 15, colorClass: "theme-red", icon: "bi-exclamation-triangle-fill", binNameEN: "Red Bin (Hazardous)", binNameTH: "ถังแดง (อันตราย)" },
        "General": { xp: 2, colorClass: "theme-blue", icon: "bi-trash3-fill", binNameEN: "Blue Bin (General)", binNameTH: "ถังน้ำเงิน (ทั่วไป)" },
        "Unknown": { xp: 0, colorClass: "theme-blue", icon: "bi-question-circle", binNameEN: "Unknown Bin", binNameTH: "ไม่ทราบประเภท" }
    };

    const category = wasteStandards[aiData.category] ? aiData.category : "General";
    const info = wasteStandards[category];

    // 🆕 Feature integrations triggered on every successful scan
    logScan(category);
    sendIoTCommand(category);
    sendUSBCommand(category); // 🆕 สั่งงานผ่าน USB ให้เปิดมอเตอร์และไฟ
    updateQuestProgress(category);

    card.classList.remove('theme-yellow', 'theme-green', 'theme-red', 'theme-blue');
    card.classList.add(info.colorClass);

    const xpResult = calculateXPWithBuff(info.xp);
    let xpText = `+${xpResult.total} XP`;
    if (xpResult.multiplier > 1) {
        xpText += ` (Boost x${xpResult.multiplier} 🔥)`;
    }
    document.getElementById('res-xp').innerText = xpText;

    const isTH = currentLang === 'th';
    document.getElementById('res-title').innerText = isTH ? aiData.name_th : aiData.name_en;
    document.getElementById('res-bin').innerText = isTH ? info.binNameTH : info.binNameEN;
    document.getElementById('res-desc').innerText = isTH ? aiData.desc_th : aiData.desc_en;
    document.getElementById('res-knowledge').innerText = isTH ? aiData.knowledge_th : aiData.knowledge_en;
    document.getElementById('res-howto').innerText = isTH ? aiData.howto_th : aiData.howto_en;
    document.getElementById('res-icon').className = `bi ${info.icon}`;

    document.getElementById('result-modal').style.display = "flex";
    
    if(isSoundOn) {
        const textToSpeak = isTH ? `${aiData.name_th}. ${info.binNameTH}` : `${aiData.name_en}. ${info.binNameEN}`;
        const u = new SpeechSynthesisUtterance(textToSpeak);
        u.lang = isTH ? 'th-TH' : 'en-US';
        window.speechSynthesis.speak(u);
    }
    
    userData.score = (userData.score || 0) + xpResult.total;
    if(userId) {
        db.ref('users/' + userId).update({ score: userData.score });
    }
    updateUI(true); 
}

function closeResultModal() {
    document.getElementById('result-modal').style.display = 'none';
    if (pendingItem) {
        showItemDropModal(pendingItem);
        saveItemToInventory(pendingItem);
        pendingItem = null;
    }
}

document.getElementById('username-input').addEventListener("keyup", function(event) {
    if (event.key === "Enter") handleAuthAction();
});

function getTodayDateStr() {
    return new Date().toISOString().slice(0, 10);
}

function setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('nav-' + page);
    if (el) el.classList.add('active');
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.style.display = 'block';
});
window.addEventListener('appinstalled', () => { dismissPWA(); });

function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; dismissPWA(); });
}
function dismissPWA() {
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.style.display = 'none';
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[SW] Registered:', reg.scope))
            .catch(err => console.warn('[SW] Failed:', err));
    });
}

function logScan(category) {
    if (!userId) return;
    const statsRef = db.ref('users/' + userId + '/scanStats');
    statsRef.once('value').then(snap => {
        const stats = snap.val() || { Recyclable: 0, Organic: 0, Hazardous: 0, General: 0, total: 0 };
        stats[category] = (stats[category] || 0) + 1;
        stats.total = (stats.total || 0) + 1;
        statsRef.set(stats);
    });
}

const CATEGORY_TO_BIN = { 'Recyclable': 'yellow', 'Organic': 'green', 'Hazardous': 'red', 'General': 'blue' };
let iotAutoCloseTimer = null;

function openIoTPanel() {
    setActiveNav('iot');
    document.getElementById('iot-modal').style.display = 'flex';
}
function closeIoTPanel() {
    document.getElementById('iot-modal').style.display = 'none';
    setActiveNav('home');
}

function initIoTListener() {
    db.ref('iotBins').on('value', snapshot => {
        updateIoTUI(snapshot.val() || {});
    });
}

function updateIoTUI(binsData) {
    ['yellow', 'green', 'red', 'blue'].forEach(color => {
        const binData = binsData[color] || { open: false };
        const card = document.getElementById('iot-' + color);
        const badge = document.getElementById('iot-status-' + color);
        if (!card || !badge) return;
        if (binData.open) {
            card.classList.add('iot-open');
            badge.className = 'iot-status-badge iot-open-state';
            badge.textContent = '● เปิดอยู่';
        } else {
            card.classList.remove('iot-open');
            badge.className = 'iot-status-badge iot-closed';
            badge.textContent = '● ปิด';
        }
    });
}

function sendIoTCommand(category) {
    const binColor = CATEGORY_TO_BIN[category];
    if (!binColor) return;
    const updates = {};
    ['yellow', 'green', 'red', 'blue'].forEach(color => {
        updates['iotBins/' + color + '/open'] = (color === binColor);
        updates['iotBins/' + color + '/lastUpdated'] = Date.now();
    });
    updates['iotBins/' + binColor + '/lastOpenedBy'] = userData.firstName || userId;
    db.ref().update(updates);
    // Auto-close synced with Micro:bit firmware (4s) + small buffer
    // If USB connected, Micro:bit sends STATUS:CLOSED which cancels this timer
    if (iotAutoCloseTimer) clearTimeout(iotAutoCloseTimer);
    iotAutoCloseTimer = setTimeout(() => {
        db.ref('iotBins/' + binColor + '/open').set(false);
        iotAutoCloseTimer = null;
    }, 4500);
}

function manualIoTToggle(color) {
    const binRef = db.ref('iotBins/' + color);
    binRef.once('value').then(snap => {
        const current = snap.val() || {};
        const newState = !current.open;
        binRef.update({ open: newState, lastUpdated: Date.now(), lastOpenedBy: userData.firstName || userId });
        if (newState) {
            sendManualUSBCommand(color); // also send to Micro:bit if connected
            setTimeout(() => { db.ref('iotBins/' + color + '/open').set(false); }, 4500);
        }
    });
}

function openLeaderboard() {
    setActiveNav('leaderboard');
    document.getElementById('leaderboard-modal').style.display = 'flex';
    document.getElementById('podium-container').innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div></div>';
    document.getElementById('rankings-list').innerHTML = '';

    db.ref('users').orderByChild('score').limitToLast(20).once('value').then(snapshot => {
        const users = [];
        snapshot.forEach(child => {
            const u = child.val();
            users.push({
                id: child.key,
                name: ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.username || 'Unknown',
                score: u.score || 0,
                profilePic: u.profilePic || ''
            });
        });
        users.sort((a, b) => b.score - a.score);
        renderLeaderboard(users);
    });
}
function closeLeaderboard() {
    document.getElementById('leaderboard-modal').style.display = 'none';
    setActiveNav('home');
}

function renderLeaderboard(users) {
    const podiumEl = document.getElementById('podium-container');
    const listEl = document.getElementById('rankings-list');
    if (!users.length) {
        podiumEl.innerHTML = '<p style="color:#999;padding:20px;text-align:center;">ยังไม่มีข้อมูล</p>';
        listEl.innerHTML = '';
        return;
    }
    const emojis = ['👑', '🥈', '🥉'];
    const top3 = users.slice(0, 3);
    const order = [1, 0, 2].filter(i => top3[i]);
    podiumEl.innerHTML = order.map(i => {
        const u = top3[i];
        const rank = i + 1;
        const isMe = u.id === userId;
        const av = u.profilePic || ('https://placehold.co/60x60/4361ee/fff?text=' + (u.name.charAt(0).toUpperCase() || '?'));
        return `<div class="podium-item rank-${rank}">
            <div class="podium-crown">${emojis[i]}</div>
            <img class="podium-avatar" src="${av}" onerror="this.src='https://placehold.co/60x60/4361ee/fff?text=?'">
            <div class="podium-name">${u.name}${isMe ? ' 👤' : ''}</div>
            <div class="podium-score">${u.score} XP</div>
            <div class="podium-base">${rank}</div>
        </div>`;
    }).join('');

    listEl.innerHTML = users.slice(3).map((u, idx) => {
        const rank = idx + 4;
        const isMe = u.id === userId;
        const rObj = getRank(u.score);
        const av = u.profilePic || ('https://placehold.co/40x40/4361ee/fff?text=' + (u.name.charAt(0).toUpperCase() || '?'));
        return `<div class="rank-row ${isMe ? 'is-me' : ''}">
            <div class="rank-num">#${rank}</div>
            <img class="rank-avatar" src="${av}" onerror="this.src='https://placehold.co/40x40/4361ee/fff?text=?'">
            <div class="rank-info">
                <div class="rank-uname">${u.name}${isMe ? ' 👤' : ''}</div>
                <span class="rank-badge ${rObj.class}">${rObj.name}</span>
            </div>
            <div class="rank-xp">${u.score} XP</div>
        </div>`;
    }).join('');
}

const QUEST_POOL = [
    { id: 'q1', icon: '📦', titleTH: 'นักสแกนมือใหม่', titleEN: 'First Steps', descTH: 'สแกนขยะ 5 ชิ้น', descEN: 'Scan 5 waste items', type: 'scan_total', target: 5, reward: { xp: 50 } },
    { id: 'q2', icon: '☣️', titleTH: 'นักจัดการของอันตราย', titleEN: 'Hazard Handler', descTH: 'สแกนขยะอันตราย 2 ชิ้น', descEN: 'Scan 2 hazardous items', type: 'scan_hazardous', target: 2, reward: { xp: 30, item: 'xp01' } },
    { id: 'q3', icon: '♻️', titleTH: 'นักรีไซเคิล', titleEN: 'Recycler Pro', descTH: 'สแกนขยะรีไซเคิล 3 ชิ้น', descEN: 'Scan 3 recyclable items', type: 'scan_recyclable', target: 3, reward: { xp: 25, item: 'luk01' } },
    { id: 'q4', icon: '🌿', titleTH: 'นักรักษ์โลก', titleEN: 'Earth Lover', descTH: 'สแกนขยะอินทรีย์ 3 ชิ้น', descEN: 'Scan 3 organic items', type: 'scan_organic', target: 3, reward: { xp: 25 } },
    { id: 'q5', icon: '🌟', titleTH: 'ผู้เชี่ยวชาญขยะ', titleEN: 'Waste Expert', descTH: 'สแกนขยะครบทุกประเภท', descEN: 'Scan all 4 waste types', type: 'scan_all_types', target: 4, reward: { xp: 100, item: 'xp02' } },
    { id: 'q6', icon: '🔍', titleTH: 'นักสแกนอาชีพ', titleEN: 'Pro Scanner', descTH: 'สแกนขยะ 10 ชิ้น', descEN: 'Scan 10 waste items', type: 'scan_total', target: 10, reward: { xp: 100 } },
    { id: 'q7', icon: '🗑️', titleTH: 'นักคัดแยก', titleEN: 'General Sorter', descTH: 'สแกนขยะทั่วไป 5 ชิ้น', descEN: 'Scan 5 general waste', type: 'scan_general', target: 5, reward: { xp: 20 } },
    { id: 'q8', icon: '⚡', titleTH: 'นักสะสมพลังงาน', titleEN: 'Energy Collector', descTH: 'สแกนขยะ 3 ชิ้น', descEN: 'Scan any 3 waste items', type: 'scan_total', target: 3, reward: { xp: 40, item: 'xp01' } },
];

function getDailyQuests() {
    const seed = parseInt(getTodayDateStr().replace(/-/g, ''));
    const indices = new Set();
    let s = seed;
    while (indices.size < 3) {
        s = (Math.imul(s, 1664525) + 1013904223) | 0;
        indices.add(Math.abs(s) % QUEST_POOL.length);
    }
    return [...indices].map(i => QUEST_POOL[i]);
}

function openQuests() {
    setActiveNav('quests');
    document.getElementById('quests-modal').style.display = 'flex';
    loadDailyQuests(true);
}
function closeQuests() {
    document.getElementById('quests-modal').style.display = 'none';
    setActiveNav('home');
}

function loadDailyQuests(forceRender) {
    if (!userId) return;
    const today = getTodayDateStr();
    const dailyQuests = getDailyQuests();
    db.ref('users/' + userId + '/questProgress/' + today).once('value').then(snap => {
        const progress = snap.val() || {};
        checkQuestBadge(progress, dailyQuests);
        if (forceRender || document.getElementById('quests-modal').style.display === 'flex') {
            renderQuests(dailyQuests, progress);
        }
    });
}

function renderQuests(dailyQuests, progress) {
    const list = document.getElementById('quests-list');
    if (!list) return;
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msLeft = midnight - now;
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    const resetEl = document.getElementById('quests-reset-time');
    if (resetEl) resetEl.textContent = 'รีเซ็ตใน ' + h + ' ชม. ' + m + ' นาที';

    list.innerHTML = dailyQuests.map((quest, idx) => {
        const qp = progress[idx] || { progress: 0, claimed: false };
        const prog = Math.min(qp.progress || 0, quest.target);
        const pct = Math.min(Math.round((prog / quest.target) * 100), 100);
        const done = prog >= quest.target;
        const claimed = qp.claimed;
        const rewardItem = quest.reward.item ? ITEM_DB.find(x => x.id === quest.reward.item) : null;
        const rewardTxt = '+' + quest.reward.xp + ' XP' + (rewardItem ? ' + ' + rewardItem.icon : '');
        let statusHtml = '';
        if (claimed) {
            statusHtml = '<div class="quest-claimed-badge"><i class="bi bi-check-circle-fill"></i> รับรางวัลแล้ว</div>';
        } else if (done) {
            statusHtml = '<button class="quest-claim-btn" onclick="claimQuestReward(' + idx + ')">🎁 รับรางวัล ' + rewardTxt + '</button>';
        }
        return '<div class="quest-item ' + (claimed ? 'claimed' : done ? 'completed' : '') + '">' +
            '<div class="quest-top">' +
            '<div class="quest-icon">' + quest.icon + '</div>' +
            '<div class="quest-info">' +
            '<div class="quest-title">' + (currentLang === 'th' ? quest.titleTH : quest.titleEN) + '</div>' +
            '<div class="quest-desc">' + (currentLang === 'th' ? quest.descTH : quest.descEN) + '</div>' +
            '</div>' +
            '<div class="quest-reward">' + rewardTxt + '</div>' +
            '</div>' +
            '<div class="quest-progress-bar"><div class="quest-progress-fill" style="width:' + pct + '%;"></div></div>' +
            '<div class="quest-progress-text"><span>' + prog + ' / ' + quest.target + '</span><span>' + pct + '%</span></div>' +
            statusHtml +
            '</div>';
    }).join('');
}

function updateQuestProgress(category) {
    if (!userId) return;
    const today = getTodayDateStr();
    const dailyQuests = getDailyQuests();
    const questRef = db.ref('users/' + userId + '/questProgress/' + today);
    questRef.once('value').then(snap => {
        const progress = snap.val() || {};
        dailyQuests.forEach((quest, idx) => {
            const qp = progress[idx] || { progress: 0, claimed: false };
            if (qp.claimed) return;
            const prev = qp.progress || 0;
            let updated = false;
            let typesArr = qp.typesScanned || [];
            switch (quest.type) {
                case 'scan_total': qp.progress = prev + 1; updated = true; break;
                case 'scan_recyclable': if (category === 'Recyclable') { qp.progress = prev + 1; updated = true; } break;
                case 'scan_organic': if (category === 'Organic') { qp.progress = prev + 1; updated = true; } break;
                case 'scan_hazardous': if (category === 'Hazardous') { qp.progress = prev + 1; updated = true; } break;
                case 'scan_general': if (category === 'General') { qp.progress = prev + 1; updated = true; } break;
                case 'scan_all_types':
                    if (!typesArr.includes(category)) {
                        typesArr.push(category);
                        qp.typesScanned = typesArr;
                        qp.progress = typesArr.length;
                        updated = true;
                    }
                    break;
            }
            if (updated) {
                progress[idx] = qp;
                if ((qp.progress || 0) >= quest.target && prev < quest.target) {
                    showQuestToast(currentLang === 'th' ? quest.titleTH : quest.titleEN);
                }
            }
        });
        questRef.set(progress).then(() => checkQuestBadge(progress, dailyQuests));
    });
}

function claimQuestReward(questIdx) {
    if (!userId) return;
    const today = getTodayDateStr();
    const quest = getDailyQuests()[questIdx];
    const entryRef = db.ref('users/' + userId + '/questProgress/' + today + '/' + questIdx);
    entryRef.once('value').then(snap => {
        const qp = snap.val() || {};
        if (qp.claimed || (qp.progress || 0) < quest.target) return;
        entryRef.update({ claimed: true });
        userData.score = (userData.score || 0) + quest.reward.xp;
        const finish = (extraInv) => {
            const upd = { score: userData.score };
            if (extraInv) upd.inventory = extraInv;
            db.ref('users/' + userId).update(upd);
            updateUI(true);
            loadDailyQuests(true);
            alert('🎉 รับรางวัลแล้ว! +' + quest.reward.xp + ' XP' + (quest.reward.item ? ' + ไอเทม!' : ''));
        };
        if (quest.reward.item) {
            const itemData = ITEM_DB.find(x => x.id === quest.reward.item);
            if (itemData) {
                db.ref('users/' + userId + '/inventory').once('value').then(invSnap => {
                    let inv = invSnap.val() || [];
                    if (!Array.isArray(inv)) inv = [];
                    inv.push(itemData);
                    userData.inventory = inv;
                    finish(inv);
                });
                return;
            }
        }
        finish();
    });
}

function checkQuestBadge(progress, dailyQuests) {
    let count = 0;
    dailyQuests.forEach((quest, idx) => {
        const qp = progress[idx] || {};
        if ((qp.progress || 0) >= quest.target && !qp.claimed) count++;
    });
    const badge = document.getElementById('quest-nav-badge');
    if (!badge) return;
    badge.style.display = count > 0 ? 'flex' : 'none';
    badge.textContent = count > 0 ? count : '';
}

function showQuestToast(title) {
    const toast = document.getElementById('quest-toast');
    const sub = document.getElementById('quest-toast-name');
    if (!toast || !sub) return;
    sub.textContent = title;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function openAdminDashboard() {
    setActiveNav('admin');
    document.getElementById('admin-modal').style.display = 'flex';
    document.getElementById('admin-stats-grid').innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div></div>';
    document.getElementById('admin-top-users').innerHTML = '';
    loadAdminData();
}
function closeAdminDashboard() {
    document.getElementById('admin-modal').style.display = 'none';
    setActiveNav('home');
}

function loadAdminData() {
    db.ref('users').once('value').then(snapshot => {
        const users = [];
        let totR = 0, totO = 0, totH = 0, totG = 0, totAll = 0;
        snapshot.forEach(child => {
            const u = child.val();
            const s = u.scanStats || {};
            const r = s.Recyclable || 0, o = s.Organic || 0, h = s.Hazardous || 0, g = s.General || 0;
            const t = s.total || (r + o + h + g);
            totR += r; totO += o; totH += h; totG += g; totAll += t;
            users.push({ name: ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.username || 'Unknown', profilePic: u.profilePic || '', scans: t });
        });
        users.sort((a, b) => b.scans - a.scans);
        renderAdminDashboard({ totR, totO, totH, totG, totAll, users });
    });
}

function renderAdminDashboard(d) {
    const types = [
        { label: '♻️ Recyclable', val: d.totR },
        { label: '🌿 Organic', val: d.totO },
        { label: '☣️ Hazardous', val: d.totH },
        { label: '🗑️ General', val: d.totG }
    ];
    const most = types.reduce((a, b) => b.val > a.val ? b : a, types[0]);

    document.getElementById('admin-stats-grid').innerHTML =
        '<div class="admin-stat-card" style="--c1:#4361ee;--c2:#3a0ca3;"><div class="admin-stat-icon">🔍</div><div class="admin-stat-num">' + d.totAll + '</div><div class="admin-stat-label">สแกนทั้งหมด</div></div>' +
        '<div class="admin-stat-card" style="--c1:#06d6a0;--c2:#0a9e76;"><div class="admin-stat-icon">♻️</div><div class="admin-stat-num">' + d.totR + '</div><div class="admin-stat-label">รีไซเคิล</div></div>' +
        '<div class="admin-stat-card" style="--c1:#ef476f;--c2:#b5173a;"><div class="admin-stat-icon">☣️</div><div class="admin-stat-num">' + d.totH + '</div><div class="admin-stat-label">อันตราย</div></div>' +
        '<div class="admin-stat-card" style="--c1:#f08c00;--c2:#d97706;"><div class="admin-stat-icon">🏆</div><div class="admin-stat-num" style="font-size:1.1rem;">' + (most ? most.label : '-') + '</div><div class="admin-stat-label">พบมากที่สุด</div></div>';

    if (wasteDonutChart) wasteDonutChart.destroy();
    const dCtx = document.getElementById('waste-donut-chart');
    if (dCtx) {
        wasteDonutChart = new Chart(dCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Recyclable ♻️', 'Organic 🌿', 'Hazardous ☣️', 'General 🗑️'],
                datasets: [{ data: [d.totR, d.totO, d.totH, d.totG], backgroundColor: ['#ffc107', '#06d6a0', '#ef476f', '#4361ee'], borderWidth: 3, borderColor: '#fff' }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } }, cutout: '60%', animation: { animateScale: true } }
        });
    }

    if (wasteBarChart) wasteBarChart.destroy();
    const bCtx = document.getElementById('waste-bar-chart');
    if (bCtx) {
        wasteBarChart = new Chart(bCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Recyclable', 'Organic', 'Hazardous', 'General'],
                datasets: [{ label: 'สแกน', data: [d.totR, d.totO, d.totH, d.totG], backgroundColor: ['rgba(255,193,7,0.8)', 'rgba(6,214,160,0.8)', 'rgba(239,71,111,0.8)', 'rgba(67,97,238,0.8)'], borderColor: ['#f08c00', '#06d6a0', '#ef476f', '#4361ee'], borderWidth: 2, borderRadius: 8, borderSkipped: false }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: '#f1f3f5' } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } }, animation: { duration: 800 } }
        });
    }

    const topDiv = document.getElementById('admin-top-users');
    if (topDiv) {
        topDiv.innerHTML = d.users.slice(0, 5).map((u, i) => {
            const av = u.profilePic || ('https://placehold.co/40x40/4361ee/fff?text=' + (u.name.charAt(0).toUpperCase() || 'U'));
            return '<div class="admin-user-row">' +
                '<div class="admin-user-rank">' + (i + 1) + '</div>' +
                '<img class="admin-user-avatar" src="' + av + '" onerror="this.src=\'https://placehold.co/40x40/4361ee/fff?text=U\'">' +
                '<div class="admin-user-name">' + u.name + '</div>' +
                '<div class="admin-user-scans">' + u.scans + ' scans</div>' +
                '</div>';
        }).join('') || '<p style="text-align:center;color:#999;">ยังไม่มีข้อมูล</p>';
    }
}

// ============================================================
// 🔌 WEB SERIAL API (MICRO:BIT USB CONNECTION)
// ============================================================
let serialPort       = null;
let serialWriter     = null;
let serialReader     = null;
let serialReadActive = false;
let _usbToastTimer   = null;
let _serialLogCount  = 0;
const MAX_LOG_LINES  = 80;

// ---- Helper: get current timestamp string ----
function getTimestamp() {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, '0'))
        .join(':');
}

// ---- Helper: append line to Serial Log console ----
function appendSerialLog(text, type = 'sys') {
    const console = document.getElementById('serial-log-console');
    if (!console) return;

    // Remove idle placeholder
    const idle = console.querySelector('.serial-log-idle');
    if (idle) idle.remove();

    // Limit log lines
    _serialLogCount++;
    if (_serialLogCount > MAX_LOG_LINES) {
        if (console.firstChild) console.removeChild(console.firstChild);
    }

    const line = document.createElement('div');
    line.className = 'log-' + type;
    line.textContent = `[${getTimestamp()}] ${text}`;
    console.appendChild(line);
    console.scrollTop = console.scrollHeight;
}

// ---- Helper: clear Serial Log ----
function clearSerialLog() {
    const console = document.getElementById('serial-log-console');
    if (!console) return;
    console.innerHTML = '<span class="serial-log-idle">— Serial Log ล้างแล้ว —</span>';
    _serialLogCount = 0;
}

// ---- Helper: update Serial Status Bar UI ----
function setSerialConnectedUI(connected) {
    const bar   = document.getElementById('serial-status-bar');
    const dot   = document.getElementById('serial-dot');
    const label = document.getElementById('serial-status-label');
    const btnC  = document.getElementById('btn-serial-connect');
    const btnD  = document.getElementById('btn-serial-disconnect');

    if (!bar) return;

    if (connected) {
        bar.classList.add('connected');
        dot.classList.add('connected');
        label.classList.add('connected');
        label.textContent = '✅ Micro:bit เชื่อมต่อแล้ว';
        if (btnC) btnC.style.display = 'none';
        if (btnD) btnD.style.display = 'flex';
    } else {
        bar.classList.remove('connected');
        dot.classList.remove('connected');
        label.classList.remove('connected');
        label.textContent = 'ยังไม่ได้เชื่อมต่อ';
        if (btnC) btnC.style.display = 'flex';
        if (btnD) btnD.style.display = 'none';
    }
}

// ---- Helper: show USB Command Toast ----
function showUSBToast(command) {
    if (_usbToastTimer) { clearTimeout(_usbToastTimer); }
    let existing = document.querySelector('.usb-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'usb-toast';
    toast.innerHTML = `<div class="usb-toast-inner"><span class="usb-toast-icon">🔌</span> → ${command}</div>`;
    document.body.appendChild(toast);

    _usbToastTimer = setTimeout(() => { toast.remove(); }, 2500);
}

// ---- Connect to Micro:bit via Web Serial ----
async function connectSerial() {
    if (!('serial' in navigator)) {
        alert('❌ เบราว์เซอร์ของคุณไม่รองรับ Web Serial API\nกรุณาใช้ Google Chrome หรือ Microsoft Edge เวอร์ชันล่าสุด');
        return;
    }

    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        // Setup Writer
        const textEncoder = new TextEncoderStream();
        textEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = textEncoder.writable.getWriter();

        // Setup Reader (read Micro:bit feedback)
        const textDecoder = new TextDecoderStream();
        serialPort.readable.pipeTo(textDecoder.writable);
        serialReader = textDecoder.readable.getReader();

        setSerialConnectedUI(true);
        appendSerialLog('🟢 Connected to Micro:bit @ 115200 baud', 'sys');

        // Listen for incoming data from Micro:bit
        startSerialRead();

        console.log('[Web Serial] Connected');
    } catch (error) {
        console.error('[Web Serial] Connection failed:', error);
        if (error.name !== 'NotFoundError') {
            const msg = currentLang === 'en'
                ? 'Connection failed. Please select the Micro:bit port.'
                : 'การเชื่อมต่อล้มเหลว กรุณาเลือกพอร์ต Micro:bit';
            alert(msg);
            appendSerialLog('❌ Connection failed: ' + error.message, 'err');
        }
    }
}

// ---- Disconnect from Micro:bit ----
async function disconnectSerial() {
    serialReadActive = false;

    try {
        if (serialReader) { await serialReader.cancel(); serialReader = null; }
        if (serialWriter) { await serialWriter.close(); serialWriter = null; }
        if (serialPort)   { await serialPort.close();   serialPort   = null; }
    } catch (e) {
        console.warn('[Web Serial] Disconnect error:', e);
    }

    setSerialConnectedUI(false);
    appendSerialLog('🔴 Disconnected', 'sys');
    console.log('[Web Serial] Disconnected');
}

// ---- Read loop: receive data from Micro:bit ----
async function startSerialRead() {
    serialReadActive = true;
    let rxBuffer = '';

    try {
        while (serialReadActive && serialReader) {
            const { value, done } = await serialReader.read();
            if (done) break;
            if (!value) continue;

            rxBuffer += value;
            const lines = rxBuffer.split('\n');
            rxBuffer = lines.pop(); // keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                handleSerialIncoming(trimmed);
            }
        }
    } catch (e) {
        if (serialReadActive) {
            appendSerialLog('❌ Read error: ' + e.message, 'err');
            console.error('[Web Serial] Read error:', e);
        }
    }
}

// ---- Handle messages received FROM Micro:bit ----
function handleSerialIncoming(msg) {
    appendSerialLog('← ' + msg, 'rx');
    console.log('[Micro:bit RX]:', msg);

    // STATUS:COLOR:OPENED or STATUS:COLOR:CLOSED
    if (msg.startsWith('STATUS:')) {
        const parts = msg.split(':');
        if (parts.length === 3) {
            const color  = parts[1].toLowerCase();
            const state  = parts[2];
            const isOpen = state === 'OPENED';

            // Sync Firebase with actual hardware state
            if (['yellow', 'green', 'red', 'blue'].includes(color)) {
                db.ref('iotBins/' + color + '/open').set(isOpen);
                if (!isOpen) {
                    // Micro:bit confirmed close — cancel any pending timer
                    if (iotAutoCloseTimer) {
                        clearTimeout(iotAutoCloseTimer);
                        iotAutoCloseTimer = null;
                    }
                }
            }
        }
    }

    if (msg === 'PONG') {
        appendSerialLog('← PONG (heartbeat OK)', 'rx');
    }

    if (msg === 'READY') {
        appendSerialLog('🤖 Micro:bit is READY!', 'sys');
    }
}

// ---- Send command TO Micro:bit ----
async function sendUSBCommand(category) {
    if (!serialWriter) return;

    const CATEGORY_TO_COLOR = {
        'Recyclable': 'YELLOW',
        'Organic':    'GREEN',
        'Hazardous':  'RED',
        'General':    'BLUE'
    };

    const color   = CATEGORY_TO_COLOR[category] || 'BLUE';
    const command = 'OPEN:' + color + '\n';

    try {
        await serialWriter.write(command);
        appendSerialLog('→ ' + command.trim(), 'tx');
        showUSBToast('OPEN:' + color);
        console.log('[Web Serial TX]:', command.trim());
    } catch (e) {
        appendSerialLog('❌ Write error: ' + e.message, 'err');
        console.error('[Web Serial] Write error:', e);

        // If port was disconnected unexpectedly, clean up
        if (e.name === 'InvalidStateError') {
            await disconnectSerial();
        }
    }
}

// ---- Send manual USB command from IoT panel ----
async function sendManualUSBCommand(color) {
    if (!serialWriter) return;
    const command = 'OPEN:' + color.toUpperCase() + '\n';
    try {
        await serialWriter.write(command);
        appendSerialLog('→ ' + command.trim() + ' (manual)', 'tx');
        showUSBToast('OPEN:' + color.toUpperCase());
    } catch (e) {
        appendSerialLog('❌ Write error: ' + e.message, 'err');
    }
}
