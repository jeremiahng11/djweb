import type { FastifyInstance } from "fastify";
import { loginUser } from "../db.js";

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Passwordless login: pick a username; it's created if new, returned if it exists.
  app.post(
    "/api/users/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["username"],
          additionalProperties: false,
          properties: { username: { type: "string", minLength: 1, maxLength: 24 } },
        },
      },
    },
    async (req, reply) => {
      const { username } = req.body as { username: string };
      if (!username.trim()) return reply.code(400).send({ error: "username required" });
      const user = await loginUser(username);
      return { user };
    }
  );
}
