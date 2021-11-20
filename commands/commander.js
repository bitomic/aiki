const { SlashCommandBuilder } = require('@discordjs/builders');
const shell = require('shelljs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commander')
        .setDescription('Controls the bot')
        .addSubCommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Updates the bot')
        )
        .addSubCommand(subcommand =>
            subcommand
                .setName('revert')
                .setDescription('Reverts last update')
        )
        .addSubCommand(subcommand =>
            subcommand
                .setName('exec')
                .setDescription('Executes a command')
                .addStringOption(option =>
                    option
                        .setName('command')
                        .setDescription('The command to run')
                        .setRequired(true)
                )
        ),
    async execute (interaction) {
        await interaction.deferReply();
        const command = interaction.options.getSubcommand() === 'exec' ? 'exec ' + interaction.options.getString('command') : interaction.options.getSubcommand();
        shell.exec('pm2 deploy aiki ' + command, function (code, stdout, stderr) {
            interaction.reply('Exit code: ', code);
            interaction.followUp('Program output: ', stdout);
            interaction.followUp('Program stderr: ', stderr);
        });
    }
}