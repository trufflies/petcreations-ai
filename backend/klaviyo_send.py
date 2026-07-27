"""
Push preview signups into a Klaviyo list (zero-dependency, urllib only — matches email_send.py).

Each time someone generates a preview, their email (+ a few properties) is upserted as a Klaviyo
profile and added to your list, so your Klaviyo flows / campaigns can reach them. Completely INERT
until KLAVIYO_API_KEY and KLAVIYO_LIST_ID are set, so it's safe to deploy before you configure it.

Env:
  KLAVIYO_API_KEY   Klaviyo PRIVATE api key (starts with 'pk_') — required (unset -> every call no-ops)
  KLAVIYO_LIST_ID   target list id (Klaviyo > Lists & Segments > your list > Settings) — required
  KLAVIYO_REVISION  API revision date (default 2024-10-15)
  PUBLIC_BASE_URL   base for turning /generated/... into an absolute image url (default: Render URL)
"""

import os
import json
import urllib.request
import urllib.error

API_BASE = "https://a.klaviyo.com/api"
DEFAULT_REVISION = "2024-10-15"
DEFAULT_BASE = "https://petcreations-ai.onrender.com"


def _abs(url):
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    return os.environ.get("PUBLIC_BASE_URL", DEFAULT_BASE).rstrip("/") + url


def _headers(key):
    return {
        "Authorization": "Klaviyo-API-Key " + key,
        "revision": os.environ.get("KLAVIYO_REVISION", DEFAULT_REVISION),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _post(url, payload, key):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers=_headers(key), method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return getattr(r, "status", 200), r.read().decode("utf-8", "ignore")


def _upsert_profile(email, properties, key):
    """Create the profile; if it already exists (409) return its existing id."""
    payload = {"data": {"type": "profile",
                        "attributes": {"email": email, "properties": properties or {}}}}
    try:
        _status, body = _post(API_BASE + "/profiles/", payload, key)
        return json.loads(body or "{}").get("data", {}).get("id")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        if e.code == 409:                       # duplicate — Klaviyo returns the existing id
            try:
                errs = json.loads(body).get("errors", [])
                return errs[0].get("meta", {}).get("duplicate_profile_id")
            except Exception:
                return None
        raise


def add_to_list(email, style=None, preview_url=None):
    """Upsert the profile and add it to KLAVIYO_LIST_ID. Never raises — returns a status dict."""
    key = os.environ.get("KLAVIYO_API_KEY")
    list_id = os.environ.get("KLAVIYO_LIST_ID")
    if not key or not list_id:
        return {"skipped": "KLAVIYO_API_KEY / KLAVIYO_LIST_ID not set"}
    if not email:
        return {"skipped": "no email"}

    props = {"source": "Instant preview (petcreationsart.com)"}
    if style:
        props["last_preview_style"] = style
    if preview_url:
        props["last_preview_image"] = _abs(preview_url)

    try:
        pid = _upsert_profile(email, props, key)
        if not pid:
            return {"error": "no profile id returned"}
        _post(API_BASE + "/lists/" + list_id + "/relationships/profiles/",
              {"data": [{"type": "profile", "id": pid}]}, key)
        return {"ok": True, "profile_id": pid}
    except urllib.error.HTTPError as e:
        return {"error": "klaviyo %s: %s" % (e.code, e.read().decode("utf-8", "ignore")[:200])}
    except urllib.error.URLError as e:
        return {"error": "klaviyo unreachable: %s" % (e.reason,)}
    except Exception as e:                       # never let list-sync break the caller
        return {"error": "klaviyo failed: %s" % (e,)}
