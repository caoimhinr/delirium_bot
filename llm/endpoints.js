require('dotenv').config();
const axios = require('axios');
const prompts = require("../data/prompts.js");

module.exports.callAzureOpenAI = async (prompt) => {
    
        // Call Azure OpenAI
        const response = await axios.post(
            process.env.AZURE_OPENAI_ENDPOINT,
            {
                messages: [
                    { role: "system", content: prompts.systemPromptLumberjackMan },
                    { role: "user", content: prompt }
                ],
                max_completion_tokens: process.env.MAX_COMPLETION_TOKENS
            },
            {
                headers: {
                    "api-key": process.env.AZURE_OPENAI_KEY,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log('output', JSON.stringify(response.data, null, 2));
        return response.data.choices?.[0]?.message?.content?.trim().replace(/—/g, "");
    }