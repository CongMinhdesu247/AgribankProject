# Agribank Helpdesk UI

## Railway deployment

Deploy this directory as the frontend service (Dockerfile build). Deploy
`agribankservicecv` as a separate Node.js backend service. Set the frontend
service variable `API_UPSTREAM` to the backend's Railway private hostname and
port (for example, `your-backend.railway.internal:8080` for the Spring service
in this repository, or the port assigned to the Node backend's `PORT`). The
frontend calls `/api` on its own origin and Caddy forwards those requests to
`API_UPSTREAM`, so the browser never tries to call `localhost` or needs a
public backend URL.

On the backend service, add the frontend's public URL (including `https://`)
to `CORS_ORIGINS`. Keep any other origins you still use, comma-separated, for
example `http://localhost:5173,https://your-frontend.up.railway.app`.

On the backend service, configure its database variables and `SESSION_SECRET`
(at least 32 bytes). For local Vite development, the UI still calls
`http://localhost:5000/api` by default; start the Node backend on port 5000.

`VITE_API_BASE_URL` can override the API URL at frontend build time, but leave
it unset when using the same-origin Caddy proxy described above.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
