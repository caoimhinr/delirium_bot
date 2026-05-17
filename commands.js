module.exports = {
    ping: {
        description: 'Basic command to check bot availability.',
        example: '$ping'
    },
    remember: {
        description: 'Stores a personal memory for the bot in Postgres using `$remember key = value`.',
        example: '$remember favorite_game = Deep Rock Galactic'
    },
    xemidan: {
        description: 'Properly insult someone.',
        example: '$xemidan @user'
    },
    drama: {
        description: 'Picks one of the last <X> messages in the channel to take offense to, alternatively you can reply to a specific message with $drama for a targeted input.',
        example: '$drama 20'
    },
    sweet: {
        description: 'Picks one of the last <X> messages in the channel to encourage and uplift the sender, alternatively you can reply to a specific message with $sweet for a targeted input.',
        example: '$sweet 20'
    },
    members: {
        description: 'Lists all members from the server file.',
        example: '$members'
    },
    pricecheck: {
        description: 'Checks the price of a given steam item using the store url. Add drama to the command to get a dramatic response.',
        example: '$pricecheck <drama> [store url]'
    },
    claim: {
        description: 'Starts an interactive claim flow for an event using reactions and replies.',
        example: '$claim'
    },
    claims: {
        description: 'Lets you choose an event, then lists all claims for that event.',
        example: '$claims'
    },
    help: {
        description: 'Shows this help menu.',
        example: '$help'
    }
};
