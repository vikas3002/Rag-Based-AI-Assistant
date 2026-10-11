async function sendMessage() {
    const input = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");
    const loading = document.getElementById("loading");
    const sendBtn = document.getElementById("send-btn");

    const message = input.value.trim();
    if (!message) return;

    // Append user message
    const userMsgDiv = document.createElement("div");
    userMsgDiv.className = "message user";
    userMsgDiv.innerHTML = `<div class="msg-content">${escapeHtml(message)}</div>`;
    chatBox.appendChild(userMsgDiv);

    // Reset input & scroll to bottom
    input.value = "";
    scrollToBottom();

    // Set UI to loading state
    loading.style.display = "flex";
    input.disabled = true;
    sendBtn.disabled = true;
    scrollToBottom();

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });

        const data = await res.json();

        // Create Bot Response element
        const botMsgDiv = document.createElement("div");

        if (res.ok && data.reply) {
            botMsgDiv.className = "message bot";
            botMsgDiv.innerHTML = `<div class="msg-content">${formatMarkdown(data.reply)}</div>`;
        } else {
            botMsgDiv.className = "message error-msg";
            const errorText = data.error || "An error occurred while fetching the response.";
            botMsgDiv.innerHTML = `<div class="msg-content">⚠️ <b>Error:</b> ${escapeHtml(errorText)}</div>`;
        }

        chatBox.appendChild(botMsgDiv);

    } catch (err) {
        console.error("Chat error:", err);
        const errorDiv = document.createElement("div");
        errorDiv.className = "message error-msg";
        errorDiv.innerHTML = `<div class="msg-content">⚠️ <b>Network Error:</b> Failed to connect to backend server.</div>`;
        chatBox.appendChild(errorDiv);
    } finally {
        // Reset UI loading state
        loading.style.display = "none";
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        scrollToBottom();
    }
}

async function clearChat() {
    const chatBox = document.getElementById("chat-box");

    try {
        const res = await fetch("/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        if (res.ok) {
            chatBox.innerHTML = `
                <div class="message bot">
                    <div class="msg-content">
                        👋 <b>Welcome to SV Infotech Document Assistant!</b><br>
                        Ask me anything based on your uploaded documents.
                    </div>
                </div>
                <div class="message system-msg">
                    ℹ️ Chat history cleared.
                </div>
            `;
        } else {
            alert("Failed to clear chat history on server.");
        }
    } catch (err) {
        console.error("Clear chat error:", err);
        alert("Network error: Could not reach backend server.");
    }
}

function handleKeyPress(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function scrollToBottom() {
    const chatBox = document.getElementById("chat-box");
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMarkdown(text) {
    if (!text) return "";

    // 1. Remove markdown header '#' symbols as per system prompt rule
    let processed = text.replace(/^#+\s*/gm, "");

    // 2. Escape HTML tags to prevent XSS injection
    processed = escapeHtml(processed);

    // 3. Bold formatting: **text**
    processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // 4. Inline code formatting: `code`
    processed = processed.replace(/`(.*?)`/g, "<code>$1</code>");

    // 5. Bullet points (- item or * item)
    let lines = processed.split("\n");
    let inList = false;
    let formattedLines = [];

    for (let line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            let itemContent = trimmed.substring(2);
            if (!inList) {
                inList = true;
                formattedLines.push("<ul>");
            }
            formattedLines.push(`<li>${itemContent}</li>`);
        } else {
            if (inList) {
                inList = false;
                formattedLines.push("</ul>");
            }
            formattedLines.push(line);
        }
    }
    if (inList) {
        formattedLines.push("</ul>");
    }

    let result = formattedLines.join("\n");

    // 6. Replace remaining newlines with <br> (excluding list blocks)
    result = result.replace(/\n/g, "<br>");
    result = result.replace(/<\/ul><br>/g, "</ul>");
    result = result.replace(/<ul><br>/g, "<ul>");

    return result;
}
