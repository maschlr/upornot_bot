import { serve } from "https://deno.land/std@0.140.0/http/server.ts";

// Encryption library (you may need to find a suitable one for Deno)
import { RSA } from "https://deno.land/x/encryption_lib@0.1.4/mod.ts";

// Environment variables
const PASSWORD = Deno.env.get("PASSWORD");
const OTHER_BOT_TOKEN = Deno.env.get("OTHER_BOT_TOKEN");

// Decrypt and read the JSON file
const encryptedJson = await Deno.readTextFile("./encrypted_config.json");
const decryptedJson = RSA.Decoding(encryptedJson, PASSWORD);
const config = JSON.parse(decryptedJson);

const BOT_TOKEN = config.BOT_TOKEN;
const CHANNEL_ID = config.CHANNEL_ID;

let isOtherBotOnline = true;

async function sendTelegramMessage(message: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: CHANNEL_ID,
      text: message,
    }),
  });
  return response.ok;
}

async function checkOtherBot() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${OTHER_BOT_TOKEN}/getMe`);
    const wasOnline = isOtherBotOnline;
    isOtherBotOnline = response.ok;

    if (!wasOnline && isOtherBotOnline) {
      await sendTelegramMessage("The other bot is back online!");
    } else if (wasOnline && !isOtherBotOnline) {
      await sendTelegramMessage("The other bot is offline!");
    }
  } catch (error) {
    console.error("Error checking other bot:", error);
    if (isOtherBotOnline) {
      isOtherBotOnline = false;
      await sendTelegramMessage("The other bot is offline!");
    }
  }
}

// Run the check every 5 minutes
setInterval(checkOtherBot, 5 * 60 * 1000);

// Simple server to keep the Deno Deploy instance running
serve(() => new Response("Health check endpoint for Telegram Bot"));
