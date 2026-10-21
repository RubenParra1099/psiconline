// API de documentos: guarda los datos del demo en una sola tabla de Postgres (columna JSONB).
import { neon } from "@neondatabase/serverless";

const URL_DB = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = URL_DB ? neon(URL_DB) : null;
const COLECCIONES = new Set(["expedientes", "notas", "jueces", "config"]);
const LECTURA_PUBLICA = new Set(["config"]);        // la app del usuario lee qué preguntas están activas
const ESCRITURA_PUBLICA = new Set(["expedientes"]); // la app del usuario guarda su cribado sin clave
const ID_OK = /^[A-Za-z0-9_\-.~:@+]{1,120}$/;
let lista = false;

async function preparar() {
  if (lista) return;
  await sql`create table if not exists docs (
    col text not null,
    id text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (col, id)
  )`;
  lista = true;
}

export default async function handler(req, res) {
  if (!sql) return res.status(503).json({ error: "Falta configurar DATABASE_URL (conecta Neon Postgres en Vercel)." });
  try {
    await preparar();
    const clave = req.headers["x-bewyou-key"] || "";
    const autorizado = Boolean(process.env.ACCESS_KEY) && clave === process.env.ACCESS_KEY;
    const col = req.method === "PUT" ? req.body?.col : req.query.col;
    const id = req.method === "PUT" ? req.body?.id : req.query.id;
    if (!COLECCIONES.has(col)) return res.status(400).json({ error: "Colección no válida" });
    if (id != null && !ID_OK.test(String(id))) return res.status(400).json({ error: "Id no válido" });

    if (req.method === "GET") {
      if (!LECTURA_PUBLICA.has(col) && !autorizado) return res.status(401).json({ error: "Clave requerida" });
      if (id) {
        const r = await sql`select data from docs where col = ${col} and id = ${id}`;
        return res.json({ data: r[0]?.data ?? null });
      }
      const r = await sql`select id, data from docs where col = ${col} order by updated_at desc limit 1000`;
      return res.json({ docs: r });
    }
    if (req.method === "PUT") {
      if (!ESCRITURA_PUBLICA.has(col) && !autorizado) return res.status(401).json({ error: "Clave requerida" });
      const data = req.body?.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ error: "Datos no válidos" });
      const json = JSON.stringify(data);
      if (json.length > 250000) return res.status(413).json({ error: "Documento demasiado grande" });
      await sql`insert into docs (col, id, data) values (${col}, ${id}, ${json}::jsonb)
                on conflict (col, id) do update set data = excluded.data, updated_at = now()`;
      return res.json({ ok: true });
    }
    if (req.method === "DELETE") {
      if (!autorizado) return res.status(401).json({ error: "Clave requerida" });
      await sql`delete from docs where col = ${col} and id = ${id}`;
      return res.json({ ok: true });
    }
    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error de base de datos" });
  }
}
