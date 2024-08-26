import "jsr:@std/dotenv/load";

// Encryption library (you may need to find a suitable one for Deno)
import { decrypt, PASSWORD, ENCRYPTED_FILE } from "./crypto.ts";

// Decrypt and read the JSON file
const encryptedJson = await Deno.readTextFile(ENCRYPTED_FILE);
const decryptedJson = await decrypt(encryptedJson, PASSWORD as string);
const config: Record<string, Record<string, string | number>> = JSON.parse(decryptedJson);

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");

const botOnlineStatus: Record<string, boolean> = {};
for (const bot_name of Object.keys(config)) {
  botOnlineStatus[bot_name] = true;
}

async function sendTelegramMessage(message: string, channel_id: number) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: channel_id,
      text: message,
    }),
  });
  return response.ok;
}

async function checkOtherBots() {
  for (const [bot_name, { webhook_url, channel_id }] of Object.entries(config)) {
    const response = await fetch(webhook_url as string, {method: "POST"});
    const wasOnline = botOnlineStatus[bot_name];
    // should get 403 forbidden if bot is online since we are not using the webhook secret
    const isOtherBotOnline = response.status === 403;
    botOnlineStatus[bot_name] = isOtherBotOnline;
    try {
      if (!wasOnline && isOtherBotOnline) {
        await sendTelegramMessage(`🥳 Bot ${bot_name} is back online!`, channel_id as number);
      } else if (wasOnline && !isOtherBotOnline) {
        await sendTelegramMessage(`💔 Bot ${bot_name} is offline!`, channel_id as number);
      }
    } catch (error) {
      console.error("Error checking other bot:", error);
      if (isOtherBotOnline) {
        botOnlineStatus[bot_name] = false;
        await sendTelegramMessage(`💔 Error checking bot ${bot_name} (error: ${error})`, channel_id as number);
      }
    }
  }
}

// Run the check every 5 minutes
Deno.cron("Check other bots", "*/5 * * * *", () => {
  checkOtherBots();
});
