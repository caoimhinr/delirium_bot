const { Pool } = require('pg');

let pool;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    return pool;
}

async function query(text, params = []) {
    return getPool().query(text, params);
}

async function initDb() {
    await query(`
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS guilds (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            server TEXT NOT NULL
        );
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            guild_id TEXT REFERENCES guilds(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            ign TEXT
        );
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS claims (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            phase INTEGER NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS web_settings (
            guild_id TEXT PRIMARY KEY,
            system_prompt TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_claims_event_id ON claims(event_id);
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_claims_member_id ON claims(member_id);
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_claims_guild_id ON claims(guild_id);
    `);

    const defaultEvents = ['Castle Siege', 'Guild Raid', 'World Boss'];
    for (const eventName of defaultEvents) {
        await query(
            'INSERT INTO events (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
            [eventName]
        );
    }
}

module.exports = {
    getPool,
    query,
    initDb
};
