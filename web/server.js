require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'guildSettings.json');
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // Discord role allowed to edit
const GUILD_ID = process.env.GUILD_ID; // Your guild ID

// --- Passport Discord OAuth2 setup ---
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => done(null, profile)));



function start(loggedInClient) {
    client = loggedInClient;

    const app = express();
    const PORT = process.env.PORT || 3000;

    // Serve static files (CSS, JS, images)
    app.use(express.static(path.join(__dirname, 'public')));

    // Set views folder and view engine
    app.engine('html', require('ejs').renderFile);
    app.set('view engine', 'html');
    app.set('views', path.join(__dirname, 'views'));

    // For POST data
    app.use(express.urlencoded({ extended: true }));

    // --- Express middlewares ---
    app.use(session({
        secret: process.env.SESSION_SECRET || 'keyboardcat',
        resave: false,
        saveUninitialized: false
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(bodyParser.urlencoded({ extended: true }));

    // --- Authentication routes ---
    app.get('/login', passport.authenticate('discord'));
    app.get('/callback',
        passport.authenticate('discord', { failureRedirect: '/' }),
        (req, res) => res.redirect('/settings')
    );
    app.get('/logout', (req, res) => {
        req.logout(() => res.redirect('/'));
    });

    // --- Settings page ---
    app.get('/settings', ensureAdmin, (req, res) => {
        const guildId = req.query.guild || req.user.guilds[0].id;
        const settings = loadSettings();
        const guildConfig = settings[guildId] || { systemPrompt: "You are a dramatic sassy bot." };

        res.render('settings', {
            GUILD_ID: guildId,
            SYSTEM_PROMPT: guildConfig.systemPrompt
        });
    });

    app.post('/settings', ensureAdmin, (req, res) => {
        const guildId = req.query.guild;
        const systemPrompt = req.body.systemPrompt;

        const settings = loadSettings();
        settings[guildId] = { systemPrompt };
        saveSettings(settings);

        res.send(`<p>Settings saved for guild ${guildId}!</p><p><a href="/settings?guild=${guildId}">Back</a></p>`);
    });

    // --- Start server ---
    app.listen(PORT, () => console.log(`Web UI running on http://localhost:${PORT}`));
}

// --- Authorization middleware ---
async function ensureAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/login');

    // Check if user is in any guild where they have ADMIN_ROLE_ID
    const guild = await client.guilds.fetch(GUILD_ID);           // ensure guild object
    const member = await guild.members.fetch(req.user.id);      // fetch the member explicitly
    if (!member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
        return res.status(403).send('Forbidden: You do not have permission.');
    }
    next();
}

// --- Load/save guild settings ---
function loadSettings() {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE));
}

function saveSettings(data) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

module.exports = { start };