import './style.css';
import { supabase } from "./supabase.js";

// ---------------------------------------------------
// AUTH CHECK
// ---------------------------------------------------
const { data: auth } = await supabase.auth.getSession();

if (!auth.session) {
    window.location.href = "/login.html";
    throw new Error("STOP: utilisateur non connecté");
}

const user = auth.session.user;

loadUserPDFs();

async function loadUserPDFs() {
    const { data: pdfs, error } = await supabase
        .from("pdf_files")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

    if (error) {
        console.error("Erreur chargement PDFs", error);
        return;
    }

    updatePDFList(pdfs);
}



// ---------------------------
// Récupération des infos Google
// ---------------------------
const meta = user.user_metadata ?? {};
const name = meta.full_name ?? meta.name ?? user.email;
const avatar = meta.avatar_url ?? meta.picture ?? "https://via.placeholder.com/80";

// ---------------------------
// Remplissage du bandeau
// ---------------------------
document.getElementById("userName").textContent = name;
document.getElementById("userAvatar").src = avatar;


document.getElementById("userBanner").style.opacity = "1";

// Initialisation lucide
lucide.createIcons();


// GLOBALS
let isPlaying = false;
let scrollSpeed = 1.5;
let animationId = null;

let documents = [];
let totalPages = 0;

// DOM
const scroller = document.getElementById('scroller');
const pdfRenderArea = document.getElementById('pdfArea');
const fileInput = document.getElementById('fileInput');
const emptyState = document.getElementById('empty');

const btnToggle = document.getElementById('toggleBtn');
const speedRange = document.getElementById('speed');
const btnSettings = document.getElementById('settingsBtn');

const settingsPanel = document.getElementById('advanced');
const settingsContent = document.getElementById('settingsContent');
const closeSettings = document.getElementById('closeSettings');
const tabLibrary = document.getElementById('tabLibrary');
const tabSpeeds = document.getElementById('tabSpeeds');



// ---------------------------------------------------
// UPLOAD MULTI-PDF
// ---------------------------------------------------
fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;

    const files = [...e.target.files];
    const userId = user.id; // utilisateur connecté

    for (const file of files) {
        const ext = file.name.split('.').pop();
        const newName = `${crypto.randomUUID()}.${ext}`;
        const path = `${userId}/${newName}`;

        // 1️⃣ Upload Supabase Storage
        const { error: uploadError } = await supabase
            .storage
            .from("pdfs")
            .upload(path, file);

        if (uploadError) {
            console.error("Erreur upload", uploadError);
            continue;
        }

        // 2️⃣ Compter les pages
        const tempUrl = URL.createObjectURL(file);
        const pdf = await pdfjsLib.getDocument(tempUrl).promise;
        const pageCount = pdf.numPages;

        // 3️⃣ Enregistrement BDD
        const { error: insertError } = await supabase
            .from("pdf_files")
            .insert({
                user_id: userId,
                pdf_name: file.name,
                storage_path: path,
                page_count: pageCount,
                speed: 1.5,
                sort_order: documents.length
            });

        if (insertError) {
            console.error("Erreur DB", insertError);
            continue;
        }
    }

    alert("PDF enregistré !");
    loadUserPDFs();
});



// ---------------------------------------------------
// PLAY / PAUSE
// ---------------------------------------------------
btnToggle.addEventListener('click', togglePlay);


// ---------------------------------------------------
// SPEED CONTROL (HUD SLIDER = PDF COURANT)
// ---------------------------------------------------
speedRange.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);

    // trouver le PDF actuellement affiché
    const docIndex = getCurrentDocumentIndex();
    if (docIndex !== -1) {
        documents[docIndex].speed = speed;     // update vitesse PDF
    }

    scrollSpeed = speed; // utilisé si aucun doc détecté (edge case)
});


// ---------------------------------------------------
// OPEN SETTINGS PANEL
// ---------------------------------------------------
btnSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');

    // Onglet par défaut = Bibliothèque
    tabLibrary.classList.add("active");
    tabSpeeds.classList.remove("active");

    loadUserPDFs();
});



