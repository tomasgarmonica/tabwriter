const entrarForm = document.getElementById("entrar-form");
const mensajeEl = document.getElementById("mensaje-el");
let registrando = false;

// Página a la que volver después de entrar (solo páginas del propio sitio)
const volverParametro = new URLSearchParams(location.search).get("volver") || "";
const volver = /^[a-z0-9-]+\.html(\?[^\s]*)?$/.test(volverParametro) ? volverParametro : "index.html";
const urlVolver = new URL(volver, location.href).href;

const ERRORES = {
    "Invalid login credentials": "Email o contraseña incorrectos.",
    "Email not confirmed": "Todavía no confirmaste tu email. Revisá tu casilla (y el spam).",
    "User already registered": "Ya hay una cuenta con ese email. Probá entrar.",
};

function traducirError(error){
    return ERRORES[error.message] || error.message;
}

document.getElementById("cambiar-el").addEventListener("click", (event) => {
    event.preventDefault();
    registrando = !registrando;
    document.getElementById("entrar-ttl").textContent = registrando ? "Crear cuenta" : "Entrar";
    document.getElementById("entrar-btn").textContent = registrando ? "Crear cuenta" : "Entrar";
    document.getElementById("cambiar-txt").textContent = registrando ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?";
    event.target.textContent = registrando ? "Entrá" : "Registrate";
    document.getElementById("nombre-lbl").hidden = !registrando;
    entrarForm.nombre.required = registrando;
    entrarForm.clave.autocomplete = registrando ? "new-password" : "current-password";
    mensajeEl.textContent = "";
});

async function entrarConGoogle(){
    if(!db) return;
    const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: urlVolver } });
    if(error) mensajeEl.textContent = traducirError(error);
}

entrarForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if(!db) return;
    const boton = document.getElementById("entrar-btn");
    boton.disabled = true;
    mensajeEl.textContent = "";
    try {
        if(registrando){
            await registrar();
        } else {
            const { error } = await db.auth.signInWithPassword({
                email: entrarForm.email.value, password: entrarForm.clave.value
            });
            if(error){
                mensajeEl.textContent = traducirError(error);
                return;
            }
            location.href = urlVolver;
        }
    } finally {
        boton.disabled = false;
    }
});

async function registrar(){
    const nombre = entrarForm.nombre.value.trim();
    // ilike sin comodines: compara sin distinguir mayúsculas
    const { data: existente } = await db.from("perfiles").select("id")
        .ilike("nombre", nombre.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if(existente){
        mensajeEl.textContent = "Ese nombre de usuario ya está en uso.";
        return;
    }
    const { data, error } = await db.auth.signUp({
        email: entrarForm.email.value,
        password: entrarForm.clave.value,
        options: { data: { nombre }, emailRedirectTo: urlVolver }
    });
    if(error){
        mensajeEl.textContent = traducirError(error);
        return;
    }
    if(data.session){
        location.href = urlVolver;
    } else {
        mensajeEl.textContent = "¡Listo! Te mandamos un email para confirmar la cuenta. Abrí el enlace y vas a quedar adentro.";
        entrarForm.reset();
    }
}

// Si ya tiene sesión, no tiene sentido estar acá
obtenerUsuario().then(usuario => { if(usuario) location.href = urlVolver; });

// El botón de Google aparece solo si está activado en Supabase (Authentication > Providers)
async function mostrarGoogleSiEstaActivo(){
    if(!db) return;
    try {
        const respuesta = await fetch(SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: SUPABASE_ANON_KEY } });
        const ajustes = await respuesta.json();
        if(ajustes.external && ajustes.external.google){
            document.getElementById("google-btn").hidden = false;
            document.getElementById("separador-el").hidden = false;
        }
    } catch(error){}
}

mostrarGoogleSiEstaActivo();
