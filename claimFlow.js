const claimService = require('./claimService');

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const plusEmoji = '➕';
const editEmoji = '✏️';
const checkEmoji = '✅';
const cancelEmoji = '❌';
const activeClaimFlows = new Set();

async function startClaimFlow(message) {
    return runClaimSelectionFlow(message, { listOnly: false });
}

async function startClaimsListFlow(message) {
    return runClaimSelectionFlow(message, { listOnly: true });
}

async function runClaimSelectionFlow(message, options = {}) {
    const { listOnly = false } = options;
    const userKey = getFlowKey(message.channel.id, message.author.id);

    if (activeClaimFlows.has(userKey)) {
        await message.reply('You already have an active claim flow in this channel. Finish it or wait for it to timeout.');
        return;
    }

    activeClaimFlows.add(userKey);

    try {
        if (!message.guild) {
            await message.reply('Claims can only be used inside a server.');
            return;
        }

        const events = await claimService.listEvents();
        if (!events.length) {
            await message.reply('No events are configured yet. Add them in /maintenance first.');
            return;
        }

        const prompt = await message.channel.send({
            content: [
                `## ${listOnly ? 'Claim list' : 'Claim registration'} for ${message.author.username}`,
                'Reply with the number of the event you want to choose, or react to choose:',
                ...events.map((event, index) => `${index + 1}. ${event.name}`),
                '',
                'Use ❌ to cancel.'
            ].join('\n')
        });

        const maxOptions = Math.min(events.length, numberEmojis.length);
        for (let i = 0; i < maxOptions; i++) {
            await prompt.react(numberEmojis[i]).catch(err => console.error('Failed to add reaction:', err.message));
        }
        await prompt.react(cancelEmoji).catch(err => console.error('Failed to add cancel reaction:', err.message));

        const selectedIndex = await waitForEventSelection(prompt, message.channel, message.author.id, maxOptions);
        if (selectedIndex === null) {
            await message.channel.send('Claim flow cancelled or timed out.');
            return;
        }

        const selectedEvent = events[selectedIndex];
        if (!selectedEvent) {
            await message.channel.send('Invalid event selection.');
            return;
        }

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

        if (listOnly) {
            return;
        }

        let claimToEdit = null;

        if (existingClaims.length > 0) {
            const existingPrompt = await message.channel.send({
                content: [
                    `You already have ${existingClaims.length} claim(s) for **${selectedEvent.name}** as yourself or your guild.`,
                    ...existingClaims.map(claim => `• #${claim.id} — Phase ${claim.phase} — ${claim.description || 'No description'}`),
                    '',
                    `Reply \`edit\` to edit your latest claim, \`new\` to create a new one, or react with ${editEmoji}/${plusEmoji}.`,
                    `React ${cancelEmoji} or reply \`cancel\` to cancel.`
                ].join('\n')
            });

            await existingPrompt.react(editEmoji).catch(() => {});
            await existingPrompt.react(plusEmoji).catch(() => {});
            await existingPrompt.react(cancelEmoji).catch(() => {});

            const action = await waitForActionSelection(existingPrompt, message.channel, message.author.id, [editEmoji, plusEmoji, cancelEmoji]);
            if (!action || action === cancelEmoji || action === 'cancel') {
                await message.channel.send('Claim flow cancelled.');
                return;
            }

            if (action === editEmoji || action === 'edit') {
                claimToEdit = existingClaims[existingClaims.length - 1];
            }
        }

        await message.channel.send('Reply with the phase number for this claim.');
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

        const descriptionPrompt = await message.channel.send('Reply with a description for this claim, or react with ✅ on this message to skip the description. You can also reply `skip`.');
        await descriptionPrompt.react(checkEmoji).catch(() => {});
        await descriptionPrompt.react(cancelEmoji).catch(() => {});

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
    } finally {
        activeClaimFlows.delete(userKey);
    }
}

function isUserInActiveClaimFlow(channelId, userId) {
    return activeClaimFlows.has(getFlowKey(channelId, userId));
}

function getFlowKey(channelId, userId) {
    return `${channelId}:${userId}`;
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

async function waitForEventSelection(promptMessage, channel, userId, optionCount) {
    const reactionPromise = waitForSpecificReaction(promptMessage, userId, [...numberEmojis.slice(0, optionCount), cancelEmoji]);
    const replyPromise = waitForReply(channel, userId);

    const result = await Promise.race([
        reactionPromise.then(emoji => ({ type: 'reaction', value: emoji })),
        replyPromise.then(msg => ({ type: 'reply', value: msg }))
    ]);

    if (!result) return null;

    if (result.type === 'reaction') {
        if (!result.value || normalizeEmoji(result.value) === normalizeEmoji(cancelEmoji)) return null;
        return numberEmojis.slice(0, optionCount).findIndex(validEmoji => normalizeEmoji(validEmoji) === normalizeEmoji(result.value));
    }

    const content = result.value?.content?.trim().toLowerCase();
    if (!content) return null;
    if (content === 'cancel') return null;

    const parsed = parseInt(content, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= optionCount) {
        return parsed - 1;
    }

    return null;
}

async function waitForActionSelection(promptMessage, channel, userId, emojiOptions) {
    const reactionPromise = waitForSpecificReaction(promptMessage, userId, emojiOptions);
    const replyPromise = waitForReply(channel, userId);

    const result = await Promise.race([
        reactionPromise.then(emoji => ({ type: 'reaction', value: emoji })),
        replyPromise.then(msg => ({ type: 'reply', value: msg }))
    ]);

    if (!result) return null;

    if (result.type === 'reaction') {
        return result.value || null;
    }

    const content = result.value?.content?.trim().toLowerCase();
    if (['edit', 'new', 'cancel'].includes(content)) {
        return content;
    }

    return null;
}

async function waitForSpecificReaction(message, userId, emojiOptions) {
    const normalizedOptions = emojiOptions.map(normalizeEmoji);

    try {
        const reactionCollection = await message.awaitReactions({
            filter: (reaction, user) => {
                const normalizedReaction = normalizeEmoji(reaction.emoji.name || '');
                return user.id === userId && normalizedOptions.includes(normalizedReaction);
            },
            max: 1,
            time: 120000,
            errors: ['time']
        });

        const reaction = reactionCollection.first();
        return reaction?.emoji?.name || null;
    } catch {
        return null;
    }
}

function normalizeEmoji(value) {
    return (value || '').replace(/\uFE0F/g, '');
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
            filter: (reaction, user) => {
                const normalizedReaction = normalizeEmoji(reaction.emoji.name || '');
                return user.id === userId && [normalizeEmoji(checkEmoji), normalizeEmoji(cancelEmoji)].includes(normalizedReaction);
            },
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
            if (normalizeEmoji(reaction.emoji.name) === normalizeEmoji(cancelEmoji)) {
                resolve({ cancelled: true });
            } else {
                resolve({ description: null });
            }
        });

        messageCollector.on('collect', msg => {
            if (finished) return;
            finished = true;
            cleanup();
            const value = msg.content.trim().toLowerCase();
            if (value === 'cancel') {
                resolve({ cancelled: true });
            } else if (value === 'skip') {
                resolve({ description: null });
            } else {
                resolve({ description: msg.content.trim() || null });
            }
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
    startClaimFlow,
    startClaimsListFlow,
    isUserInActiveClaimFlow
};