// ---------------------------------------------------
// CLOSE SETTINGS PANEL
// ---------------------------------------------------
closeSettings.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
    emptyState.style.display = 'flex';
    pdfRenderArea.innerHTML = "";
    documents = [];
    totalPages = 0;
    cancelAnimationFrame(animationId);

    btnToggle.innerHTML = '<i data-lucide="play"></i>';
    lucide.createIcons();
});


// ---------------------------------------------------
// SETTINGS TABS LOGIC
// ---------------------------------------------------

tabLibrary.addEventListener('click', () => {
    tabLibrary.classList.add("active");
    tabSpeeds.classList.remove("active");

    // Affiche les PDFs sauvegardés
    loadUserPDFs();
});

tabSpeeds.addEventListener('click', () => {
    tabSpeeds.classList.add("active");
    tabLibrary.classList.remove("active");

    // Affiche les sliders de vitesses
    updateSettingsPanel();
});


// ---------------------------------------------------
// KEYBOARD SHORTCUTS
// ---------------------------------------------------
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    }
});


// ---------------------------------------------------
// RENDER PDF  → retourne nombre de pages
// ---------------------------------------------------
async function renderPDF(url) {
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;

        let num = pdf.numPages;

        for (let pageNum = 1; pageNum <= num; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.width = "100%";

            await page.render({
                canvasContext: ctx,
                viewport
            }).promise;

            pdfRenderArea.appendChild(canvas);
        }

        return num;

    } catch (err) {
        console.error(err);
        alert("Erreur lors du chargement du PDF : " + err.message);
        return 0;
    }
}


// ---------------------------------------------------
// SETTINGS CONTENT (par PDF)
// ---------------------------------------------------
function updateSettingsPanel() {

    settingsContent.innerHTML = `
        <div class="settings-title">
            <strong>Documents chargés :</strong>
        </div>

        <div class="settings-grid">
            ${documents.map((doc, i) => `
                <div class="settings-page">

                    <span>${doc.name}</span>

                    <input 
                        type="range"
                        min="0.2"
                        max="5"
                        step="0.1"
                        value="${doc.speed}"
                        data-doc="${i}"
                        class="pdf-speed-slider"
                    >

                    <div class="settings-reorder">
                        <button class="move-up" data-index="${i}">🔼</button>
                        <button class="move-down" data-index="${i}">🔽</button>
                    </div>

                </div>
            `).join("")}
        </div>
    `;

    // sliders
    document.querySelectorAll(".pdf-speed-slider").forEach(slider => {
        slider.addEventListener("input", async (e) => {
            const idx = Number(e.target.dataset.doc);
            const newSpeed = Number(e.target.value);

            documents[idx].speed = newSpeed;

            if (idx === getCurrentDocumentIndex()) {
                speedRange.value = newSpeed;
            }

            await supabase
                .from("pdf_files")
                .update({ speed: newSpeed })
                .eq("storage_path", documents[idx].storage_path);
        });
    });


    // boutons monter / descendre
    document.querySelectorAll(".move-up").forEach(btn => {
        btn.addEventListener("click", () => movePDFUp(Number(btn.dataset.index)));
    });

    document.querySelectorAll(".move-down").forEach(btn => {
        btn.addEventListener("click", () => movePDFDown(Number(btn.dataset.index)));
    });
}

function movePDFUp(index) {
    if (index === 0) return;

    [documents[index - 1], documents[index]] = [documents[index], documents[index - 1]];

    reorderCanvasFromDocuments();
    updateSettingsPanel();

    saveOrderToDatabase(); 
}


function movePDFDown(index) {
    if (index === documents.length - 1) return;

    [documents[index], documents[index + 1]] = [documents[index + 1], documents[index]];

    reorderCanvasFromDocuments();
    updateSettingsPanel();

    saveOrderToDatabase();
}


async function saveOrderToDatabase() {
    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];

        await supabase
            .from("pdf_files")
            .update({
                sort_order: i,
                speed: doc.speed
            })
            .eq("storage_path", doc.storage_path); 
    }

    console.log("Ordre sauvegardé en BDD.");
}


