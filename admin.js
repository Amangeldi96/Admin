import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://xvdkoilhxvqpyljuaabq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGtvaWxoeHZxcHlsanVhYWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjc5MzIsImV4cCI6MjA4NjgwMzkzMn0.4hL5UriqWuCrHVNwyx_XJVBQoQu4Nv6lLxhr5-xXSJ8';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- ГЛОБАЛДЫК ӨЗГӨРМӨЛӨР ---
let isLoaded = false;
const ALL_CATEGORIES = ['video_clips', 'shorts', 'top_hits', 'hits', 'new_hits', 'upcoming'];

// --- 1. АВТОРИЗАЦИЯ ---

window.login = async () => {
    const e = document.getElementById('email-in').value;
    const p = document.getElementById('pass-in').value;
    const remember = document.getElementById('remember-me').checked;

    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    
    if (error) {
        showMsg("Ката: " + error.message, true);
    } else {
        if (remember) {
            localStorage.setItem('rememberedEmail', e);
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberMe');
        }
    }
};

window.logout = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        document.getElementById('pass-in').value = "";
        if (localStorage.getItem('rememberMe') !== 'true') {
            document.getElementById('email-in').value = "";
        }

        // UI тазалоо
        ALL_CATEGORIES.forEach(c => {
            const list = document.getElementById('list-' + c);
            if (list) list.innerHTML = "";
        });

        isLoaded = false;
        showMsg("Системадан чыктыңыз");
    } catch (err) {
        showMsg("Ката: " + err.message, true);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('rememberMe') === 'true') {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) document.getElementById('email-in').value = savedEmail;
        const check = document.getElementById('remember-me');
        if (check) check.checked = true;
    }
});

