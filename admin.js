import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://xvdkoilhxvqpyljuaabq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGtvaWxoeHZxcHlsanVhYWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjc5MzIsImV4cCI6MjA4NjgwMzkzMn0.4hL5UriqWuCrHVNwyx_XJVBQoQu4Nv6lLxhr5-xXSJ8';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 1. АВТОРИЗАЦИЯ ---
window.login = async () => {
    const e = document.getElementById('email-in').value;
    const p = document.getElementById('pass-in').value;
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if (error) showMsg("Ката: " + error.message, true);
};

// БУЛ ЖЕРДЕ ОҢДОЛДУ: logout функциясы эми HTML'ге көрүнөт
window.logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) showMsg("Чыгууда ката кетти", true);
};

let isLoaded = false;
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-main').style.display = 'block';
        if (!isLoaded) { loadAllItems(); isLoaded = true; }
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-main').style.display = 'none';
        isLoaded = false;
    }
});

// --- 2. СВАЙП ЛОГИКАСЫ ---
let startX = 0, lastX = 0, currentItem = null;

window.ts = (e) => {
    startX = e.touches[0].clientX;
    currentItem = e.currentTarget;
    currentItem.style.transition = "none";
};

window.tm = (e) => {
    let diff = startX - e.touches[0].clientX;
    lastX = diff;
    if (diff > 0 && diff <= 120) {
        currentItem.style.transform = `translateX(-${diff}px)`;
    }
};

window.te = (e) => {
    currentItem.style.transition = "transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)";
    if (lastX > 50) {
        currentItem.style.transform = "translateX(-85px)";
    } else {
        currentItem.style.transform = "translateX(0px)";
    }
    lastX = 0;
};

// --- 3. МААЛЫМАТТАРДЫ ЖҮКТӨӨ ---
async function loadAllItems() {
    const cats = ['shorts', 'top_hits', 'hits', 'new_hits', 'upcoming'];
    for (let c of cats) {
        const list = document.getElementById('list-' + c);
        if (!list) continue;
        list.innerHTML = ""; 

        const { data: items } = await supabase.from(c).select('*').order('created_at', { ascending: false });
        if (!items) continue;

        items.forEach(data => {
            let imgHtml = (data.cover) ? `<img src="${data.cover}" style="width:45px; height:45px; border-radius:10px; object-fit:cover; margin-right:15px;">` : "";
            if (c === 'shorts') imgHtml = "";

            const title = (c === 'shorts') ? data.artist : `${data.artist} - ${data.name}`;
            list.insertAdjacentHTML('beforeend', `
                <div class="swipe-container" id="cont-${data.id}">
                    <div class="delete-btn" onclick="askDelete('${c}', '${data.id}')">✕</div>
                    <div class="item" ontouchstart="ts(event)" ontouchmove="tm(event)" ontouchend="te(event)">
                        ${imgHtml}
                        <div style="flex:1; overflow:hidden;">
                            <b style="display:block; font-size:14px;">${title}</b>
                            <small style="color:#666; font-size:11px;">${data.src}</small>
                        </div>
                    </div>
                </div>`);
        });
    }
}

// --- 4. КОШУУ (ЧЕКТӨӨЛӨР МЕНЕН) ---
window.confirmUpload = async () => {
    const cat = document.getElementById('mainCategory').value;
    const artist = document.getElementById('artistName').value;
    const name = document.getElementById('itemName').value;
    const url = document.getElementById('itemUrl').value;
    const file = document.getElementById('imgFile').files[0];

    if (!artist || !url) return showMsg("Толук толтуруңуз!", true);
    
    const btn = document.getElementById('uploadBtn');
    const prg = document.getElementById('upload-progress');
    const prgCont = document.getElementById('upload-progress-container');
    
    btn.disabled = true;

    try {
        // --- ЧЕКТӨӨЛӨР ---
        if (cat === 'shorts' || cat === 'top_hits') {
            const { count } = await supabase.from(cat).select('*', { count: 'exact', head: true });
            if (cat === 'shorts' && count >= 4) throw new Error("Шортс бөлүмүнө 4 гана ыр бабат!");
            if (cat === 'top_hits' && count >= 5) throw new Error("Топ-5 бөлүмүнө 5 гана ыр бабат!");
        }

        prgCont.style.display = 'block';
        prg.style.width = '30%';

        let coverUrl = "";
        if (file && (cat === 'top_hits' || cat === 'upcoming')) {
            const fileName = `covers/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage.from('Albums').upload(fileName, file);
            if (upErr) throw upErr;
            coverUrl = supabase.storage.from('Albums').getPublicUrl(fileName).data.publicUrl;
        }
        
        prg.style.width = '70%';

        const { error: dbErr } = await supabase.from(cat).insert([{
            artist,
            name: (cat === 'shorts') ? "" : name,
            src: url,
            cover: coverUrl
        }]);

        if (dbErr) throw dbErr;
        
        prg.style.width = '100%';
        showMsg("Ийгиликтүү кошулду!");
        
        setTimeout(() => {
            closeUpload();
            location.reload(); 
        }, 800);

    } catch (err) {
        showMsg(err.message, true);
        btn.disabled = false;
        prgCont.style.display = 'none';
    }
};

// --- 5. ӨЧҮРҮҮ ---
let delCat = '', delId = '';
window.askDelete = (c, i) => { delCat = c; delId = i; document.getElementById('deleteModal').style.display = 'flex'; };
window.closeDelModal = () => document.getElementById('deleteModal').style.display = 'none';

document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
        const { data: item } = await supabase.from(delCat).select('cover').eq('id', delId).single();
        if (item?.cover) {
            const path = item.cover.split('/public/Albums/')[1];
            if (path) await supabase.storage.from('Albums').remove([path]);
        }
        await supabase.from(delCat).delete().eq('id', delId);
        document.getElementById('cont-' + delId).remove();
        showMsg("Өчүрүлдү!");
    } catch (err) {
        showMsg(err.message, true);
    } finally {
        closeDelModal();
    }
};

// --- ЖӨМӨКЧҮ ФУНКЦИЯЛАР ---
window.openUpload = () => { document.getElementById('uploadModal').style.display = 'flex'; };
window.closeUpload = () => { document.getElementById('uploadModal').style.display = 'none'; };
window.updateFileName = () => {
    const f = document.getElementById('imgFile').files[0];
    if (f) document.getElementById('l-imgFile').innerHTML = `Тандалды: <span>${f.name.substring(0, 15)}...</span>`;
};

function showMsg(txt, err = false) {
    const b = document.getElementById('toast-box');
    b.innerText = txt;
    b.style.background = err ? "#ff4444" : "#00c853";
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 3000);
}
