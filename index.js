require('dotenv').config();
const client = require('./discordClient');
const server = require('./web/server');
const commands = require('./commands.js');
const axios = require('axios');
const prompts = require('./data/prompts.js');
const llms = require('./llm/endpoints.js');
const fs = require('fs');
const db = require('./db');
const { startClaimFlow } = require('./claimFlow');

const COMMAND_OPERATOR = '$';

client.once('clientReady', async () => {
    if (process.env.DATABASE_URL) {
        try {
            await db.initDb();
            console.log('Database initialized');
        } catch (err) {
            console.error('Failed to initialize database:', err);
        }
    }

    console.log(`Logged in as ${client.user.tag}`);
    server.start(client);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user)) {
        await respondTo(message, 'jas');
        return;
    }

    if (!message.content.startsWith(COMMAND_OPERATOR)) return;

    switch (message.content) {
        case `${COMMAND_OPERATOR}ping`:
            await handlePing(message);
            return;
        case `${COMMAND_OPERATOR}help`:
            await handleHelp(message);
            return;
        case `${COMMAND_OPERATOR}members`:
            await handleMembers(message);
            return;
        case `${COMMAND_OPERATOR}pricecheck`:
            await handlePriceCheck(message);
            return;
        case `${COMMAND_OPERATOR}claim`:
            await startClaimFlow(message);
            return;
        default:
            if (message.content.startsWith(`${COMMAND_OPERATOR}xemidan`))
                await handleXemidan(message);
            if (message.content.startsWith(`${COMMAND_OPERATOR}drama`))
                await handleGPTResponse(message, 'drama');
            if (message.content.startsWith(`${COMMAND_OPERATOR}sweet`))
                await handleGPTResponse(message, 'sweet');
            if (message.content.startsWith(`${COMMAND_OPERATOR}pricecheck drama`))
                await handlePriceCheck(message, true);
            else if (message.content.startsWith(`${COMMAND_OPERATOR}pricecheck`))
                await handlePriceCheck(message);
    }
});

client.login(process.env.DISCORD_TOKEN);

async function handlePing(message) {
    message.channel.send('Pong!');
}

