## Installation

1. Clone this repository.
```
$ git clone https://github.com/JamesRobertJohns/2006.git
```
1. Install the required modules in `frontend/`
```
$ cd 2006/frontend
$ npm install
```
## Preview

```
$ cd 2006/frontend
$ npm run build
$ npm run preview
```

## AI Chatbot (backend)

Scaffold for the AI chatbot (use case CHATBOT_001). The chat widget (`frontend/src/Chatbot/`) sends questions to the Express backend (`backend/src/chatbot/`), which calls the Claude API with tools that look up the app's HDB data. Only one example tool (`search_flats`) exists so far; see the TODOs in `tools.js`.

1. Install the backend modules and add your API key:
```
$ cd 2006/backend
$ npm install
$ cp .env.example .env    # optional: set ANTHROPIC_API_KEY in .env
```
2. Start the backend (port 8000), then the frontend dev server in another terminal. Vite proxies `/chatbot` to the backend.
```
$ cd 2006/backend && npm start
$ cd 2006/frontend && npm run dev
```
Without an API key the chatbot runs in scaffold mode and replies with a placeholder instead of calling the LLM.
