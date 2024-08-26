import "jsr:@std/dotenv/load";

// Encryption library (you may need to find a suitable one for Deno)
import { decrypt, PASSWORD, ENCRYPTED_FILE } from "./crypto.ts";

// Decrypt and read the JSON file
const encryptedJson = await Deno.readTextFile(ENCRYPTED_FILE);
const decryptedJson = await decrypt(encryptedJson, PASSWORD as string);
const config: Record<string, number> = JSON.parse(decryptedJson);

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");;

const botOnlineStatus: Record<string, boolean> = {};
for (const bot_token of Object.keys(config)) {
  botOnlineStatus[bot_token] = true;
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
  for (const [bot_token, channel_id] of Object.entries(config)) {
    const response = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    const wasOnline = botOnlineStatus[bot_token];
    let isOtherBotOnline = response.ok;
    botOnlineStatus[bot_token] = isOtherBotOnline;
    try {
      if (!wasOnline && isOtherBotOnline) {
        await sendTelegramMessage("Bot is back online!", channel_id);
      } else if (wasOnline && !isOtherBotOnline) {
        await sendTelegramMessage("Bot is offline!", channel_id);
      }
    } catch (error) {
      console.error("Error checking other bot:", error);
      if (isOtherBotOnline) {
        isOtherBotOnline = false;
        await sendTelegramMessage(`Error checking bot (error: ${error}`, channel_id);
      }
    }
  }
}

// Run the check every 5 minutes
Deno.cron("Check other bots", "*/1 * * * *", () => {
  checkOtherBots();
});
