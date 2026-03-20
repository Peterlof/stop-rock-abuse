#!/usr/bin/env python3
"""Daily rock news blog generator.

Fetches rock/geology news from Google News RSS, uses Gemini API to select
the most relevant stories and generate satirical commentary in the voice
of Stop Rock Abuse, then appends posts to blog/posts.json.
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from xml.etree import ElementTree

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
)

POSTS_FILE = os.path.join(os.path.dirname(__file__), "..", "blog", "posts.json")
SEARCH_INDEX_FILE = os.path.join(os.path.dirname(__file__), "..", "search-index.json")

RSS_URL = (
    "https://news.google.com/rss/search?"
    "q=geology+OR+%22rocks%22+OR+minerals+OR+volcanic+OR+meteorite"
    "+OR+mining+OR+fossils+OR+earthquake+OR+quarry+OR+gemstone"
    "&hl=en-US&gl=US&ceid=US:en"
)

MAX_POSTS_PER_RUN = 3

# Voice examples from the existing site
VOICE_EXAMPLES = [
    'A rover literally ran over a rock and cracked it open. On another planet. The abuse has gone interplanetary.',
    '50 billion tonnes a year. Not even water gets exploited this hard. Actually, water does. Rocks are second place in their own abuse ranking.',
    'They found a New York-sized diamond floating in space and immediately started calculating its carat weight. The rock is 2,500 miles wide. Humanity looked at it and saw a ring.',
    'A 4.6-billion-year-old meteorite that predates Earth is now in a university lab being sliced into thin sections. It survived the birth of the solar system but not a graduate student with a rock saw.',
    'The volcano didn\'t erupt AT anyone. It erupted. The town was in the way. There\'s a difference, legally and geologically.',
]


# ---------------------------------------------------------------------------
# RSS Fetching
# ---------------------------------------------------------------------------
def fetch_rss():
    """Fetch and parse Google News RSS feed. Returns list of article dicts."""
    req = urllib.request.Request(RSS_URL, headers={"User-Agent": "StopRockAbuse/1.0"})
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        xml_data = resp.read()
    except Exception as e:
        print(f"RSS fetch failed: {e}")
        return []

    root = ElementTree.fromstring(xml_data)
    articles = []
    for item in root.iter("item"):
        title = item.findtext("title", "")
        link = item.findtext("link", "")
        source = item.findtext("source", "")
        pub_date = item.findtext("pubDate", "")
        desc = item.findtext("description", "")
        # Strip HTML from description
        desc = re.sub(r"<[^>]+>", "", desc).strip()
        if title and link:
            articles.append({
                "title": title,
                "link": link,
                "source": source,
                "pubDate": pub_date,
                "description": desc[:500],
            })
    return articles


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------
def load_existing_posts():
    """Load existing blog posts from JSON file."""
    path = os.path.normpath(POSTS_FILE)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def deduplicate(articles, existing_posts):
    """Remove articles already covered in existing posts."""
    existing_urls = {p.get("sourceUrl", "") for p in existing_posts}
    existing_titles = {p.get("originalTitle", "").lower() for p in existing_posts}
    return [
        a for a in articles
        if a["link"] not in existing_urls
        and a["title"].lower() not in existing_titles
    ]


# ---------------------------------------------------------------------------
# Gemini API
# ---------------------------------------------------------------------------
def call_gemini(prompt, retries=2):
    """Call Gemini API with text prompt. Returns response text."""
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.9,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        GEMINI_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    for attempt in range(retries):
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            result = json.loads(resp.read())
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            return text
        except Exception as e:
            print(f"  Gemini attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(5)
    return None


def select_stories(articles):
    """Use Gemini to pick the most interesting stories for the site."""
    headlines = "\n".join(
        f"{i+1}. {a['title']} ({a['source']})" for i, a in enumerate(articles[:20])
    )

    prompt = f"""You curate news for Stop Rock Abuse (stoprockabuse.com), a satirical site
that treats rocks as sentient beings deserving rights.

From these headlines, pick the {MAX_POSTS_PER_RUN} that are most relevant to rocks,
geology, minerals, mining, volcanoes, meteorites, fossils, earthquakes, or stone —
AND that offer the best material for witty geological commentary.

Headlines:
{headlines}

