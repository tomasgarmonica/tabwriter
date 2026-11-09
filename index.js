const armonica = document.getElementById("armo-el")
let tabEl = document.getElementById("tab-el");
let aeBtn = document.getElementById("ae-btn");
let uaBtn = document.getElementById("ua-btn");
let auBtn = document.getElementById("au-btn");
let uauBtn = document.getElementById("uau-btn");
let tBtn = document.getElementById("t-btn");
let tecladoBtn = document.getElementById("teclado-btn");
let micBtn = document.getElementById("mic-btn");
let deteccionEl = document.getElementById("deteccion-el");

// El textarea es la fuente de verdad: así se conserva lo que se escribe a mano
function celdaPulsada(celda){
    const texto = tabEl.value;
    tabEl.value = (texto === "" || texto.endsWith("\n")) ? texto + celda : texto + " " + celda;
    tabEl.scrollTop = tabEl.scrollHeight;
}

function borrar(){
    let texto = tabEl.value.replace(/[ \t]+$/, "");
    if(texto.endsWith("\n")){
        texto = texto.slice(0, -1);
    } else {
        texto = texto.replace(/[ \t]*\S+$/, "");
    }
    tabEl.value = texto;
}

function saltoDeLinea(){
    tabEl.value += "\n";
    tabEl.scrollTop = tabEl.scrollHeight;
}

function aeBtnState(){
    if(uaBtn.innerText === "ua"  && auBtn.innerText === "au" && uauBtn.innerText === "uau"){
        uaBtn.innerText = "ue"
        auBtn.innerText = "eu"
        uauBtn.innerText = "ueu"
    } else if(uaBtn.innerText === "tua"  && auBtn.innerText === "tau" && uauBtn.innerText === "tuau"){
        uaBtn.innerText = "tue"
        auBtn.innerText = "teu"
        uauBtn.innerText = "tueu"
    } else if(uaBtn.innerText === "ue"  && auBtn.innerText === "eu" && uauBtn.innerText === "ueu"){
        uaBtn.innerText = "ua";
        auBtn.innerText = "au";
        uauBtn.innerText = "uau";
    } else{
        uaBtn.innerText = "tua";
        auBtn.innerText = "tau";
        uauBtn.innerText = "tuau";
    }
}

function tBtnState(){
    if(uaBtn.innerText === "ua"  && auBtn.innerText === "au" && uauBtn.innerText === "uau"){
        uaBtn.innerText = "tua";
        auBtn.innerText = "tau";
        uauBtn.innerText = "tuau";
    } else if(uaBtn.innerText === "tua"  && auBtn.innerText === "tau" && uauBtn.innerText === "tuau"){
        uaBtn.innerText = "ua";
        auBtn.innerText = "au";
        uauBtn.innerText = "uau";
    } else if(uaBtn.innerText === "tue"  && auBtn.innerText === "teu" && uauBtn.innerText === "tueu"){
        uaBtn.innerText = "ue";
        auBtn.innerText = "eu";
        uauBtn.innerText = "ueu";
    } else {
        uaBtn.innerText = "tue";
        auBtn.innerText = "teu";
        uauBtn.innerText = "tueu";
    }
}


function copiarAPortaPapeles(){
    let textoCopiado = document.getElementById("tab-el");

    textoCopiado.select();
    textoCopiado.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(textoCopiado.value);

    alert("Tab copiada al portapapeles!");
}

//Modo teclado
let modoTeclado = true;
tecladoBtn.classList.add("activo");

function toggleModoTeclado(){
    modoTeclado = !modoTeclado;
    tabEl.readOnly = modoTeclado;
    tecladoBtn.innerText = modoTeclado ? "Teclado: on (Esc)" : "Teclado: off (Esc)";
    tecladoBtn.classList.toggle("activo", modoTeclado);
    if(!modoTeclado){
        tabEl.focus();
        tabEl.setSelectionRange(tabEl.value.length, tabEl.value.length);
    } else {
        tabEl.blur();
    }
}

