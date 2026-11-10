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

    const { data: perfil } = await db.from("perfiles").select("nombre").eq("id", perfilId).maybeSingle();
    if(!perfil){
        estadoEl.textContent = "Este usuario no existe.";
        return;
    }
    document.title = perfil.nombre + " · Armonitabs";
    document.getElementById("nombre-el").textContent = perfil.nombre;

    const { data, error } = await db.from("tabs_resumen")
        .select("id, titulo, artista, tonalidades, dificultad, autor_nombre, promedio, cantidad_votos")
        .eq("autor", perfilId)
        .order("creada", { ascending: false });
    if(error){
        estadoEl.textContent = "No se pudieron cargar las tablaturas: " + error.message;
        return;
    }
    const propio = usuario && usuario.id === perfilId;
    if(data.length){
        estadoEl.textContent = data.length + (data.length === 1 ? " tablatura publicada" : " tablaturas publicadas");
    } else {
        estadoEl.textContent = propio
            ? "Todavía no publicaste tablaturas. Escribí una en el editor y tocá «Publicar»."
            : "Todavía no publicó tablaturas.";
    }
    document.getElementById("lista-el").replaceChildren(...data.map(crearTarjetaTab));
}

cargarPerfil();
