let tabEl = document.getElementById("tab-el");

let tab = [];

$array = preg_split("\n", $string);

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