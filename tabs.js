const buscarForm = document.getElementById("buscar-form");
const estadoEl = document.getElementById("estado-el");
const listaEl = document.getElementById("lista-el");

for(const tonalidad of TONALIDADES) buscarForm.tonalidad.add(new Option(tonalidad, tonalidad));

// Los filtros quedan en la URL para poder compartir una búsqueda
const parametros = new URLSearchParams(location.search);
buscarForm.texto.value = parametros.get("texto") || "";
buscarForm.tonalidad.value = parametros.get("tonalidad") || "";
buscarForm.orden.value = parametros.get("orden") || "puntaje";

buscarForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nuevos = new URLSearchParams();
    if(buscarForm.texto.value.trim()) nuevos.set("texto", buscarForm.texto.value.trim());
    if(buscarForm.tonalidad.value) nuevos.set("tonalidad", buscarForm.tonalidad.value);
    if(buscarForm.orden.value !== "puntaje") nuevos.set("orden", buscarForm.orden.value);
    history.replaceState(null, "", "?" + nuevos);
    buscar();
});

async function buscar(){
    if(!db){
        estadoEl.textContent = "Las tablaturas no están disponibles en este momento.";
        return;
    }
    estadoEl.textContent = "Buscando...";
    listaEl.replaceChildren();

    let consulta = db.from("tabs_resumen")
        .select("id, titulo, artista, tonalidades, dificultad, autor_nombre, promedio, cantidad_votos")
        .limit(100);
    // Se sacan los caracteres que tienen significado especial en el filtro
    const texto = buscarForm.texto.value.replace(/[,()%*\\]/g, " ").trim();
    if(texto) consulta = consulta.or(`titulo.ilike.%${texto}%,artista.ilike.%${texto}%`);
    if(buscarForm.tonalidad.value) consulta = consulta.contains("tonalidades", [buscarForm.tonalidad.value]);
    if(buscarForm.orden.value === "nuevas"){
        consulta = consulta.order("creada", { ascending: false });
    } else {
        consulta = consulta.order("promedio", { ascending: false })
            .order("cantidad_votos", { ascending: false })
            .order("creada", { ascending: false });
    }

    const { data, error } = await consulta;
    if(error){
        estadoEl.textContent = "No se pudieron cargar las tablaturas: " + error.message;
        return;
    }
    estadoEl.textContent = data.length ? "" : "No se encontraron tablaturas.";
    listaEl.replaceChildren(...data.map(crearTarjetaTab));
}

buscar();
