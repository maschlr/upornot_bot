import {
  Bot,
  Context,
  InlineKeyboard,
  webhookCallback,
} from "https://deno.land/x/grammy/mod.ts";
import "https://deno.land/x/dotenv/load.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set in the environment variables");
  Deno.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const kv = await Deno.openKv();

// Helper function to check if a webhook is online
async function isWebhookOnline(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.status === 405;
  } catch {
    return false;
  }
}

// Command handlers
bot.command("start", async (ctx: Context) => {
  const keyboard = new InlineKeyboard()
    .text("Add Webhook", "/add")
    .text("List Webhooks", "/list")
    .text("Delete Webhook", "/del");

  await ctx.reply(
    "Welcome! I can help you manage your webhooks. Use the buttons below or type commands:",
    { reply_markup: keyboard },
  );
});
bot.command("add", async (ctx: Context) => {
  const webhookUrl = ctx.match as string;
  if (!webhookUrl) {
    await ctx.reply("Please provide a webhook URL. Usage: /add <webhook_url>");
    return;
  }
  if (ctx.chat && await isWebhookOnline(webhookUrl)) {
    await kv.set(["webhooks", ctx.chat.id, webhookUrl], { url: webhookUrl });
    await kv.set(["status", ctx.chat.id, webhookUrl], true);
    await ctx.reply("Webhook added successfully");
  } else if (!ctx.chat) {
    await ctx.reply("Error: Unable to process your request.");
  } else {
    await ctx.reply("The provided webhook is not online or invalid");
  }
});

bot.command("list", async (ctx) => {
  const webhooks = kv.list({ prefix: ["webhooks", ctx.chat.id] });
  let message = "Registered webhooks:\n";
  let count = 0;
  for await (const entry of webhooks) {
    const webhook = entry.value as { url: string };
    message += `${webhook.url}\n`;
    count++;
  }
  if (count === 0) {
    await ctx.reply("You have no registered webhooks.");
  } else {
    await ctx.reply(message);
  }
});

bot.command("del", async (ctx) => {
  const webhookUrl = ctx.match;
  if (!webhookUrl) {
    await ctx.reply(
      "Please provide a webhook URL to delete. Usage: /del <webhook_url>",
    );
    return;
  }

  await kv.delete(["webhooks", ctx.chat.id, webhookUrl]);
  await kv.delete(["status", ctx.chat.id, webhookUrl]);

  const webhookEntry = await kv.get(["webhooks", ctx.chat.id, webhookUrl]);
  if (webhookEntry.value === null) {
    await ctx.reply("Webhook deleted successfully");
  } else {
    await ctx.reply("Webhook not found or could not be deleted");
  }
});

// Set up the bot commands in the chat interface
await bot.api.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "add", description: "Add a new webhook" },
  { command: "list", description: "List all webhooks" },
  { command: "del", description: "Delete a webhook" },
]);

// Function to check other bots
async function checkOtherBots() {
  const webhooks = kv.list({ prefix: ["webhooks"] });
  for await (const entry of webhooks) {
    const [, chatId, webhookUrl] = entry.key;
    const isOnline = await isWebhookOnline(webhookUrl as string);

    const statusEntry = await kv.get(["status", chatId, webhookUrl]);
    const wasOnline = statusEntry.value as boolean | undefined;

    await kv.set(["status", chatId, webhookUrl], isOnline);

    if (wasOnline === undefined) {
      await bot.api.sendMessage(
        chatId as number,
        `Bot ${String(webhookUrl)} is ${isOnline ? "online" : "offline"}.`,
      );
    } else if (!wasOnline && isOnline) {
      await bot.api.sendMessage(
        chatId as number,
        `🥳 Bot ${String(webhookUrl)} is back online!`,
      );
    } else if (wasOnline && !isOnline) {
      await bot.api.sendMessage(
        chatId as number,
        `💀 Bot ${String(webhookUrl)} is offline!`,
      );
    }
  }
}

// Run the check every 5 minutes
Deno.cron("Check other bots", "*/5 * * * *", () => {
  checkOtherBots();
});

// Webhook setup for Deno Deploy
const WEBHOOK_URL =  Deno.env.get("WEBHOOK_URL");

if (!WEBHOOK_URL) {
  // local environment: long-polling
  bot.start();
} else {
  // Set the webhook
  await bot.api.setWebhook(WEBHOOK_URL);
  // Start the bot
  Deno.serve(webhookCallback(bot, "std/http"));
}

console.log("Bot is running...");
