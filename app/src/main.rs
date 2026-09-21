use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

// Fly siempre usa 8080; PUERTO solo lo fija tools/arrancar.ps1 al probar en el PC.
fn puerto() -> u16 {
    std::env::var("PUERTO")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080)
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
    let build = std::env::var("BUILD_ID").unwrap_or_else(|_| "dev".to_string());
    ([(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")], Json(json!({ "ok": true, "build": build })))
}

// ---------- Mayordomo: proxy a OpenRouter ----------
// La clave vive en el secreto OPENROUTER_API_KEY de Fly y nunca llega al navegador.
// Opcionales: OPENROUTER_MODEL (por defecto openrouter/auto) y OPENROUTER_URL (para pruebas).

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
}

fn poner_cors(r: &mut Response) {
    let h = r.headers_mut();
    h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    h.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("content-type"));
    h.insert(header::ACCESS_CONTROL_ALLOW_METHODS, HeaderValue::from_static("POST, OPTIONS"));
}

fn con_cors(status: StatusCode, cuerpo: Value) -> Response {
    let mut r = (status, Json(cuerpo)).into_response();
    poner_cors(&mut r);
    r
}

// Preflight del navegador (POST con JSON desde otro origen). Un 204 no puede llevar cuerpo ni
// Content-Length: HTTP/2 (el proxy de Fly) rechaza la respuesta si los lleva.
async fn mayordomo_options() -> Response {
    let mut r = StatusCode::NO_CONTENT.into_response();
    poner_cors(&mut r);
    r
}

fn recortar(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

async fn mayordomo(Json(p): Json<Peticion>) -> Response {
    let clave = match std::env::var("OPENROUTER_API_KEY") {
        Ok(k) if !k.trim().is_empty() => k,
        _ => {
            return con_cors(
                StatusCode::SERVICE_UNAVAILABLE,
                json!({ "error": "El mayordomo no tiene clave de OpenRouter: define el secreto OPENROUTER_API_KEY en Fly (flyctl secrets set OPENROUTER_API_KEY=...)" }),
            )
        }
    };
    let modelo = std::env::var("OPENROUTER_MODEL").unwrap_or_else(|_| "openrouter/auto".to_string());
    let url = std::env::var("OPENROUTER_URL")
        .unwrap_or_else(|_| "https://openrouter.ai/api/v1/chat/completions".to_string());

    let mut sistema = SISTEMA.to_string();
    if !p.contexto.trim().is_empty() {
        sistema.push_str("\n\nEstado actual de la persona:\n");
        sistema.push_str(&recortar(&p.contexto, 8000));
    }
    let mut mensajes = vec![json!({ "role": "system", "content": sistema })];
    for m in p.mensajes.iter().rev().take(12).collect::<Vec<_>>().into_iter().rev() {
        let role = if m.rol == "usuario" || m.rol == "user" { "user" } else { "assistant" };
        mensajes.push(json!({ "role": role, "content": recortar(&m.contenido, 4000) }));
    }
    if mensajes.len() == 1 {
        return con_cors(StatusCode::BAD_REQUEST, json!({ "error": "Sin mensajes" }));
    }

    let cliente = match reqwest::Client::builder().timeout(std::time::Duration::from_secs(75)).build() {
        Ok(c) => c,
        Err(e) => return con_cors(StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() })),
    };
    let respuesta = cliente
        .post(&url)
        .bearer_auth(clave)
        .header("HTTP-Referer", "https://npiobject-labs.github.io/maydom/")
        .header("X-Title", "maydom")
        .json(&json!({ "model": modelo, "messages": mensajes, "max_tokens": 600, "temperature": 0.6 }))
        .send()
        .await;
    let respuesta = match respuesta {
        Ok(r) => r,
        Err(e) => return con_cors(StatusCode::BAD_GATEWAY, json!({ "error": format!("OpenRouter no responde: {e}") })),
    };
    let estado = respuesta.status();
    let cuerpo: Value = respuesta.json().await.unwrap_or(Value::Null);
    if !estado.is_success() {
        let detalle = cuerpo
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("sin detalle")
            .to_string();
        return con_cors(StatusCode::BAD_GATEWAY, json!({ "error": format!("OpenRouter devolvio {}: {detalle}", estado.as_u16()) }));
    }
    let texto = cuerpo
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    let usado = cuerpo.get("model").and_then(Value::as_str).unwrap_or(&modelo).to_string();
    con_cors(StatusCode::OK, json!({ "respuesta": texto, "modelo": usado }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(raiz))
        .route("/salud", get(salud))
        .route("/holamundo", get(holamundo))
        .route("/api/mayordomo", axum::routing::post(mayordomo).options(mayordomo_options));

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
