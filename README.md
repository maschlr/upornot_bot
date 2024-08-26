# UpOrNot Bot

A simple bot that checks whether other bots are online and sends a message to a channel if they are not.

Since this check involves the bot tokens of the bots that are being checked, the bot tokens are encrypted and stored in a file that is part of the repository. Storing encrypted data in a public repository could be a security risk. Do this at your own risk.

The purpose of this repository is to be forked. Create your own `config.json` file, add your bot tokens and the channel ids where the health message will be send to.

Create your own health check bot, using [BotFather](https://t.me/botfather) and add the bot token to the `config.json` file.

## Installation

1. Fork this repository
2. `pip install pre-commit` (needed to automatically encrypt the `config.json` file before committing)
3. `pre-commit install` (installs the pre-commit hook)
4. Create your own `config.json` file
5. Store your encryption password and the bot token of your health check bot in the `.env` file
6. Use free [deno deploy](https://docs.deno.com/deploy/manual/) to host your bot
7. Store the same environment variables on deno deploy

## Configuration

`config.json`:

```json
{
    <BOT_NAME_1>: {
        bot_token: <BOT_TOKEN_1>,
        channel_id: <MESSAGE_CHANNEL_ID_1>
    },
    <BOT_NAME_2>: {
        bot_token: <BOT_TOKEN_2>,
        channel_id: <MESSAGE_CHANNEL_ID_2>
    },
    ...
    <BOT_NAME_N>: {
        bot_token: <BOT_TOKEN_N>,
        channel_id: <MESSAGE_CHANNEL_ID_N>
    }
}
```
