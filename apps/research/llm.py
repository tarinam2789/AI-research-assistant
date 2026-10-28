import json

import httpx
from django.conf import settings

URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"


def stream_answer(system, user):
    payload = {
        "model": settings.GEMINI_MODEL,
        "stream": True,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {"Authorization": f"Bearer {settings.GEMINI_API_KEY}"}
    with httpx.stream("POST", URL, json=payload, headers=headers, timeout=120) as resp:
        if resp.status_code != 200:
            resp.read()
            raise RuntimeError(f"Gemini error {resp.status_code}: {resp.text[:300]}")
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
