require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const COMMAND_OPERATOR = '$'

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', message => {
    switch(message.content) {
        case `${COMMAND_OPERATOR}ping`:
            handlePing(message);
            break;
    }
});

client.login(process.env.DISCORD_TOKEN);

function handlePing(message) {
    message.channel.send('Pong!');
}