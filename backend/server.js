require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sgMail = require("@sendgrid/mail");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = process.env.DATABASE_URL
    ? new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
      })
    : null;

let dbReady = false;

async function ensureDatabase() {
    if (!pool || dbReady) {
        return;
    }
    await pool.query(
        "CREATE SEQUENCE IF NOT EXISTS order_number_seq MINVALUE 0 START 0"
    );
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id BIGSERIAL PRIMARY KEY,
            order_number BIGINT UNIQUE NOT NULL DEFAULT nextval('order_number_seq'),
            nombre TEXT NOT NULL,
            correo TEXT,
            telefono TEXT NOT NULL,
            direccion TEXT NOT NULL,
            notas TEXT,
            metodo_pago TEXT NOT NULL,
            monto TEXT NOT NULL,
            total TEXT NOT NULL,
            items JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    dbReady = true;
}

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        env: {
            SENDGRID_API_KEY: Boolean(process.env.SENDGRID_API_KEY),
            EMAIL_FROM: Boolean(process.env.EMAIL_FROM),
            EMAIL_TO: Boolean(process.env.EMAIL_TO),
            DATABASE_URL: Boolean(process.env.DATABASE_URL),
            ADMIN_USER: Boolean(process.env.ADMIN_USER),
            ADMIN_PASS: Boolean(process.env.ADMIN_PASS)
        }
    });
});

function buildReceipt(payload, audience = "store") {
    const {
        nombre,
        correo,
        telefono,
        direccion,
        notas,
        metodoPago,
        referencia,
        monto,
        items,
        total
    } = payload;

    const lineasProductos = (items || [])
        .map((item) => `- ${item.titulo} x${item.cantidad} (${item.precio})`)
        .join("\n");

    const fecha = new Date().toLocaleString("es-MX");

    const encabezado =
        audience === "buyer"
            ? "Confirmacion de pedido - Mini Flavors"
            : "Recibo de pago - Mini Flavors";
    const cierre =
        audience === "buyer"
            ? "Tu pedido fue enviado correctamente. Gracias por tu compra."
            : "Gracias por tu compra.";

    const mensaje = [
        encabezado,
        `Fecha: ${fecha}`,
        "",
        `Nombre: ${nombre}`,
        `Correo: ${correo}`,
        `Telefono: ${telefono}`,
        `Direccion: ${direccion}`,
        notas ? `Notas: ${notas}` : "",
        "",
        "Pago:",
        `Metodo: ${metodoPago}`,
        `Referencia: ${referencia}`,
        `Monto: ${monto}`,
        "",
        "Detalle de productos:",
        lineasProductos || "Sin productos",
        "",
        `Total: ${total}`,
        "",
        cierre
    ]
        .filter(Boolean)
        .join("\n");

    return mensaje;
}

