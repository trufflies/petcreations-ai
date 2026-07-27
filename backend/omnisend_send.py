"""
Push preview signups into Omnisend (zero-dependency, urllib only — matches email_send.py).

Each time someone generates a preview, their email is added to Omnisend as a contact and tagged,
so you can segment / automate on it. Completely INERT until OMNISEND_API_KEY is set, so it's safe
to deploy before you configure it.

Env:
  OMNISEND_API_KEY   Omnisend API key (Omnisend > Store settings > Integrations & API > API keys) — required
  OMNISEND_TAG       tag applied to these leads for segmenting/automations (default: pet-preview)
  OMNISEND_STATUS    email consent status: 'subscribed' or 'nonSubscribed' (default: subscribed)
  PUBLIC_BASE_URL    base for turning /generated/... into an absolute image url (default: Render URL)
"""

import os
import json
import datetime
import urllib.request
import urllib.error

API_URL = "https://api.omnisend.com/v3/contacts"
DEFAULT_BASE = "https://petcreations-ai.onrender.com"


def _abs(url):
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return os.environ.get("PUBLIC_BASE_URL", DEFAULT_BASE).rstrip("/") + url


def add_contact(email, style=None, preview_url=None):
    """Create/subscribe + tag the contact in Omnisend. Never raises — returns a status dict."""
    key = os.environ.get("OMNISEND_API_KEY")
    if not key:
        return {"skipped": "OMNISEND_API_KEY not set"}
    if not email:
        return {"skipped": "no email"}

    status = os.environ.get("OMNISEND_STATUS", "subscribed")
    tag = os.environ.get("OMNISEND_TAG", "pet-preview")
    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    props = {"source": "Instant preview (petcreationsart.com)"}
    if style:
        props["last_preview_style"] = style
    if preview_url:
        props["last_preview_image"] = _abs(preview_url)

    payload = {
        "identifiers": [{
            "type": "email",
            "id": email,
            "channels": {"email": {"status": status, "statusDate": now}},
        }],
        "tags": [tag] if tag else [],
        "customProperties": props,
    }
    req = urllib.request.Request(
        API_URL, data=json.dumps(payload).encode("utf-8"),
        headers={"X-API-KEY": key, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return {"ok": True, "status": getattr(r, "status", 200)}
    except urllib.error.HTTPError as e:
        # a 4xx for an already-existing contact is fine — they're already in Omnisend
        return {"error": "omnisend %s: %s" % (e.code, e.read().decode("utf-8", "ignore")[:200])}
    except urllib.error.URLError as e:
        return {"error": "omnisend unreachable: %s" % (e.reason,)}
    except Exception as e:                       # never let list-sync break the caller
        return {"error": "omnisend failed: %s" % (e,)}
