import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error calling OpenAI API" });
  }
});

// Start server
app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});


app.post("/ai/todo", async (req, res) => {
  const scrapedData = req.body;

  const prompt = `
You are an academic assistant.
Turn the following scraped course data into a prioritized to-do list.
Include:
- Task
- Due date
- Priority (High/Medium/Low)

Data:
${JSON.stringify(scrapedData, null, 2)}
`;

  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }]
  });

  res.json(JSON.parse(aiResponse.choices[0].message.content));
});
