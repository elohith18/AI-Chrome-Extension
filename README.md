# ZORO AI Chrome Extension

An AI Chrome extension that lets you ask questions and get streamed answers.

## Features

- Chat in Chrome’s side panel
- Stream answers from Groq
- Open the chat in a full browser tab
- Keep the Groq API key on the local server

## Requirements

- Google Chrome with side panel support
- Node.js 20 or newer
- A Groq API key

## Setup

1. Clone the repository and open its folder in a terminal.

2. Install the server dependencies:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env` and add your Groq API key:

   ```env
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=openai/gpt-oss-20b
   PORT=3000
   ```

4. Start the local server:

   ```sh
   npm start
   ```

5. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the project folder.

6. Click the ZORO extension icon to open the side panel. Keep the local server running while using AI answers.

The server listens at `http://127.0.0.1:3000`. The `.env` file is excluded from Git. Do not commit or share your API key.
