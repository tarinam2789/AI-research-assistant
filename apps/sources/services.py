import time
from functools import lru_cache

import httpx
import trafilatura
from django.conf import settings

RETRY_STATUSES = {429, 500, 502, 503, 504}


def search_web(query, max_results=5):
    error = "Web search failed"
    for wait in (0, 2, 5):
        time.sleep(wait)
        try:
            resp = httpx.post(
                "https://api.tavily.com/search",
                headers={"Authorization": f"Bearer {settings.TAVILY_API_KEY}"},
                json={"query": query, "max_results": max_results},
                timeout=httpx.Timeout(45, connect=10),
            )
        except httpx.TransportError:
            error = "Web search timed out (Tavily did not respond)"
            continue
        if resp.status_code == 200:
            return resp.json().get("results", [])
        error = f"Web search error {resp.status_code}: {resp.text[:200]}"
        if resp.status_code not in RETRY_STATUSES:
            break
    raise RuntimeError(error)


def fetch_text(url):
    try:
        resp = httpx.get(
            url,
            follow_redirects=True,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 (research-assistant)"},
        )
        resp.raise_for_status()
        return trafilatura.extract(resp.text) or ""
    except httpx.HTTPError:
        return ""


def chunk_text(text, size=200, overlap=40, max_chunks=None):
    max_chunks = max_chunks or settings.MAX_CHUNKS_PER_SOURCE
    words = text.split()
    step = size - overlap
    chunks = []
    for start in range(0, len(words), step):
        piece = words[start : start + size]
        if piece:
            chunks.append(" ".join(piece))
    return chunks[:max_chunks]


@lru_cache(maxsize=1)
def _local_model():
    from fastembed import TextEmbedding

    return TextEmbedding(
        model_name=settings.EMBEDDING_MODEL,
        cache_dir=str(settings.BASE_DIR / ".fastembed"),
    )


def _embed_gemini(texts, input_type):
    model = settings.GEMINI_EMBEDDING_MODEL
    task = "RETRIEVAL_QUERY" if input_type == "query" else "RETRIEVAL_DOCUMENT"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
    vectors = []
    for i in range(0, len(texts), 50):
        batch = texts[i : i + 50]
        body = {
            "requests": [
                {
                    "model": f"models/{model}",
                    "content": {"parts": [{"text": t}]},
                    "taskType": task,
                    "outputDimensionality": 384,
                }
                for t in batch
            ]
        }
        resp = None
        for wait in (0, 5, 15, 30):
            time.sleep(wait)
            try:
                resp = httpx.post(
                    url,
                    headers={"x-goog-api-key": settings.GEMINI_API_KEY},
                    json=body,
                    timeout=httpx.Timeout(60, connect=10),
                )
            except httpx.TransportError:
                resp = None
                continue
            if resp.status_code not in RETRY_STATUSES:
                break
        if resp is None:
            raise RuntimeError("Embedding request timed out (Gemini did not respond)")
        resp.raise_for_status()
        vectors.extend(item["values"] for item in resp.json()["embeddings"])
    return vectors


def embed(texts, input_type):
    if settings.EMBEDDING_BACKEND == "gemini":
        return _embed_gemini(texts, input_type)
    return [vector.tolist() for vector in _local_model().embed(texts)]
