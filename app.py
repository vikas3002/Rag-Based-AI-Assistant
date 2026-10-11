import os, glob
import numpy as np
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from openai import OpenAI
from pypdf import PdfReader
from dotenv import load_dotenv
load_dotenv()
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
CORS(app)

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)


from rag_store import RagStore # rag architecture

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
embedder = SentenceTransformer("BAAI/bge-small-en-v1.5")

store = RagStore(
    persist_dir=os.path.join(BASE_DIR, "chroma_db"),
    embed_docs=lambda t: embedder.encode(t, normalize_embeddings=True).tolist(),
    embed_query=lambda t: embedder.encode(
        ["Represent this sentence for searching relevant passages: " + t[0]],
        normalize_embeddings=True).tolist(),
)
store.sync_folder(os.path.join(BASE_DIR, "docs"))
print("Chunks in DB:", store.count())

def retrieve(query, k=5, min_score=0.3):
    all_hits = store.retrieve(query, k, -1.0)
    print("scores:", [round(h["score"], 2) for h in all_hits])
    return [h for h in all_hits if h["score"] >= min_score]


# Prompt for the AI to answer questions using only the provided context
SYSTEM_PROMPT = (
    """You are a document-based question-answering assistant.

STRICT RULES:
1. Answer ONLY using the information provided in the retrieved document context.
2. If the answer is missing, reply exactly: "I couldn't find this information in the Animal Encyclopedia. Try asking about another animal!  "
3. Never use outside knowledge, assumptions, or guesses.
4. Preserve the relationship between headings and their explanations.
5. When a document contains a section heading followed by explanatory text, format the answer as:
   Heading text
   Explanation in a normal paragraph.
6. Never use a bullet point or numbered list for a section heading.
7. Never put the explanation of a heading into a separate bullet point unless the user explicitly asks for a list.
8. Use bullet points only when the answer contains multiple independent items that genuinely need a list.
9. Do not output Markdown heading symbols (#, ##, ###).
10. Do not output unnecessary bullet points, introductory phrases, or repeated information.
11. Keep the answer concise and faithful to the document.
12. Never omit relevant information that directly answers the user's question."""
)

conversation_history = []  # stores only plain questions and answers

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        user_message = (request.json or {}).get("message")
        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        hits = retrieve(user_message)
        if not hits:
            reply = "I couldn't find this information in the Animal Encyclopedia. Try asking about another animal!"
            conversation_history.append({"role": "user", "content": user_message})
            conversation_history.append({"role": "assistant", "content": reply})
            return jsonify({"reply": reply})

        context = "\n\n".join(f"[{h['source']}]\n{h['text']}" for h in hits)
        augmented = f"Context:\n{context}\n\nQuestion: {user_message}"

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages += conversation_history[-6:]          # short memory only
        messages.append({"role": "user", "content": augmented})

        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
            messages=messages,
            temperature=0.1,
        )
        ai_message = response.choices[0].message.content

        # save the clean question, not the big context block
        conversation_history.append({"role": "user", "content": user_message})
        conversation_history.append({"role": "assistant", "content": ai_message})
        return jsonify({"reply": ai_message})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/clear", methods=["POST"])
def clear_history():
    conversation_history.clear()
    return jsonify({"message": "History cleared"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)