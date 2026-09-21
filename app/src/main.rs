use std::time::Duration;

use axum::{
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

// Fly siempre usa 8080; PUERTO solo lo fija tools/arrancar.ps1 al probar en el PC.
fn puerto() -> u16 {
    variable("PUERTO").and_then(|p| p.parse().ok()).unwrap_or(8080)
}

// Una variable vacía cuenta como no definida: flyctl secrets y los formularios de GitHub dejan cadenas vacías.
fn variable(nombre: &str) -> Option<String> {
    std::env::var(nombre).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

async fn raiz() -> &'static str {
    "maydom backend"
}

// Prueba "hola mundo" consumida desde Pages (otro origen): CORS abierto.
async fn holamundo() -> impl IntoResponse {
    ([(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")], "holamundo")
}

// /salud tambien se lee desde Pages (docs/holamundo.html): misma cabecera.
async fn salud() -> impl IntoResponse {
    let build = variable("BUILD_ID").unwrap_or_else(|| "dev".to_string());
    ([(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")], Json(json!({ "ok": true, "build": build })))
}

// ---------- Mayordomo: cliente del gateway openrouter (npiobject-labs/openrouter) ----------
// El gateway expone la API de OpenAI en LLM_BASE_URL (por defecto el VPS) y exige una clave de
// aplicación (LLM_API_KEY, secreto del repo que deploy.yml vuelca a Fly). La clave nunca llega al
// navegador. Opcionales: LLM_MODELO (vacío = el modelo por defecto del gateway) y MAYDOM_CLAVE, la
// clave que la app envía en X-Clave para que nadie más gaste el presupuesto desde esta URL pública.

const BASE_DEFECTO: &str = "https://apisor.oracle402.com/v1";
const REFERER: &str = "https://npiobject-labs.github.io/maydom/";

const SISTEMA: &str = "Eres el mayordomo de maydom, el asistente personal de una sola persona. Conoces su calendario, sueño, ejercicio, comidas, suplementos, proyectos, ocio y cuentas por el contexto que recibes. \
Principios: (1) el sueño es la prioridad: objetivo 7 h, vale un tramo de 4,5-5 h más un despertar breve y ~2 h ligeras; (2) nunca sobrecargar el día ni proponer rutinas largas: preferencias a días o semana; \
(3) aconsejas, no impones: cada consejo lo prueba, rechaza o deja en espera la persona; nada va al calendario sin su decisión; (4) sencillez: nada que exija preparar un entorno; \
(5) ten en cuenta coste, tiempo y el calendario antes de proponer ocio o actividades. \
Responde en español, breve y concreto (máximo 120 palabras salvo que pidan más), sin listas de más de 3 puntos, sin diagnósticos médicos: el criterio de suplementos es general y remite al médico.";

#[derive(Deserialize)]
struct Mensaje {
    rol: String,
    contenido: String,
}

#[derive(Deserialize)]
struct Peticion {
    #[serde(default)]
    contexto: String,
    #[serde(default)]
    mensajes: Vec<Mensaje>,
    // Instrucción concreta de una sección (menú, ejercicios, ocio...). Se añade al sistema.
    #[serde(default)]
    tarea: String,
    // "json": se pide json_object al modelo y se limpia la respuesta antes de devolverla.
    #[serde(default)]
    formato: String,
    // Imagen en data URL (foto del frigorífico); va en el último mensaje del usuario.
    #[serde(default)]
    imagen: String,
    // Nombre corto de la operación de negocio, para X-Operacion del gateway (chat, menu, foto...).
    #[serde(default)]
    operacion: String,
}

fn poner_cors(r: &mut Response) {
    let h = r.headers_mut();
    h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    h.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("content-type, x-clave"));
    h.insert(header::ACCESS_CONTROL_ALLOW_METHODS, HeaderValue::from_static("GET, POST, OPTIONS"));
}

fn con_cors(status: StatusCode, cuerpo: Value) -> Response {
    let mut r = (status, Json(cuerpo)).into_response();
    poner_cors(&mut r);
    r
}

fn error(status: StatusCode, codigo: &str, mensaje: impl Into<String>) -> Response {
    con_cors(status, json!({ "error": mensaje.into(), "code": codigo }))
}

// Preflight del navegador (POST con JSON desde otro origen). Un 204 no puede llevar cuerpo ni
// Content-Length: HTTP/2 (el proxy de Fly) rechaza la respuesta si los lleva.
async fn preflight() -> Response {
    let mut r = StatusCode::NO_CONTENT.into_response();
    poner_cors(&mut r);
    r
}

fn recortar(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

// Quita vallas ```json ... ``` y texto alrededor del primer objeto o array JSON.
fn limpiar_json(s: &str) -> String {
    let t = s.trim();
    let t = t.strip_prefix("```json").or_else(|| t.strip_prefix("```")).unwrap_or(t);
    let t = t.strip_suffix("```").unwrap_or(t).trim();
    let ini = t.find(['{', '[']);
    let fin = t.rfind(['}', ']']);
    match (ini, fin) {
        (Some(a), Some(b)) if b >= a => t[a..=b].to_string(),
        _ => t.to_string(),
    }
}

// Lo que la app necesita saber antes de llamar: si hay LLM, qué modelo y si hace falta X-Clave. Sin gasto.
async fn estado() -> Response {
    con_cors(
        StatusCode::OK,
        json!({
            "ok": true,
            "llm": variable("LLM_API_KEY").is_some(),
            "base": variable("LLM_BASE_URL").unwrap_or_else(|| BASE_DEFECTO.to_string()),
            "modelo": variable("LLM_MODELO").unwrap_or_else(|| "(el del gateway)".to_string()),
            "clave_requerida": variable("MAYDOM_CLAVE").is_some(),
            "build": variable("BUILD_ID").unwrap_or_else(|| "dev".to_string()),
        }),
    )
}

// Solo la app con la clave configurada en Ajustes puede gastar presupuesto desde esta URL pública.
fn autorizado(cabeceras: &HeaderMap) -> bool {
    match variable("MAYDOM_CLAVE") {
        None => true,
        Some(esperada) => {
            let recibida = cabeceras.get("x-clave").and_then(|v| v.to_str().ok()).unwrap_or("").trim();
            recibida.len() == esperada.len() && recibida.bytes().zip(esperada.bytes()).fold(0u8, |a, (x, y)| a | (x ^ y)) == 0
        }
    }
}

async fn mayordomo(cabeceras: HeaderMap, Json(p): Json<Peticion>) -> Response {
    if !autorizado(&cabeceras) {
        return error(StatusCode::UNAUTHORIZED, "sin_clave", "Clave de acceso incorrecta: ponla en Ajustes → Mayordomo (la misma que el secreto MAYDOM_CLAVE)");
    }
    let clave = match variable("LLM_API_KEY") {
        Some(k) => k,
        None => {
            return error(StatusCode::SERVICE_UNAVAILABLE, "sin_configurar", "El mayordomo no tiene clave del gateway openrouter: crea la aplicación en conectar.html y guarda su clave como secreto LLM_API_KEY del repositorio")
        }
    };
    let base = variable("LLM_BASE_URL").unwrap_or_else(|| BASE_DEFECTO.to_string());
    let url = format!("{}/chat/completions", base.trim_end_matches('/'));

    let mut sistema = SISTEMA.to_string();
    if !p.contexto.trim().is_empty() {
        sistema.push_str("\n\nEstado actual de la persona:\n");
        sistema.push_str(&recortar(&p.contexto, 8000));
    }
    if !p.tarea.trim().is_empty() {
        sistema.push_str("\n\nTarea concreta de esta llamada:\n");
        sistema.push_str(&recortar(&p.tarea, 4000));
    }
    let json_pedido = p.formato == "json";
    if json_pedido {
        sistema.push_str("\n\nResponde ÚNICAMENTE con JSON válido, sin texto antes ni después, sin comentarios ni vallas de código.");
    }
    let mut mensajes = vec![json!({ "role": "system", "content": sistema })];
    let n = p.mensajes.len();
    for (i, m) in p.mensajes.iter().enumerate().skip(n.saturating_sub(12)) {
        let role = if m.rol == "usuario" || m.rol == "user" { "user" } else { "assistant" };
        let texto = recortar(&m.contenido, 4000);
        let ultimo = i + 1 == n;
        if ultimo && role == "user" && p.imagen.starts_with("data:image/") && p.imagen.len() < 6_000_000 {
            mensajes.push(json!({ "role": role, "content": [
                { "type": "text", "text": texto },
                { "type": "image_url", "image_url": { "url": p.imagen } }
            ] }));
        } else {
            mensajes.push(json!({ "role": role, "content": texto }));
        }
    }
    if mensajes.len() == 1 {
        return error(StatusCode::BAD_REQUEST, "cuerpo_invalido", "Sin mensajes");
    }

    let mut cuerpo = json!({
        "messages": mensajes,
        "max_tokens": if json_pedido { 2000 } else { 600 },
        "temperature": if json_pedido { 0.3 } else { 0.6 },
        "user": "maydom",
    });
    if let Some(m) = variable("LLM_MODELO") {
        cuerpo["model"] = Value::String(m);
    }
    if json_pedido {
        cuerpo["response_format"] = json!({ "type": "json_object" });
    }
    let operacion: String = {
        let op = p.operacion.trim();
        let op = if op.is_empty() { "chat" } else { op };
        format!("maydom-{}", recortar(op, 40).chars().map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' }).collect::<String>())
    };

    // El gateway concede 120 s al proveedor; el cliente espera más para que sea él quien corte y anote.
    let cliente = match reqwest::Client::builder().timeout(Duration::from_secs(150)).build() {
        Ok(c) => c,
        Err(e) => return error(StatusCode::INTERNAL_SERVER_ERROR, "cliente", e.to_string()),
    };

    // Reintentos solo ante fallo del proveedor (502/504), como pide la guía: dos, con espera creciente.
    let esperas = [0u64, 2, 8];
    let mut ultimo: Option<Response> = None;
    for (intento, espera) in esperas.iter().enumerate() {
        if *espera > 0 {
            tokio::time::sleep(Duration::from_secs(*espera)).await;
        }
        let envio = cliente
            .post(&url)
            .bearer_auth(&clave)
            .header("HTTP-Referer", REFERER)
            .header("X-Title", "maydom")
            .header("X-Operacion", &operacion)
            .json(&cuerpo)
            .send()
            .await;
        let respuesta = match envio {
            Ok(r) => r,
            Err(e) => {
                ultimo = Some(error(StatusCode::BAD_GATEWAY, "gateway_inalcanzable", format!("El gateway no responde: {e}")));
                continue;
            }
        };
        let estado = respuesta.status();
        let uso_id = respuesta.headers().get("x-uso-id").and_then(|v| v.to_str().ok()).map(str::to_string);
        let aviso = respuesta.headers().get("x-presupuesto").and_then(|v| v.to_str().ok()).map(str::to_string);
        let datos: Value = respuesta.json().await.unwrap_or(Value::Null);

        if estado.is_success() {
            let mut texto = datos
                .pointer("/choices/0/message/content")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim()
                .to_string();
            if json_pedido {
                texto = limpiar_json(&texto);
            }
            let modelo = datos.get("model").and_then(Value::as_str).unwrap_or("").to_string();
            return con_cors(StatusCode::OK, json!({ "respuesta": texto, "modelo": modelo, "uso_id": uso_id, "aviso": aviso, "usage": datos.get("usage").cloned().unwrap_or(Value::Null) }));
        }

        // Sobre de error del gateway: {"ok":false,"error":{"message","code","type"}}.
        let codigo = datos.pointer("/error/code").and_then(Value::as_str).unwrap_or("").to_string();
        let mensaje = datos.pointer("/error/message").and_then(Value::as_str).unwrap_or("sin detalle").to_string();
        let texto = match (estado.as_u16(), codigo.as_str()) {
            (401, _) => "La clave de aplicación del gateway no es válida o está dada de baja (secreto LLM_API_KEY)".to_string(),
            (402, _) => "Presupuesto del mayordomo agotado en el gateway; hasta el siguiente periodo solo reglas locales".to_string(),
            (429, "bucle") => "El gateway ha cortado una petición repetida; espera un minuto".to_string(),
            (429, _) => "Cuota por minuto superada; espera un minuto".to_string(),
            (400, _) if cuerpo.get("response_format").is_some() && intento == 0 => {
                // El modelo no admite json_object: se reintenta sin él y con la instrucción del sistema.
                cuerpo.as_object_mut().map(|o| o.remove("response_format"));
                ultimo = Some(error(StatusCode::BAD_GATEWAY, "gateway_rechaza", format!("{codigo}: {mensaje}")));
                continue;
            }
            _ => format!("El gateway devolvió {} {codigo}: {mensaje}", estado.as_u16()),
        };
        let salida = error(StatusCode::from_u16(estado.as_u16()).unwrap_or(StatusCode::BAD_GATEWAY), if codigo.is_empty() { "gateway_rechaza" } else { &codigo }, texto);
        // 502/504 del proveedor: se reintenta; el resto es definitivo.
        if estado.as_u16() == 502 || estado.as_u16() == 504 {
            ultimo = Some(salida);
            continue;
        }
        return salida;
    }
    ultimo.unwrap_or_else(|| error(StatusCode::BAD_GATEWAY, "gateway_inalcanzable", "Sin respuesta del gateway"))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(raiz))
        .route("/salud", get(salud))
        .route("/holamundo", get(holamundo))
        .route("/api/estado", get(estado).options(preflight))
        .route("/api/mayordomo", axum::routing::post(mayordomo).options(preflight))
        // Una foto reducida en el móvil ronda los 200 KB en base64; 8 MB deja margen.
        .layer(axum::extract::DefaultBodyLimit::max(8 * 1024 * 1024));

    let direccion = format!("0.0.0.0:{}", puerto());
    let listener = tokio::net::TcpListener::bind(&direccion)
        .await
        .unwrap_or_else(|e| panic!("no se pudo abrir {direccion}: {e}"));

    println!("maydom backend escuchando en {direccion}");

    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("fallo del servidor HTTP");
}