async function handlePriceCheck(message, drama = false) {
    const steamLinkRegex = /https?:\/\/store\.steampowered\.com\/app\/(\d+)/gi;
    let targetMessage = message;

    if (message.reference) {
        targetMessage = await message.channel.messages.fetch(message.reference.messageId);
    }

    const matches = [...targetMessage.content.matchAll(steamLinkRegex)];
    matches.forEach(async match => {
        const appId = match[1];
        const price = await getSteamPrice(appId);
        if (!drama)
            message.channel.send(`Current price for this game: ${price.text}`);
        else {
            const placeholderMessage = await message.channel.send(prompts.placeholderMessage);

            try {
                const offender = message.author;
                const gameName = price.data.name;
                const gameDesc = stripHtml(price.data.detailed_description);

                const prompt = prompts.buildPriceCheckPrompt(offender.username, gameName, gameDesc, price.text);
                const generatedText = await llms.callAzureOpenAI(prompt);
                await placeholderMessage.delete().catch(() => { });

                if (!generatedText) {
                    return message.channel.send(prompts.backupMessage);
                }

                const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

                await message.channel.send({
                    content: `${responses[0]}`,
                    reply: { messageReference: message.id }
                });

                for (let i = 1; i < responses.length; i++) {
                    await message.channel.send(`${responses[i]}`);
                    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
                }
            } catch (err) {
                console.error(err);
                await placeholderMessage.edit(`Error generating code: ${err.message}`);
            }
        }
    });
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function getSteamPrice(appId) {
    const response = await axios.get(
        'https://store.steampowered.com/api/appdetails',
        {
            params: {
                appids: appId,
                cc: 'de',
                l: 'en'
            }
        }
    );

    const appData = response.data[appId];

    if (!appData || !appData.success) {
        return {
            text: 'Unavailable'
        };
    }

    const priceInfo = appData.data.price_overview;

    if (!priceInfo) {
        return {
            text: 'Free or not for sale'
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
        discount,
        data: appData.data
    };
}

async function handleHelp(message) {
    let helpText = '**Available Commands:**\n\n';

    for (const [name, info] of Object.entries(commands)) {
        helpText += `• **$${name}** — ${info.description}`;
        if (info.example) helpText += ` (Example: \`${info.example}\`)`;
        helpText += '\n';
    }

    await message.channel.send(helpText);
}

async function handleXemidan(message) {
    const mention = message.mentions.users.first();

    if (!mention) {
        return message.reply('You need to mention a user. Example: `$xemidan @User`');
    }

    await message.delete().catch(() => { });
    message.channel.send(`Hey ${mention}, go multiply yourself by yourself you mewling quim.`);
}

async function handleGPTResponse(message, mode = 'drama') {
    const args = message.content.split(' ').slice(1);
    const modifiers = args.join(' ');
    const limit = parseInt(args[1]) || 20;
    let targetMessage;

    try {
        if (message.reference) {
            targetMessage = await message.channel.messages.fetch(message.reference.messageId);
        } else {
            const messages = await message.channel.messages.fetch({ limit });
            const eligible = messages.filter(m => !m.author.bot && m.id !== message.id &&
                !m.content.startsWith(COMMAND_OPERATOR));

            if (eligible.size === 0) {
                return message.reply('No messages to take offense to!');
            }

            targetMessage = eligible.random();
        }

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

async function respondWithJas(message) {
    message.channel.sendTyping();

    try {
        const friend = message.author;
        const targetContent = message.content;
        const prompt = prompts.buildJasPrompt(targetContent, friend.username);
        const generatedText = await llms.callAzureOpenAI(prompt);

        if (!generatedText) {
            return message.channel.send(prompts.backupMessage);
        }

        const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

        await message.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: message.id }
        });

        message.channel.sendTyping();
        for (let i = 1; i < responses.length; i++) {
            await message.channel.send(`${responses[i]}`);
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
    } catch (err) {
        console.error(err);
    }
}

async function respondWithDrama(message) {
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

        const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

        await message.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: message.id }
        });

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
    const placeholderMessage = await message.channel.send('Get ready... ⏳');

    try {
        const offender = message.author;
        const targetContent = message.content;

        const prompt = `
You are a caring and empathical Discord bot. 
You see the following message from a user:

"${targetContent}" 

Generate 1 to 2 short supportive replies directed at the user ${offender.username}, 
as if you are finding a way to help them succeed. Each reply should be one sentence, 
sweet and playful, but only use the user's name in the first reply.
`;

        const response = await axios.post(
            process.env.AZURE_OPENAI_ENDPOINT,
            {
                messages: [
                    { role: 'system', content: "You are a hairy Canadian lumberjack man who's been through a lot in his still short lifetime. You care about the people you interact with and wish for them to reach their full potential in life." },
                    { role: 'user', content: prompt }
                ],
                max_completion_tokens: process.env.MAX_COMPLETION_TOKENS
            },
            {
                headers: {
                    'api-key': process.env.AZURE_OPENAI_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const generatedText = response.data.choices?.[0]?.message?.content?.trim();
        await placeholderMessage.delete().catch(() => { });

        if (!generatedText) {
            return message.channel.send("Hmm, I couldn't come up with any drama this time.");
        }

        const responses = generatedText.split(/\n/).filter(line => line.trim().length > 0);

        await message.channel.send({
            content: `${responses[0]}`,
            reply: { messageReference: message.id }
        });

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
        const rawData = fs.readFileSync('data/members.json', 'utf8');
        const data = JSON.parse(rawData);
        const usernames = data.members.map(m => m.member.user.username);

        const chunkSize = 1900;
        let chunk = '';
        for (const name of usernames) {
            if ((chunk + name + '\n').length > chunkSize) {
                await message.channel.send('```' + chunk + '```');
                chunk = '';
            }
            chunk += name + '\n';
        }
        if (chunk.length > 0) {
            await message.channel.send('```' + chunk + '```');
        }
    } catch (err) {
        console.error(err);
        await message.reply(`Error listing members: ${err.message}`);
    }
}

module.exports = client;
