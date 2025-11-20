import './style.css';

lucide.createIcons();

// GLOBALS
let isPlaying = false;
let scrollSpeed = 1.5;
let animationId = null;
let currentScale = 1.0;

let totalPages = 0;

// vitesses personnalisées par page
let pageSpeeds = {};


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
    totalPages = 0;
    pageSpeeds = {}; // reset vitesses pages

    for (const file of files) {
        const url = URL.createObjectURL(file);
        await renderPDF(url);
    }

    updateSettingsPanel();
});


// ---------------------------------------------------
// PLAY / PAUSE
// ---------------------------------------------------
btnToggle.addEventListener('click', togglePlay);


// ---------------------------------------------------
// SPEED CONTROL
// ---------------------------------------------------
speedRange.addEventListener('input', (e) => {
    scrollSpeed = parseFloat(e.target.value);
});


// ---------------------------------------------------
// OPEN SETTINGS PANEL
// ---------------------------------------------------
btnSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
});


// ---------------------------------------------------
// CLOSE SETTINGS PANEL → retour à l'écran d'accueil
// ---------------------------------------------------
closeSettings.addEventListener('click', () => {

    // réinitialise l’application (mais laisse les PDF chargés)
    settingsPanel.classList.add('hidden');
    emptyState.style.display = 'flex';
    pdfRenderArea.innerHTML = "";
    totalPages = 0;
    pageSpeeds = {};
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
// RENDER PDF
// ---------------------------------------------------
async function renderPDF(url) {
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {

            totalPages++;

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

    } catch (err) {
        console.error(err);
        alert("Erreur lors du chargement du PDF : " + err.message);
    }
}


// ---------------------------------------------------
// SETTINGS CONTENT (per-page speed)
// ---------------------------------------------------
function updateSettingsPanel() {

    settingsContent.innerHTML = `
        <div class="settings-title">
            <strong>Total pages :</strong> ${totalPages}
        </div>

        <div class="settings-grid">
            ${Array.from({ length: totalPages }, (_, i) => {
                const speedValue = pageSpeeds[i + 1] ?? scrollSpeed;

                return `
                    <div class="settings-page">
                        <span>Page ${i + 1}</span>

                        <input 
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value="${speedValue}"
                            data-page="${i + 1}"
                            class="page-speed-slider"
                        >
                    </div>
                `;
            }).join("")}
        </div>
    `;

    // sliders par page
    document.querySelectorAll(".page-speed-slider").forEach(slider => {
        slider.addEventListener("input", (e) => {
            const page = Number(e.target.dataset.page);
            const value = Number(e.target.value);

            pageSpeeds[page] = value;
        });
    });
}


// ---------------------------------------------------
// DETECT CURRENT PAGE
// ---------------------------------------------------
function getCurrentPage() {
    const canvases = [...pdfRenderArea.querySelectorAll("canvas")];

    for (let i = 0; i < canvases.length; i++) {
        const rect = canvases[i].getBoundingClientRect();

        if (rect.top < window.innerHeight * 0.5 && rect.bottom > 0) {
            return i + 1;
        }
    }

    return 1;
}


// ---------------------------------------------------
// SCROLL ENGINE
// ---------------------------------------------------
function startScroll() {
    if (!isPlaying) return;

    const currentPage = getCurrentPage();
    const speed = pageSpeeds[currentPage] ?? scrollSpeed;

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
