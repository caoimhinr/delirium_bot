module.exports = {
  apps: [
    {
      name: "delirium-bot",
      script: "./index.js",
      env: {
        NODE_ENV: "production",
        DISCORD_TOKEN: process.env.DISCORD_TOKEN,
        AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
        AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
        MAX_COMPLETION_TOKENS: process.env.MAX_COMPLETION_TOKENS
      }
    },
    {
      name: "delirium-webui",
      script: "./web/server.js",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
        DISCORD_CALLBACK_URL: process.env.DISCORD_CALLBACK_URL,
        ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID,
        SESSION_SECRET: process.env.SESSION_SECRET
      }
    }
  ]
};
