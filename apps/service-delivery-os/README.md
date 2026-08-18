# Service Delivery OS

Aplicación estática servida por Cloudflare Workers con persistencia en D1.

## Desarrollo

1. Crea `.dev.vars` con `APP_PASSWORD` y `SESSION_SECRET`.
2. Ejecuta `npm install`.
3. Ejecuta `npm run db:migrate:local`.
4. Ejecuta `npm run dev`.

## Despliegue

```sh
npm run types
npm run db:migrate:remote
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy
```

El HTML fuente permanece en `index.html` para conservar compatibilidad con GitHub Pages. El script `assets` genera `dist/index.html` antes de desarrollar o desplegar el Worker.

La primera sesión en una base vacía ofrece importar explícitamente todas las claves `sdo_*` de `localStorage`. Después de la importación, cada cambio se guarda localmente y se sincroniza con D1 usando revisiones optimistas.
