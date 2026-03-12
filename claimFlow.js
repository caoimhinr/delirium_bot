const { Events } = require('discord.js');
const claimService = require('./claimService');

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const plusEmoji = '➕';
const editEmoji = '✏️';
const checkEmoji = '✅';
const cancelEmoji = '❌';

async function startClaimFlow(message) {
    if (!message.guild) {
        await message.reply('Claims can only be created inside a server.');
        return;
    }

    const events = await claimService.listEvents();
    if (!events.length) {
        await message.reply('No events are configured yet.');
        return;
    }

    const prompt = await message.channel.send({
        content: [
            `## Claim registration for ${message.author.username}`,
            'React to choose an event:',
            ...events.map((event, index) => `${index + 1}. ${event.name}`),
            '',
            'Use ❌ to cancel.'
        ].join('\n')
    });

    for (let i = 0; i < Math.min(events.length, numberEmojis.length); i++) {
        await prompt.react(numberEmojis[i]);
    }
    await prompt.react(cancelEmoji);

    const selectedIndex = await waitForReactionChoice(prompt, message.author.id, events.length);
    if (selectedIndex === null) {
        await message.channel.send('Claim flow cancelled or timed out.');
        return;
    }

    const selectedEvent = events[selectedIndex];
    const guildId = message.guild.id;
    const guildName = message.guild.name;
    const serverName = message.guild.name;
    const memberId = message.author.id;
    const memberName = message.member?.displayName || message.author.username;

    await claimService.ensureGuildRecord({ guildId, guildName, serverName });
    await claimService.ensureMemberRecord({ memberId, guildId, memberName });

    const existingClaims = await claimService.getMemberClaimsForEvent(selectedEvent.id, memberId, guildId);
    const allClaims = await claimService.listClaimsForEvent(selectedEvent.id);

    await message.channel.send({
        content: formatClaimsList(selectedEvent.name, allClaims)
    });

    let claimToEdit = null;

    if (existingClaims.length > 0) {
        const existingPrompt = await message.channel.send({
            content: [
                `You already have ${existingClaims.length} claim(s) for **${selectedEvent.name}** as yourself or your guild.`,
                ...existingClaims.map(claim => `• #${claim.id} — Phase ${claim.phase} — ${claim.description || 'No description'}`),
                '',
                `React ${editEmoji} to edit your latest claim or ${plusEmoji} to create a new one.`,
                `React ${cancelEmoji} to cancel.`
            ].join('\n')
        });

        await existingPrompt.react(editEmoji);
        await existingPrompt.react(plusEmoji);
        await existingPrompt.react(cancelEmoji);

        const action = await waitForSpecificReaction(existingPrompt, message.author.id, [editEmoji, plusEmoji, cancelEmoji]);
        if (!action || action === cancelEmoji) {
            await message.channel.send('Claim flow cancelled.');
            return;
        }

        if (action === editEmoji) {
            claimToEdit = existingClaims[existingClaims.length - 1];
        }
    }

    const phasePrompt = await message.channel.send('Reply with the phase number for this claim.');
    const phaseReply = await waitForReply(message.channel, message.author.id);
    if (!phaseReply) {
        await message.channel.send('Claim flow timed out while waiting for phase.');
        return;
    }

    const phase = parseInt(phaseReply.content.trim(), 10);
    if (!Number.isInteger(phase)) {
        await message.channel.send('Phase must be an integer. Claim flow cancelled.');
        return;
    }

    const descriptionPrompt = await message.channel.send('Reply with a description for this claim, or react with ✅ on this message to skip the description.');
    await descriptionPrompt.react(checkEmoji);
    await descriptionPrompt.react(cancelEmoji);

    const descriptionResult = await waitForDescriptionOrSkip(descriptionPrompt, message.channel, message.author.id);
    if (!descriptionResult || descriptionResult.cancelled) {
        await message.channel.send('Claim flow cancelled.');
        return;
    }

    const description = descriptionResult.description;

    let savedClaim;
    if (claimToEdit) {
        savedClaim = await claimService.updateClaim(claimToEdit.id, { phase, description });
    } else {
        savedClaim = await claimService.createClaim({
            eventId: selectedEvent.id,
            guildId,
            memberId,
            phase,
            description
        });
    }

    await message.channel.send([
        `Claim ${claimToEdit ? 'updated' : 'created'} successfully.`,
        `Event: **${selectedEvent.name}**`,
        `Claim ID: **#${savedClaim.id}**`,
        `Phase: **${savedClaim.phase}**`,
        `Description: ${savedClaim.description || 'No description'}`
    ].join('\n'));
}

function formatClaimsList(eventName, claims) {
    if (!claims.length) {
        return `There are currently no claims for **${eventName}**.`;
    }

    return [
        `Current claims for **${eventName}**:`,
        ...claims.map(claim => `• #${claim.id} — Phase ${claim.phase} — ${claim.guild_name} / ${claim.member_name}${claim.description ? ` — ${claim.description}` : ''}`)
    ].join('\n');
}

async function waitForReactionChoice(message, userId, optionCount) {
    const validEmojis = numberEmojis.slice(0, optionCount).concat(cancelEmoji);
    const emoji = await waitForSpecificReaction(message, userId, validEmojis);

    if (!emoji || emoji === cancelEmoji) return null;
    return numberEmojis.indexOf(emoji);
}

async function waitForSpecificReaction(message, userId, emojiOptions) {
    try {
        const reaction = await message.awaitReactions({
            filter: (reaction, user) => user.id === userId && emojiOptions.includes(reaction.emoji.name),
            max: 1,
            time: 120000,
            errors: ['time']
        });

        return reaction.first()?.emoji.name || null;
    } catch {
        return null;
    }
}

async function waitForReply(channel, userId) {
    try {
        const collected = await channel.awaitMessages({
            filter: msg => msg.author.id === userId,
            max: 1,
            time: 120000,
            errors: ['time']
        });

        return collected.first() || null;
    } catch {
        return null;
    }
}

async function waitForDescriptionOrSkip(promptMessage, channel, userId) {
    return new Promise(resolve => {
        let finished = false;

        const cleanup = () => {
            reactionCollector.stop();
            messageCollector.stop();
        };

        const reactionCollector = promptMessage.createReactionCollector({
            filter: (reaction, user) => user.id === userId && [checkEmoji, cancelEmoji].includes(reaction.emoji.name),
            max: 1,
            time: 120000
        });

        const messageCollector = channel.createMessageCollector({
            filter: msg => msg.author.id === userId,
            max: 1,
            time: 120000
        });

        reactionCollector.on('collect', reaction => {
            if (finished) return;
            finished = true;
            cleanup();
            if (reaction.emoji.name === cancelEmoji) {
                resolve({ cancelled: true });
            } else {
                resolve({ description: null });
            }
        });

        messageCollector.on('collect', msg => {
            if (finished) return;
            finished = true;
            cleanup();
            resolve({ description: msg.content.trim() || null });
        });

        const timeout = () => {
            if (finished) return;
            finished = true;
            cleanup();
            resolve(null);
        };

        reactionCollector.on('end', collected => {
            if (!finished && collected.size === 0) timeout();
        });

        messageCollector.on('end', collected => {
            if (!finished && collected.size === 0) timeout();
        });
    });
}

module.exports = {
    startClaimFlow
};
