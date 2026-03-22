/* ── Neural Canvas — app.js ─────────────────────────────────────── */

const API = "https://neural-canvas.onrender.com";

// ── State ─────────────────────────────────────────────────────────
let state = {
    mode: "story",
    generating: false,
    sessions: 0,
    tokenTotal: 0,
    history: [],
};

// ── Mode Config ───────────────────────────────────────────────────
const MODES = {
    story: {
        icon: "📖", label: "STORY MODE",
        info: "Craft immersive narratives with vivid scenes, compelling characters, and emotional depth.",
        sparks: ["A detective who can smell lies", "The last library on a dying planet", "Two strangers share an umbrella during the apocalypse"],
    },
    poem: {
        icon: "🌸", label: "POEM MODE",
        info: "Distill emotion into verse. Haiku, free form, sonnet — the AI finds the perfect rhythm.",
        sparks: ["Grief that feels like furniture", "The color of nostalgia", "A love letter from the ocean to the shore"],
    },
    idea: {
        icon: "💡", label: "IDEA MODE",
        info: "Brainstorm bold, unexpected creative concepts for products, campaigns, art, or business.",
        sparks: ["App ideas for lonely astronauts", "Guerrilla marketing for a bookstore", "A restaurant concept unlike any other"],
    },
    code: {
        icon: "⚡", label: "CODE MODE",
        info: "Generate clean, production-ready code across any language, framework, or paradigm.",
        sparks: ["Animated particle system in canvas", "REST API with auth in Express", "React hook for infinite scroll"],
    },
    image_prompt: {
        icon: "🎨", label: "ART PROMPT MODE",
        info: "Generate hyper-detailed AI art prompts with style, lighting, composition, and mood.",
        sparks: ["Cyberpunk Tokyo street at 3am", "Portrait of a forgotten god", "Architecture of a dream city"],
    },
    chat: {
        icon: "🧠", label: "CHAT MODE",
        info: "Open-ended conversation with Neural Canvas AI. Explore ideas, ask anything, go deep.",
        sparks: ["What is consciousness?", "Explain quantum entanglement simply", "What makes great design?"],
    },
};

// ── DOM Refs ───────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const output = $("output-area");
const prompt = $("prompt-input");
const genBtn = $("generate-btn");
const cursor = $("cursor");
const welcome = $("welcome-screen");

// ── Init ───────────────────────────────────────────────────────────
function init() {
    setupBgCanvas();
    checkHealth();
    setupModeNav();
    setupSparks();
    setupSlider();
    setupActions();
    applyMode("story");

    prompt.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            generate();
        }
    });

    genBtn.addEventListener("click", generate);
    $("clear-btn").addEventListener("click", clearCanvas);

    setInterval(checkHealth, 30000);
}

// ── Health Check ───────────────────────────────────────────────────
async function checkHealth() {
    const dot = $("status-dot");
    const txt = $("status-text");
    try {
        const res = await fetch(`${API}/health`);
        if (res.ok) {
            dot.className = "status-dot online";
            txt.textContent = "connected";
        } else throw new Error();
    } catch {
        dot.className = "status-dot error";
        txt.textContent = "offline";
    }
}

// ── Mode Nav ───────────────────────────────────────────────────────
function setupModeNav() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            applyMode(btn.dataset.mode);
        });
    });
}

function applyMode(mode) {
    state.mode = mode;
    const cfg = MODES[mode];
    $("mode-icon").textContent = cfg.icon;
    $("mode-label").textContent = cfg.label;
    $("mode-info").textContent = cfg.info;
    setupSparks();
}

// ── Sparks ─────────────────────────────────────────────────────────
function setupSparks() {
    const sparksEl = $("sparks");
    const cfg = MODES[state.mode];
    sparksEl.innerHTML = "";
    cfg.sparks.forEach((s) => {
        const btn = document.createElement("button");
        btn.className = "spark-btn";
        btn.textContent = s;
        btn.onclick = () => {
            prompt.value = s;
            prompt.focus();
        };
        sparksEl.appendChild(btn);
    });
}

// ── Slider ─────────────────────────────────────────────────────────
function setupSlider() {
    const slider = $("temp-slider");
    const val = $("temp-val");
    slider.addEventListener("input", () => {
        val.textContent = (slider.value / 100).toFixed(1);
    });
}

