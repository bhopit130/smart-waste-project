// ==========================================
// ⚙️ CONFIGURATION & SETUP
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyA3UTjmzolQs5HHejpzfga0px6uxnADuSM", 
    authDomain: "smart-waste-deebuk.firebaseapp.com",
    databaseURL: "https://smart-waste-deebuk-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-waste-deebuk",
    storageBucket: "smart-waste-deebuk.firebasestorage.app",
    messagingSenderId: "11316279684",
    appId: "1:11316279684:web:5cee12dd58e7b5962c05d1"
};

// 🔴🔴 ใส่ API KEY ของคุณที่นี่ (gsk_...) 🔴🔴
const GROQ_API_KEY = "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"; 

// --- INIT FIREBASE ---
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

// --- VARIABLES ---
let currentLang = 'en';
let isSoundOn = true;
let userData = { score: 0, firstName: "", lastName: "", username: "", password: "", profilePic: "", inventory: [], activeBuff: null, equippedLuck: "" };
let userId = "";
let isRegisterMode = false;
let tempProfilePic = "";

// Camera Variables
let webcam, isRunning = false, animationId;
let useBackCamera = true; 

// Text Data
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

// ==========================================
// 🎒 ITEM SYSTEM (HARDCORE MODE)
// ==========================================

const ITEM_DB = [
    // --- XP BOOSTERS (Consumable) ---
    { id: "xp01", name: "Energy Drink", icon: "⚡", rarity: "Common", desc: "XP x1.5 (10 Mins)", type: "consumable", duration: 10, multiplier: 1.5 },
    { id: "xp02", name: "Textbook", icon: "📚", rarity: "Rare", desc: "XP x2.0 (20 Mins)", type: "consumable", duration: 20, multiplier: 2.0 },
    { id: "xp03", name: "Golden Brain", icon: "🧠", rarity: "Epic", desc: "XP x3.0 (30 Mins)", type: "consumable", duration: 30, multiplier: 3.0 },
    { id: "xp04", name: "Alien Chip", icon: "👽", rarity: "Legendary", desc: "XP x5.0 (1 Hour)", type: "consumable", duration: 60, multiplier: 5.0 },

    // --- LUCK CHARMS (Equipment) ---
    { id: "luk01", name: "Glass Eye", icon: "👁️", rarity: "Common", desc: "Drop Chance +5%", type: "equipment", stat: "luck", val: 5 },
    { id: "luk02", name: "Magnet", icon: "🧲", rarity: "Rare", desc: "Drop Chance +10%", type: "equipment", stat: "luck", val: 10 },
    { id: "luk03", name: "Lucky Cat", icon: "🐱", rarity: "Epic", desc: "Drop Chance +20%", type: "equipment", stat: "luck", val: 20 }
];

let pendingItem = null;

// 🔥 ปรับสมดุลความยาก (Hardcore Balance)
function rollItemDrop() {
    // 1. Base Chance ต่ำลง (จาก 30 เหลือ 12)
    const baseChance = 12; 

    // 2. คำนวณ Luck (Cap ไว้ไม่ให้เกิน 50% รวม)
    const equippedId = userData.equippedLuck || "";
    const equippedItem = ITEM_DB.find(i => i.id === equippedId);
    let luckBonus = (equippedItem && equippedItem.val) ? equippedItem.val : 0;
    
    // Final Chance = 12% + Luck (Max Luck Item คือ +20%) = สูงสุดแค่ 32%
    const finalChance = baseChance + luckBonus;
    
    console.log(`Drop Rate: ${finalChance}% (Base: ${baseChance} + Luck: ${luckBonus})`);

    // สุ่มว่าจะดรอปไหม?
    if (Math.random() * 100 > finalChance) return null; 

    // 3. ถ้าดรอป... สุ่ม Rarity (ยากขึ้น)
    const rRoll = Math.random() * 100;
    let rarityPool = [];
    
    // Common: 70% (0-70)
    // Rare: 25% (70-95)
    // Epic: 4.5% (95-99.5)
    // Legendary: 0.5% (99.5-100) -> ยากมาก!
    
    if (rRoll < 70) rarityPool = ITEM_DB.filter(i => i.rarity === "Common");
    else if (rRoll < 95) rarityPool = ITEM_DB.filter(i => i.rarity === "Rare");
    else if (rRoll < 99.5) rarityPool = ITEM_DB.filter(i => i.rarity === "Epic");
    else rarityPool = ITEM_DB.filter(i => i.rarity === "Legendary");

    if (rarityPool.length === 0) return ITEM_DB[0];
    return rarityPool[Math.floor(Math.random() * rarityPool.length)];
}

