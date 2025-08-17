const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files with proper MIME types
app.use(
  express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
      }
      if (filePath.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      }
      if (filePath.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json");
      }
    },
  })
);

// Gemini API configuration
const GEMINI_CONFIG = {
  baseUrl:
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
  apiKey: process.env.GEMINI_API_KEY,
};

// API endpoint for recommendations
app.post("/api/recommendations", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!GEMINI_CONFIG.apiKey) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    const response = await fetch(
      `${GEMINI_CONFIG.baseUrl}?key=${GEMINI_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Gemini API Error");
    }

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content
    ) {
      throw new Error("No response from Gemini");
    }

    const responseText = data.candidates[0].content.parts[0].text;
    const recommendations = JSON.parse(responseText);

    res.json({ success: true, recommendations });
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({
      error: "Failed to get AI recommendations",
      details: error.message,
    });
  }
});

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