function requireAdmin(req, res, next) {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASS;
    if (!user || !pass) {
        return res.status(500).send("Admin no configurado.");
    }
    const header = req.headers.authorization || "";
    if (!header.startsWith("Basic ")) {
        res.set("WWW-Authenticate", "Basic");
        return res.status(401).send("Autenticacion requerida.");
    }
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [inputUser, inputPass] = decoded.split(":");
    if (inputUser !== user || inputPass !== pass) {
        res.set("WWW-Authenticate", "Basic");
        return res.status(401).send("Credenciales invalidas.");
    }
    return next();
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeCsv(value) {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

app.get("/admin/orders", requireAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).send("Base de datos no configurada.");
    }
    try {
        await ensureDatabase();
        const sort = req.query.sort === "alpha" ? "alpha" : "recent";
        const orderBy =
            sort === "alpha"
                ? "ORDER BY nombre ASC, created_at DESC"
                : "ORDER BY created_at DESC";
        const result = await pool.query(
            `SELECT order_number, nombre, correo, telefono, metodo_pago, monto, total, items, created_at FROM orders ${orderBy} LIMIT 200`
        );
        const rows = result.rows
            .map((row) => {
                const items = Array.isArray(row.items) ? row.items : [];
                const itemsText = items
                    .map((item) => `${item.titulo} x${item.cantidad} (${item.precio})`)
                    .join(", ");
                return `
                    <tr>
                        <td>#${escapeHtml(String(row.order_number).padStart(4, "0"))}</td>
                        <td>${escapeHtml(row.nombre)}</td>
                        <td>${escapeHtml(row.correo)}</td>
                        <td>${escapeHtml(row.telefono)}</td>
                        <td>${escapeHtml(row.metodo_pago)}</td>
                        <td>${escapeHtml(row.monto)}</td>
                        <td>${escapeHtml(row.total)}</td>
                        <td>${escapeHtml(itemsText)}</td>
                        <td>${escapeHtml(new Date(row.created_at).toLocaleString("es-MX"))}</td>
                    </tr>
                `;
            })
            .join("");

        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Ordenes - Mini Flavors</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 24px; }
                    h1 { margin-bottom: 16px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
                    th { background: #f5f5f5; }
                    tr:nth-child(even) { background: #fafafa; }
                </style>
            </head>
            <body>
                <h1>Ordenes recientes</h1>
                <div style="margin-bottom: 16px;">
                    <a href="/admin/orders?sort=recent">Ordenar por fecha</a>
                    |
                    <a href="/admin/orders?sort=alpha">Ordenar alfabeticamente</a>
                    |
                    <a href="/admin/orders.csv?sort=${sort}">Exportar CSV</a>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Orden</th>
                            <th>Cliente</th>
                            <th>Correo</th>
                            <th>Telefono</th>
                            <th>Metodo</th>
                            <th>Monto</th>
                            <th>Total</th>
                            <th>Productos</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>${rows || "<tr><td colspan='9'>Sin ordenes.</td></tr>"}</tbody>
                </table>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Admin orders error:", error);
        return res.status(500).send("Error cargando ordenes.");
    }
});

app.get("/admin/orders.csv", requireAdmin, async (req, res) => {
    if (!pool) {
        return res.status(500).send("Base de datos no configurada.");
    }
    try {
        await ensureDatabase();
        const sort = req.query.sort === "alpha" ? "alpha" : "recent";
        const orderBy =
            sort === "alpha"
                ? "ORDER BY nombre ASC, created_at DESC"
                : "ORDER BY created_at DESC";
        const result = await pool.query(
            `SELECT order_number, nombre, correo, telefono, metodo_pago, monto, total, items, created_at FROM orders ${orderBy} LIMIT 200`
        );

        const header = [
            "orden",
            "nombre",
            "correo",
            "telefono",
            "metodo",
            "monto",
            "total",
            "productos",
            "fecha"
        ].join(",");

        const lines = result.rows.map((row) => {
            const items = Array.isArray(row.items) ? row.items : [];
            const itemsText = items
                .map((item) => `${item.titulo} x${item.cantidad} (${item.precio})`)
                .join(" | ");
            return [
                `#${String(row.order_number).padStart(4, "0")}`,
                row.nombre,
                row.correo,
                row.telefono,
                row.metodo_pago,
                row.monto,
                row.total,
                itemsText,
                new Date(row.created_at).toLocaleString("es-MX")
            ]
                .map(escapeCsv)
                .join(",");
        });

        res.set("Content-Type", "text/csv; charset=utf-8");
        res.set("Content-Disposition", "attachment; filename=\"ordenes.csv\"");
        res.send([header, ...lines].join("\n"));
    } catch (error) {
        console.error("Admin orders csv error:", error);
        return res.status(500).send("Error exportando ordenes.");
    }
});

app.post("/api/checkout", async (req, res) => {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    const emailTo = process.env.EMAIL_TO;
    const databaseUrl = process.env.DATABASE_URL;

    if (!sendgridApiKey || !emailFrom || !emailTo || !databaseUrl || !pool) {
        return res.status(500).json({
            ok: false,
            error: "Faltan variables de entorno."
        });
    }

    const payload = req.body || {};
    if (!payload.nombre || !payload.telefono || !payload.items?.length) {
        return res.status(400).json({
            ok: false,
            error: "Datos incompletos para la orden."
        });
    }

    sgMail.setApiKey(sendgridApiKey);

    let referencia = "0000";
    try {
        await ensureDatabase();
        const insertResult = await pool.query(
            `
                INSERT INTO orders
                    (nombre, correo, telefono, direccion, notas, metodo_pago, monto, total, items)
                VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
                RETURNING order_number
            `,
            [
                payload.nombre,
                payload.correo || "",
                payload.telefono,
                payload.direccion,
                payload.notas || "",
                payload.metodoPago,
                payload.monto,
                payload.total,
                JSON.stringify(payload.items || [])
            ]
        );
        const orderNumber = insertResult.rows[0]?.order_number ?? 0;
        referencia = String(orderNumber).padStart(4, "0");
    } catch (error) {
        console.error("DB insert error:", error);
        return res.status(500).json({
            ok: false,
            error: "No se pudo guardar la orden."
        });
    }

    const receiptPayload = { ...payload, referencia };
    const messageStore = buildReceipt(receiptPayload, "store");
    const messageBuyer = buildReceipt(receiptPayload, "buyer");

    const destinatarios = [
        { to: emailTo, subject: "Nuevo pedido - Mini Flavors", text: messageStore }
    ];
    if (payload.correo) {
        destinatarios.push({
            to: payload.correo,
            subject: "Confirmacion de pedido - Mini Flavors",
            text: messageBuyer
        });
    }

    try {
        console.log("Enviando email a:", destinatarios.map((item) => item.to));
        const results = await Promise.all(
            destinatarios.map((mail) =>
                sgMail.send({
                    from: emailFrom,
                    to: mail.to,
                    subject: mail.subject,
                    text: mail.text
                })
            )
        );

        console.log("Emails enviados:", results.length);
        return res.json({ ok: true, orderNumber: referencia });
    } catch (error) {
        console.error("Email error:", error);
        return res.status(500).json({
            ok: false,
            error: "Fallo inesperado al enviar email."
        });
    }
});

app.listen(port, () => {
    console.log(`Backend escuchando en http://localhost:${port}`);
});

ensureDatabase()
    .then(() => {
        if (pool) {
            console.log("Base de datos lista.");
        }
    })
    .catch((error) => {
        console.error("Error preparando base de datos:", error);
    });