function useItem(itemIndexInInventory) {
    if(!userId) return;

    db.ref('users/' + userId).once('value').then(snapshot => {
        const u = snapshot.val();
        let inv = u.inventory || [];
        const itemObj = inv[itemIndexInInventory];
        if (!itemObj) return;

        const dbItem = ITEM_DB.find(x => x.id === itemObj.id);
        if (!dbItem) return;

        if (dbItem.type === "consumable") {
            const confirmMsg = currentLang === 'en' 
                ? `Activate ${dbItem.name}? It lasts ${dbItem.duration} mins.` 
                : `ยืนยันใช้ "${dbItem.name}" หรือไม่?\n(มีผล ${dbItem.duration} นาที)`;
            
            if (confirm(confirmMsg)) {
                inv.splice(itemIndexInInventory, 1);
                const expireTime = Date.now() + (dbItem.duration * 60 * 1000);
                const newBuff = { itemId: dbItem.id, expireAt: expireTime, multiplier: dbItem.multiplier };
                
                db.ref('users/' + userId).update({ inventory: inv, activeBuff: newBuff }).then(() => {
                    userData.inventory = inv;
                    userData.activeBuff = newBuff;
                    alert(currentLang === 'en' ? "Buff Activated!" : "เริ่มใช้งานไอเทมแล้ว! รีบสแกนเลย!");
                    openInventory();
                });
            }
        }
        else if (dbItem.type === "equipment") {
            let newEquip = (u.equippedLuck === itemObj.id) ? "" : itemObj.id;
            db.ref('users/' + userId).update({ equippedLuck: newEquip }).then(() => {
                userData.equippedLuck = newEquip;
                openInventory();
            });
        }
    });
}

