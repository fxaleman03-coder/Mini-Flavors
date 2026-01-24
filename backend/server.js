require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        env: {
            EMAIL_USER: Boolean(process.env.EMAIL_USER),
            EMAIL_PASS: Boolean(process.env.EMAIL_PASS),
            EMAIL_TO: Boolean(process.env.EMAIL_TO)
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

app.post("/api/checkout", async (req, res) => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailTo = process.env.EMAIL_TO;

    if (!emailUser || !emailPass || !emailTo) {
        return res.status(500).json({
            ok: false,
            error: "Faltan variables de entorno de email."
        });
    }

    const payload = req.body || {};
    if (!payload.nombre || !payload.telefono || !payload.items?.length) {
        return res.status(400).json({
            ok: false,
            error: "Datos incompletos para la orden."
        });
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    const messageStore = buildReceipt(payload, "store");
    const messageBuyer = buildReceipt(payload, "buyer");

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
                transporter.sendMail({
                    from: emailUser,
                    to: mail.to,
                    subject: mail.subject,
                    text: mail.text
                })
            )
        );

        console.log("Emails enviados:", results.length);
        return res.json({ ok: true });
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
