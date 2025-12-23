import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chat";

const app = express();

app.use(
  cors({
    origin: [
      "https://sajumon.netlify.app",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
  })
);

app.options("*", cors());

app.use(express.json({ limit: "1mb" }));

app.get("/", (_, res) => {
  res.send("sajumon API running");
});

app.get("/health", (req, res) => res.status(200).json({ ok: true }));
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
