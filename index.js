require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const commands = require("./commands.js");

const COMMAND_OPERATOR = '$'

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    // ignore bot messages
    if (message.author.bot) return;

    if (!message.content.startsWith(COMMAND_OPERATOR)) return;

    switch(message.content) {
        case `${COMMAND_OPERATOR}ping`:
            await handlePing(message);
            break;
        case `${COMMAND_OPERATOR}help`:
            await handleHelp(message);
            break;
        default:
            if (message.content.startsWith(`${COMMAND_OPERATOR}xemidan`))
                await handleXemidan(message)
    }
});

client.login(process.env.DISCORD_TOKEN);

async function handlePing(message) {
    message.channel.send('Pong!');
}

async function handleHelp(message) {
    let helpText = "**📘 Available Commands**\n\n";

    for (const [name, info] of Object.entries(commands)) {
        helpText += `**${prefix}${name}** — ${info.description}\n`;
    }

    return message.channel.send(helpText);
}

async function handleXemidan(message) {
    const mention = message.mentions.users.first();

    if (!mention) {
        return message.reply("You need to mention a user. Example: `$xemidan @User`");
    }

    // Delete the original message
    await message.delete().catch(() => {});

    // Send the replacement message
    message.channel.send(`Hey ${mention}, go multiple yourself by yourself you mewling quim.`);
}