const teclas = {
    Minus: '10bb', Digit1: '1ob', Digit4: '4ob', Digit5: '5ob', Digit6: '6ob',
    Digit8: '8b', Digit9: '9b', Digit0: '10b',
    KeyQ: '1', KeyW: '2', KeyE: '3', KeyR: '4', KeyT: '5',
    KeyY: '6', KeyU: '7', KeyI: '8', KeyO: '9', KeyP: '10',
    KeyA: '(1)', KeyS: '(2)', KeyD: '(3)', KeyF: '(4)', KeyG: '(5)',
    KeyH: '(6)', KeyJ: '(7)', KeyK: '(8)', KeyL: '(9)', Semicolon: '(10)',
    IntlBackslash: '(1)b', KeyZ: '(2)b', KeyC: '(3)b', KeyN: '(4)b', KeyM: '(6)b',
    Comma: '(7)od', Period: '(9)od', Slash: '(10)od',
    KeyX: '(2)bb', KeyV: '(3)bb', KeyB: '(3)bbb',
};

window.addEventListener('keydown', (event) => {
    if(event.code === "Escape"){
        event.preventDefault();
        toggleModoTeclado();
        return;
    }
    // Texto libre o atajos (Ctrl+C, Ctrl+R...): dejar que el navegador los maneje
    if(!modoTeclado || event.ctrlKey || event.metaKey || event.altKey) return;

    event.preventDefault();
    if(event.code === "Enter"){
        saltoDeLinea();
    } else if(event.code === "Backspace"){
        borrar();
    } else if(teclas[event.code]){
        celdaPulsada(teclas[event.code]);
    }
});

//Detector de notas por micrófono
// Celdas de una armónica diatónica Richter, una por semitono desde el 1 soplado (C4 en una armónica en C).
// G4 sale tanto en 3 soplado como en (2) aspirado: se escribe (2).
const celdasPorSemitono = [
    "1", "(1)b", "(1)", "1ob", "2", "(2)bb", "(2)b", "(2)", "(3)bbb", "(3)bb",
    "(3)b", "(3)", "4", "(4)b", "(4)", "4ob", "5", "(5)", "5ob", "6",
    "(6)b", "(6)", "6ob", "(7)", "7", "(7)od", "(8)", "8b", "8", "(9)",
    "9b", "9", "(9)od", "(10)", "10bb", "10b", "10", "(10)od"
];
const nombresNotas = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const VOLUMEN_MINIMO = 0.01;  // RMS por debajo del cual se considera silencio
const FRAMES_ESTABLES = 6;    // ~100ms con la misma nota antes de escribirla
const FRAMES_SILENCIO = 4;    // silencio necesario para volver a escribir la misma nota
const TOLERANCIA_CENTS = 45;

let tono = 0;
let audioCtx = null;
let analizador = null;
let streamMic = null;
let bufferAudio = null;
let candidata = null;
let framesCandidata = 0;
let ultimaEscrita = null;
let framesSilencio = 0;
let botonDetectado = null;

function cambiarTono(valor){
    tono = parseInt(valor);
}

async function toggleMicrofono(){
    if(audioCtx){
        detenerMicrofono();
        return;
    }
    try {
        // Sin procesamiento: la supresión de ruido y el control de ganancia deforman el sonido de la armónica
        streamMic = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
    } catch(error){
        alert("No se pudo acceder al micrófono: " + error.message);
        return;
    }
    audioCtx = new AudioContext();
    analizador = audioCtx.createAnalyser();
    analizador.fftSize = 2048;
    audioCtx.createMediaStreamSource(streamMic).connect(analizador);
    bufferAudio = new Float32Array(analizador.fftSize);
    candidata = null;
    ultimaEscrita = null;
    micBtn.innerText = "Micrófono: on";
    micBtn.classList.add("activo");
    requestAnimationFrame(analizarAudio);
}

function detenerMicrofono(){
    streamMic.getTracks().forEach(track => track.stop());
    audioCtx.close();
    audioCtx = null;
    micBtn.innerText = "Micrófono: off";
    micBtn.classList.remove("activo");
    deteccionEl.textContent = "-";
    marcarCelda(null);
}

