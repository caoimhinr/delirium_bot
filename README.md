# delirium_bot

## Setup 

Update the container
```
apt update && apt full-upgrade -y
apt install -y curl git
```
Install node.js
```
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
```
Create a bot folder
```
mkdir -p /opt/discord-bot
cd /opt/discord-bot
```
Install Discord.js
```
npm install discord.js
```
Make the bot run in the background

```
npm install -g pm2
cd /opt/delirium_bot
pm2 start index.js --name "delirium_bot"
pm2 list
```

View logs
```
pm2 logs discord-bot
```
