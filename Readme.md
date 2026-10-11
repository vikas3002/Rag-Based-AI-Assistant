# Document-Grounded RAG Chatbot

A Flask chatbot that answers questions **only from your own documents** (PDF, DOCX, TXT, MD). Documents are chunked, embedded with a local sentence-transformer model, and stored in a persistent ChromaDB index. At question time the most relevant chunks are retrieved and passed to an LLM served through Groq's OpenAI-compatible API.

If the answer is not in the documents, the bot says so instead of guessing.

## Features

- Retrieval-Augmented Generation over local PDF, DOCX, TXT and Markdown files
- Persistent vector index (ChromaDB), so documents are embedded once and survive restarts
- Incremental indexing: only new or changed files are re-embedded; deleted files are removed from the index
- Heading-aware DOCX chunking: each chunk carries its topic header (for example `Tiger — Coat and identification`) so retrieval stays accurate
- Similarity threshold to refuse out-of-scope questions without calling the LLM
- Simple web UI served by Flask (HTML, CSS, JS)

## How it works

```
docs/ (PDF, DOCX, TXT, MD)
        |
        v
  extract text -> split into chunks -> embed (bge-small-en-v1.5) -> ChromaDB (chroma_db/)

User question -> embed -> top-k similar chunks -> prompt + context -> Groq LLM -> answer
```

## Project structure

```
project/
├── app.py              # Flask app, /chat and /clear routes, LLM call
├── rag_store.py        # Chunking, embedding, ChromaDB storage and retrieval
├── requirements.txt
├── .env                # Your secrets (not committed)
├── .env.example        # Template for .env
├── docs/               # Put your documents here
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

## Setup

1. Clone the repository and create a virtual environment:

```bash
git clone <your-repo-url>
cd <your-repo-folder>
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

`sentence-transformers` installs PyTorch, so the first install is a large download.

3. Create your `.env` file from the template and add your Groq API key:

```bash
cp .env.example .env            # Windows: copy .env.example .env
```

```
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

Get a key from the [Groq console](https://console.groq.com). Model names change over time; if you get a `model_not_found` error, list the models available to your key and update `GROQ_MODEL`.

4. Add your documents to the `docs/` folder (`.pdf`, `.docx`, `.txt`, `.md`).

## Run

```bash
python app.py
```

On startup the terminal shows how many chunks were indexed per file. Then open `http://localhost:5000` and ask questions about your documents.

## Updating documents

- **Add a document:** drop it into `docs/` and restart. Only the new file is embedded.
- **Edit a document:** replace the file and restart. Its old chunks are removed and re-created.
- **Delete a document:** remove it from `docs/` and restart. Its chunks are removed from the index.
- **Rebuild everything:** delete the `chroma_db/` folder and restart.

## Configuration

| Setting | Where | Purpose |
|---|---|---|
| `GROQ_API_KEY` | `.env` | Groq API key |
| `GROQ_MODEL` | `.env` | Chat model name |
| `min_score` | `retrieve()` in `app.py` | Minimum similarity for a chunk to be used. Lower it if the bot refuses too often, raise it if it answers off-topic questions |
| `k` | `retrieve()` in `app.py` | Number of chunks sent to the LLM |
| `size`, `overlap` | `chunk_text()` in `rag_store.py` | Chunk size and overlap in characters |
| `CHUNK_VERSION` | `rag_store.py` | Change it after editing chunking logic so existing files are re-indexed |

Calibrate `min_score` by checking the printed `scores:` line for questions inside and outside your documents, then pick a value between the two groups.

## Limitations

- Scanned or image-only PDFs have no text layer and need OCR before indexing.
- DOCX files have no page numbers, so page metadata is stored as `0`.
- Conversation history is global to the server process, so it is shared by all visitors. Use per-session histories for multi-user deployment.
- The index is built at startup; new documents need a restart.

## Tech stack

Python, Flask, flask-cors, ChromaDB, sentence-transformers (`BAAI/bge-small-en-v1.5`), pypdf, python-docx, Groq API via the OpenAI Python client.

## Security

Never commit your `.env` file or API keys. If a key is ever exposed, revoke it in the Groq console and create a new one.