function analizarAudio(){
    if(!audioCtx) return;
    analizador.getFloatTimeDomainData(bufferAudio);
    const frecuencia = detectarFrecuencia(bufferAudio, audioCtx.sampleRate);
    const celda = frecuencia ? frecuenciaACelda(frecuencia) : null;

    if(!celda){
        framesSilencio++;
        if(framesSilencio >= FRAMES_SILENCIO) ultimaEscrita = null;
        candidata = null;
        framesCandidata = 0;
        deteccionEl.textContent = "-";
        marcarCelda(null);
    } else {
        framesSilencio = 0;
        if(celda.nombre === candidata){
            framesCandidata++;
        } else {
            candidata = celda.nombre;
            framesCandidata = 1;
        }
        if(framesCandidata >= FRAMES_ESTABLES){
            deteccionEl.textContent = celda.nombre + "  (" + celda.nota + ")";
            marcarCelda(celda.nombre);
            if(celda.nombre !== ultimaEscrita){
                celdaPulsada(celda.nombre);
                ultimaEscrita = celda.nombre;
            }
        }
    }
    requestAnimationFrame(analizarAudio);
}

function frecuenciaACelda(frecuencia){
    const midi = 69 + 12 * Math.log2(frecuencia / 440);
    const midiRedondeado = Math.round(midi);
    if(Math.abs(midi - midiRedondeado) * 100 > TOLERANCIA_CENTS) return null;
    const nombre = celdasPorSemitono[midiRedondeado - 60 - tono];
    if(!nombre) return null;
    const nota = nombresNotas[midiRedondeado % 12] + (Math.floor(midiRedondeado / 12) - 1);
    return { nombre, nota };
}

// Algoritmo YIN: busca el período fundamental de la señal
function detectarFrecuencia(buffer, sampleRate){
    let rms = 0;
    for(let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
    if(Math.sqrt(rms / buffer.length) < VOLUMEN_MINIMO) return null;

    const tauMin = Math.floor(sampleRate / 4000);
    const tauMax = Math.floor(sampleRate / 150);
    const ventana = buffer.length - tauMax;
    const diferencias = new Float32Array(tauMax + 1);

    for(let tau = 1; tau <= tauMax; tau++){
        let suma = 0;
        for(let i = 0; i < ventana; i++){
            const delta = buffer[i] - buffer[i + tau];
            suma += delta * delta;
        }
        diferencias[tau] = suma;
    }

    // Diferencia normalizada acumulada
    let acumulado = 0;
    diferencias[0] = 1;
    for(let tau = 1; tau <= tauMax; tau++){
        acumulado += diferencias[tau];
        diferencias[tau] = acumulado ? diferencias[tau] * tau / acumulado : 1;
    }

    let tau = tauMin;
    while(tau < tauMax && diferencias[tau] >= 0.15) tau++;
    if(tau >= tauMax) return null;
    while(tau + 1 < tauMax && diferencias[tau + 1] < diferencias[tau]) tau++;

    // Interpolación parabólica para afinar el período
    const a = diferencias[tau - 1], b = diferencias[tau], c = diferencias[tau + 1];
    const divisor = a + c - 2 * b;
    const tauFino = divisor ? tau + (a - c) / (2 * divisor) : tau;
    return sampleRate / tauFino;
}

function marcarCelda(nombre){
    if(botonDetectado) botonDetectado.classList.remove("detectada");
    botonDetectado = null;
    if(!nombre) return;
    for(const boton of armonica.getElementsByTagName("button")){
        if(boton.innerText === nombre){
            boton.classList.add("detectada");
            botonDetectado = boton;
            break;
        }
    }
}



function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - (button.offsetLeft + radius)}px`;
    circle.style.top = `${event.clientY - (button.offsetTop + radius)}px`;
    circle.classList.add("ripple");


    const ripple = button.getElementsByClassName("ripple")[0];

    if (ripple) {
        ripple.remove();
    }

    button.appendChild(circle);
}

const buttons = document.getElementsByTagName("button");
for (const button of buttons) {
    button.addEventListener("click", createRipple);
}