// ── Generate ───────────────────────────────────────────────────────
async function generate() {
    const p = prompt.value.trim();
    if (!p || state.generating) return;

    state.generating = true;
    state.sessions++;

    // UI
    welcome && (welcome.style.display = "none");
    output.className = "output-area generating";
    output.textContent = "";
    cursor.style.display = "block";
    genBtn.disabled = true;
    genBtn.classList.add("loading");
    genBtn.querySelector(".btn-icon").textContent = "↻";

    const startTime = Date.now();
    let tokenCount = 0;
    let fullText = "";

    // Log entry
    addLog(p, state.mode);

    try {
        const res = await fetch(`${API}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: p,
                mode: state.mode,
                model: $("model-select").value,
            }),
        });

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") break;

                try {
                    const { token } = JSON.parse(data);
                    fullText += token;
                    tokenCount++;

                    // Render with syntax highlighting for code mode
                    if (state.mode === "code") {
                        output.innerHTML = formatCode(fullText);
                    } else {
                        output.textContent = fullText;
                    }

                    output.scrollTop = output.scrollHeight;
                    updateStats(tokenCount, fullText);
                } catch { }
            }
        }

        // Done
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        $("gen-time").textContent = `${elapsed}s · ${(tokenCount / elapsed).toFixed(0)} tok/s`;
        $("token-count").textContent = `${tokenCount} tokens`;

        // Save to history
        state.history.unshift({ prompt: p, mode: state.mode, output: fullText });
        if (state.history.length > 20) state.history.pop();
        updateHistory();

        state.tokenTotal += tokenCount;

    } catch (err) {
        output.textContent = `⚠ Error: ${err.message}\n\nMake sure the backend is running on http://localhost:3001`;
        showToast("Generation failed — is the server running?");
    } finally {
        cursor.style.display = "none";
        output.className = "output-area";
        genBtn.disabled = false;
        genBtn.classList.remove("loading");
        genBtn.querySelector(".btn-icon").textContent = "→";
        state.generating = false;
    }
}

// ── Stats ──────────────────────────────────────────────────────────
function updateStats(tokens, text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    $("stat-tokens").textContent = tokens;
    $("stat-words").textContent = words;
    $("stat-chars").textContent = text.length;
    $("stat-sessions").textContent = state.sessions;
}

// ── Log ────────────────────────────────────────────────────────────
function addLog(prompt, mode) {
    const log = $("gen-log");
    const item = document.createElement("div");
    item.className = "log-item";
    const time = new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
    item.innerHTML = `<span>${MODES[mode].icon} ${prompt.slice(0, 22)}…</span><span class="log-time">${time}</span>`;
    log.prepend(item);
    if (log.children.length > 10) log.lastChild.remove();
}

// ── History ────────────────────────────────────────────────────────
function updateHistory() {
    const el = $("history-list");
    el.innerHTML = "";
    if (state.history.length === 0) {
        el.innerHTML = '<p class="empty-state">No creations yet...</p>';
        return;
    }
    state.history.slice(0, 8).forEach((item) => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.title = item.prompt;
        div.textContent = `${MODES[item.mode].icon} ${item.prompt}`;
        div.onclick = () => {
            welcome && (welcome.style.display = "none");
            output.textContent = item.output;
            if (item.mode === "code") output.innerHTML = formatCode(item.output);
            prompt.value = item.prompt;
        };
        el.appendChild(div);
    });
}

// ── Code Format ────────────────────────────────────────────────────
function formatCode(text) {
    // Highlight code blocks
    return text
        .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code>${escHtml(code.trim())}</code></pre>`
        )
        .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
        .replace(/\n/g, "<br>");
}

function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Actions ────────────────────────────────────────────────────────
function setupActions() {
    $("copy-btn").onclick = () => {
        const text = output.innerText || output.textContent;
        if (!text.trim()) return showToast("Nothing to copy!");
        navigator.clipboard.writeText(text).then(() => showToast("✓ Copied to clipboard"));
    };

    $("download-btn").onclick = () => {
        const text = output.innerText || output.textContent;
        if (!text.trim()) return showToast("Nothing to save!");
        const blob = new Blob([text], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `neural-canvas-${state.mode}-${Date.now()}.txt`;
        a.click();
        showToast("↓ Saved!");
    };
}

function clearCanvas() {
    output.textContent = "";
    if (welcome) {
        const w = document.createElement("div");
        w.id = "welcome-screen";
        w.className = "welcome-screen";
        w.innerHTML = `<div class="welcome-orb"></div><h2>What will you create today?</h2><p>Choose a mode, write your prompt, and let the neural canvas paint with words.</p>`;
        output.appendChild(w);
    }
    prompt.value = "";
    $("token-count").textContent = "0 tokens";
    $("gen-time").textContent = "";
}

// ── Toast ──────────────────────────────────────────────────────────
function showToast(msg) {
    const toast = $("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}

// ── Background Canvas ──────────────────────────────────────────────
function setupBgCanvas() {
    const canvas = $("bg-canvas");
    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    const nodes = Array.from({ length: 60 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 1,
    }));

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(124,106,247,${(1 - dist / 120) * 0.15})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        nodes.forEach((n) => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(124,106,247,0.4)";
            ctx.fill();

            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
            if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        });

        requestAnimationFrame(draw);
    }

    draw();
}

// ── Boot ───────────────────────────────────────────────────────────
init();