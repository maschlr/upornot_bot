import {
  Bot,
  Context,
  webhookCallback,
} from "https://deno.land/x/grammy/mod.ts";
import { type TextMessage } from "https://deno.land/x/grammy/types.ts";
import "https://deno.land/x/dotenv/load.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set");
}

const bot = new Bot(BOT_TOKEN);
const kv = await Deno.openKv();

interface ChatData {
  webhooks: [{ webhookUrl: string; name: string }];
}

interface WebhookData {
  isOnline: boolean;
  chats: number[];
}

const ERROR_CODES = [405, 502];

// Helper function to check if a webhook is online
async function isWebhookOnline(hostnameWithPath: string): Promise<boolean> {
  const url = `http://${hostnameWithPath}`;

  try {
    const response = await fetch(url);
    return ERROR_CODES.includes(response.status);
  } catch {
    return false;
  }
}

// Command handlers
bot.command("start", async (ctx: Context) => {
  await ctx.reply(
    "Welcome! I can help you monitor the online status of your bots. The following commands are available: /add, /list and /del",
  );
});

bot.command("add", async (ctx: Context) => {
  const [webhookUrlInput, name] = (ctx.match as string).split(" ");
  if (!webhookUrlInput) {
    await ctx.reply(
      "Please provide a webhook URL. Usage: /add <webhook_url> [name]",
    );
    return;
  } else if (!ctx.chat) {
    await ctx.reply("Error: Unable to process your request.");
    return;
  }

  // if user inputs url with http:// or http(s)://, remove it (normalize)
  let webhookUrl: string;
  try {
    const url = new URL(webhookUrlInput);
    webhookUrl = `${url.hostname}${url.pathname}`;
  } catch {
    webhookUrl = webhookUrlInput;
  }

  const isOnline = await isWebhookOnline(webhookUrl);
  if (!isOnline) {
    await ctx.reply("The provided webhook is not online or invalid");
    return;
  }

  const webhookKey = ["webhooks", webhookUrl];
  const existingWebhookData = await kv.get(webhookKey);
  if (!existingWebhookData.value) {
    // add new webhook
    const newWebhookData: WebhookData = {
      isOnline: true,
      chats: [ctx.chat.id],
    };
    await kv.set(webhookKey, newWebhookData);
  } else {
    // add chat_id to existing webhook
    const typedValue = existingWebhookData.value as WebhookData;
    typedValue.chats.push(ctx.chat.id);
    await kv.set(webhookKey, typedValue);
  }

  const chatsKey = ["chats", ctx.chat.id];
  const existingChatsData = await kv.get(chatsKey);
  if (existingChatsData.value) {
    const typedValue = existingChatsData.value as ChatData;
    const webhooksInChat = typedValue.webhooks.filter((webhook) =>
      webhook.webhookUrl === webhookUrl
    );
    if (webhooksInChat.length > 0) {
      await ctx.reply(
        "Webhook already configured for this chat. Use /list to see your webhooks or /del to delete them.",
      );
      return;
    } else {
      typedValue.webhooks.push({
        webhookUrl: webhookUrl,
        name: name || webhookUrl,
      });
      await kv.set(chatsKey, typedValue);
      await ctx.reply("Webhook added successfully");
    }
  } else {
    const newChatsData: ChatData = {
      webhooks: [{ webhookUrl: webhookUrl, name: name || webhookUrl }],
    };
    await kv.set(chatsKey, newChatsData);
    await ctx.reply("Webhook added successfully");
  }
});

