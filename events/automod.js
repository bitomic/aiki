const parseDuration = require('parse-duration');
const { MessageEmbed } = require('discord.js');
const db = require('../database.js');
const config = db.prepare('SELECT modLogChannel, modChannel, muteRole, messageLogChannel, modRole FROM config WHERE guildId = ?');
const filters = db.prepare('SELECT * FROM filters').all();
const addMuteToDB = db.prepare('INSERT INTO mutes (userId, guildId, expiry) VALUES (?, ?, ?)');

const levels = {
    alert: 1,
    mute: 2,
    kick: 3,
    ban: 4,
    1: 'alert',
    2: 'mute',
    3: 'kick',
    4: 'ban'
}

module.exports = {
    name: 'messageCreate',
    // eslint-disable-next-line complexity
    async execute (message) {
        const { modLogChannel, modChannel, muteRole, messageLogChannel, modRole } = config.all(message.guild.id)[0];
        if (message.author.bot || message.member.roles.highest.comparePositionTo(modRole) >= 0) {
            return;
        }

        const matches = [];
        for (var filter of filters) {
            if (new RegExp(filter.regex, 'igms').test(message.content)) {
                matches.push(filter);
            }
        }
        if (!matches.length) {
            return;
        }
        const highest = {
            level: null,
            duration: null,
            shouldDelete: null
        };
        const regexes = [];
        for (var match of matches) {
            const level = levels[match.action];
            if (highest.level) {
                if (level > highest.level) {
                    highest.level = level;
                    highest.duration = match.duration;
                    highest.shouldDelete = match.shouldDelete;
                } else if (match.shouldDelete > highest.shouldDelete) {
                    highest.level = level;
                    highest.duration = match.duration;
                    highest.shouldDelete = match.shouldDelete;
                } else if (parseDuration(match.duration, 'ms') > parseDuration(highest.duration, 'ms')) {
                    highest.level = level;
                    highest.duration = match.duration;
                    highest.shouldDelete = match.shouldDelete;
                } else {
                    //do nothing
                }
            } else {
                highest.level = level;
                highest.duration = match.duration;
                highest.shouldDelete = match.shouldDelete;
            }
            regexes.push('`' + new RegExp(match.regex, 'igms').toString() + '`');
        }
        if (highest.level === 2 && !highest.duration) {
            highest.duration = 'infinite';
        }
        let noUrl;
        let url = `https://discord.com/channels/${message.guildId}/`;
        if (highest.shouldDelete) {
            message.delete();
            const filter = m => m.embeds.some(embed => embed.fields.some(field => field.value.includes(message.id)));
            const collected = await message.guild.channels.cache.get(messageLogChannel).awaitMessages({
                filter,
                max: 1,
                time: 10_000,
                error: ['time']
            });
            if (collected.size) {
                url += messageLogChannel + '/' + collected.firstKey();
            } else {
                noUrl = true;
            }
        } else {
            url += `${message.channelId}/${message.id}`;
        }
        const logEmbed = new MessageEmbed()
            .setTitle('Automatic ' + levels[highest.level])
            .setDescription(message.content)
            .addField('User', '<@' + message.author.id + '>')
            .addField('Channel', '<#' + message.channel.id + '>');
        if (highest.level === 2) {
            logEmbed.addField('Duration', highest.duration);
        }
        logEmbed.addField('Matched', '• ' + regexes.join('\n • '));
        if (!noUrl) {
            logEmbed.setURL(url);
        }
        message.guild.channels.cache.get(modLogChannel).send({
            embeds: [
                logEmbed
            ]
        });
        const action = highest.level === 2 ? 'muted for ' + highest.duration : levels[highest.level] + 'ed';
        if (highest.level !== 1) {
            message.guild.channels.cache.get(modChannel).send(`<@${message.author.id}> has been ${action}` + (noUrl ? '.' : ` because of <${url}>.`));
        }
        switch (highest.level) {
            case 1:
                //do nothing
                break;
            case 2: {
                const user = await message.guild.members.fetch(message.author.id);
                user.roles.add(muteRole);
                if (highest.duration !== 'infinite') {
                    const expiry = Date.now() + parseDuration(highest.duration, 'ms');
                    addMuteToDB.run(message.author.id, message.guild.id, expiry);
                }
                break;
            }
            case 3:
                message.member.kick('Automod');
                break;
            case 4:
                message.member.ban({
                    reason: 'Automod'
                });
                break;
        }
    }
}