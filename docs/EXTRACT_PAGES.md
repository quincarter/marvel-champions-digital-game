## Usage Examples

### Extract only pages 1, 3, and 5 through 8:

```bash
uv run extract_pages.py ./docs/*.pdf --pages 1,3,5-8
```

### Extract just the cover page across multiple PDFs:

```bash
uv run extract_pages.py ./docs/*.pdf -p 1
```

### Extract a specific range with a custom DPI:

```bash
uv run extract_pages.py my_doc.pdf -p 10-15 --dpi 450 -o ./renders
```
