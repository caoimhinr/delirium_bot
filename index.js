require('dotenv').config();
const client = require('./discordClient');
const server = require('./web/server');
const commands = require("./commands.js");
const axios = require('axios');
const prompts = require("./data/prompts.js");
const llms = require('./llm/endpoints.js');
const fs = require('fs');
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
        await respondTo(message, 'jas');
    } else {

        if (!message.content.startsWith(COMMAND_OPERATOR)) return;

        switch (message.content) {
            case `${COMMAND_OPERATOR}ping`:
                await handlePing(message);
                break;
            case `${COMMAND_OPERATOR}help`:
                await handleHelp(message);
                break;
            case `${COMMAND_OPERATOR}members`:
                await handleMembers(message);
                break;
            case `${COMMAND_OPERATOR}pricecheck`:
                await handlePriceCheck(message);
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

async function handlePriceCheck(message) {
    // const forumChannel = guild.channels.cache.get('1442337698470690917');
    const messageThread = message.channel.isThread() ? message.channel : null;
    const steamLinkRegex = /https?:\/\/store\.steampowered\.com\/app\/(\d+)/gi;

    if (!message.reference) {
        message.channel.send("Please reply to a message containing Steam links to check prices.");
        return;
    } else {
        const targetMessage = await message.channel.messages.fetch(message.reference.messageId);
        const matches = [...targetMessage.content.matchAll(steamLinkRegex)];
        matches.forEach(async match => {
            const appId = match[1];
            console.log(`Found Steam app ID: ${appId}`);
            const price = await getSteamPrice(appId);
            message.channel.send(`Current price for this game: ${price.text}`);
            // const low = await getHistoricalLow(appId);
            // message.channel.send(`Historical low for this game: ${low}`);
        });
    }
    return;

    const allThreads = await forumChannel.threads.fetchActive();
    allThreads.forEach(async thread => {
        await checkSteamContent(thread);
    });
}

async function getSteamPrice(appId) {
    const response = await axios.get(
        "https://store.steampowered.com/api/appdetails",
        {
            params: {
                appids: appId,
                cc: "de", // 🇪🇺 Germany (EUR)
                l: "en"
            }
        }
    );

    const appData = response.data[appId];

    if (!appData || !appData.success) {
        return {
            text: "Unavailable"
        };
    }

    const priceInfo = appData.data.price_overview;

    if (!priceInfo) {
        return {
            text: "Free or not for sale"
        };
    }

    const finalPrice = (priceInfo.final / 100).toFixed(2);
    const originalPrice = (priceInfo.initial / 100).toFixed(2);
    const discount = priceInfo.discount_percent;

    return {
        text:
            discount > 0
                ? `~~${originalPrice}~~ **${finalPrice} ${priceInfo.currency}** (-${discount}%)`
                : `**${finalPrice} ${priceInfo.currency}**`,
        discount
    };
}

async function getHistoricalLow(appId) {
    const response = await axios.get(
        "https://api.isthereanydeal.com/v01/game/lowest/",
        {
            params: {
                key: process.env.ITAD_API_KEY,
                plains: `steam:${appId}`,
                country: "DE"
            }
        }
    );

    const data = response.data.data[`steam:${appId}`];

    if (!data) return null;

    return {
        price: data.price.toFixed(2),
        currency: data.currency
    };
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
    //const args = message.content.split(/\s+/);
    const args = message.content.split(" ").slice(1);
    const modifiers = args.join(" "); // "angry chaotic"
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

        await respondTo(targetMessage, mode, modifiers);
    } catch (err) {
        console.error(err);
    }
}

async function respondTo(message, mode = 'drama', modifiers = null) {
    switch (mode) {
        case 'drama':
            await respondWithDrama(message);
            break;
        case 'sweet':
            await respondWithSweetness(message);
            break;
        case 'jas':
            await respondWithJas(message, modifiers);
            break;
    }
}

async function respondWithJas(message, modifiers = null) {
    // Send a temporary reply to let user know generation is in progress
    //const placeholderMessage = await targetMessage.channel.send(prompts.placeholderMessage);
    message.channel.sendTyping();

    try {

        const friend = message.author;
        const targetContent = message.content;

        const prompt = prompts.buildJasPrompt(targetContent, friend.username);
        console.log('Jas Prompt:', prompt);
        const generatedText = await llms.callAzureOpenAI(prompt);
        //await placeholderMessage.delete().catch(() => { });

        if (!generatedText) {
            return message.channel.send(prompts.backupMessage);
        }

        // Split responses if OpenAI returns multiple lines
        const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

        await message.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: message.id }
        });

        // Post the rest normally with small delays
        message.channel.sendTyping();
        for (let i = 1; i < responses.length; i++) {
            await message.channel.send(`${responses[i]}`);
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
    } catch (err) {
        console.error(err);
        //await placeholderMessage.edit(`Error generating code: ${err.message}`);
    }
}

async function respondWithDrama(message) {
    // Send a temporary reply to let user know generation is in progress
    const placeholderMessage = await message.channel.send(prompts.placeholderMessage);

    try {

        const offender = message.author;
        const targetContent = message.content;

        const prompt = prompts.buildDramaPrompt(targetContent, offender.username);
        const generatedText = await llms.callAzureOpenAI(prompt);
        await placeholderMessage.delete().catch(() => { });

        if (!generatedText) {
            return message.channel.send(prompts.backupMessage);
        }

        // Split responses if OpenAI returns multiple lines
        const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

        await message.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: message.id }
        });

        // Post the rest normally with small delays
        for (let i = 1; i < responses.length; i++) {
            await message.channel.send(`${responses[i]}`);
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
    } catch (err) {
        console.error(err);
        await placeholderMessage.edit(`Error generating code: ${err.message}`);
    }
}

async function respondWithSweetness(message) {
    // Send a temporary reply to let user know generation is in progress
    const placeholderMessage = await message.channel.send("Get ready... ⏳");

    try {

        const offender = message.author;
        const targetContent = message.content;

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

        await message.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: message.id }
        });

        // Post the rest normally with small delays
        for (let i = 1; i < responses.length; i++) {
            await message.channel.send(`${responses[i]}`);
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
    } catch (err) {
        console.error(err);
        await placeholderMessage.edit(`Error generating code: ${err.message}`);
    }
}

async function handleMembers(message) {
    try {
        // Read the JSON file
        const rawData = fs.readFileSync('data/members.json', 'utf8');
        const data = JSON.parse(rawData);

        // Extract usernames
        const usernames = data.members.map(m => m.member.user.username);

        // Discord messages have a 2000 character limit, so we split if needed
        const chunkSize = 1900; // leave room for formatting
        let chunk = '';
        for (const name of usernames) {
            if ((chunk + name + '\n').length > chunkSize) {
                await message.channel.send('```' + chunk + '```');
                chunk = '';
            }
            chunk += name + '\n';
        }
        console.log('chunk', chunk);
        if (chunk.length > 0) {
            await message.channel.send('```' + chunk + '```');
        }
    } catch (err) {
        console.error(err);
        await message.edit(`Error generating code: ${err.message}`);
    }
}

module.exports = client;