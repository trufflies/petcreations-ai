"""
Transactional email via Resend (zero-dependency, urllib only — matches generation.py).

Sends the customer their watermarked preview + a "complete your order" link the moment
they generate. Completely INERT until RESEND_API_KEY is set, so it's safe to deploy early.

Env:
  RESEND_API_KEY   required to actually send (unset -> every call is a no-op)
  EMAIL_FROM       sender, e.g. "Pet Creations Art <hello@petcreationsart.com>"
                   (defaults to Resend's test sender, which only delivers to the
                    Resend account owner until a domain is verified)
  PUBLIC_BASE_URL  where /generated/... images are served (default: the Render URL)
  PRODUCT_URL      the product page the CTA links to
"""

import os
import json
import urllib.request
import urllib.error

RESEND_URL = "https://api.resend.com/emails"
DEFAULT_BASE = "https://petcreations-ai.onrender.com"
DEFAULT_PRODUCT = "https://petcreationsart.com/products/custom-heritage-framed-pet-portrait-draft"
DEFAULT_FROM = "Pet Creations Art <onboarding@resend.dev>"


def _abs(url):
    """Turn a /generated/... path into an absolute URL for the email."""
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    base = os.environ.get("PUBLIC_BASE_URL", DEFAULT_BASE).rstrip("/")
    return base + url


def _preview_html(preview_abs, style_label, product_url):
    # Inline styles only — email clients strip <style>/external CSS. On-brand parchment + burgundy.
    # Token replacement (not %/format) so literal % and {} in the HTML can never break it.
    tpl = """\
<!doctype html><html><body style="margin:0;padding:0;background:#f3ecde;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ecde;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:540px;background:#fbf7ee;border-radius:14px;overflow:hidden;
                    font-family:Georgia,'Times New Roman',serif;color:#2b211c;">
        <tr><td style="padding:28px 32px 8px;text-align:center;">
          <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#8a6d3b;">Pet Creations Art</div>
          <h1 style="margin:10px 0 4px;font-size:26px;font-weight:normal;color:#2b211c;">Your preview is ready</h1>
          <p style="margin:0;font-size:15px;color:#6b5d52;">Here's your pet, reimagined in our __STYLE__ style.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;text-align:center;">
          <img src="__PREVIEW__" alt="Your pet portrait preview" width="476"
               style="width:100%;max-width:476px;border-radius:10px;display:block;margin:0 auto;" />
        </td></tr>
        <tr><td style="padding:8px 32px 4px;text-align:center;">
          <p style="font-size:15px;line-height:1.6;color:#4a3f37;">
            Love it? Complete your order and we'll hand-frame it on gallery-grade canvas
            in our Florida studio and ship it to your door. Want tweaks first? Just reply —
            revisions are always free.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:12px 32px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#5e1622;border-radius:100px;">
              <a href="__CTA__" style="display:inline-block;padding:15px 40px;color:#fbf7ee;
                 font-family:Georgia,serif;font-size:16px;letter-spacing:.5px;text-decoration:none;">
                 Complete your order &rarr;</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px 28px;text-align:center;">
          <p style="font-size:12px;color:#9a8d81;line-height:1.5;">
            The preview is watermarked; your finished piece is clean, high-resolution, and framed.<br>
            You only pay if you love it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    return (tpl.replace("__STYLE__", style_label or "heirloom")
               .replace("__PREVIEW__", preview_abs or "")
               .replace("__CTA__", product_url or DEFAULT_PRODUCT))


def send_preview_email(to_email, preview_url, style_label="heirloom", product_url=None):
    """Fire the preview email. Never raises — returns a small status dict for logging."""
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        return {"skipped": "no RESEND_API_KEY"}
    if not to_email:
        return {"skipped": "no recipient"}
    sender = os.environ.get("EMAIL_FROM", DEFAULT_FROM)
    product_url = product_url or os.environ.get("PRODUCT_URL", DEFAULT_PRODUCT)
    html = _preview_html(_abs(preview_url), style_label, product_url)
    payload = json.dumps({
        "from": sender,
        "to": [to_email],
        "subject": "Your pet portrait preview is ready \U0001f43e",
        "html": html,
    }).encode("utf-8")
    req = urllib.request.Request(
        RESEND_URL, data=payload,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return {"ok": True, "status": getattr(r, "status", 200)}
    except urllib.error.HTTPError as e:
        return {"error": "resend %s: %s" % (e.code, e.read().decode("utf-8", "ignore")[:200])}
    except urllib.error.URLError as e:
        return {"error": "resend unreachable: %s" % (e.reason,)}
    except Exception as e:  # never let email break the caller
        return {"error": "email failed: %s" % (e,)}