bot.command("list", async (ctx) => {
  const chatsKey = ["chats", ctx.chat.id];
  const existingChatsData = await kv.get(chatsKey);
  if (!existingChatsData.value) {
    await ctx.reply("You have no registered webhooks.");
    return;
  }
  const typedValue = existingChatsData.value as ChatData;

  let count = 0;
  let message = "Registered webhooks:\n";
  for (const webhook of typedValue.webhooks) {
    const { webhookUrl, name } = webhook;
    const webhookQueryResult = await kv.get(["webhooks", webhookUrl]);
    const webhookData = webhookQueryResult.value as WebhookData;
    const wasOnline = webhookData.isOnline;
    const isOnline = await isWebhookOnline(webhookUrl);
    const statusEmoji = isOnline ? "🟢" : "🔴";
    if (name === webhookUrl) {
      message += `${statusEmoji} ${name}\n`;
    } else {
      message += `${statusEmoji} ${name} (${webhookUrl})\n`;
    }
    count++;

    if (wasOnline !== isOnline) {
      webhookData.isOnline = isOnline;
      await kv.set(["webhooks", webhookUrl], webhookData);
    }
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

  // remove webhook from ChatData
  const existingChatDataQueryResult = await kv.get(["chats", ctx.chat.id]);
  if (existingChatDataQueryResult.value) {
    const chatData = existingChatDataQueryResult.value as ChatData;
    const webhooksInChat = chatData.webhooks.filter((webhook) =>
      webhook.webhookUrl === webhookUrl
    );
    if (webhooksInChat.length === 0) {
      await ctx.reply(
        "Webhook not found in your watchlist. Use /list to see your configured webhooks.",
      );
    } else {
      const webhooksWithoutDeletedOne = chatData.webhooks.filter((webhook) =>
        webhook.webhookUrl !== webhookUrl
      );
      await kv.set(["chats", ctx.chat.id], {
        webhooks: webhooksWithoutDeletedOne,
      });
      await ctx.reply("Webhook removed from your list");
    }
  } else {
    await ctx.reply(
      "Webhook not found in your watchlist. Use /list to see your configured webhooks.",
    );
  }

  // remove webhook from WebhookData
  const existingWebhookDataQueryResult = await kv.get(["webhooks", webhookUrl]);
  if (existingWebhookDataQueryResult.value) {
    const webhookData = existingWebhookDataQueryResult.value as WebhookData;
    const chatsWithWebhook = webhookData.chats.filter((chatId) =>
      chatId !== ctx.chat.id
    );
    if (chatsWithWebhook.length === 0) {
      await kv.delete(["webhooks", webhookUrl]);
    } else {
      await kv.set(["webhooks", webhookUrl], chatsWithWebhook);
    }
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
async function checkBotsOnlineStatus() {
  // docs say that kv.list() has a limit of 1000 items, so this might eventually break
  // https://docs.deno.com/deploy/kv/manual/transactions/#limits
  const webhooks = kv.list({ prefix: ["webhooks"] });
  const promises: Promise<TextMessage>[] = [];
  for await (const entry of webhooks) {
    const webhookUrl = entry.key[1] as string;
    const webhookData = entry.value as WebhookData;
    const wasOnline = webhookData.isOnline;
    const isOnline = await isWebhookOnline(webhookUrl);

    if (wasOnline !== isOnline) {
      webhookData.isOnline = isOnline;
      await kv.set(["webhooks", webhookUrl], webhookData);
    }

    if (!wasOnline && isOnline) {
      for (const chatId of webhookData.chats) {
        promises.push(bot.api.sendMessage(
          chatId,
          `🥳 Bot ${webhookUrl} is back online!`,
        ));
      }
    } else if (wasOnline && !isOnline) {
      for (const chatId of webhookData.chats) {
        promises.push(bot.api.sendMessage(
          chatId,
          `💀 Bot ${webhookUrl} is offline!`,
        ));
      }
    }
  }
  await Promise.all(promises);
}

// Webhook setup for Deno Deploy
const WEBHOOK_URL = Deno.env.get("WEBHOOK_URL");

if (!WEBHOOK_URL) {
  // local environment: long-polling
  await bot.api.deleteWebhook();
  bot.start();
} else {
  // Set the webhook
  await bot.api.setWebhook(WEBHOOK_URL);
  // Start the bot
  // Run the check every 5 minutes
  Deno.cron("Check other bots", "*/5 * * * *", () => {
    checkBotsOnlineStatus();
  });
  Deno.serve(webhookCallback(bot, "std/http"));
}

console.log("Bot is running...");