// --- 2. СЕРВЕРДЕН КАБАРЛАРДЫ КҮТҮҮ ---
supabase.auth.onAuthStateChange(async (event, session) => {
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

// --- 3. СВАЙП ЛОГИКАСЫ ---
let startX = 0, lastX = 0, currentItem = null;
window.ts = (e) => { startX = e.touches[0].clientX; currentItem = e.currentTarget; currentItem.style.transition = "none"; };
window.tm = (e) => { 
    let diff = startX - e.touches[0].clientX; 
    lastX = diff; 
    if (diff > 0 && diff <= 120) currentItem.style.transform = `translateX(-${diff}px)`; 
};
window.te = () => { 
    if (!currentItem) return;
    currentItem.style.transition = "transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)"; 
    if (lastX > 50) currentItem.style.transform = "translateX(-85px)"; 
    else currentItem.style.transform = "translateX(0px)"; 
    lastX = 0; 
};

// --- 4. МААЛЫМАТТАРДЫ ЖҮКТӨӨ ---
async function loadAllItems() {
    for (let c of ALL_CATEGORIES) {
        const list = document.getElementById('list-' + c);
        if (!list) continue;
        list.innerHTML = `<div style="padding:10px; color:#666; font-size:12px;">Жүктөлүүдө...</div>`; 
        
        const { data: items, error } = await supabase.from(c).select('*').order('created_at', { ascending: false });
        
        if (error) {
            console.error(`Ката (${c}):`, error.message);
            continue;
        }

        list.innerHTML = ""; 
        if (items) items.forEach(data => {
            // Видео жана Шортс үчүн сүрөт көрсөтпөйбүз (Ютубдан келет)
            let hasImage = (data.cover && c !== 'shorts' && c !== 'video_clips' && c !== 'hits' && c !== 'new_hits');
            let img = hasImage ? `<img src="${data.cover}" style="width:45px; height:45px; border-radius:10px; object-fit:cover; margin-right:15px;">` : "";
            
            // Тизмедеги текстти форматтоо
            const title = (c === 'shorts') ? data.artist : `${data.artist} - ${data.name}`;
            
            list.insertAdjacentHTML('beforeend', `
                <div class="swipe-container" id="cont-${data.id}">
                    <div class="delete-btn" onclick="askDelete('${c}', '${data.id}')">✕</div>
                    <div class="item" ontouchstart="ts(event)" ontouchmove="tm(event)" ontouchend="te(event)">
                        ${img}
                        <div style="flex:1; overflow:hidden;">
                            <b style="display:block; font-size:14px; color:#fff;">${title}</b>
                            <small style="color:#666; font-size:11px; white-space:nowrap;">${data.src}</small>
                        </div>
                    </div>
                </div>`);
        });
    }
}

// --- 5. КОШУУ ---
window.confirmUpload = async () => {
    const cat = document.getElementById('mainCategory').value;
    const artist = document.getElementById('artistName').value;
    const name = document.getElementById('itemName').value;
    const url = document.getElementById('itemUrl').value;
    const file = document.getElementById('imgFile').files[0];

    // Валидация
    if (!artist || !url) return showMsg("Артист жана Шилтеме талап кылынат!", true);
    if ((cat !== 'shorts') && !name) return showMsg("Аталышын жазыңыз!", true);

    const btn = document.getElementById('uploadBtn');
    const prg = document.getElementById('upload-progress');
    const prgCont = document.getElementById('upload-progress-container');
    
    btn.disabled = true;
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = "Жүктөлүүдө...";

    try {
        // Чектөөлөр (Шортс жана Топ 5 үчүн)
        if (cat === 'shorts' || cat === 'top_hits') {
            const { count } = await supabase.from(cat).select('*', { count: 'exact', head: true });
            if (cat === 'shorts' && count >= 4) throw new Error("Шортс бөлүмүнө 4 гана видео бабат!");
            if (cat === 'top_hits' && count >= 5) throw new Error("Топ-5 бөлүмүнө 5 гана ыр бабат!");
        }

        if (prgCont) prgCont.style.display = 'block'; 
        if (prg) prg.style.width = '20%';

        let coverUrl = "";
        // Сүрөт жүктөй турган категориялар
        if (file && (cat === 'top_hits' || cat === 'upcoming')) {
            const fileName = `covers/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from('Albums').upload(fileName, file);
            if (uploadError) throw uploadError;
            coverUrl = supabase.storage.from('Albums').getPublicUrl(fileName).data.publicUrl;
        }
        
        if (prg) prg.style.width = '60%';

        // Базага кошуу
        const insertData = {
            artist: artist,
            name: (cat === 'shorts' ? "" : name),
            src: url
        };
        if (coverUrl) insertData.cover = coverUrl;

        const { error: insertError } = await supabase.from(cat).insert([insertData]);
        if (insertError) throw insertError;

        if (prg) prg.style.width = '100%';
        showMsg("Ийгиликтүү кошулду!");
        
        setTimeout(() => location.reload(), 800);
    } catch (err) {
        showMsg(err.message, true); 
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
        if (prgCont) prgCont.style.display = 'none';
    }
};

// --- 6. ӨЧҮРҮҮ ---
let delCat = '', delId = '';
window.askDelete = (c, i) => { delCat = c; delId = i; document.getElementById('deleteModal').style.display = 'flex'; };
window.closeDelModal = () => document.getElementById('deleteModal').style.display = 'none';

document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
        // Эгер сүрөтү болсо, аны Storage'ден кошо өчүрүү
        const { data: item } = await supabase.from(delCat).select('cover').eq('id', delId).single();
        if (item?.cover) {
            const path = item.cover.split('/public/Albums/')[1];
            if (path) await supabase.storage.from('Albums').remove([path]);
        }
        
        await supabase.from(delCat).delete().eq('id', delId);
        const el = document.getElementById('cont-' + delId);
        if (el) el.remove();
        showMsg("Өчүрүлдү!");
    } catch (err) { 
        showMsg("Өчүрүүдө ката: " + err.message, true); 
    } finally { 
        closeDelModal(); 
    }
};

// --- ЖӨМӨКЧҮЛӨР ---
window.openUpload = () => { document.getElementById('uploadModal').style.display = 'flex'; };
window.closeUpload = () => { 
    document.getElementById('uploadModal').style.display = 'none';
    // Форманы тазалоо
    document.getElementById('artistName').value = "";
    document.getElementById('itemName').value = "";
    document.getElementById('itemUrl').value = "";
    document.getElementById('imgFile').value = "";
};

function showMsg(txt, err = false) {
    const b = document.getElementById('toast-box');
    if (!b) return;
    b.innerText = txt; 
    b.style.background = err ? "#ff4444" : "#00c853";
    b.classList.add('show'); 
    setTimeout(() => b.classList.remove('show'), 3000);
}
