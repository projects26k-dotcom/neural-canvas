import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(express.json());

// ─── Generate Text / Story / Poem ─────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
    const { prompt, mode, model = "llama-3.3-70b-versatile" } = req.body;

    const systemPrompts = {
        story:
            "You are a master storyteller. Craft vivid, immersive short stories. Use rich imagery, emotion, and a compelling arc. Keep under 300 words.",
        poem: "You are a poet. Write beautiful, evocative poems with rhythm and metaphor. Surprise with imagery. Max 20 lines.",
        idea: "You are a creative director. Generate brilliant, original creative concepts. Be bold, unexpected, and inspiring. Use bullet points.",
        code: "You are an expert developer. Write clean, commented, production-ready code. Explain what it does briefly.",
        image_prompt:
            "You are an AI art director. Generate ultra-detailed, vivid image prompts for AI image generators like Midjourney or DALL-E. Include style, lighting, mood, composition details.",
        chat: "You are Neural Canvas AI — a creative, witty, deeply knowledgeable assistant. Be conversational, insightful, and occasionally poetic.",
    };

    const systemPrompt =
        systemPrompts[mode] || systemPrompts.chat;

    try {
        const stream = await groq.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            max_tokens: 1024,
            temperature: mode === "code" ? 0.3 : 0.9,
            stream: true,
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || "";
            if (token) {
                res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }
        }

        res.write("data: [DONE]\n\n");
        res.end();
    } catch (err) {
        console.error("Groq error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── List Available Models ─────────────────────────────────────────────────
app.get("/api/models", async (req, res) => {
    try {
        const models = await groq.models.list();
        const filtered = models.data
            .filter((m) => m.id.includes("llama") || m.id.includes("mixtral") || m.id.includes("gemma"))
            .map((m) => ({ id: m.id, owned_by: m.owned_by }));
        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`\n🧠 Neural Canvas Backend running → http://localhost:${PORT}\n`);
});