Return a JSON array of the selected headline numbers (1-indexed). Example: [3, 7, 12]
Only return the JSON array, nothing else."""

    text = call_gemini(prompt)
    if not text:
        return articles[:MAX_POSTS_PER_RUN]

    try:
        indices = json.loads(text)
        selected = [articles[i - 1] for i in indices if 1 <= i <= len(articles)]
        return selected[:MAX_POSTS_PER_RUN]
    except (json.JSONDecodeError, IndexError):
        print(f"  Could not parse selection: {text}")
        return articles[:MAX_POSTS_PER_RUN]


def generate_commentary(article):
    """Generate satirical blog post content for an article."""
    examples_text = "\n".join(f'- "{ex}"' for ex in VOICE_EXAMPLES)

    prompt = f"""You write for Stop Rock Abuse (stoprockabuse.com), a satirical geology site
that treats rocks as sentient beings deserving rights and dignity. Your voice is witty,
sardonic, specific, and data-driven. You find the geological angle in everything.

Examples of your commentary style:
{examples_text}

Given this news article:
Title: {article['title']}
Source: {article['source']}
Description: {article['description']}

Generate a JSON object with these fields:
- "category": one of ["discovery", "crisis", "space", "crime", "volcanic", "science", "culture"] (pick the best fit)
- "headline": a rewritten headline in the site's sardonic voice (short, punchy, under 80 chars)
- "summary": 2-3 sentence factual summary of the story (no satire here, just the facts)
- "take": 1-2 sentence sardonic "Our Take" commentary in the site's voice. Be specific, clever, and geological. No generic jokes.

Return only the JSON object."""

    text = call_gemini(prompt)
    if not text:
        return None

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from markdown code block
        match = re.search(r"\{[^{}]+\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        print(f"  Could not parse commentary: {text}")
        return None


# ---------------------------------------------------------------------------
# Post creation
# ---------------------------------------------------------------------------
def slugify(text):
    """Create a URL-safe slug from text."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text[:60].rstrip("-")


def create_post(article, commentary):
    """Create a blog post dict from article data and generated commentary."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slug = slugify(commentary.get("headline", article["title"]))
    return {
        "id": f"{today}-{slug}",
        "date": today,
        "headline": commentary.get("headline", article["title"]),
        "originalTitle": article["title"],
        "source": article["source"],
        "sourceUrl": article["link"],
        "category": commentary.get("category", "science"),
        "summary": commentary.get("summary", article["description"]),
        "take": commentary.get("take", "No comment. The rocks are speechless."),
        "generated": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Search index
# ---------------------------------------------------------------------------
def update_search_index(new_posts):
    """Append new blog posts to the site search index."""
    path = os.path.normpath(SEARCH_INDEX_FILE)
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as f:
        index = json.load(f)

    for post in new_posts:
        index.append({
            "title": post["headline"],
            "section": "Blog",
            "content": f"{post['summary']} {post['take']}",
            "url": f"blog.html#{post['id']}",
            "tags": ["blog", "news", post["category"]],
        })

    with open(path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"  Updated search index with {len(new_posts)} entries")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY environment variable not set")
        sys.exit(1)

    print("Fetching rock news from Google News RSS...")
    articles = fetch_rss()
    if not articles:
        print("No articles found. Exiting.")
        return

    print(f"  Found {len(articles)} articles")

    existing_posts = load_existing_posts()
    articles = deduplicate(articles, existing_posts)
    print(f"  {len(articles)} new articles after dedup")

    if not articles:
        print("No new articles. Exiting.")
        return

    print("Selecting best stories...")
    selected = select_stories(articles)
    print(f"  Selected {len(selected)} stories")

    new_posts = []
    for i, article in enumerate(selected):
        print(f"Generating commentary for: {article['title'][:60]}...")
        commentary = generate_commentary(article)
        if commentary:
            post = create_post(article, commentary)
            new_posts.append(post)
            print(f"  -> {post['headline']}")
        if i < len(selected) - 1:
            time.sleep(2)

    if not new_posts:
        print("No posts generated. Exiting.")
        return

    # Prepend new posts to existing
    all_posts = new_posts + existing_posts
    path = os.path.normpath(POSTS_FILE)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(all_posts, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nSaved {len(new_posts)} new posts to {path}")

    update_search_index(new_posts)
    print("Done.")


if __name__ == "__main__":
    main()
