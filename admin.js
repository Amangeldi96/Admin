import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBVhHADTsrD2e2tKXEtJ-M1EOUHv8qREuw",
    authDomain: "musickg-36f9f.firebaseapp.com",
    projectId: "musickg-36f9f",
    storageBucket: "musickg-36f9f.appspot.com",
    messagingSenderId: "718433313457",
    appId: "1:718433313457:web:bb6906c7108adcb01d3890"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- АВТОРИЗАЦИЯ ---
window.login = () => {
    const e = document.getElementById('email-in').value;
    const p = document.getElementById('pass-in').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => showMsg("Ката: " + err.message, true));
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, u => {
    if (u) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-main').style.display = 'block';
        loadAllItems();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-main').style.display = 'none';
    }
});

// --- ФОРМАНЫ ЖӨНӨӨ ---
window.adjustForm = () => {
    const cat = document.getElementById('mainCategory').value;
    const divName = document.getElementById('divName');
    const divFile = document.getElementById('divFile');

    if(divName) divName.style.display = 'block';
    if(divFile) divFile.style.display = 'block';

    if (cat === 'shorts') {
        if(divName) divName.style.display = 'none';
        if(divFile) divFile.style.display = 'none';
    } 
    else if (cat === 'new_hits' || cat === 'hits') {
        if(divFile) divFile.style.display = 'none';
    }
};

window.updateFileName = () => {
    const f = document.getElementById('imgFile').files[0];
    const lbl = document.getElementById('l-imgFile');
    if (f) lbl.innerHTML = `Тандалды: <span style="color:#00c853">${f.name.substring(0, 15)}...</span>`;
};

// --- САЙТКА ЧЫГАРУУ ---
window.confirmUpload = async () => {
    const cat = document.getElementById('mainCategory').value;
    const artist = document.getElementById('artistName').value;
    const name = document.getElementById('itemName').value;
    const url = document.getElementById('itemUrl').value;
    const file = document.getElementById('imgFile').files[0];

    if (!artist || !url) return showMsg("Артистти жана шилтемени жазыңыз!", true);
    if ((cat === 'top_hits' || cat === 'upcoming') && !file) return showMsg("Сүрөт милдеттүү!", true);

    const btn = document.getElementById('uploadBtn');
    const btnText = document.getElementById('upload-btn-text');
    btn.disabled = true;
    btnText.innerText = "Күтө туруңуз...";

    try {
        let coverUrl = "";
        if (file && (cat === 'top_hits' || cat === 'upcoming')) {
            const imgRef = ref(storage, `covers/${Date.now()}_${file.name}`);
            const snap = await uploadBytes(imgRef, file);
            coverUrl = await getDownloadURL(snap.ref);
        }
        
        await addDoc(collection(db, cat), {
            artist: artist,
            name: (cat === 'shorts') ? "" : name,
            src: url,
            cover: coverUrl, 
            createdAt: new Date()
        });

        showMsg("Ийгиликтүү кошулду!");
        setTimeout(() => location.reload(), 1000);
    } catch (err) {
        showMsg("Ката: " + err.message, true);
        btn.disabled = false;
        btnText.innerText = "Кайра аракет";
    }
};

// --- ТИЗМЕНИ ЖҮКТӨӨ ---
async function loadAllItems() {
    const cats = ['shorts', 'top_hits', 'hits', 'new_hits', 'upcoming'];
    for (let c of cats) {
        const list = document.getElementById('list-' + c);
        if (!list) continue;
        list.innerHTML = "";

        const q = query(collection(db, c), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        snap.forEach(d => {
            const data = d.data();
            let imgHtml = "";
            if (c !== 'shorts') {
                imgHtml = data.cover 
                    ? `<img src="${data.cover}" style="width:40px; height:40px; border-radius:5px; object-fit:cover; margin-right:10px;">` 
                    : `<div style="width:40px; height:40px; background:#333; border-radius:5px; margin-right:10px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#555;">IMG</div>`;
            }

            const title = (c === 'shorts') ? data.artist : `${data.artist} - ${data.name}`;
            list.insertAdjacentHTML('beforeend', `
                <div class="swipe-container" id="${d.id}">
                    <div class="item" ontouchstart="ts(event)" ontouchmove="tm(event)" ontouchend="te(event)">
                        ${imgHtml}
                        <div style="width:100%">
                            <b style="display:block; font-size:14px;">${title}</b>
                            <small style="color:#666; font-size:10px; display:block;">${data.src}</small>
                        </div>
                    </div>
                    <div class="delete-btn" onclick="askDelete('${c}', '${d.id}')">✕</div>
                </div>`);
        });
    }
}

// --- ТОЛУК ӨЧҮРҮҮ (ТЕКСТ + СҮРӨТ) ---
let delCat = '', delId = '';
window.askDelete = (c, i) => { delCat = c; delId = i; document.getElementById('deleteModal').style.display = 'flex'; };
window.closeDelModal = () => document.getElementById('deleteModal').style.display = 'none';

document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
        const docRef = doc(db, delCat, delId);
        const snap = await getDocs(query(collection(db, delCat)));
        const targetDoc = snap.docs.find(d => d.id === delId);

        if (targetDoc) {
            const data = targetDoc.data();
            // Эгер сүрөтү болсо Storage'ден өчүрөбүз
            if (data.cover && data.cover.includes("firebasestorage")) {
                try {
                    const imgRef = ref(storage, data.cover);
                    await deleteObject(imgRef);
                } catch (e) { console.log("Сүрөт мурда эле өчүрүлгөн"); }
            }
        }

        await deleteDoc(docRef);
        document.getElementById(delId).remove();
        closeDelModal();
        showMsg("Баары өчүрүлдү!");
    } catch (err) { showMsg("Ката: " + err.message, true); }
};

window.openUpload = () => { document.getElementById('uploadModal').style.display = 'flex'; adjustForm(); };
window.closeUpload = () => { document.getElementById('uploadModal').style.display = 'none'; };

function showMsg(txt, err = false) {
    const b = document.getElementById('toast-box');
    if(!b) return;
    b.innerText = txt;
    b.style.background = err ? "#ff4444" : "#00c853";
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 3000);
}

// Swipe logic
let sx = 0, cx = 0, activeEl = null;
window.ts = (e) => { sx = e.touches[0].clientX; activeEl = e.currentTarget; activeEl.style.transition = 'none'; }
window.tm = (e) => { 
    cx = e.touches[0].clientX - sx;
    if (cx < 0 && cx > -100) activeEl.style.transform = `translateX(${cx}px)`;
}
window.te = () => {
    activeEl.style.transition = 'transform 0.4s ease';
    activeEl.style.transform = (cx < -50) ? 'translateX(-85px)' : 'translateX(0px)';
}
