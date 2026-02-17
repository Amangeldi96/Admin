import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://xvdkoilhxvqpyljuaabq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGtvaWxoeHZxcHlsanVhYWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjc5MzIsImV4cCI6MjA4NjgwMzkzMn0.4hL5UriqWuCrHVNwyx_XJVBQoQu4Nv6lLxhr5-xXSJ8';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- АВТОРИЗАЦИЯ ЖАНА АБАЛ ---
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

// --- СВАЙП ЛОГИКАСЫ (Fixed) ---
let startX = 0, lastX = 0, currentItem = null;

window.ts = (e) => {
    startX = e.touches[0].clientX;
    currentItem = e.currentTarget;
    currentItem.style.transition = "none";
};

window.tm = (e) => {
    let moveX = e.touches[0].clientX;
    let diff = startX - moveX;
    lastX = diff;
    if (diff > 0 && diff <= 120) {
        currentItem.style.transform = `translateX(-${diff}px)`;
    } else if (diff < 0) {
        currentItem.style.transform = `translateX(${Math.max(diff, -85) + 85}px)`;
        if (Math.abs(diff) >= 85) currentItem.style.transform = `translateX(0px)`;
    }
};

window.te = (e) => {
    currentItem.style.transition = "transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)";
    if (lastX > 40) {
        currentItem.style.transform = "translateX(-85px)";
    } else {
        currentItem.style.transform = "translateX(0px)";
    }
    lastX = 0;
};

// --- МААЛЫМАТ КИРГИЗҮҮ (Чектөөлөр менен) ---
window.confirmUpload = async () => {
    const cat = document.getElementById('mainCategory').value;
    const artist = document.getElementById('artistName').value;
    const name = document.getElementById('itemName').value;
    const url = document.getElementById('itemUrl').value;
    const file = document.getElementById('imgFile').files[0];

    if (!artist || !url) return showMsg("Артистти жана шилтемени жазыңыз!", true);
    
    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;

    try {
        // 1. ЧЕКТӨӨЛӨРДҮ ТЕКШЕРҮҮ
        if (cat === 'shorts' || cat === 'top_hits') {
            const { count, error: countErr } = await supabase
                .from(cat)
                .select('*', { count: 'exact', head: true });

            if (countErr) throw countErr;

            if (cat === 'shorts' && count >= 4) {
                throw new Error("Шортс бөлүмүнө 4 гана шортс бабат! Бирин өчүрүңүз.");
            }
            if (cat === 'top_hits' && count >= 5) {
                throw new Error("Топ-5 бөлүмүнө 5 гана ыр бабат! Бирин өчүрүңүз.");
            }
        }

        // 2. СҮРӨТ ЖҮКТӨӨ
        let coverUrl = "";
        if (file && (cat === 'top_hits' || cat === 'upcoming' || cat === 'hits' || cat === 'new_hits')) {
            const fileName = `covers/${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage.from('Albums').upload(fileName, file);
            if (upErr) throw upErr;
            coverUrl = supabase.storage.from('Albums').getPublicUrl(fileName).data.publicUrl;
        }
        
        // 3. БАЗАГА ЖАЗУУ
        const { error: dbErr } = await supabase.from(cat).insert([{
            artist: artist,
            name: (cat === 'shorts') ? "" : name,
            src: url,
            cover: coverUrl,
            created_at: new Date()
        }]);

        if (dbErr) throw dbErr;
        
        showMsg("Ийгиликтүү кошулду!");
        setTimeout(() => {
            closeUpload();
            btn.disabled = false;
            document.getElementById('artistName').value = "";
            document.getElementById('itemName').value = "";
            document.getElementById('itemUrl').value = "";
            document.getElementById('imgFile').value = "";
            loadAllItems(); 
        }, 800);

    } catch (err) {
        showMsg(err.message, true);
        btn.disabled = false;
    }
};

// --- ӨЧҮРҮҮ (Storage + Database) ---
let delCat = '', delId = '';
window.askDelete = (c, i) => { delCat = c; delId = i; document.getElementById('deleteModal').style.display = 'flex'; };
window.closeDelModal = () => document.getElementById('deleteModal').style.display = 'none';

document.getElementById('confirmDeleteBtn').onclick = async () => {
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    try {
        const { data: item } = await supabase.from(delCat).select('cover').eq('id', delId).single();
        
        if (item && item.cover) {
            const pathParts = item.cover.split('/public/Albums/');
            if (pathParts.length > 1) {
                await supabase.storage.from('Albums').remove([pathParts[1]]);
            }
        }

        const { error } = await supabase.from(delCat).delete().eq('id', delId);
        if (error) throw error;

        const el = document.getElementById('cont-' + delId);
        if (el) el.remove();
        showMsg("Өчүрүлдү!");
    } catch (err) {
        showMsg("Ката: " + err.message, true);
    } finally {
        btn.disabled = false;
        closeDelModal();
    }
};

// --- ЖҮКТӨӨ ЖАНА ИНТЕРФЕЙС ---
async function loadAllItems() {
    const cats = ['shorts', 'top_hits', 'hits', 'new_hits', 'upcoming'];
    for (let c of cats) {
        const list = document.getElementById('list-' + c);
        if (!list) continue;
        list.innerHTML = ""; 

        const { data: items } = await supabase.from(c).select('*').order('created_at', { ascending: false });
        if (!items) continue;

        items.forEach(data => {
            let imgHtml = (c !== 'shorts') ? (data.cover 
                ? `<img src="${data.cover}" style="width:45px; height:45px; border-radius:10px; object-fit:cover; margin-right:15px;">` 
                : `<div style="width:45px; height:45px; background:#222; border-radius:10px; margin-right:15px;"></div>`) : "";

            const title = (c === 'shorts') ? data.artist : `${data.artist} - ${data.name}`;
            list.insertAdjacentHTML('beforeend', `
                <div class="swipe-container" id="cont-${data.id}">
                    <div class="delete-btn" onclick="askDelete('${c}', '${data.id}')">✕</div>
                    <div class="item" ontouchstart="ts(event)" ontouchmove="tm(event)" ontouchend="te(event)">
                        ${imgHtml}
                        <div style="flex:1; overflow:hidden;">
                            <b style="display:block; font-size:14px;">${title}</b>
                            <small style="color:#666; font-size:11px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.src}</small>
                        </div>
                    </div>
                </div>`);
        });
    }
}

window.openUpload = () => { document.getElementById('uploadModal').style.display = 'flex'; adjustForm(); };
window.closeUpload = () => { document.getElementById('uploadModal').style.display = 'none'; };
window.adjustForm = () => {
    const cat = document.getElementById('mainCategory').value;
    document.getElementById('divName').style.display = (cat === 'shorts') ? 'none' : 'block';
    document.getElementById('divFile').style.display = (cat === 'shorts') ? 'none' : 'block';
};
window.updateFileName = () => {
    const f = document.getElementById('imgFile').files[0];
    if (f) document.getElementById('l-imgFile').innerHTML = `Тандалды: <span style="color:var(--primary)">${f.name.substring(0, 15)}...</span>`;
};

function showMsg(txt, err = false) {
    const b = document.getElementById('toast-box');
    if(!b) return;
    b.innerText = txt;
    b.style.background = err ? "#ff4d4d" : "#00c853";
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 3000);
}
