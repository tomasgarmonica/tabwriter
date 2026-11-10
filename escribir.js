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
let g4Btn = document.getElementById("g4-btn");

//Guardado automático en el navegador
function guardar(){
    try {
        localStorage.setItem("tabwriter-tab", tabEl.value);
        localStorage.setItem("tabwriter-ajustes", JSON.stringify({
            tono, sensibilidad, estabilidad: framesEstables, g4: celdasPorSemitono[7]
        }));
    } catch(error){}
}

function cargar(){
    try {
        tabEl.value = localStorage.getItem("tabwriter-tab") || "";
        const ajustes = JSON.parse(localStorage.getItem("tabwriter-ajustes"));
        if(!ajustes) return;
        cambiarTono(ajustes.tono);
        document.getElementById("tono-el").value = ajustes.tono;
        cambiarSensibilidad(ajustes.sensibilidad);
        document.getElementById("sensibilidad-el").value = ajustes.sensibilidad;
        cambiarEstabilidad(ajustes.estabilidad);
        document.getElementById("estabilidad-el").value = ajustes.estabilidad;
        if(ajustes.g4 !== celdasPorSemitono[7]) toggleG4();
    } catch(error){}
}

tabEl.addEventListener("input", guardar);

// El textarea es la fuente de verdad: así se conserva lo que se escribe a mano
function celdaPulsada(celda){
    const texto = tabEl.value;
    tabEl.value = (texto === "" || texto.endsWith("\n")) ? texto + celda : texto + " " + celda;
    tabEl.scrollTop = tabEl.scrollHeight;
    guardar();
}

function borrar(){
    let texto = tabEl.value.replace(/[ \t]+$/, "");
    if(texto.endsWith("\n")){
        texto = texto.slice(0, -1);
    } else {
        texto = texto.replace(/[ \t]*\S+$/, "");
    }
    tabEl.value = texto;
    guardar();
}

function saltoDeLinea(){
    tabEl.value += "\n";
    tabEl.scrollTop = tabEl.scrollHeight;
    guardar();
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
    navigator.clipboard.writeText(tabEl.value);
    mostrarAviso("¡Tab copiada al portapapeles!");
}

function descargar(){
    // Si la primera línea es un título, se usa como nombre del archivo
    descargarTexto(tabEl.value, tabEl.value.split("\n")[0].trim() || "tablatura");
}

function limpiar(){
    if(tabEl.value === "" || !confirm("¿Borrar toda la tablatura?")) return;
    tabEl.value = "";
    guardar();
    dejarDeEditar();
}

//Publicar en Armonitabs
const publicarEl = document.getElementById("publicar-el");
const publicarForm = document.getElementById("publicar-form");

// Tab publicada que se abrió desde su página con "Editar" (se guarda en el navegador)
function tabEditando(){
    try {
        return JSON.parse(localStorage.getItem("armonitabs-editando"));
    } catch(error){
        return null;
    }
}

function dejarDeEditar(){
    try { localStorage.removeItem("armonitabs-editando"); } catch(error){}
    document.getElementById("publicar-editando").hidden = true;
    document.getElementById("publicar-ttl").textContent = "Publicar tablatura";
    document.getElementById("publicar-btn").textContent = "Publicar";
}

// Versiones: al publicar se ofrecen los artistas y temas que ya están, para que se escriban igual
let temasPublicados = new Map();
let parecidoRevisado = false;   // ya contestó "¿Es este tema?"
const parecidoEl = document.getElementById("publicar-parecido");

// Temas que no son solamente la tab que se está editando
function otrosTemas(){
    const editando = tabEditando();
    return [...temasPublicados.values()].filter(tema => !editando || tema.ids.some(id => id !== editando.id));
}

function llenarLista(lista, textos){
    const vistos = new Set();
    const opciones = [];
    for(const texto of textos){
        const clave = normalizarTexto(texto);
        if(!clave || vistos.has(clave)) continue;
        vistos.add(clave);
        opciones.push(new Option(texto));
    }
    opciones.sort((a, b) => a.value.localeCompare(b.value, "es"));
    document.getElementById(lista).replaceChildren(...opciones);
}

// Los títulos sugeridos son los del artista elegido (o todos si no coincide con ninguno)
function actualizarSugerencias(){
    const temas = otrosTemas();
    llenarLista("artistas-lista", temas.map(tema => tema.artista));
    const artista = normalizarTexto(publicarForm.artista.value);
    const delArtista = temas.filter(tema => normalizarTexto(tema.artista) === artista);
    llenarLista("titulos-lista", (delArtista.length ? delArtista : temas).map(tema => tema.titulo));

    const editando = tabEditando();
    const tema = temasPublicados.get(claveTema(publicarForm.titulo.value, publicarForm.artista.value));
    const cantidad = tema ? tema.ids.filter(id => !editando || id !== editando.id).length : 0;
    const aviso = document.getElementById("publicar-versiones");
    aviso.hidden = !cantidad || !publicarForm.titulo.value.trim();
    aviso.textContent = (cantidad === 1 ? "Ya hay 1 versión" : "Ya hay " + cantidad + " versiones") +
        " de este tema. Si la tuya es distinta (otra armónica, otra parte), ¡publicala igual!";
}

