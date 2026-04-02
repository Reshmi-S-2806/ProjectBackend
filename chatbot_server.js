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
const axios = require('axios');

const pythonapi = async (req, res) => {
    const userText = req.body.message;

    if (!userText) {
        return res.status(400).json({ error: "No message provided" });
    }

    try {
        // Switch between localhost (local dev) or chatbot-service (K8s)
        const targetUrl = process.env.NODE_ENV === 'production' 
            ? 'http://chatbot-service:6000/chat' 
            : 'http://localhost:6000/chat';

        const response = await axios.post(targetUrl, {
            message: userText 
        });

        // We return 'reply' so your Angular frontend doesn't break
        res.json({ 
            reply: response.data.response 
        });

    } catch (error) {
        console.error('Bridge Error:', error.message);
        res.status(500).json({ reply: "Service temporarily unavailable." });
    }
};

module.exports = pythonapi;
