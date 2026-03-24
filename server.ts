import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Digital Knowledge Foundation API is running" });
  });

  // API: Smart Exam Generator
  app.post("/api/exams/generate", async (req, res) => {
    const { title, matrix, subject } = req.body;
    
    // In a real app, we would query Firestore here.
    // For this skeleton, we'll return a mock response.
    console.log(`Generating exam: ${title} for ${subject} with matrix:`, matrix);
    
    const mockQuestions = [
      { id: "q1", content: "Calculate \\( x^2 + 2x + 1 = 0 \\)", difficulty: 1, type: "mcq" },
      { id: "q2", content: "What is the derivative of \\( \\sin(x) \\)?", difficulty: 2, type: "mcq" },
      { id: "q3", content: "Solve for \\( x \\): \\( \\int_{0}^{1} x dx \\)", difficulty: 3, type: "short_answer" }
    ];

    res.json({
      success: true,
      examId: "exam_" + Date.now(),
      title,
      questions: mockQuestions
    });
  });

  // API: XP Calculation
  app.post("/api/student/xp/calculate", (req, res) => {
    const { score, difficulty, timeSpent } = req.body;
    
    const baseXP = 100;
    const difficultyMultiplier = [1, 1.2, 1.5, 2]; // For levels 1-4
    const scoreMultiplier = score / 10;
    
    const xpEarned = Math.floor(baseXP * (difficultyMultiplier[difficulty - 1] || 1) * scoreMultiplier);
    
    res.json({
      success: true,
      xpEarned,
      levelUp: xpEarned > 500 // Mock level up logic
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
