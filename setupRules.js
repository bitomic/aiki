const db = require('./database.js');
const config = db.prepare('SELECT rulesChannel FROM config WHERE guildId = ?');
const { clientId } = require('./config.json');
const fs = require('fs');

module.exports = {
    async execute (interaction) {
        const { rulesChannel } = config.get(interaction.guildId);
        const channelroles = interaction.client.channels.cache.get(rulesChannel);
        const webhooks = await channelroles.fetchWebhooks();
        let channelWebhook = webhooks.first();
        let createdWebhook;

        if (!channelWebhook) {
            await channelroles.createWebhook('Rules', {
                avatar: 'https://cdn.discordapp.com/icons/563020189604773888/e238c167354de75db9b5b5a23af93736.png'
            }).then(webhook => {
                channelWebhook = webhook;
            });
            await interaction.editReply({
                content: 'Webhook created',
                ephemeral: true
            });
            createdWebhook = true;
        }
        if (channelWebhook.owner.id !== clientId) {
            throw new Error('Rules webhook was not created by the bot.');
        }

        const content = await fs.readFile('./rules.md');

        await channelWebhook.send(content);
        const reply = {
            content: 'Rules messages created',
            ephemeral: true
        };
        if (createdWebhook) {
            await interaction.followUp(reply);
        } else {
            await interaction.editReply(reply);
        }
    }
};