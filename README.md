# ZORO — standalone HTML/CSS/JS app

This is a regular web project. It has no Chrome extension manifest, `chrome.*` APIs, or browser storage. The API key remains in JavaScript memory and is cleared when the page closes or reloads.

## Run it

Open `index.html` in a modern browser. For the most reliable browser permissions and API requests, serve this folder from a local development server (for example, VS Code Live Server).

Click **CONNECT AI**, paste an OpenAI API key, and choose **USE THIS KEY**. The key is sent from the browser to OpenAI for live requests, so use this only for a personal prototype. A public deployment should send requests through a backend that keeps the key secret. Without a key, the app shows sample answers in demo mode.

Files: `index.html`, `style.css`, and `app.js`.
