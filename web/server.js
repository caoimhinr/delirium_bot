require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const claimService = require('../claimService');

const SETTINGS_FILE = path.join(__dirname, 'guildSettings.json');
const AUTHORIZED_MEMBERS_FILE = path.join(__dirname, '..', 'data', 'authorizedMembers.json');
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const GUILD_ID = process.env.GUILD_ID;
let client;

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

    app.set('trust proxy', 1);
    app.use(express.static(path.join(__dirname, 'public')));
    app.engine('html', require('ejs').renderFile);
    app.set('view engine', 'html');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    app.use(session({
        secret: process.env.SESSION_SECRET || 'keyboardcat',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true'
        }
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/', (req, res) => res.redirect('/settings'));
    app.get('/login', passport.authenticate('discord'));
    app.get('/callback',
        passport.authenticate('discord', { failureRedirect: '/' }),
        (req, res) => res.redirect('/settings')
    );
    app.get('/logout', (req, res) => {
        req.logout(() => {
            req.session.destroy(() => {
                res.clearCookie('connect.sid');
                res.redirect('/');
            });
        });
    });

    app.get('/settings', ensureAuthorized, async (req, res) => {
        const guildId = req.query.guild || req.user.guilds?.[0]?.id || GUILD_ID;
        const settings = await loadSettings();
        const guildConfig = settings[guildId] || { systemPrompt: 'You are a dramatic sassy bot.' };

        res.render('settings', {
            GUILD_ID: guildId,
            SYSTEM_PROMPT: guildConfig.systemPrompt
        });
    });

    app.post('/settings', ensureAuthorized, async (req, res) => {
        const guildId = req.query.guild || GUILD_ID;
        const systemPrompt = req.body.systemPrompt;

        const settings = await loadSettings();
        settings[guildId] = { systemPrompt };
        await saveSettings(settings);

        res.send(`<p>Settings saved for guild ${guildId}!</p><p><a href="/settings?guild=${guildId}">Back</a></p>`);
    });

    app.get('/maintenance', ensureAuthorized, async (req, res) => {
        const [events, guilds, members] = await Promise.all([
            claimService.listEvents(),
            claimService.listGuilds(),
            claimService.listMembers()
        ]);
        const claims = await db.query(`
            SELECT c.id, c.phase, c.description, e.name AS event_name, g.name AS guild_name, m.name AS member_name
            FROM claims c
            JOIN events e ON e.id = c.event_id
            JOIN guilds g ON g.id = c.guild_id
            JOIN members m ON m.id = c.member_id
            ORDER BY c.id ASC
        `);

        res.render('maintenance', {
            events,
            guilds,
            members,
            claims: claims.rows
        });
    });

    app.post('/maintenance/events', ensureAuthorized, async (req, res) => {
        const name = req.body.name?.trim();
        if (name) {
            await db.query('INSERT INTO events (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
        }
        res.redirect('/maintenance');
    });

    app.post('/maintenance/events/:id/delete', ensureAuthorized, async (req, res) => {
        await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
        res.redirect('/maintenance');
    });

    app.post('/maintenance/guilds', ensureAuthorized, async (req, res) => {
        const { id, name, server } = req.body;
        if (id && name && server) {
            await db.query(`
                INSERT INTO guilds (id, name, server)
                VALUES ($1, $2, $3)
                ON CONFLICT (id)
                DO UPDATE SET name = EXCLUDED.name, server = EXCLUDED.server
            `, [id.trim(), name.trim(), server.trim()]);
        }
        res.redirect('/maintenance');
    });

    app.post('/maintenance/guilds/:id/delete', ensureAuthorized, async (req, res) => {
        await db.query('DELETE FROM guilds WHERE id = $1', [req.params.id]);
        res.redirect('/maintenance');
    });

    app.post('/maintenance/members', ensureAuthorized, async (req, res) => {
        const { id, guild_id, name, ign } = req.body;
        if (id && name) {
            await db.query(`
                INSERT INTO members (id, guild_id, name, ign)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id)
                DO UPDATE SET guild_id = EXCLUDED.guild_id, name = EXCLUDED.name, ign = EXCLUDED.ign
            `, [id.trim(), guild_id?.trim() || null, name.trim(), ign?.trim() || null]);
        }
        res.redirect('/maintenance');
    });

    app.post('/maintenance/members/:id/delete', ensureAuthorized, async (req, res) => {
        await db.query('DELETE FROM members WHERE id = $1', [req.params.id]);
        res.redirect('/maintenance');
    });

    app.post('/maintenance/claims/:id/delete', ensureAuthorized, async (req, res) => {
        await claimService.deleteClaim(req.params.id);
        res.redirect('/maintenance');
    });

    app.listen(PORT, () => console.log(`Web UI running on http://localhost:${PORT}`));
}

async function ensureAuthorized(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/login');

    const authorizedIds = loadAuthorizedMemberIds();
    if (authorizedIds.includes(req.user.id)) return next();

    if (ADMIN_ROLE_ID && GUILD_ID) {
        try {
            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(req.user.id);
            if (member.roles.cache.has(ADMIN_ROLE_ID)) {
                return next();
            }
        } catch (err) {
            console.error('Authorization lookup failed:', err.message);
        }
    }

    return res.status(403).send('Forbidden: You do not have permission.');
}

function loadAuthorizedMemberIds() {
    if (!fs.existsSync(AUTHORIZED_MEMBERS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(AUTHORIZED_MEMBERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

async function loadSettings() {
    if (process.env.DATABASE_URL) {
        const result = await db.query('SELECT guild_id, system_prompt FROM web_settings');
        const settings = {};
        for (const row of result.rows) {
            settings[row.guild_id] = { systemPrompt: row.system_prompt };
        }
        return settings;
    }

    if (!fs.existsSync(SETTINGS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_FILE));
}

async function saveSettings(data) {
    if (process.env.DATABASE_URL) {
        for (const [guildId, config] of Object.entries(data)) {
            await db.query(`
                INSERT INTO web_settings (guild_id, system_prompt, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (guild_id)
                DO UPDATE SET system_prompt = EXCLUDED.system_prompt, updated_at = NOW()
            `, [guildId, config.systemPrompt]);
        }
        return;
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

module.exports = { start };