function calculateXPWithBuff(baseXP) {
    let multiplier = 1;
    let isBuffActive = false;

    if (userData.activeBuff) {
        if (Date.now() < userData.activeBuff.expireAt) {
            multiplier = userData.activeBuff.multiplier;
            isBuffActive = true;
        } else {
            db.ref('users/' + userId).update({ activeBuff: null });
            userData.activeBuff = null;
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
    rBadge.classList.remove("rank-novice", "rank-scout", "rank-guardian", "rank-legend"); // Reset classes
    
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
    grid.innerHTML = '<p>Loading...</p>';
    modal.style.display = 'flex';

    if(!userId) {
        grid.innerHTML = '<p>Please Login first.</p>';
        return;
    }

    db.ref('users/' + userId).once('value').then(snapshot => {
        const u = snapshot.val();
        const inv = u.inventory || [];
        userData.activeBuff = u.activeBuff || null;
        userData.equippedLuck = u.equippedLuck || "";

        grid.innerHTML = '';

        // Status Bar
        const statusDiv = document.createElement('div');
        statusDiv.style.gridColumn = "1 / -1";
        statusDiv.style.marginBottom = "15px";
        statusDiv.style.padding = "10px";
        statusDiv.style.borderRadius = "10px";
        statusDiv.style.textAlign = "center";
        
        if (userData.activeBuff && Date.now() < userData.activeBuff.expireAt) {
            const timeLeft = Math.ceil((userData.activeBuff.expireAt - Date.now()) / 60000);
            const buffItem = ITEM_DB.find(x => x.id === userData.activeBuff.itemId);
            statusDiv.style.background = "#d3f9d8";
            statusDiv.style.border = "2px solid #2b8a3e";
            statusDiv.innerHTML = `
                <div style="font-weight:bold; color:#2b8a3e;">⚡ ACTIVE BOOST: ${buffItem ? buffItem.name : "Unknown"}</div>
                <div style="font-size:0.9rem;">XP x${userData.activeBuff.multiplier} | Time left: ${timeLeft} mins</div>
            `;
        } else {
            statusDiv.style.background = "#eee";
            statusDiv.style.color = "#888";
            statusDiv.innerHTML = `<small>No active XP boost. Use an item!</small>`;
        }
        grid.appendChild(statusDiv);

        if(inv.length === 0) {
            grid.innerHTML += '<p style="grid-column: 1/-1; text-align: center; color:#999;">Bag is empty. Scan waste to find items!</p>';
            return;
        }

        inv.forEach((itemObj, index) => {
            const itemData = ITEM_DB.find(x => x.id === itemObj.id);
            if (!itemData) return;
            const div = document.createElement('div');
            const isEquipped = (userData.equippedLuck === itemObj.id);
            div.className = `item-slot rarity-${itemData.rarity.toLowerCase()} ${isEquipped ? 'equipped-slot' : ''}`;
            let actionLabel = "";
            if (itemData.type === "consumable") actionLabel = `<div style="position:absolute; top:5px; right:5px; background:#f08c00; color:white; font-size:0.6rem; padding:2px 5px; border-radius:4px;">USE</div>`;
            if (isEquipped) actionLabel = `<div style="position:absolute; top:5px; left:5px; background:#4361ee; color:white; font-size:0.6rem; padding:2px 5px; border-radius:4px;">EQUIPPED</div>`;

            div.innerHTML = `
                ${actionLabel}
                <span class="item-icon">${itemData.icon}</span>
                <div class="item-name">${itemData.name}</div>
                <div style="font-size:0.65rem; color:#666;">${itemData.desc}</div>
            `;
            div.onclick = () => useItem(index);
            grid.appendChild(div);
        });
    });
}

function closeInventory() { document.getElementById('inventory-modal').style.display = 'none'; }

// 🆕 TUTORIAL FUNCTIONS
function openTutorial() { document.getElementById('tutorial-modal').style.display = 'flex'; }
function closeTutorial() { document.getElementById('tutorial-modal').style.display = 'none'; }

// ==========================================
// 🔐 AUTH SYSTEM
// ==========================================
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
                    inventory: [], activeBuff: null, equippedLuck: "" 
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

        const size = 600; 
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

async function captureAndAnalyzeWithGroq() {
    if (!webcam || !webcam.canvas) return;
    if (!GROQ_API_KEY || GROQ_API_KEY.includes("YOUR_GROQ")) {
        alert("Please set your GROQ_API_KEY in script.js first!");
        return;
    }

    const btn = document.getElementById('btn-main');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${textData[currentLang].analyzing}`;
    document.getElementById('scan-line').style.display = 'block';

    try {
        const imageBase64 = webcam.canvas.toDataURL("image/jpeg", 0.7);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
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

                                Return JSON ONLY with this structure:
                                {
                                  "category": "Recyclable" OR "Organic" OR "Hazardous" OR "General",
                                  "name_en": "Short name in English",
                                  "name_th": "Short name in Thai",
                                  "desc_en": "Brief description in English",
                                  "desc_th": "Brief description in Thai",
                                  "howto_en": "How to dispose in English",
                                  "howto_th": "How to dispose in Thai",
                                  "knowledge_en": "One fun fact in English",
                                  "knowledge_th": "One fun fact in Thai"
                                }
                                If no waste is found, set category to "Unknown".`
                            },
                            { type: "image_url", image_url: { url: imageBase64 } }
                        ]
                    }
                ],
                temperature: 0.1, max_tokens: 500, response_format: { type: "json_object" }
            })
        });

        const json = await response.json();
        if (json.error) throw new Error(json.error.message);

        const aiContent = json.choices[0].message.content;
        const resultData = JSON.parse(aiContent);

        document.getElementById('scan-line').style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = originalText;

        if (resultData.category === "Unknown") {
            alert(currentLang === 'en' ? "No waste detected." : "ไม่พบขยะในภาพ");
        } else {
            pendingItem = rollItemDrop(); 
            showResultPopupFromAI(resultData);
        }

    } catch (error) {
        console.error("AI Error:", error);
        document.getElementById('scan-line').style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = originalText;
        alert("AI Error: " + error.message);
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