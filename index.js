let tabEl = document.getElementById("tab-el");
let aeBtn = document.getElementById("ae-btn");
let uaBtn = document.getElementById("ua-btn");
let auBtn = document.getElementById("au-btn");
let uauBtn = document.getElementById("uau-btn");
let tBtn = document.getElementById("t-btn")
let aeState = true;
let tState = true;

let tab = [];

function celdaPulsada(celda){
    tab.push(celda)
    tabEl.textContent = tab.join(" ")
}

function borrar(){
    tab.pop()
    tabEl.textContent = tab.join(" ")
}

function saltoDeLinea(){
    tab.push("\n")
    tabEl.textContent = tab.join(" ")
}

function aeBtnState(){
    if(aeState){
        uaBtn.innerText = "ue"
        auBtn.innerText = "eu"
        uauBtn.innerText = "ueu"
        aeState = false;
    } else {
        uaBtn.innerText = "ua"
        auBtn.innerText = "au"
        uauBtn.innerText = "uau"
        aeState = true
    }
}

function tBtnState(){
    if(tState){
        uaBtn.innerText = "t" + uaBtn.innerText
        auBtn.innerText = "t" + auBtn.innerText
        uauBtn.innerText = "t" + uauBtn.innerText
        tState = false;
    } else {
        uaBtn.innerText = uaBtn.innerText.slice(1)
        auBtn.innerText = auBtn.innerText.slice(1)
        uauBtn.innerText = uauBtn.innerText.slice(1)
        tState = true
    }
}


function copiarAPortaPapeles(){
    let textoCopiado = document.getElementById("tab-el");

    textoCopiado.select();
    textoCopiado.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(textoCopiado.value);

    alert("Tab copiada al portapapeles");
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