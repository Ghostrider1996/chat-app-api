// Imports
import dotenv from "dotenv";
import cors from "cors";
import OpenAI from "openai";
import express, { Request, Response } from "express";
import { StreamChat } from "stream-chat";
import { generateRandomId } from "./utilFunctions/utilServices";
import { db } from "./config/database.js";
import { chats, users } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { ChatCompletionMessage } from "openai/resources.mjs";

// Config
dotenv.config();
const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Stream Client
const chatClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY!,
    process.env.STREAM_API_SECRET!
);

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY,
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Endpoints
app.post("/register-user", async (req: Request, res: Response): Promise<any> => {
    const { name, email, lang } = req.body || {};

    const responseMap: Record<string, string> = { BG: "Име и Имейл адрес са необходими.", EN: "Name and Email is required." };

    if (!name || !email) return res.status(400).json({ error: responseMap[(lang.toUpperCase())] || responseMap["EN"] });

    try {
        const userId: string = generateRandomId();

        const userResponse = await chatClient.queryUsers({ id: { $eq: userId } });

        if (!userResponse.users.length) await chatClient.upsertUser({ id: userId, name, email, role: "user" });


        // Check for existing user in database
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.userId, userId));

        if (!existingUser.length) {
            console.log(`User ${userId} does not exist in the database. Adding them...`);
            await db.insert(users).values({ userId, name, email });
        };

        res.status(200).json({ userId, name, email });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    };
});

app.post("/chat", async (req: Request, res: Response): Promise<any> => {
    const { message, userId } = req.body || {};

    if (!message || !userId) return res.status(400).json({ error: "Message and User are required." });

    try {
        const verifyUserExist = await chatClient.queryUsers({ id: userId });

        if (!verifyUserExist.users.length) return res.status(404).json({ error: "User not found. Please register first" });

        // Check for existing user in database
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.userId, userId));

        if (!existingUser.length) return res.status(404).json({ error: "User not found. Please register first" });

        const aiAnswer = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ "role": "user", "content": message }],
        });

        const aiMessage: string = aiAnswer.choices[0]?.message.content ?? "No response from AI";

        // Save chat in database
        await db.insert(chats).values({ userId, message, reply: aiMessage });

        // Create or get channel
        const channel = chatClient.channel("messaging", `chat-${userId}`, {
            name: "AI Chat",
            created_by_id: "ai_bot"
        });

        await channel.create();
        await channel.sendMessage({ text: aiMessage, user_id: "ai_bot" });

        res.status(200).json({ reply: aiMessage });

    } catch (error: any) {
        console.log("Error generating AI response: ", error.message);

        // Save chat in database
        await db.insert(chats).values({ userId, message, reply: error.message }); // TODO: Delete after activation and add user friendly error message

        // Create or get channel
        const channel = chatClient.channel("messaging", `chat-${userId}`, { // TODO: Delete after activation and add user friendly error message
            name: "AI Chat",
            created_by_id: "ai_bot"
        });

        await channel.create();
        await channel.sendMessage({ text: error.message, user_id: "ai_bot" });

        return res.status(500).json({ error: "Internal Server Error" });
    }
});