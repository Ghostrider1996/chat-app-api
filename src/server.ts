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
import { ChatCompletionMessageParam } from "openai/resources.mjs";

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
    baseURL: "https://openrouter.ai/api/v1",
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

        const userResponse = await chatClient.queryUsers({ email: { $eq: email } });

        if (!userResponse.users.length) await chatClient.upsertUser({ id: userId, name: name.toLowerCase(), email, role: "user" });


        // Check for existing user in database
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

        if (!existingUser.length) {
            console.log(`User ${userId} does not exist in the database. Adding them...`);
            await db.insert(users).values({ userId, name, email, lang });
        };

        res.status(200).json({ userId, name, email, lang });
    } catch (error) {
        console.log("Internal Server Error", error);
        res.status(500).json({ error: "Internal Server Error" });
    };
});

app.post("/chat", async (req: Request, res: Response): Promise<any> => {
    const { message, username, email } = req.body || {};
   
    if (!message || !username) return res.status(400).json({ error: "Message and User are required." });

    try {
        const verifyUserExist = await chatClient.queryUsers({ name: username.toLowerCase() });

        if (!verifyUserExist.users.length) return res.status(404).json({ error: "User not found. Please register first" });

        // Check for existing user in database
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.name, username));

        if (!existingUser.length) return res.status(404).json({ error: "User not found. Please register first" });

        // Fetch users past messages for context
        const chatHistory = await db
            .select()
            .from(chats)
            .where(eq(chats.userId, email))
            .orderBy(chats.createdAt)
            .limit(10);

        const conversation: ChatCompletionMessageParam[] = chatHistory.flatMap(
            (chat) => [
                { role: 'user', content: chat.message },
                { role: 'assistant', content: chat.reply },
            ]
        );

        // Add latest user messages to the conversation
        conversation.push({ role: 'user', content: message });


        const aiAnswer = await openai.chat.completions.create({
            model: "deepseek/deepseek-r1:free",
            messages: conversation as ChatCompletionMessageParam[],
        });

        // const aiAnswer = await openai.chat.completions.create({
        //     model: "gpt-4o-mini",
        //     messages: [{ "role": "user", "content": message }],
        // });

        const aiMessage: string = aiAnswer.choices[0]?.message.content ?? "No response from AI";

        // Save chat in database
        await db.insert(chats).values({ userId: email, message, reply: aiMessage });

        // Create or get channel
        const channel = chatClient.channel("messaging", `chat-${email}`, {
            name: "AI Chat",
            created_by_id: "ai_bot"
        });

        await channel.create();
        await channel.sendMessage({ text: aiMessage, user_id: "ai_bot" });

        res.status(200).json({ reply: aiMessage });

    } catch (error: any) {
        console.log("Error generating AI response: ", error.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/get-messages", async (req: Request, res: Response): Promise<any> => {
    const { email } = req.body || {};

    if (!email) return res.status(400).json({ error: "User ID is required." });

    try {
        const chatHistory = await db
            .select()
            .from(chats)
            .where(eq(chats.userId, email))

        res.status(200).json({ messages: chatHistory });
    } catch (error) {
        console.log("Error fetching chat history", error);
        res.status(500).json({ error: "Internal server error" })
    }
})