import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Initial model configuration is not needed if we call generateContent directly
// But if we want to store a reference, we just don't call it yet.

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join_room", (room) => {
      socket.join(room);
      console.log(`User joined room: ${room}`);
    });

    socket.on("send_message", async (data) => {
      const { room, message } = data;
      // Broadcast to others in the room
      socket.to(room).emit("receive_message", message);

      // If the message is for AI
      if (message.receiverId === "AI") {
        try {
          const result = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: [{ parts: [{ text: message.text }] }],
            config: {
              systemInstruction: "Sen 'Pro İletişim' uygulamasının yapay zeka asistanısın. Profesyonel, yardımsever ve arkadaş canlısı bir ton kullan. Kullanıcıların sorularını yanıtla, onlara rehberlik et. Uygulamanın yöneticileri: Ali (CEO) ve Efe (Lider). Uygulama modern ve minimalist bir tasarıma sahip. Kullanıcıların 4 haneli ID'leri var.",
            }
          });
          const aiResponse = {
            senderId: "AI",
            receiverId: message.senderId,
            text: result.text || "Üzgünüm, şu an yanıt veremiyorum.",
            timestamp: new Date().toISOString(),
          };
          io.to(room).emit("receive_message", aiResponse);
        } catch (error) {
          console.error("AI Error:", error);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