// El tema ya publicado más parecido a lo escrito, si no hay uno exactamente igual
function temaParecido(){
    const titulo = normalizarTexto(publicarForm.titulo.value);
    const artista = normalizarTexto(publicarForm.artista.value);
    let mejor = null;
    let menorDistancia = Infinity;
    for(const tema of otrosTemas()){
        const temaTitulo = normalizarTexto(tema.titulo);
        const temaArtista = normalizarTexto(tema.artista);
        if(temaTitulo === titulo && temaArtista === artista) return null;
        // Sin artista escrito se compara solo el título
        if(!textosParecidos(titulo, temaTitulo)) continue;
        if(artista && !textosParecidos(artista, temaArtista)) continue;
        const distancia = distanciaTextos(titulo, temaTitulo) + (artista ? distanciaTextos(artista, temaArtista) : 0);
        if(distancia < menorDistancia){
            mejor = tema;
            menorDistancia = distancia;
        }
    }
    return mejor;
}

for(const campo of [publicarForm.artista, publicarForm.titulo]){
    campo.addEventListener("input", () => {
        parecidoRevisado = false;
        parecidoEl.hidden = true;
        actualizarSugerencias();
    });
}

async function abrirPublicar(){
    if(!db){
        mostrarAviso("La publicación no está disponible en este momento");
        return;
    }
    if(tabEl.value.trim() === ""){
        mostrarAviso("La tab está vacía");
        return;
    }
    const usuario = await obtenerUsuario();
    if(!usuario){
        if(confirm("Para publicar tenés que entrar con tu cuenta. ¿Ir a entrar? (La tab queda guardada)")){
            location.href = urlEntrar();
        }
        return;
    }
    // Una edición que quedó de otra cuenta en este navegador no se puede guardar: se publica como nueva
    const editandoAntes = tabEditando();
    if(editandoAntes && editandoAntes.autor && editandoAntes.autor !== usuario.id) dejarDeEditar();

    const tonos = document.getElementById("publicar-tonos");
    if(!tonos.children.length){
        for(const tonalidad of TONALIDADES){
            const opcion = document.createElement("label");
            const casilla = document.createElement("input");
            casilla.type = "checkbox";
            casilla.name = "tonalidades";
            casilla.value = tonalidad;
            opcion.append(casilla, tonalidad);
            tonos.append(opcion);
        }
    }
    const editando = tabEditando();
    // Armónicas sugeridas: las de la tab que se edita, las marcadas en el texto o la elegida para el micrófono
    let sugeridas = armonicasEnContenido(tabEl.value);
    if(editando) sugeridas = editando.tonalidades || [editando.tonalidad];
    if(!sugeridas.length) sugeridas = [document.getElementById("tono-el").selectedOptions[0].text];
    for(const casilla of tonos.querySelectorAll("input")) casilla.checked = sugeridas.includes(casilla.value);

    if(editando){
        publicarForm.titulo.value = editando.titulo;
        publicarForm.artista.value = editando.artista || "";
        publicarForm.dificultad.value = editando.dificultad;
        document.getElementById("publicar-editando").hidden = false;
        document.getElementById("publicar-ttl").textContent = "Guardar cambios";
        document.getElementById("publicar-btn").textContent = "Guardar";
    }
    temasPublicados = await cargarTemas();
    parecidoRevisado = false;
    parecidoEl.hidden = true;
    actualizarSugerencias();
    publicarEl.showModal();
}

// Marca dentro de la tab desde dónde se toca con la armónica elegida en el selector
function cambioDeArmonica(){
    let texto = tabEl.value;
    if(texto !== "" && !texto.endsWith("\n")) texto += "\n";
    tabEl.value = texto + marcaArmonica(document.getElementById("tono-el").selectedOptions[0].text) + "\n";
    tabEl.scrollTop = tabEl.scrollHeight;
    guardar();
}

function cerrarPublicar(){
    publicarEl.close();
}

publicarForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    // Primero las armónicas en el orden en que aparecen en la tab, después el resto de las marcadas
    const marcadas = [...publicarForm.querySelectorAll("input[name=tonalidades]:checked")].map(casilla => casilla.value);
    const tonalidades = [
        ...armonicasEnContenido(tabEl.value).filter(tonalidad => marcadas.includes(tonalidad)),
        ...marcadas,
    ].filter((tonalidad, i, lista) => lista.indexOf(tonalidad) === i);
    if(tonalidades.length < 1 || tonalidades.length > 4){
        mostrarAviso("Marcá entre 1 y 4 armónicas");
        return;
    }
    // Si se parece a un tema ya publicado, se pregunta antes de crear uno nuevo
    const parecido = parecidoRevisado ? null : temaParecido();
    if(parecido){
        const cantidad = parecido.ids.length;
        document.getElementById("publicar-parecido-txt").textContent = "¿Es «" + parecido.titulo + "»" +
            (parecido.artista ? " de " + parecido.artista : "") + "? Ya hay " +
            (cantidad === 1 ? "1 versión" : cantidad + " versiones") + " de ese tema.";
        document.getElementById("parecido-si").onclick = () => {
            publicarForm.titulo.value = parecido.titulo;
            publicarForm.artista.value = parecido.artista;
            parecidoRevisado = true;
            publicarForm.requestSubmit();
        };
        document.getElementById("parecido-no").onclick = () => {
            parecidoRevisado = true;
            publicarForm.requestSubmit();
        };
        parecidoEl.hidden = false;
        return;
    }
    const boton = document.getElementById("publicar-btn");
    boton.disabled = true;
    const datos = {
        titulo: publicarForm.titulo.value.trim(),
        artista: publicarForm.artista.value.trim() || null,
        tonalidades,
        dificultad: parseInt(publicarForm.dificultad.value),
        contenido: tabEl.value,
    };
    const editando = tabEditando();
    let respuesta;
    if(editando){
        datos.actualizada = new Date().toISOString();
        respuesta = await db.from("tabs").update(datos).eq("id", editando.id).select("id").single();
    } else {
        respuesta = await db.from("tabs").insert(datos).select("id").single();
    }
    boton.disabled = false;
    if(respuesta.error){
        mostrarAviso("No se pudo publicar: " + respuesta.error.message);
        return;
    }
    dejarDeEditar();
    // Ya está publicada: la próxima vez el editor arranca vacío (los ajustes se mantienen)
    tabEl.value = "";
    guardar();
    location.href = "tab.html?id=" + respuesta.data.id;
});

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
    // Con el formulario de publicar abierto, el teclado escribe normalmente
    if(publicarEl.open) return;
    if(event.code === "Escape"){
        event.preventDefault();
        toggleModoTeclado();
        return;
    }
    // Texto libre o atajos (Ctrl+C, Ctrl+R...): dejar que el navegador los maneje
    if(!modoTeclado || event.ctrlKey || event.metaKey || event.altKey) return;
    // En los controles (selector de armónica, deslizadores) el teclado funciona como siempre
    if(event.target.matches("select, input")) return;

    // Solo se toman las teclas de la armónica; Tab, Espacio y las flechas siguen sirviendo para moverse
    if(event.code === "Enter"){
        event.preventDefault();
        saltoDeLinea();
    } else if(event.code === "Backspace"){
        event.preventDefault();
        borrar();
    } else if(teclas[event.code]){
        event.preventDefault();
        celdaPulsada(teclas[event.code]);
    }
});

//Detector de notas por micrófono
// Celdas de una armónica diatónica Richter, una por semitono desde el 1 soplado (C4 en una armónica en C).
// G4 sale tanto en 3 soplado como en (2) aspirado: se elige con el botón G4 (índice 7).
const celdasPorSemitono = [
    "1", "(1)b", "(1)", "1ob", "2", "(2)bb", "(2)b", "(2)", "(3)bbb", "(3)bb",
    "(3)b", "(3)", "4", "(4)b", "(4)", "4ob", "5", "(5)", "5ob", "6",
    "(6)b", "(6)", "6ob", "(7)", "7", "(7)od", "(8)", "8b", "8", "(9)",
    "9b", "9", "(9)od", "(10)", "10bb", "10b", "10", "(10)od"
];
const nombresNotas = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// RMS por debajo del cual se considera silencio, según el control de sensibilidad (1 a 10)
const VOLUMENES_MINIMOS = [0.08, 0.05, 0.035, 0.02, 0.01, 0.007, 0.005, 0.003, 0.002, 0.001];
const FRAMES_SILENCIO = 4;    // silencio necesario para volver a escribir la misma nota
const TOLERANCIA_CENTS = 45;

let tono = 0;
let sensibilidad = 5;
let volumenMinimo = VOLUMENES_MINIMOS[sensibilidad - 1];
let framesEstables = 6;       // frames (~16ms c/u) con la misma nota antes de escribirla
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
    guardar();
}

function cambiarSensibilidad(valor){
    sensibilidad = parseInt(valor);
    volumenMinimo = VOLUMENES_MINIMOS[sensibilidad - 1];
    guardar();
}

function cambiarEstabilidad(valor){
    framesEstables = parseInt(valor);
    guardar();
}

function toggleG4(){
    celdasPorSemitono[7] = celdasPorSemitono[7] === "(2)" ? "3" : "(2)";
    g4Btn.innerText = "G4 como: " + celdasPorSemitono[7];
    guardar();
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
        if(framesCandidata >= framesEstables){
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
    if(Math.sqrt(rms / buffer.length) < volumenMinimo) return null;

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

cargar();
