const estadoEl = document.getElementById("estado-el");

async function cargarPerfil(){
    if(!db){
        estadoEl.textContent = "Los perfiles no están disponibles en este momento.";
        return;
    }
    // Sin id en la URL se muestra el perfil propio
    let perfilId = new URLSearchParams(location.search).get("id");
    const usuario = await obtenerUsuario();
    if(!perfilId){
        if(!usuario){
            location.href = urlEntrar();
            return;
        }
        perfilId = usuario.id;
    }

    const { data: perfil } = await db.from("perfiles").select("nombre, profe").eq("id", perfilId).maybeSingle();
    if(!perfil){
        estadoEl.textContent = "Este usuario no existe.";
        return;
    }
    document.title = perfil.nombre + " · Armonitabs";
    const nombreEl = document.getElementById("nombre-el");
    nombreEl.textContent = perfil.nombre;
    nombreEl.dataset.nombre = perfil.nombre;
    if(perfil.profe) nombreEl.append(" ", crearEtiqueta("Profe", "profe"));
    if(usuario && usuario.admin) mostrarBotonProfe(perfilId, perfil.profe);

    const { data, error } = await db.from("tabs_resumen")
        .select("id, titulo, artista, tonalidades, dificultad, autor_nombre, autor_profe, revisada, promedio, cantidad_votos")
        .eq("autor", perfilId)
        .order("creada", { ascending: false });
    if(error){
        estadoEl.textContent = "No se pudieron cargar las tablaturas: " + error.message;
        return;
    }
    const propio = usuario && usuario.id === perfilId;
    document.getElementById("cambiar-nombre-el").hidden = !propio;
    if(propio && bienvenida) abrirCambioDeNombre();
    if(data.length){
        estadoEl.textContent = data.length + (data.length === 1 ? " tablatura publicada" : " tablaturas publicadas");
    } else {
        estadoEl.textContent = propio
            ? "Todavía no publicaste tablaturas. Escribí una en el editor y tocá «Publicar»."
            : "Todavía no publicó tablaturas.";
    }
    document.getElementById("lista-el").replaceChildren(...data.map(tab => crearTarjetaTab(tab)));
}

// Administradores: marcar o desmarcar a un usuario como profe
function mostrarBotonProfe(perfilId, esProfe){
    const enlace = document.getElementById("profe-el");
    enlace.textContent = esProfe ? "Quitar la marca de profe" : "Marcar como profe";
    enlace.hidden = false;
    enlace.onclick = async (event) => {
        event.preventDefault();
        const { data, error } = await db.from("perfiles").update({ profe: !esProfe }).eq("id", perfilId).select("profe");
        if(error || !data.length){
            mostrarAviso("No se pudo cambiar" + (error ? ": " + error.message : ""));
            return;
        }
        location.reload();
    };
}

// Cambiar el nombre de usuario (solo en el perfil propio)
const nombreDialogo = document.getElementById("nombre-dialogo");
const nombreForm = document.getElementById("nombre-form");
const nombreMensaje = document.getElementById("nombre-mensaje");

// Primera vez que entra con Google: se abre solo y después vuelve a la página donde estaba
const parametros = new URLSearchParams(location.search);
const bienvenida = parametros.has("bienvenida") && !parametros.has("id");
const volverParametro = parametros.get("volver") || "";
const volver = /^[a-z0-9-]+\.html(\?[^\s]*)?$/.test(volverParametro) ? volverParametro : "index.html";

function abrirCambioDeNombre(){
    nombreForm.nombre.value = document.getElementById("nombre-el").dataset.nombre;
    nombreMensaje.textContent = "";
    if(bienvenida){
        document.getElementById("nombre-ttl").textContent = "¡Te damos la bienvenida!";
        document.getElementById("nombre-ayuda").textContent =
            "Elegí tu nombre de usuario: es el que se ve junto a las tabs que publicás. " +
            "Si te gusta, podés dejar el de tu cuenta de Google.";
        document.getElementById("nombre-cancelar").textContent = "Dejar este";
    }
    nombreDialogo.showModal();
    nombreForm.nombre.select();
}

document.getElementById("cambiar-nombre-el").addEventListener("click", (event) => {
    event.preventDefault();
    abrirCambioDeNombre();
});

function cerrarCambioDeNombre(){
    nombreDialogo.close();
}

// Queda anotado en la cuenta para no volver a preguntarle
async function terminarBienvenida(){
    await db.auth.updateUser({ data: { nombre_elegido: true } });
    location.href = volver;
}

// Cancelar, Escape o guardar el mismo nombre
nombreDialogo.addEventListener("close", () => {
    if(bienvenida) terminarBienvenida();
});

nombreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nombre = nombreForm.nombre.value.trim();
    if(nombre.length < 3){
        nombreMensaje.textContent = "El nombre tiene que tener al menos 3 letras.";
        return;
    }
    const usuarioActual = await obtenerUsuario();
    if(nombreReservado(nombre) && !usuarioActual.admin){
        nombreMensaje.textContent = "Ese nombre está reservado para la Escuela. Elegí otro.";
        return;
    }
    if(nombre === document.getElementById("nombre-el").dataset.nombre){
        nombreDialogo.close();
        return;
    }
    const usuario = await obtenerUsuario();
    const boton = document.getElementById("nombre-btn");
    boton.disabled = true;
    const { error } = await db.from("perfiles").update({ nombre }).eq("id", usuario.id);
    boton.disabled = false;
    if(error){
        // 23505: el índice único de nombres (sin distinguir mayúsculas)
        nombreMensaje.textContent = error.code === "23505" ? "Ese nombre de usuario ya está en uso."
            : error.message === "nombre_reservado" ? "Ese nombre está reservado para la Escuela. Elegí otro."
            : "No se pudo cambiar el nombre: " + error.message;
        return;
    }
    if(bienvenida){
        terminarBienvenida();
    } else {
        // Recargar para que el nombre nuevo aparezca también en el menú
        location.reload();
    }
});

cargarPerfil();
