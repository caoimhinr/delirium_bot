require('dotenv').config();
const client = require('./discordClient');
const server = require('./web/server');
const commands = require("./commands.js");
const axios = require('axios');
const prompts = require("./data/prompts.js");
const { buildLLMPrompt } = require('./promptBuilder');

const COMMAND_OPERATOR = '$'

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
    server.start(client);
});

client.on('messageCreate', async message => {
    // ignore bot messages
    if (message.author.bot) return;

    // Check if bot is mentioned
    if (message.mentions.has(client.user)) {
        await respondTo(message);
    } else {

        if (!message.content.startsWith(COMMAND_OPERATOR)) return;

        switch (message.content) {
            case `${COMMAND_OPERATOR}ping`:
                await handlePing(message);
                break;
            case `${COMMAND_OPERATOR}help`:
                await handleHelp(message);
                break;
            default:
                if (message.content.startsWith(`${COMMAND_OPERATOR}xemidan`))
                    await handleXemidan(message)
                if (message.content.startsWith(`${COMMAND_OPERATOR}drama`))
                    await handleGPTResponse(message, 'drama')
                if (message.content.startsWith(`${COMMAND_OPERATOR}sweet`))
                    await handleGPTResponse(message, 'sweet')
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

async function handlePing(message) {
    message.channel.send('Pong!');
}

async function handleHelp(message) {
    let helpText = "**Available Commands:**\n\n";

    for (const [name, info] of Object.entries(commands)) {
        helpText += `• **$${name}** — ${info.description}`;
        if (info.example) helpText += ` (Example: \`${info.example}\`)`;
        helpText += `\n`;
    }

    await message.channel.send(helpText);
}

async function handleXemidan(message) {
    const mention = message.mentions.users.first();

    if (!mention) {
        return message.reply("You need to mention a user. Example: `$xemidan @User`");
    }

    // Delete the original message
    await message.delete().catch(() => { });

    // Send the replacement message
    message.channel.send(`Hey ${mention}, go multiply yourself by yourself you mewling quim.`);
}

async function handleGPTResponse(message, mode = 'drama') {
    // Parse the number of messages to check (optional, default 20)
    const args = message.content.split(/\s+/);
    const limit = parseInt(args[1]) || 20;
    let targetMessage;

    try {

        // ----------------------------
        // Step 1: Pick a message
        // ----------------------------
        if (message.reference) {
            // Use the message being replied to
            targetMessage = await message.channel.messages.fetch(message.reference.messageId);
        } else {
            const messages = await message.channel.messages.fetch({ limit });
            // Remove the $drama command message from selection
            const eligible = messages.filter(m => !m.author.bot && m.id !== message.id &&
                !m.content.startsWith(COMMAND_OPERATOR));

            if (eligible.size === 0) {
                return message.reply("No messages to take offense to!");
            }

            // Pick a random message
            targetMessage = eligible.random();
        }

        // Delete the command message if you want to keep it sneaky
        await message.delete().catch(() => { });

        await respondTo(targetMessage, mode);
    } catch (err) {
        console.error(err);
    }
}

async function respondTo(targetMessage, mode = 'drama') {
    switch (mode) {
        case 'drama':
            await respondWithDrama(targetMessage);
            break;
        case 'sweet':
            await respondWithSweetness(targetMessage);
            break;
    }
}

async function respondWithDrama(targetMessage) {
    // Send a temporary reply to let user know generation is in progress
    const placeholderMessage = await targetMessage.channel.send("Get ready... ⏳");

    try {

        const offender = targetMessage.author;
        const targetContent = targetMessage.content;

        console.log('targetContent:', targetContent);

        // Build prompt for Azure OpenAI
//         const prompt = `
// You are a dramatic and sassy Discord bot. 
// You see the following message from a user:

// "${targetContent}" 

// Generate 2 to 3 short antagonizing replies directed at the user ${offender.username}, 
// as if you are taking offense to what they said. Each reply should be one sentence, 
// funny and playful, but only use the user's name in the first reply. Use :axe:, :beaver: and :maple_leaf: emojis where appropriate.
// `;
const prompt = prompts.buildDramaPrompt(targetContent, offender.username);
        // Call Azure OpenAI
        const response = await axios.post(
            process.env.AZURE_OPENAI_ENDPOINT,
            {
                messages: [
                    { role: "system", content: "You are a hairy Canadian lumberjack man who's been through a lot in his still short lifetime. You don't mince words but get straight to the point and aren't afraid to offend someone." },
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
        const generatedText = response.data.choices?.[0]?.message?.content?.trim();
        console.log('generatedText:', generatedText);
        await placeholderMessage.delete().catch(() => { });

        if (!generatedText) {
            return message.channel.send("Hmm, I couldn't come up with any drama this time.");
        }

        // Split responses if OpenAI returns multiple lines
        const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

        await targetMessage.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: targetMessage.id }
        });

        // Post the rest normally with small delays
        for (let i = 1; i < responses.length; i++) {
            await targetMessage.channel.send(`${responses[i]}`);
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
    } catch (err) {
        console.error(err);
        await placeholderMessage.edit(`Error generating code: ${err.message}`);
    }
}

async function respondWithSweetness(targetMessage) {
    // Send a temporary reply to let user know generation is in progress
    const placeholderMessage = await targetMessage.channel.send("Get ready... ⏳");

    try {

        const offender = targetMessage.author;
        const targetContent = targetMessage.content;

        console.log('targetContent:', targetContent);

        // Build prompt for Azure OpenAI
        const prompt = `
You are a caring and empathical Discord bot. 
You see the following message from a user:

"${targetContent}" 

Generate 1 to 2 short supportive replies directed at the user ${offender.username}, 
as if you are finding a way to help them succeed. Each reply should be one sentence, 
sweet and playful, but only use the user's name in the first reply.
`;

        // Call Azure OpenAI
        const response = await axios.post(
            process.env.AZURE_OPENAI_ENDPOINT,
            {
                messages: [
                    { role: "system", content: "You are a hairy Canadian lumberjack man who's been through a lot in his still short lifetime. You care about the people you interact with and wish for them to reach their full potential in life." },
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
        const generatedText = response.data.choices?.[0]?.message?.content?.trim();
        console.log('generatedText:', generatedText);
        await placeholderMessage.delete().catch(() => { });

        if (!generatedText) {
            return message.channel.send("Hmm, I couldn't come up with any drama this time.");
        }

        // Split responses if OpenAI returns multiple lines
        const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

        await targetMessage.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: targetMessage.id }
        });

        // Post the rest normally with small delays
        for (let i = 1; i < responses.length; i++) {
            await targetMessage.channel.send(`${responses[i]}`);
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
    } catch (err) {
        console.error(err);
        await placeholderMessage.edit(`Error generating code: ${err.message}`);
    }
}

module.exports = client;