function reorderCanvasFromDocuments() {
    const canvases = [...pdfRenderArea.querySelectorAll("canvas")];

    let currentIndex = 0;
    const newOrderCanvases = [];

    documents.forEach(doc => {
        const pageCount = doc.endIndex - doc.startIndex + 1;

        const docCanvas = canvases.slice(doc.startIndex, doc.startIndex + pageCount);

        newOrderCanvases.push(...docCanvas);

        doc.startIndex = currentIndex;
        doc.endIndex = currentIndex + pageCount - 1;

        currentIndex += pageCount;
    });

    pdfRenderArea.innerHTML = "";
    newOrderCanvases.forEach(c => pdfRenderArea.appendChild(c));
}


function updatePDFList(pdfs) {
    settingsContent.innerHTML = `
        <div class="settings-title"><strong>Documents sauvegardés :</strong></div>
        <div class="settings-grid">
            ${pdfs.map(pdf => `
                <div class="settings-page">
                    <span>${pdf.pdf_name}</span>
                        <button 
                            class="upload-btn" 
                            data-path="${pdf.storage_path}"
                            data-name="${pdf.pdf_name}"
                        >
                        Charger
                    </button>
                </div>
            `).join("")}
        </div>
    `;

    document.querySelectorAll("[data-path]").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const path = e.target.dataset.path;

            const { data } = await supabase
                .storage
                .from("pdfs")
                .createSignedUrl(path, 3600);

            loadSavedPDF(data.signedUrl, e.target.dataset.name, path);
        });
    });
}

async function loadSavedPDF(url, name, path) {
    emptyState.style.display = "none";

    const startIndex = pdfRenderArea.querySelectorAll("canvas").length;
    const pageCount = await renderPDF(url);
    const endIndex = startIndex + pageCount - 1;

    const { data: row } = await supabase
        .from("pdf_files")
        .select("sort_order, speed")
        .eq("storage_path", path)
        .single();

    documents.push({
        name,
        speed: row.speed ?? 1.5,
        sort_order: row.sort_order,
        startIndex,
        endIndex,
        storage_path: path
    });

    console.log("PDF ajouté :", documents);
}




// ---------------------------------------------------
// DETECT CURRENT DOCUMENT
// ---------------------------------------------------
function getCurrentDocumentIndex() {
    const canvases = [...pdfRenderArea.querySelectorAll("canvas")];

    for (let i = 0; i < canvases.length; i++) {
        const rect = canvases[i].getBoundingClientRect();

        if (rect.top < window.innerHeight * 0.5 && rect.bottom > 0) {

            // i = index page → quel doc ?
            return documents.findIndex(doc =>
                i >= doc.startIndex && i <= doc.endIndex
            );
        }
    }

    return -1;
}


// ---------------------------------------------------
// SCROLL ENGINE
// ---------------------------------------------------
function startScroll() {
    if (!isPlaying) return;

    const docIndex = getCurrentDocumentIndex();
    let speed = scrollSpeed;

    if (docIndex !== -1) {
        speed = documents[docIndex].speed;
    }

    scroller.scrollTop += speed;

    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 10) {
        togglePlay();
        return;
    }

    animationId = requestAnimationFrame(startScroll);
}

function togglePlay() {
    isPlaying = !isPlaying;

    if (isPlaying) {
        btnToggle.innerHTML = '<i data-lucide="pause"></i>';
        lucide.createIcons();
        startScroll();
    } else {
        btnToggle.innerHTML = '<i data-lucide="play"></i>';
        lucide.createIcons();
        cancelAnimationFrame(animationId);
    }
}

// ---------------------------------------------------
// DROPDOWN USER MENU
// ---------------------------------------------------

const banner = document.getElementById("userBanner");
const dropdown = document.getElementById("userDropdown");
const logoutBtn = document.getElementById("logoutBtn");

let dropdownOpen = false;

// Toggle au clic sur le banner
banner.addEventListener("click", () => {
    dropdownOpen = !dropdownOpen;
    dropdown.classList.toggle("show", dropdownOpen);
});

// Fermer au clic ailleurs
document.addEventListener("click", (e) => {
    if (!banner.contains(e.target)) {
        dropdownOpen = false;
        dropdown.classList.remove("show");
    }
});

// Déconnexion
logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
});
