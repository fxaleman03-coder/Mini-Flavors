require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        env: {
            WHATSAPP_TOKEN: Boolean(process.env.WHATSAPP_TOKEN),
            WHATSAPP_PHONE_NUMBER_ID: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
            WHATSAPP_TO: Boolean(process.env.WHATSAPP_TO)
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
        tarjetaNombre,
        tarjetaNumero,
        tarjetaVencimiento,
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
        metodoPago === "Tarjeta" ? "Tarjeta:" : "",
        metodoPago === "Tarjeta" ? `Nombre: ${tarjetaNombre}` : "",
        metodoPago === "Tarjeta" ? `Numero: ${tarjetaNumero}` : "",
        metodoPago === "Tarjeta" ? `Vencimiento: ${tarjetaVencimiento}` : "",
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

function normalizePhone(input) {
    if (!input) {
        return "";
    }
    const digits = String(input).replace(/\D/g, "");
    if (digits.length === 10) {
        return `1${digits}`;
    }
    return digits;
}

app.post("/api/checkout", async (req, res) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const waTo = process.env.WHATSAPP_TO;

    if (!token || !phoneNumberId || !waTo) {
        return res.status(500).json({
            ok: false,
            error: "Faltan variables de entorno de WhatsApp."
        });
    }

    const payload = req.body || {};
    if (!payload.nombre || !payload.telefono || !payload.items?.length) {
        return res.status(400).json({
            ok: false,
            error: "Datos incompletos para la orden."
        });
    }

    const messageStore = buildReceipt(payload, "store");
    const messageBuyer = buildReceipt(payload, "buyer");
    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

    const destinatarios = [
        { to: normalizePhone(waTo), body: messageStore },
        { to: normalizePhone(payload.telefono), body: messageBuyer }
    ].filter((item) => item.to);
    const mensajes = destinatarios.map((destino) => {
        return fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: destino.to,
                type: "text",
                text: { body: destino.body }
            })
        });
    });

    try {
        const responses = await Promise.all(mensajes);
        const detalles = await Promise.all(
            responses.map(async (response) => ({
                ok: response.ok,
                status: response.status,
                text: await response.text()
            }))
        );

        const fallo = detalles.find((item) => !item.ok);
        if (fallo) {
            console.error("WhatsApp API error:", fallo.status, fallo.text);
            return res.status(500).json({
                ok: false,
                error: "Error enviando WhatsApp.",
                details: fallo.text
            });
        }

        console.log("WhatsApp API ok:", detalles);
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({
            ok: false,
            error: "Fallo inesperado al enviar WhatsApp."
        });
    }
});

app.listen(port, () => {
    console.log(`Backend escuchando en http://localhost:${port}`);
});
