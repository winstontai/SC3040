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

The AI chatbot (use case CHATBOT_001) is a chat widget on every page (`frontend/src/Chatbot/`) backed by the Express server (`backend/src/chatbot/`). The backend calls the OpenAI Responses API and gives the model tools that look up the same HDB, school, MRT and dengue data the map uses: searching flats, price statistics, block details with nearby amenities, comparing blocks, and finding flats near an MRT station or school.

1. Install the backend modules and (optionally) add your API key:
```
$ cd 2006/backend
$ npm install
$ cp .env.example .env    # set OPENAI_API_KEY in .env
```
2. Start the backend (port 8000), then the frontend dev server in another terminal. Vite proxies `/chatbot` to the backend.
```
$ cd 2006/backend && npm start
$ cd 2006/frontend && npm run dev
```
Without `OPENAI_API_KEY` the chatbot runs in scaffold mode and replies with a placeholder instead of calling the LLM. Set `OPENAI_MODEL` in `.env` to change the model (default `gpt-6-luna`).
