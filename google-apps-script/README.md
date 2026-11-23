# Conectar Google Sheets como base de datos

En 5 pasos (menos de 2 minutos) tu app guarda y sincroniza **Clientes** y **Cortes** en tu propia planilla de Google Sheets, gratis y sin configurar Google Cloud.

## Paso 1: Crear la planilla
1. Entrá a [sheets.new](https://sheets.new) y ponele un nombre (por ejemplo: **Tres Stylos Barber - Base de datos**).
2. No hace falta crear las pestañas ni columnas a mano: el script crea automáticamente **Clientes** y **Cortes** con sus encabezados.

## Paso 2: Pegar el script
1. En el menú superior de Google Sheets, abrí **Extensiones → Apps Script**.
2. Borrá el código de ejemplo (`function myFunction() {}`).
3. Copiá todo el contenido de `google-apps-script/Code.gs` y pegalo en el editor.
4. *(Opcional)* Si querés proteger la escritura con una clave simple, completá `var SECRET_TOKEN = "tu-clave";` arriba del archivo.
5. Guardá (`Ctrl + S`).

## Paso 3: Publicar como Aplicación Web
1. Tocá el botón azul **Implementar → Nueva implementación**.
2. En **Seleccionar tipo** (ícono de engranaje), elegí **Aplicación web**.
3. Configurá:
   - **Descripción**: `API Barbería`
   - **Ejecutar como**: `Yo`
   - **Quién tiene acceso**: `Cualquier persona`
4. Tocá **Implementar**, autorizá los permisos con tu cuenta de Google *(si aparece "Google no verificó esta app", tocá "Configuración avanzada → Ir a ... (no seguro)")*.
5. Copiá la **URL de la aplicación web** (termina en `/exec`).

## Paso 4: Conectar la app de forma segura (sin subir secretos a GitHub)
La app se conecta a través del proxy `/api/sheets` (`api/sheets.js`):

- **En local:** copiá `.env.example` como `.env.local` (ignorado por `.gitignore`) y completá `SHEETS_URL` y `SHEETS_TOKEN`. Corré `node dev-server.js` (o `npm run dev`).
- **En Vercel:** entrá a tu proyecto en Vercel → **Settings → Environment Variables** y agregá:
  - `SHEETS_URL` = tu URL `/exec` de Google Apps Script
  - `SHEETS_TOKEN` = la misma clave que pusiste en `SECRET_TOKEN` (o vacío si no usás clave)
  Luego hacé Redeploy.

*(También podés pegar una URL manual desde el botón **Google Sheets** en la app si la abrís sin servidor.)*

## Cómo funciona la sincronización híbrida
- La app siempre abre **al instante** desde `localStorage`.
- Cada cliente o corte nuevo/borrado se guarda local al instante y se envía en segundo plano a Google Sheets.
- Si te quedás sin internet en la barbería, los cambios quedan en cola y se suben solos apenas vuelva la conexión.
- Si ya tenías clientes/cortes cargados antes de conectar Sheets, usá el botón **"Subir datos locales a Sheets"** una sola vez desde la ventana de configuración.
