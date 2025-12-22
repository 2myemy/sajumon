import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chat.js";

const app = express();

const allowed = [
  "http://localhost:5173",
  "https://sajumon.netlify.app"
];

app.use(
  cors({
    origin: allowed,
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (_, res) => {
  res.send("sajumon API running");
});

app.get("/health", (req, res) => res.status(200).json({ ok: true }));
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
