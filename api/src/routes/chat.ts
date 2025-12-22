import { Router } from "express";
import { z } from "zod";

export const chatRouter = Router();

const BodySchema = z.object({
  message: z.string().min(1),
});

chatRouter.post("/", (req, res) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  // TODO: 여기서 LLM 호출 붙일 예정 (OpenAI 스트리밍/일반)

  return res.json({
    reply: `echo: ${parsed.data.message}`,
  });
});

export default chatRouter;
