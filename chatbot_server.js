// // const express = require("express");
// // const cors = require("cors");
// const fs = require("fs");
// const axios = require("axios");
// const dotenv = require("dotenv");

// dotenv.config();

// const API_KEY = process.env.GEMINI_API_KEY;

// // const app = express();
// // app.use(cors());
// // app.use(express.json());

// // Load dataset
// const dataset = JSON.parse(fs.readFileSync("faq.json", "utf8"));

// // Gemini API Key
// // const GEMINI_API_KEY = "YOUR_API_KEY";

// // Find answer from dataset
// function searchDataset(question) {

//     question = question.toLowerCase();

//     for (let key in dataset) {
//         if (question.includes(key)) {
//             return dataset[key];
//         }
//     }

//     return "Sorry, I don't have information about that in this project.";
// }

// const chat = async (req, res) => {

//     const userQuestion = req.body.message;

//     const datasetAnswer = searchDataset(userQuestion);

//     try {


//     const response = await axios.post(
//       "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
//       {
//         contents: [
//           {
//             parts: [
//               {
//                 text: userQuestion  + "\n\nExplain this answer clearly for the user with minimum 50 words."
//               }
//             ]
//           }
//         ]
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "X-goog-api-key": API_KEY
//         }
//       }
//     );

//         const aiReply =
//             response.data.candidates[0].content.parts[0].text;

//         res.json({ reply: aiReply });

//     } catch (error) {

//         res.json({
//             reply: datasetAnswer
//         });
//     }
// }
// // );

// // app.listen(4000, () => {
// //     console.log("Chatbot server running on port 4000");
// // });
// module.exports = chat
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

// =========================
// 🌐 SERVICE URL CONFIG
// =========================
const CHATBOT_URL = process.env.CHATBOT_URL || "http://chatbot-service:6000/chat";

console.log("Using Chatbot URL:", CHATBOT_URL);

// =========================
// 💬 CHAT ROUTE
// =========================
app.post("/chat", async (req, res) => {

    const userText = req.body.message;

    if (!userText) {
        return res.status(400).json({ reply: "No message provided" });
    }

    try {
        const response = await axios.post(CHATBOT_API_URL, {
            message: userText
        }, {
            timeout: 5000   // ✅ prevents hanging
        });

        return res.json({
            reply: response.data.reply
        });

    } catch (error) {

        console.error("Node → Flask ERROR:");
        console.error("Message:", error.message);
        console.error("Code:", error.code);

        return res.status(500).json({
            reply: "Chatbot service unavailable."
        });
    }
});

// =========================
// 🚀 START SERVER
// =========================
app.listen(30002, () => {
    console.log("Node server running on port 30002");
});

app.listen(30002, () => {
    console.log("Node server running on port 30002");
});
