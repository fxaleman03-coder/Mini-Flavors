# Mini Flavors

Proyecto con frontend separado y backend en Node.js para enviar recibos por WhatsApp Cloud API.

## Estructura
- `frontend/` sitio web (HTML/CSS/JS)
- `backend/` API Express para enviar mensajes

## Requisitos
- Node.js 18+ (incluye npm)
- Cuenta de WhatsApp Business Cloud

## Configuracion del backend
1) Copia el archivo `.env.example` a `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2) Completa estos valores en `backend/.env`:
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_TO` (formato E.164, ej: `15618937020`)

## Ejecutar backend
```bash
cd backend
npm install
npm start
```

## Ejecutar frontend
Desde `frontend/`, usa un servidor local:
```bash
cd frontend
python3 -m http.server 8000
```
Luego abre `http://localhost:8000/Index.html`.

## Notas de WhatsApp Cloud API
- En modo prueba, los destinatarios deben estar verificados en la lista de prueba.
- El token temporal expira; si falla el envio, genera uno nuevo.
- Los numeros deben estar en formato internacional (solo digitos).

## Puntos importantes en el codigo
- `frontend/checkout.html` envia la orden al backend.
- `backend/server.js` construye el recibo y envia a:
  - `WHATSAPP_TO` (tienda)
  - `telefono` del comprador (si esta permitido en la lista)

## Cambios comunes
- Productos y precios: edita `frontend/Index.html` en las secciones de productos.
- Estilos y layout: edita `frontend/style.css`.
- Logica del carrito: edita `frontend/Script.js`.
- Formulario de checkout: edita `frontend/checkout.html`.
