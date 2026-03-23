#!/usr/bin/env python3
"""Send daily newsletter to subscribers with today's blog posts.

Reads today's posts from blog/posts.json and subscriber list from
subscribers.json, composes an HTML email, and sends via Resend API.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
POSTS_FILE = os.path.join(os.path.dirname(__file__), "..", "blog", "posts.json")
SUBSCRIBERS_FILE = os.path.join(os.path.dirname(__file__), "..", "subscribers.json")

FROM_ADDRESS = "Daily Rock Report <report@stoprockabuse.com>"
UNSUBSCRIBE_BASE = "https://rock-chat.stoprockabuse.workers.dev/unsubscribe"
SITE_URL = "https://stoprockabuse.com"

CATEGORY_COLORS = {
    "discovery": "#1e88e5",
    "crisis": "#e53935",
    "space": "#7b1fa2",
    "crime": "#3d3d5c",
    "volcanic": "#ef5350",
    "science": "#558b2f",
    "culture": "#f9a825",
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_todays_posts():
    """Load blog posts generated today."""
    path = os.path.normpath(POSTS_FILE)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        posts = json.load(f)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return [p for p in posts if p.get("date") == today]


def load_subscribers():
    """Load active subscribers."""
    path = os.path.normpath(SUBSCRIBERS_FILE)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return [s for s in data.get("subscribers", []) if s.get("active")]


# ---------------------------------------------------------------------------
# Email composition
# ---------------------------------------------------------------------------
def build_post_html(post):
    """Build HTML for a single blog post card."""
    cat = post.get("category", "science")
    color = CATEGORY_COLORS.get(cat, "#888")
    return f"""
    <tr><td style="padding: 0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e8e4de;">
        <tr><td style="padding: 24px 24px 12px;">
          <span style="display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:{color}18;color:{color};">{cat}</span>
        </td></tr>
        <tr><td style="padding: 0 24px 8px;">
          <h2 style="margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;color:#1a1a2e;line-height:1.3;">{post.get('headline', '')}</h2>
        </td></tr>
        <tr><td style="padding: 0 24px 4px;">
          <p style="margin:0;font-size:12px;color:#999;font-weight:500;">via {post.get('source', 'Unknown')}</p>
        </td></tr>
        <tr><td style="padding: 8px 24px 12px;">
          <p style="margin:0;font-size:14px;color:#555;line-height:1.65;">{post.get('summary', '')}</p>
        </td></tr>
        <tr><td style="padding: 0 24px 20px;">
          <div style="background:rgba(249,168,37,0.06);border-left:3px solid #d4a843;padding:10px 14px;border-radius:4px;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#b8960f;font-weight:700;">Our Take</p>
            <p style="margin:4px 0 0;font-size:13px;color:#8b7332;font-style:italic;line-height:1.55;">{post.get('take', '')}</p>
          </div>
        </td></tr>
      </table>
    </td></tr>"""


def build_email_html(posts, unsub_url):
    """Build the full newsletter HTML email."""
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    post_cards = "\n".join(build_post_html(p) for p in posts)

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Inter',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;">
<tr><td align="center" style="padding: 32px 16px;">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:#1a1a2e;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
      <p style="margin:0;font-size:28px;color:#d4a843;">&#9830;</p>
      <h1 style="margin:8px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:24px;color:#ffffff;letter-spacing:1px;">Daily Rock Report</h1>
      <p style="margin:0;font-size:13px;color:#888;">{today}</p>
    </td></tr>

    <!-- Intro -->
    <tr><td style="background:#f5f0e8;padding:24px 0 8px;">
      <p style="margin:0;font-size:14px;color:#666;text-align:center;line-height:1.6;">
        Today&rsquo;s geological indignities, delivered with the commentary rocks would write themselves if they had hands.
      </p>
    </td></tr>

    <!-- Posts -->
    {post_cards}

    <!-- CTA -->
    <tr><td style="text-align:center;padding:8px 0 24px;">
      <a href="{SITE_URL}/blog.html" style="display:inline-block;padding:12px 32px;background:#1a1a2e;color:#d4a843;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">Read More on the Site</a>
    </td></tr>

    <!-- Footer -->
    <tr><td style="text-align:center;padding:24px;border-top:1px solid #e0d5c1;">
      <p style="margin:0;font-size:11px;color:#999;line-height:1.8;">
        You&rsquo;re receiving this because you subscribed to the Daily Rock Report.<br>
        <a href="{unsub_url}" style="color:#999;text-decoration:underline;">Unsubscribe</a> &middot;
        <a href="{SITE_URL}" style="color:#999;text-decoration:underline;">Stop Rock Abuse</a>
      </p>
      <p style="margin:8px 0 0;font-size:10px;color:#bbb;">&copy; 4,600,000,000 BC &ndash; Present. All rocks reserved.</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------
def send_email(to_email, subject, html_body):
    """Send a single email via Resend API."""
    payload = json.dumps({
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {RESEND_API_KEY}",
        },
        method="POST",
    )

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        return True, result.get("id", "")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return False, f"{e.code}: {body}"
    except Exception as e:
        return False, str(e)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not RESEND_API_KEY:
        print("RESEND_API_KEY not set — skipping newsletter send.")
        return

    print("Loading today's blog posts...")
    posts = load_todays_posts()
    if not posts:
        print("No posts generated today. Skipping newsletter.")
        return
    print(f"  Found {len(posts)} posts for today")

    print("Loading subscribers...")
    subscribers = load_subscribers()
    if not subscribers:
        print("No active subscribers. Skipping newsletter.")
        return
    print(f"  Found {len(subscribers)} active subscribers")

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    # Use the first post's headline as the subject hook
    subject = f"Daily Rock Report — {posts[0].get('headline', today)}"
    # Keep subject under 78 chars for email clients
    if len(subject) > 78:
        subject = f"Daily Rock Report — {today}"

    sent = 0
    failed = 0
    for sub in subscribers:
        unsub_url = f"{UNSUBSCRIBE_BASE}?token={sub['token']}"
        html = build_email_html(posts, unsub_url)
        ok, detail = send_email(sub["email"], subject, html)
        if ok:
            sent += 1
            print(f"  Sent to {sub['email'][:3]}*** ({detail})")
        else:
            failed += 1
            print(f"  FAILED {sub['email'][:3]}***: {detail}")
        # Small delay to respect rate limits
        time.sleep(0.5)

    print(f"\nNewsletter complete: {sent} sent, {failed} failed")


if __name__ == "__main__":
    main()
