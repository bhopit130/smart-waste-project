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

// 🔴🔴 ใส่ GROQ API KEY ของคุณที่นี่ 🔴🔴
// ขอฟรีได้ที่ https://console.groq.com/keys
const GROQ_API_KEY = "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"; 

// --- INIT FIREBASE ---
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

// --- VARIABLES ---
let currentLang = 'en';
let isSoundOn = true;
let userData = { score: 0, firstName: "", lastName: "", username: "", password: "", profilePic: "" };
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

// --- RANK SYSTEM CONFIG ---
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
                const newUser = { username: userIn, password: passIn, firstName: first, lastName: last, score: 0, profilePic: tempProfilePic };
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

// 🟢 Rank System
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

    // Rank Logic
    const oldRankEl = document.getElementById('user-rank');
    const oldRankName = oldRankEl.innerText;
    
    const currentRankObj = getRank(userData.score || 0);
    
    oldRankEl.innerText = currentRankObj.name;
    oldRankEl.className = `rank-badge ${currentRankObj.class}`;

    // Level Up Check
    if (checkLevelUp && oldRankName !== currentRankObj.name && oldRankName !== "Beginner") {
         showLevelUpModal(currentRankObj.name);
    }

    // Button State
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
    
    if(isSoundOn) {
        // Optional sound code here
    }

    for(let i=0; i<50; i++) {
        createConfetti(modal);
    }
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

function closeLevelUpModal() {
    document.getElementById('levelup-modal').style.display = 'none';
}

function toggleLanguage() { 
    currentLang = (currentLang==='en')?'th':'en'; updateUI(); 
}
function toggleSound() { 
    isSoundOn = !isSoundOn; document.getElementById('btn-sound').classList.toggle('active'); 
}

// ==========================================
// 📷 SECTION: CAMERA LOGIC
// ==========================================

async function handleMainButton() {
    if (!isRunning) {
        startCamera();
    } else {
        captureAndAnalyzeWithGroq(); // 🚀 เรียกใช้ AI Groq
    }
}

