import dotenv from "dotenv";
import cors from "cors";
import express, { Request, Response } from "express";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.post("/register-user", async (req: Request, res: Response): Promise<any> => {
    const { name, email, lang } = req.body || {};

    const responseMap: Record<string, string> = { BG: "Име и Имейл адрес са необходими.", EN: "Name and Email is required." };

    if (!name || !email) return res.status(400).json({ error: responseMap[(lang.toUpperCase())] || responseMap["EN"] });

    res.status(200).json({ message: "Success" });
});



