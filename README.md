# Aura Stack Web Game 🌐

A premium, next-generation HTML5/CSS3 isometric stacking web game inspired by anti-gravity and futuristic synthwave neon aesthetics.

---

## 🚀 Setup & Run Locally

### Prerequisites
Make sure you have **Node.js** (version 14.x or higher) and **npm** installed.

### Installation
1.  Navigate to the web application folder:
    ```bash
    cd web/aura-stack-web
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Run Dev Server
Start the local development server:
```bash
npm run dev
```
The application will be running at `http://localhost:5173/` (or another port outputted by Vite).

---

## 🛠️ Build & Production Bundle

To generate a highly optimized static production bundle:
```bash
npm run build
```
This compiles the application assets and outputs them to the `dist/` directory.

### Preview Build
Preview the production build locally:
```bash
npm run preview
```

---

## 🌐 Deployment

The contents of the generated `dist/` folder can be hosted on any static hosting provider:
*   **Vercel:** Run `vercel` in this folder or link the repository.
*   **Netlify:** Deploy the `dist/` folder via command line or Git integration.
*   **GitHub Pages:** Push the repository and configure GitHub Actions to deploy from the `dist/` directory.
