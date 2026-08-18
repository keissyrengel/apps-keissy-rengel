# Service Delivery OS

Aplicación estática publicada en GitHub Pages con una API PHP y persistencia MySQL en Hostinger. La implementación de Cloudflare Workers + D1 permanece como respaldo temporal.

## Hostinger

La API fuente está en `hostinger-api/`. En producción se despliega en `public_html/sdo-api/` junto con un `config.php` no versionado y protegido por `.htaccess`.

La interfaz usa sesiones `HttpOnly`, restringe CORS a los orígenes autorizados y sincroniza el documento de trabajo con revisiones optimistas. La primera sesión permite importar explícitamente las claves `sdo_*` existentes en `localStorage`.

## Desarrollo

1. Crea `.dev.vars` con `APP_PASSWORD` y `SESSION_SECRET`.
2. Ejecuta `npm install`.
3. Ejecuta `npm run db:migrate:local`.
4. Ejecuta `npm run dev`.

## Despliegue de respaldo en Cloudflare

```sh
npm run types
npm run db:migrate:remote
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy
```

El HTML fuente permanece en `index.html` para conservar compatibilidad con GitHub Pages. El script `assets` genera `dist/index.html` antes de desarrollar o desplegar el Worker.

La primera sesión en una base vacía ofrece importar explícitamente todas las claves `sdo_*` de `localStorage`. Después de la importación, cada cambio se guarda localmente y se sincroniza con D1 usando revisiones optimistas.
