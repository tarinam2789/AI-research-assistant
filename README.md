# Research//Lab: AI Research Assistant with Source Citations

Ask a question and get a written answer where every claim points back to the web page it came from. I built this to explore how retrieval-augmented generation (RAG) works end to end, and to make an AI answer something you can actually verify instead of just trust.

<!-- Live demo: add your link here, for example: **Live demo:** https://YOUR-SITE.sslip.io -->
<!-- Screenshot: save one as docs/screenshot.png, then add: ![Research Lab](docs/screenshot.png) -->

## What it does

1. You ask a research question.
2. The app searches the web and pulls the text out of the top pages.
3. It splits those pages into chunks, turns them into vectors, and finds the chunks most relevant to your question.
4. An LLM writes an answer using only those chunks, and cites the source number after each claim.
5. The answer streams into the browser word by word. Click a citation chip like **[2]** and the page jumps to the source behind it.

## Features

- Cited answers with clickable citation chips that highlight the matching source card
- Live streaming over WebSockets, with a 3-stage progress tracker (Search, Index, Synthesize) and a timer
- Lab notebook sidebar that saves every past question, so you can reopen or delete any of them
- Copy the answer or export it as a Markdown file with its references
- Dark terminal theme and a light "graph paper" theme
- Works on mobile, with keyboard shortcuts on desktop

## Tech stack

| Layer | What I used |
| --- | --- |
| Backend | Python 3.12, Django 5, Django REST Framework |
| Real-time | Django Channels, Daphne (ASGI), WebSockets |
| Background jobs | Celery with Redis as the broker |
| Database | PostgreSQL 16 with the pgvector extension |
| Retrieval | fastembed (local `bge-small-en-v1.5` embeddings), cosine similarity search |
| Search and extraction | Tavily search API, httpx, trafilatura |
| LLM | Google Gemini (free tier) through its OpenAI-compatible streaming endpoint |
| Frontend | React 18, Vite, hand-written CSS |
| Infra | Docker Compose, Caddy (automatic HTTPS) |
| Quality | pytest, pytest-django, ruff |

## How it works

```
Browser ──POST question──▶ Django REST API ──▶ Celery task
   ▲                                              │
   │                          Tavily search ◀─────┤
   │                          fetch + clean pages │
   │                          chunk + embed ──▶ pgvector
   │                          top 8 chunks by cosine distance
   │                                              │
   └──── tokens over WebSocket ◀── Gemini stream ◀┘
```

A few decisions I made along the way:

- **pgvector instead of a separate vector database.** Sources, chunks, and embeddings live in the same Postgres as everything else, which keeps the setup to one database.
- **Celery for the pipeline.** Fetching pages and embedding them takes seconds, so the API returns right away and the worker does the heavy lifting.
- **Streaming over WebSockets.** The worker publishes each token to a Channels group, so the answer appears as it is written.
- **Free-tier friendly.** Gemini and Tavily both have free tiers, and embeddings run locally, so anyone can run this without paying for API keys.
- **Numbered citations.** Each source gets a number, the model is told to cite with `[n]`, and the frontend turns those markers into links.

## Run it locally

You need Docker Desktop and two free API keys:

- Gemini: https://aistudio.google.com/apikey
- Tavily: https://app.tavily.com


git clone https://github.com/tarinam2789/AI-research-assistant.git
cd AI-research-assistant
cp .env.example .env
# add your GEMINI_API_KEY and TAVILY_API_KEY to .env
docker compose up --build
```

Then open http://localhost:5173. The first question is slower because the worker downloads the embedding model once (about 130 MB).

Run the tests:


docker compose run --rm web pytest


## Project structure

```
research_assistant/
  config/          # Django settings, ASGI, Celery
  apps/
    research/      # models, API views, WebSocket consumer, Celery task, LLM client
    sources/       # web search, page fetching, chunking, embeddings
    citations/     # builds the numbered source context for the prompt
  frontend/        # React + Vite app
  docker-compose.yml        # local development
  docker-compose.prod.yml   # production with Caddy and HTTPS
```

## Deployment

`docker-compose.prod.yml` runs the whole stack behind Caddy, which handles HTTPS automatically. It is designed for a single Ubuntu VM: clone the repo, create a `.env` with `DOMAIN`, `POSTGRES_PASSWORD`, and your keys, then run:


docker compose -f docker-compose.prod.yml up -d --build


## Known limitations and what I would do next

- Citations depend on the model following the prompt. I do not yet verify that each cited passage actually supports the claim.
- There are no user accounts or rate limiting, so a public deployment would need both.
- Next, I would add a reranking step after retrieval, caching for repeated questions, and integration tests that mock the search and LLM calls.
