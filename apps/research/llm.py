import json
import time

import httpx
from django.conf import settings

URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
RETRY_STATUSES = {429, 500, 502, 503, 504}
TIMEOUT = httpx.Timeout(connect=15, read=60, write=30, pool=15)


def _models():
    models = [settings.GEMINI_MODEL]
    fallback = settings.GEMINI_FALLBACK_MODEL
    if fallback and fallback not in models:
        models.append(fallback)
    return models


def _read(resp):
    for line in resp.iter_lines():
        if not line.startswith("data: "):
            continue
        data = line[6:].strip()
        if data == "[DONE]":
            break
        choices = json.loads(data).get("choices") or []
        if not choices:
            continue
        text = choices[0].get("delta", {}).get("content")
        if text:
            yield text


def stream_answer(system, user):
    headers = {"Authorization": f"Bearer {settings.GEMINI_API_KEY}"}
    last_error = "Gemini request failed"
    for model in _models():
        payload = {
            "model": model,
            "stream": True,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        for wait in (0, 3, 8):
            time.sleep(wait)
            started = False
            try:
                with httpx.stream(
                    "POST", URL, json=payload, headers=headers, timeout=TIMEOUT
                ) as resp:
                    if resp.status_code == 200:
                        for text in _read(resp):
                            started = True
                            yield text
                        return
                    resp.read()
                    last_error = f"Gemini error {resp.status_code}: {resp.text[:300]}"
                    if resp.status_code not in RETRY_STATUSES:
                        raise RuntimeError(last_error)
            except httpx.TransportError as exc:
                if started:
                    raise RuntimeError("Gemini stream was interrupted, please retry") from exc
                last_error = "Gemini did not respond in time"
    raise RuntimeError(f"{last_error} (all models are busy, try again in a minute)")
