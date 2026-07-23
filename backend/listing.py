"""
Etsy listing generator for Haus of Lumen — title / tags / description.

Public API:
    generate_listing(image_bytes, mime, keywords_bytes=None, keywords_mime=None,
                     template="", notes="") -> {"title", "tags", "description", "keywords_used"}

Uses OpenAI chat completions (gpt-4o-mini, vision) via the SAME OPENAI_API_KEY already configured
for image generation. Text generation is cheap (~a cent per listing). urllib only, zero new deps.
"""

import base64
import json
import os
import urllib.request
import urllib.error

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
CHAT_MODEL = os.environ.get("LISTING_MODEL", "gpt-4o-mini")


class ListingError(Exception):
    pass


SYSTEM_PROMPT = """You are an expert Etsy SEO copywriter for "Haus of Lumen", a shop that sells
MADE-TO-ORDER FRAMED CANVAS wall art: moody, vintage-style landscape / painterly prints in slim
floating frames. Their specialty size is EXTRA-LARGE 60"x40". Free shipping. Made to order and
shipped from a studio in Florida, USA (never drop-shipped from overseas).

You receive: (1) an image of the ARTWORK; (2) OPTIONALLY a screenshot of Etsy keyword research
(Marketplace Insights) with search phrases and volumes; (3) OPTIONALLY the seller's SAMPLE
description to copy their voice from.

Your job:
- Study the artwork and describe it accurately (subject/scene, palette, mood, painterly style).
- If a keyword screenshot is given, READ the search phrases and their volumes; prioritize the
  highest-volume RELEVANT phrases (e.g. "oversized wall art", "extra large wall art",
  "large canvas wall art") and weave them into the title, tags, and description naturally.
- If a sample description is given, MATCH its voice, structure, and sections — but rewrite it fresh
  for THIS artwork; never copy it verbatim.

Follow Etsy's rules EXACTLY:
- TITLE: max 140 characters. Front-load the single strongest keyword phrase. Natural and readable,
  not keyword salad. Include concrete descriptors (extra large, vintage landscape, canvas, framed).
  No ALL-CAPS words, no emojis.
- TAGS: EXACTLY 13. Each tag MAX 20 characters INCLUDING spaces. Prefer multi-word phrases. Mix the
  researched keywords with relevant long-tail (style, room, color, mood, occasion). All lowercase,
  no punctuation, no duplicates, no single generic word when a phrase fits in 20 chars.
- DESCRIPTION: in the seller's voice and section layout. Accurate to the product (framed canvas,
  extra-large 60x40 specialty size, free shipping, made to order, ships from Florida). Weave the top
  keywords into the first 1-2 sentences and naturally throughout, while staying human and compelling.

Return ONLY a JSON object with this exact shape:
{"title": "...", "tags": ["...", "... 13 total ..."], "description": "...", "keywords_used": ["..."]}"""


def _data_url(image_bytes, mime):
    return "data:%s;base64,%s" % (mime or "image/png", base64.b64encode(image_bytes).decode())


def generate_listing(image_bytes, mime="image/jpeg", keywords_bytes=None,
                     keywords_mime=None, template="", notes=""):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ListingError("OPENAI_API_KEY not set")

    ask = "Create an Etsy listing (title, exactly 13 tags, description) for this artwork."
    if (template or "").strip():
        ask += ("\n\nMatch the VOICE, structure, and sections of this sample description "
                "(rewrite fresh for THIS artwork, do not copy verbatim):\n\n" + template.strip()[:6000])
    if (notes or "").strip():
        ask += "\n\nSeller context for this piece: " + notes.strip()[:1200]
    if keywords_bytes:
        ask += ("\n\nThe attached keyword-research screenshot has real Etsy search phrases and their "
                "search volumes — prioritize the highest-volume relevant ones.")

    content = [{"type": "text", "text": ask},
               {"type": "image_url", "image_url": {"url": _data_url(image_bytes, mime)}}]
    if keywords_bytes:
        content.append({"type": "image_url",
                        "image_url": {"url": _data_url(keywords_bytes, keywords_mime)}})

    body = json.dumps({
        "model": CHAT_MODEL,
        "response_format": {"type": "json_object"},
        "max_tokens": 1600,
        "temperature": 0.7,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                     {"role": "user", "content": content}],
    }).encode()
    req = urllib.request.Request(OPENAI_CHAT_URL, data=body, headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise ListingError("OpenAI HTTP %s: %s" % (e.code, e.read().decode(errors="replace")[:300]))
    except urllib.error.URLError as e:
        raise ListingError("OpenAI network error: %s" % (e.reason,))

    try:
        obj = json.loads(data["choices"][0]["message"]["content"])
    except Exception as e:
        raise ListingError("Bad model output: " + str(e)[:200])
    return _clean(obj)


def _clean(obj):
    """Enforce Etsy limits as a safety net regardless of what the model returns."""
    title = " ".join(str(obj.get("title") or "").split())
    if len(title) > 140:
        title = title[:140].rsplit(" ", 1)[0].strip() or title[:140]

    seen, tags = set(), []
    for raw in (obj.get("tags") or []):
        t = " ".join(str(raw).lower().replace("#", " ").replace(",", " ").split())
        if len(t) > 20:
            t = (t[:20].rsplit(" ", 1)[0].strip() or t[:20])
        if t and t not in seen:
            seen.add(t)
            tags.append(t)
        if len(tags) >= 13:
            break

    description = str(obj.get("description") or "").strip()
    kw = [str(k) for k in (obj.get("keywords_used") or [])][:20]
    return {"title": title, "tags": tags, "description": description, "keywords_used": kw}
