// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyA3UTjmzolQs5HHejpzfga0px6uxnADuSM", 
    authDomain: "smart-waste-deebuk.firebaseapp.com",
    databaseURL: "https://smart-waste-deebuk-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-waste-deebuk",
    storageBucket: "smart-waste-deebuk.firebasestorage.app",
    messagingSenderId: "11316279684",
    appId: "1:11316279684:web:5cee12dd58e7b5962c05d1"
};
const URL = "https://teachablemachine.withgoogle.com/models/zn21Zj9KC/";

// --- INIT ---
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

let currentLang = 'en';
let isSoundOn = true;
let userData = { score: 0, firstName: "", lastName: "", username: "", password: "", profilePic: "" };
let userId = "";
let isRegisterMode = false;
let tempProfilePic = "";

// Camera Variables
let model, webcam, maxPredictions, isRunning = false, animationId;
let useBackCamera = true; 

// Text Data (พร้อมเกร็ดความรู้แบบสุ่ม)
const textData = {
    en: {
        appName: "Smart Waste<br>Classifier",
        auth: { title: "Welcome Back", sub: "Sign in to continue", regTitle: "Create Account", regSub: "Join us today" },
        btnStart: "START CAMERA", btnScan: "SCAN OBJECT", loading: "Opening Camera...",
        classes: {
            "ขยะรีไซเคิล": { 
                title: "Recyclable", bin: "Yellow Bin", xp: 10, speech: "Recyclable. Yellow bin.", desc: "Bottles, Glass, Cans", 
                knowledge: [
                    "Recycling one can saves energy for 3 hours of TV!",
                    "Glass can be recycled endlessly without losing quality.",
                    "Recycling paper saves trees and water.",
                    "Plastic bottles take 450 years to decompose!"
                ], 
                howTo: "Empty, rinse, flatten.", type: "yellow" 
            },
            "ขยะอินทรีย์": { 
                title: "Organic", bin: "Green Bin", xp: 5, speech: "Organic. Green bin.", desc: "Food scraps, Peels", 
                knowledge: [
                    "Composting reduces landfill methane.",
                    "Organic waste makes great natural fertilizer.",
                    "Over 50% of household waste is organic.",
                    "Fruit peels break down in just a few weeks."
                ], 
                howTo: "Drain water. No plastic.", type: "green" 
            },
            "ขยะอันตราย": { 
                title: "Hazardous", bin: "Red Bin", xp: 5, speech: "Hazardous! Red bin.", desc: "Batteries, Spray cans", 
                knowledge: [
                    "Never burn hazardous waste.",
                    "One battery can pollute 600,000 liters of water!",
                    "E-waste contains gold, silver, and toxic metals.",
                    "Keep separate from other trash for safety."
                ], 
                howTo: "Separate bag. Don't break.", type: "red" 
            },
            "ขยะทั่วไป": { 
                title: "General", bin: "Blue Bin", xp: 1, speech: "General. Blue bin.", desc: "Wrappers, Tissues", 
                knowledge: [
                    "Takes 450 years to decompose.",
                    "Reduce usage is better than throwing away.",
                    "Foam boxes take 500+ years to break down.",
                    "Dirty plastic cannot be recycled."
                ], 
                howTo: "Tie bag tightly.", type: "blue" 
            },
            "พื้นหลัง": { title: "", xp: 0 }
        }
    },
    th: {
        appName: "นักแยกขยะ<br>อัจฉริยะ",
        auth: { title: "ยินดีต้อนรับ", sub: "เข้าสู่ระบบเพื่อใช้งาน", regTitle: "สมัครสมาชิก", regSub: "สร้างบัญชีใหม่" },
        btnStart: "เริ่มเปิดกล้อง", btnScan: "กดเพื่อสแกน", loading: "กำลังเปิดกล้อง...",
        classes: {
            "ขยะรีไซเคิล": { 
                title: "ขยะรีไซเคิล", bin: "ถังเหลือง", xp: 10, speech: "ขยะรีไซเคิล ถังเหลืองค่ะ", desc: "ขวด, แก้ว, กระป๋อง", 
                knowledge: [
                    "ขวดพลาสติกแปลงเป็นเสื้อกีฬาได้นะ!",
                    "รีไซเคิลกระป๋อง 1 ใบ ประหยัดไฟดูทีวีได้ 3 ชม.",
                    "แก้วรีไซเคิลได้ 100% ไม่รู้จบ",
                    "กระดาษ 1 ตัน ช่วยชีวิตต้นไม้ได้ 17 ต้น"
                ], 
                howTo: "เทน้ำ ล้าง บีบให้แบน", type: "yellow" 
            },
            "ขยะอินทรีย์": { 
                title: "ขยะอินทรีย์", bin: "ถังเขียว", xp: 5, speech: "ขยะอินทรีย์ ถังเขียวค่ะ", desc: "เศษอาหาร, เปลือกผลไม้", 
                knowledge: [
                    "หมักทำปุ๋ยช่วยลดโลกร้อนได้",
                    "ขยะอินทรีย์มีปริมาณมากที่สุดในบ้าน",
                    "เปลือกผลไม้ย่อยสลายเป็นปุ๋ยชั้นดี",
                    "เศษอาหารช่วยบำรุงดินได้นะ"
                ], 
                howTo: "กรองน้ำออก ห้ามทิ้งถุง", type: "green" 
            },
            "ขยะอันตราย": { 
                title: "ขยะอันตราย", bin: "ถังแดง", xp: 5, speech: "ขยะอันตราย ระวังด้วยค่ะ", desc: "ถ่าน, หลอดไฟ, สเปรย์", 
                knowledge: [
                    "สารเคมีจากถ่าน 1 ก้อนทำน้ำเสีย 6 แสนลิตร",
                    "ห้ามเผาเด็ดขาด เพราะเกิดควันพิษ",
                    "ขยะอิเล็กทรอนิกส์มีทองคำซ่อนอยู่ด้วยนะ",
                    "แยกทิ้งต่างหาก ปลอดภัยต่อคนเก็บ"
                ], 
                howTo: "แยกใส่ถุง เขียนบอกไว้", type: "red" 
            },
            "ขยะทั่วไป": { 
                title: "ขยะทั่วไป", bin: "ถังน้ำเงิน", xp: 1, speech: "ขยะทั่วไป ถังน้ำเงินค่ะ", desc: "ซองขนม, ทิชชู่", 
                knowledge: [
                    "ย่อยสลายยาก ลดการใช้ดีกว่า",
                    "กล่องโฟมใช้เวลาย่อยสลาย 500 ปี!",
                    "ทิชชู่เปื้อนไม่นับเป็นขยะรีไซเคิล",
                    "ถุงพลาสติกเปื้อนแกง ต้องทิ้งถังนี้"
                ], 
                howTo: "มัดปากถุงให้แน่น", type: "blue" 
            },
            "พื้นหลัง": { title: "", xp: 0 }
        }
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

// --- AUTH SYSTEM ---
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
        const audio = new Audio('https://actions.google.com/sounds/v1/cartoon/clank_car_crash.ogg'); 
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
// 🟢 SECTION: CAMERA LOGIC (FULL FIX)
// ==========================================

async function initModel() {
    if(!model) {
        model = await tmImage.load(URL + "model.json", URL + "metadata.json");
        maxPredictions = model.getTotalClasses();
    }
}

async function handleMainButton() {
    if (!isRunning) {
        startCamera();
    } else {
        manualPredict();
    }
}

async function startCamera() {
    const btn = document.getElementById('btn-main');
    const container = document.getElementById('webcam-container');
    const txtBtn = document.getElementById('txt-btn-start');

    btn.disabled = true; 
    txtBtn.innerText = textData[currentLang].loading;

    try {
        await initModel();

        if (webcam && webcam.canvas) { 
            webcam.stop(); 
            webcam = null; 
        }
        container.innerHTML = ""; 

        // 🟢 FULL FIX: สั่งขนาดเป็นสี่เหลี่ยมจัตุรัสเพื่อให้ CSS ตัดขอบรอบๆ
        // เป็นการบังคับ Zoom In (1.0x) โดยอัตโนมัติ
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
        
        // 🟢 บังคับสไตล์ CSS ให้ Canvas ขยายเต็มกรอบ
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

async function manualPredict() {
    if(model && webcam && webcam.canvas) {
        const scanLine = document.getElementById('scan-line');
        scanLine.style.display = 'block';
        scanLine.style.animation = 'none';
        scanLine.offsetHeight; 
        scanLine.style.animation = 'scan 1s linear infinite';
        
        const prediction = await model.predict(webcam.canvas);
        let highest = 0, best = "";
        prediction.forEach(p => { if(p.probability > highest) { highest = p.probability; best = p.className; } });
        
        setTimeout(() => { scanLine.style.display = 'none'; }, 300);

        if(highest > 0.85 && best !== "พื้นหลัง") {
            showResultPopup(best);
        } else {
            alert(currentLang === 'en' ? "No object detected. Try moving closer." : "ไม่พบวัตถุ ลองขยับเข้าไปใกล้ๆ ครับ");
        }
    }
}

function showResultPopup(className) {
    const data = textData[currentLang].classes[className];
    const card = document.getElementById('modal-card-content');
    
    card.classList.remove('theme-yellow', 'theme-green', 'theme-red', 'theme-blue');
    if(data.type === "yellow") card.classList.add('theme-yellow');
    else if(data.type === "green") card.classList.add('theme-green');
    else if(data.type === "red") card.classList.add('theme-red');
    else if(data.type === "blue") card.classList.add('theme-blue');

    document.getElementById('res-xp').innerText = "+" + data.xp + " XP";
    document.getElementById('res-title').innerText = data.title;
    document.getElementById('res-bin').innerText = data.bin;
    document.getElementById('res-desc').innerText = data.desc;

    // 🟢 RANDOM KNOWLEDGE: สุ่มความรู้ 1 ข้อ
    let knowledgeText = "";
    if (Array.isArray(data.knowledge)) {
        const randomIndex = Math.floor(Math.random() * data.knowledge.length);
        knowledgeText = data.knowledge[randomIndex];
    } else {
        knowledgeText = data.knowledge; // เผื่อกรณีเป็น String ธรรมดา
    }
    document.getElementById('res-knowledge').innerText = knowledgeText;

    document.getElementById('res-howto').innerText = data.howTo;
    
    const iconMap = { "ขยะรีไซเคิล": "bi-recycle", "ขยะอินทรีย์": "bi-flower1", "ขยะอันตราย": "bi-exclamation-triangle-fill", "ขยะทั่วไป": "bi-trash3-fill" };
    document.getElementById('res-icon').className = `bi ${iconMap[className] || 'bi-question'}`;

    document.getElementById('result-modal').style.display = "flex";
    
    if(isSoundOn) {
        const u = new SpeechSynthesisUtterance(data.speech);
        u.lang = (currentLang === 'th') ? 'th-TH' : 'en-US';
        window.speechSynthesis.speak(u);
    }
    
    // Update Score
    userData.score = (userData.score || 0) + data.xp;
    db.ref('users/' + userId).update({ score: userData.score });
    
    updateUI(true); 
}

function closeResultModal() {
    document.getElementById('result-modal').style.display = 'none';
}

// Handle Enter Key for Login
document.getElementById('username-input').addEventListener("keyup", function(event) {
    if (event.key === "Enter") handleAuthAction();
});