async function startCamera() {
    const btn = document.getElementById('btn-main');
    const container = document.getElementById('webcam-container');
    const txtBtn = document.getElementById('txt-btn-start');

    btn.disabled = true; 
    txtBtn.innerText = textData[currentLang].loading;

    try {
        if (webcam && webcam.canvas) { 
            webcam.stop(); 
            webcam = null; 
        }
        container.innerHTML = ""; 

        const size = 600; 
        const flip = !useBackCamera; 
        
        webcam = new tmImage.Webcam(size, size, flip);

        let constraints = {
            facingMode: useBackCamera ? { exact: "environment" } : "user"
        };

        try {
            await webcam.setup(constraints);
        } catch (err) {
            constraints = { facingMode: useBackCamera ? "environment" : "user" };
            await webcam.setup(constraints);
        }

        await webcam.play();
        
        webcam.canvas.style.width = "100%";
        webcam.canvas.style.height = "100%";
        webcam.canvas.style.objectFit = "cover";
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
    
    if(webcam) {
        webcam.stop();
        webcam = null; 
    }
    
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
    if(isRunning) {
        stopScanning();
        setTimeout(() => {
            startCamera();
        }, 500); 
    }
}

async function loop() {
    if(isRunning && webcam) { 
        webcam.update(); 
        animationId = window.requestAnimationFrame(loop); 
    }
}

// ==========================================
// 🚀 AI SECTION: GROQ (Llama 4 Scout Vision)
// ==========================================

async function captureAndAnalyzeWithGroq() {
    if (!webcam || !webcam.canvas) return;

    if (!GROQ_API_KEY || GROQ_API_KEY.includes("YOUR_GROQ")) {
        alert("Please set your GROQ_API_KEY in script.js first!");
        return;
    }

    const btn = document.getElementById('btn-main');
    const originalText = btn.innerHTML;
    
    // UI: Loading
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${textData[currentLang].analyzing}`;
    
    const scanLine = document.getElementById('scan-line');
    scanLine.style.display = 'block';

    try {
        // 1. จับภาพ
        const imageBase64 = webcam.canvas.toDataURL("image/jpeg", 0.7);

        // 2. ส่งไปถาม Groq API
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
                                // 🟢 Prompt: ระบุกฎสีถังขยะของไทยให้ชัดเจน
                                text: `Identify the waste object in this image.
                                Classify it STRICTLY based on Thai waste sorting rules:

                                1. "Recyclable" (Yellow Bin): Clean plastic bottles, glass, metal cans, paper, cardboard.
                                2. "Organic" (Green Bin): Food scraps, fruit peels, leaves, biodegradable waste.
                                3. "Hazardous" (Red Bin): Batteries, electronics (e-waste), light bulbs, chemicals, medicine containers.
                                4. "General" (Blue Bin): Dirty plastic bags, snack wrappers, foam, tissues, wooden sticks, toothpaste tubes, candy wrappers, foil bags.

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
                                If no waste is found, set category to "Unknown".
                                Do not include markdown code blocks.`
                            },
                            {
                                type: "image_url",
                                image_url: { url: imageBase64 }
                            }
                        ]
                    }
                ],
                temperature: 0.1,
                max_tokens: 500,
                response_format: { type: "json_object" }
            })
        });

        const json = await response.json();
        
        if (json.error) {
            throw new Error(json.error.message);
        }

        const aiContent = json.choices[0].message.content;
        const resultData = JSON.parse(aiContent);

        scanLine.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = originalText;

        if (resultData.category === "Unknown") {
            alert(currentLang === 'en' ? "No waste detected. Try closer." : "ไม่พบขยะในภาพ ลองขยับเข้ามาใกล้ๆ ครับ");
        } else {
            showResultPopupFromAI(resultData);
        }

    } catch (error) {
        console.error("AI Error:", error);
        scanLine.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = originalText;
        alert("AI Error: " + error.message);
    }
}

// ==========================================
// 🛠️ DISPLAY RESULT (AUTO MAPPING FIX)
// ==========================================

function showResultPopupFromAI(aiData) {
    const card = document.getElementById('modal-card-content');
    
    // 🟢 Master Config: บังคับคะแนนและสีถังตามประเภทที่ AI ส่งมา
    const wasteStandards = {
        "Recyclable": {
            xp: 10,
            colorClass: "theme-yellow",
            icon: "bi-recycle",
            binNameEN: "Yellow Bin (Recycle)",
            binNameTH: "ถังเหลือง (รีไซเคิล)"
        },
        "Organic": {
            xp: 5,
            colorClass: "theme-green",
            icon: "bi-flower1",
            binNameEN: "Green Bin (Organic)",
            binNameTH: "ถังเขียว (อินทรีย์)"
        },
        "Hazardous": {
            xp: 15,
            colorClass: "theme-red",
            icon: "bi-exclamation-triangle-fill",
            binNameEN: "Red Bin (Hazardous)",
            binNameTH: "ถังแดง (อันตราย)"
        },
        "General": {
            xp: 2,
            colorClass: "theme-blue",
            icon: "bi-trash3-fill",
            binNameEN: "Blue Bin (General)",
            binNameTH: "ถังน้ำเงิน (ทั่วไป)"
        },
        "Unknown": {
            xp: 0,
            colorClass: "theme-blue",
            icon: "bi-question-circle",
            binNameEN: "Unknown Bin",
            binNameTH: "ไม่ทราบประเภท"
        }
    };

    // ตรวจสอบว่า AI ส่ง category มาตรงไหม ถ้าไม่ตรงให้ปัดเป็น General
    const category = wasteStandards[aiData.category] ? aiData.category : "General";
    const info = wasteStandards[category];

    // Reset Theme
    card.classList.remove('theme-yellow', 'theme-green', 'theme-red', 'theme-blue');
    card.classList.add(info.colorClass);

    // Update Text Data
    document.getElementById('res-xp').innerText = "+" + info.xp + " XP";
    
    const isTH = currentLang === 'th';
    document.getElementById('res-title').innerText = isTH ? aiData.name_th : aiData.name_en;
    document.getElementById('res-bin').innerText = isTH ? info.binNameTH : info.binNameEN; // ใช้ชื่อถังจาก Config เราเอง
    document.getElementById('res-desc').innerText = isTH ? aiData.desc_th : aiData.desc_en;
    document.getElementById('res-knowledge').innerText = isTH ? aiData.knowledge_th : aiData.knowledge_en;
    document.getElementById('res-howto').innerText = isTH ? aiData.howto_th : aiData.howto_en;
    
    document.getElementById('res-icon').className = `bi ${info.icon}`;

    document.getElementById('result-modal').style.display = "flex";
    
    // Speak
    if(isSoundOn) {
        const binText = isTH ? info.binNameTH : info.binNameEN;
        const itemText = isTH ? aiData.name_th : aiData.name_en;
        const textToSpeak = `${itemText}. ${binText}`;
        const u = new SpeechSynthesisUtterance(textToSpeak);
        u.lang = isTH ? 'th-TH' : 'en-US';
        window.speechSynthesis.speak(u);
    }
    
    // Save Score
    userData.score = (userData.score || 0) + info.xp;
    if(userId) {
        db.ref('users/' + userId).update({ score: userData.score });
    }
    
    updateUI(true); 
}

function closeResultModal() {
    document.getElementById('result-modal').style.display = 'none';
}

// Handle Enter Key for Login
document.getElementById('username-input').addEventListener("keyup", function(event) {
    if (event.key === "Enter") handleAuthAction();
});