# UpOrNot Bot

A simple bot that periodically checks (every 5 minutes) whether bots are online
using the webhook url and sends a message to a channel if the online status has
changed (online -> offline or offline -> online).

You're invited to use the instance I run on telegram:
[UpOrNotBot](https://t.me/upornot_bot).

## How to run your own instance

1. Fork this repository
2. Create your own UpOrNot bot instance, using
   [BotFather](https://t.me/botfather).
3. Use free [deno deploy](https://docs.deno.com/deploy/manual/) to host your bot
4. Store `BOT_TOKEN` in the deno deploy secrets
