const db = require('./db');

async function listEvents() {
    const result = await db.query('SELECT id, name FROM events ORDER BY id ASC');
    return result.rows;
}

async function listClaimsForEvent(eventId) {
    const result = await db.query(`
        SELECT c.id, c.phase, c.description, c.member_id, c.guild_id,
               m.name AS member_name, m.ign,
               g.name AS guild_name, g.server,
               e.name AS event_name
        FROM claims c
        JOIN members m ON m.id = c.member_id
        JOIN guilds g ON g.id = c.guild_id
        JOIN events e ON e.id = c.event_id
        WHERE c.event_id = $1
        ORDER BY c.phase ASC, c.id ASC
    `, [eventId]);

    return result.rows;
}

async function ensureGuildRecord({ guildId, guildName, serverName }) {
    await db.query(`
        INSERT INTO guilds (id, name, server)
        VALUES ($1, $2, $3)
        ON CONFLICT (id)
        DO UPDATE SET name = EXCLUDED.name, server = EXCLUDED.server
    `, [guildId, guildName, serverName]);
}

async function ensureMemberRecord({ memberId, guildId, memberName, ign }) {
    await db.query(`
        INSERT INTO members (id, guild_id, name, ign)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id)
        DO UPDATE SET guild_id = EXCLUDED.guild_id, name = EXCLUDED.name, ign = COALESCE(EXCLUDED.ign, members.ign)
    `, [memberId, guildId, memberName, ign || null]);
}

async function getMemberClaimsForEvent(eventId, memberId, guildId) {
    const result = await db.query(`
        SELECT c.id, c.phase, c.description, c.member_id, c.guild_id,
               m.name AS member_name,
               g.name AS guild_name
        FROM claims c
        JOIN members m ON m.id = c.member_id
        JOIN guilds g ON g.id = c.guild_id
        WHERE c.event_id = $1 AND (c.member_id = $2 OR c.guild_id = $3)
        ORDER BY c.phase ASC, c.id ASC
    `, [eventId, memberId, guildId]);

    return result.rows;
}

async function createClaim({ eventId, guildId, memberId, phase, description }) {
    const result = await db.query(`
        INSERT INTO claims (event_id, guild_id, member_id, phase, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, event_id, guild_id, member_id, phase, description, created_at, updated_at
    `, [eventId, guildId, memberId, phase, description || null]);

    return result.rows[0];
}

async function updateClaim(claimId, { phase, description }) {
    const result = await db.query(`
        UPDATE claims
        SET phase = $2,
            description = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, event_id, guild_id, member_id, phase, description, created_at, updated_at
    `, [claimId, phase, description || null]);

    return result.rows[0];
}

async function deleteClaim(claimId) {
    await db.query('DELETE FROM claims WHERE id = $1', [claimId]);
}

async function listGuilds() {
    const result = await db.query('SELECT id, name, server FROM guilds ORDER BY name ASC');
    return result.rows;
}

async function listMembers() {
    const result = await db.query(`
        SELECT m.id, m.name, m.ign, m.guild_id, g.name AS guild_name
        FROM members m
        LEFT JOIN guilds g ON g.id = m.guild_id
        ORDER BY m.name ASC
    `);
    return result.rows;
}

module.exports = {
    listEvents,
    listClaimsForEvent,
    ensureGuildRecord,
    ensureMemberRecord,
    getMemberClaimsForEvent,
    createClaim,
    updateClaim,
    deleteClaim,
    listGuilds,
    listMembers
};
