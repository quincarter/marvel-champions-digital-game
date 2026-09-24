# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "beautifulsoup4>=4.12.0",
#     "markdownify>=0.13.0",
#     "requests>=2.31.0",
# ]
# ///

import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup
from markdownify import markdownify as md
import requests

TARGET_URL = "https://marvelcdb.com/rules"
OUTPUT_FILE = Path("marvel_champions_rules.md")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

def clean_markdown(text: str) -> str:
    # Collapse 3+ consecutive newlines down to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip trailing whitespace on individual lines
    return "\n".join(line.rstrip() for line in text.splitlines()).strip() + "\n"

def main() -> None:
    print(f"Fetching {TARGET_URL}...")
    try:
        response = requests.get(TARGET_URL, headers=HEADERS, timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        sys.exit(1)

    soup = BeautifulSoup(response.text, "html.parser")

    # Strip site chrome: navbar, footer, modals, styles, scripts
    for selector in ["nav", "header", "footer", "script", "style", ".navbar", ".modal"]:
        for element in soup.select(selector):
            element.decompose()

    # Target the main container
    content = (
        soup.find("main")
        or soup.find("div", class_="container")
        or soup.find("div", role="main")
        or soup.body
    )

    if not content:
        print("Error: Could not locate main content block.", file=sys.stderr)
        sys.exit(1)

    print("Parsing HTML and generating Markdown...")
    raw_md = md(
        str(content),
        heading_style="ATX",
        bullets="-",
        strip=["script", "style", "nav"]
    )

    formatted_md = clean_markdown(raw_md)
    OUTPUT_FILE.write_text(formatted_md, encoding="utf-8")
    print(f"Successfully generated: {OUTPUT_FILE.resolve()}")

if __name__ == "__main__":
    main()