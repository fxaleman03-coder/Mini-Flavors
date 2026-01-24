# Mini Flavors

Proyecto con frontend separado y backend en Node.js para enviar recibos por email.

## Estructura
- `frontend/` sitio web (HTML/CSS/JS)
- `backend/` API Express para enviar mensajes

## Requisitos
- Node.js 18+ (incluye npm)
- Cuenta de Gmail con contraseña de aplicacion

## Configuracion del backend
1) Copia el archivo `.env.example` a `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2) Completa estos valores en `backend/.env`:
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `EMAIL_TO`
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

## Notas de email (Gmail)
- Usa una contraseña de aplicacion (App Password), no la clave normal.
- El correo del comprador recibira confirmacion si el campo `correo` esta lleno.

## Puntos importantes en el codigo
- `frontend/checkout.html` envia la orden al backend.
- `backend/server.js` construye el recibo y envia a:
  - `EMAIL_TO` (tienda)
  - `correo` del comprador (si lo proporciona)

## Cambios comunes
- Productos y precios: edita `frontend/Index.html` en las secciones de productos.
- Estilos y layout: edita `frontend/style.css`.
- Logica del carrito: edita `frontend/Script.js`.
- Formulario de checkout: edita `frontend/checkout.html`.
