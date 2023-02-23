const armonica = document.getElementById("armo-el")
let tabEl = document.getElementById("tab-el");
let aeBtn = document.getElementById("ae-btn");
let uaBtn = document.getElementById("ua-btn");
let auBtn = document.getElementById("au-btn");
let uauBtn = document.getElementById("uau-btn");
let tBtn = document.getElementById("t-btn");
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
    // if(tState){
    //     uaBtn.innerText = "t" + uaBtn.innerText
    //     auBtn.innerText = "t" + auBtn.innerText
    //     uauBtn.innerText = "t" + uauBtn.innerText
    //     tState = false;
    // } else {
    //     uaBtn.innerText = uaBtn.innerText.slice(1)
    //     auBtn.innerText = auBtn.innerText.slice(1)
    //     uauBtn.innerText = uauBtn.innerText.slice(1)
    //     tState = true
    // }
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
window.addEventListener('keydown', (event) => {
    event.preventDefault();
    switch(event.code){
        case "Enter": 
            saltoDeLinea();
            break;
        case "Backspace": 
            borrar();
            break;
        case "Minus": 
            celdaPulsada('10bb');
            break;
        case "Digit1": 
            celdaPulsada('1ob');
            break;
        case "Digit4": 
            celdaPulsada('4ob');
            break;
        case "Digit5": 
            celdaPulsada('5ob');
            break;
        case "Digit6": 
            celdaPulsada('6ob');
            break;
        case "Digit8": 
            celdaPulsada('8b');
            break;
        case "Digit9": 
            celdaPulsada('9b');
            break;
        case "Digit0": 
            celdaPulsada('10b');
            break;
        case "KeyQ": 
            celdaPulsada('1');
            break;
        case "KeyW": 
            celdaPulsada('2');
            break;
        case "KeyE": 
            celdaPulsada('3');
            break;
        case "KeyR": 
            celdaPulsada('4');
            break;
        case "KeyT": 
            celdaPulsada('5');
            break;
        case "KeyY": 
            celdaPulsada('6');
            break;
        case "KeyU": 
            celdaPulsada('7');
            break;
        case "KeyI": 
            celdaPulsada('8');
            break;
        case "KeyO": 
            celdaPulsada('9');
            break;
        case "KeyP": 
            celdaPulsada('10');
            break;
        case "KeyA": 
            celdaPulsada('(1)');
            break;
        case "KeyS": 
            celdaPulsada('(2)');
            break;
        case "KeyD": 
            celdaPulsada('(3)');
            break;
        case "KeyF": 
            celdaPulsada('(4)');
            break;
        case "KeyG": 
            celdaPulsada('(5)');
            break;
        case "KeyH": 
            celdaPulsada('(6)');
            break;
        case "KeyJ": 
            celdaPulsada('(7)');
            break;
        case "KeyK": 
            celdaPulsada('(8)');
            break;
        case "KeyL": 
            celdaPulsada('(9)');
            break;
        case "Semicolon": 
            celdaPulsada('(10)');
            break;
        case "IntlBackslash": 
            celdaPulsada('(1)b');
            break;
        case "KeyZ": 
            celdaPulsada('(2)b');
            break;
        case "KeyC": 
            celdaPulsada('(3)b');
            break;
        case "KeyN": 
            celdaPulsada('(4)b');
            break;
        case "KeyM": 
            celdaPulsada('(6)b');
            break;
        case "Comma": 
            celdaPulsada('(7)od');
            break;
        case "Period": 
            celdaPulsada('(9)od');
            break;
        case "Slash": 
            celdaPulsada('(10)od');
            break;
        case "KeyX": 
            celdaPulsada('(2)bb');
            break;
        case "KeyV": 
            celdaPulsada('(3)bb');
            break;
        case "KeyB": 
            celdaPulsada('(3)bbb');
            break;
    }
});





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