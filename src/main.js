/* ---------------------------------------------------
   IMPORTS PDF.js + worker
-----------------------------------------------------*/
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* ---------------------------------------------------
   VARIABLES DOM
-----------------------------------------------------*/
const fileInput = document.getElementById("fileInput");
const emptyMessage = document.getElementById("emptyMessage");
const pdfContent = document.getElementById("pdfContent");

// Contrôles flottants
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const speedRange = document.getElementById("speedRange");

// Modale réglages par page
const pageSettingsBtn = document.getElementById("pageSettingsBtn");
const pageSettingsModal = document.getElementById("pageSettingsModal");
const pageSettingsList = document.getElementById("pageSettingsList");
const closePageSettings = document.getElementById("closePageSettings");

/* ---------------------------------------------------
   SCROLL AUTOMATIQUE
-----------------------------------------------------*/
let scrollInterval = null;

// Vitesse globale
let scrollSpeed = 2;

// Vitesse personnalisée par page
let pageSpeeds = {};  // { 1: 5, 2: 3, ... }

/* slider global */
speedRange.addEventListener("input", () => {
    scrollSpeed = Number(speedRange.value);
});

/* START */
startBtn.addEventListener("click", () => {
    clearInterval(scrollInterval);

    scrollInterval = setInterval(() => {
        const currentPage = getCurrentPage();
        const speed = pageSpeeds[currentPage] ?? scrollSpeed;
        pdfContent.scrollTop += speed;
    }, 40);
});

/* STOP */
stopBtn.addEventListener("click", () => {
    clearInterval(scrollInterval);
});

/* ---------------------------------------------------
   DETECTER LA PAGE ACTUELLE
-----------------------------------------------------*/
function getCurrentPage() {
    const canvases = [...pdfContent.querySelectorAll("canvas")];

    for (let i = 0; i < canvases.length; i++) {
        const rect = canvases[i].getBoundingClientRect();

        // Page considérée active si visible au moins à 25%
        if (rect.top <= window.innerHeight * 0.25 && rect.bottom > 0) {
            return i + 1;
        }
    }

    return canvases.length;
}

/* ---------------------------------------------------
   SELECTION MULTI-PDF
-----------------------------------------------------*/
let totalPages = 0;

fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    if (files.length === 0) return;

    pdfContent.innerHTML = "";
    pdfContent.style.display = "block";
    emptyMessage.style.display = "none";

    pageSpeeds = {};
    totalPages = 0;

    for (const file of files) {
        await renderPDF(file);
    }

    generatePageSettingsUI();
});

/* ---------------------------------------------------
   RENDU D’UN PDF
-----------------------------------------------------*/
async function renderPDF(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    console.log(`📄 Chargement : ${file.name} - ${pdf.numPages} pages`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {

        totalPages++;

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.4 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: ctx,
            viewport
        }).promise;

        pdfContent.appendChild(canvas);
    }
}

/* ---------------------------------------------------
   GENERER L'UI DES VITESSES PAR PAGE
-----------------------------------------------------*/
function generatePageSettingsUI() {
    pageSettingsList.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const wrapper = document.createElement("div");
        wrapper.className = "page-setting-row";

        wrapper.innerHTML = `
            <label>Page ${i}</label>
            <input 
                type="number" 
                min="0" 
                max="20" 
                step="0.5" 
                value="${pageSpeeds[i] ?? scrollSpeed}"
                data-page="${i}"
            >
        `;

        pageSettingsList.appendChild(wrapper);
    }

    // MAJ des valeurs par page
    pageSettingsList.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", () => {
            const page = Number(input.dataset.page);
            const value = Number(input.value);
            pageSpeeds[page] = value;
        });
    });
}

/* ---------------------------------------------------
   MODALE PAR PAGE
-----------------------------------------------------*/
pageSettingsBtn.addEventListener("click", () => {
    pageSettingsModal.classList.remove("hidden");
});

closePageSettings.addEventListener("click", () => {
    pageSettingsModal.classList.add("hidden");
});

// Cliquer en dehors ferme la modale
pageSettingsModal.addEventListener("click", (e) => {
    if (e.target === pageSettingsModal) {
        pageSettingsModal.classList.add("hidden");
    }
});
