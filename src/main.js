import './style.css';

lucide.createIcons();

// GLOBALS
let isPlaying = false;
let scrollSpeed = 1.5;
let animationId = null;

let documents = []; // <-- liste des PDF + vitesses + index pages
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


// ---------------------------------------------------
// UPLOAD MULTI-PDF
// ---------------------------------------------------
fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;

    const files = [...e.target.files];

    emptyState.style.display = 'none';
    pdfRenderArea.innerHTML = "";

    documents = [];
    totalPages = 0;

    for (const file of files) {
        const url = URL.createObjectURL(file);

        const startIndex = totalPages; 

        const numPages = await renderPDF(url);
        const endIndex = startIndex + numPages - 1;

        // ajouter document
        documents.push({
            name: file.name,
            speed: scrollSpeed,   // vitesse par défaut
            startIndex,
            endIndex
        });

        totalPages += numPages;
    }

    updateSettingsPanel();
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
                </div>
            `).join("")}
        </div>
    `;

    document.querySelectorAll(".pdf-speed-slider").forEach(slider => {
        slider.addEventListener("input", (e) => {
            const idx = Number(e.target.dataset.doc);
            documents[idx].speed = Number(e.target.value);

            // si le doc modifié est affiché → update HUD slider
            if (idx === getCurrentDocumentIndex()) {
                speedRange.value = documents[idx].speed;
            }
        });
    });
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
