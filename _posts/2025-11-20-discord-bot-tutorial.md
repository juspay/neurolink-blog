---
layout: post
title: Building AI Discord Bots with NeuroLink
description: >-
  Build intelligent Discord bots with NeuroLink. Slash commands, conversations,
  and server automation.
date: '2025-11-20 10:00:00 +0530'
last_updated: 2026-01-15T00:00:00.000Z
categories:
  - Tutorial
  - Integration
tags:
  - discord
  - bot
  - chatbot
  - community
  - automation
author: neurolink
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/discord-bot-tutorial/hero.png
  alt: Building AI Discord Bots with NeuroLink
---

You will build a fully-featured AI Discord bot using Discord.js and NeuroLink's generation API. By the end of this tutorial, you will have slash commands, multi-turn conversations, AI-powered moderation, and production deployment -- all using NeuroLink as the AI backend.

> **Tip:** This tutorial builds a custom Discord bot from scratch. NeuroLink does not provide a built-in Discord integration -- you will build the bot infrastructure yourself using Discord.js, with NeuroLink handling AI generation.
{: .prompt-tip }

## External Dependencies

This tutorial requires several npm packages for building Discord bots:

```bash
npm install @juspay/neurolink discord.js
npm install dotenv
npm install -D typescript @types/node ts-node nodemon
```

**Required Packages:**

- `@juspay/neurolink` - NeuroLink SDK for AI generation
- `discord.js` (v14.x) - Discord's official JavaScript library
- `dotenv` - Environment variable management
- `typescript` and `@types/node` - TypeScript support
- `ts-node` and `nodemon` - Development tools

## Prerequisites

Before we begin, ensure you have the following:

- **Node.js 18+** installed
- **A Discord account** with a test server where you have admin permissions
- **NeuroLink API key** (sign up at neurolink.ink)
- **Required packages** (see External Dependencies section above)
- Basic familiarity with JavaScript/TypeScript and async/await
- A code editor of your choice

> **Important**: This tutorial uses Discord.js v14.x. If you're upgrading from v13 or earlier, review the [Discord.js v14 migration guide](https://discordjs.guide/additional-info/changes-in-v14.html).

## Setting Up Your Discord Application

First, we need to create a Discord application and bot user through the Discord Developer Portal.

### Creating the Application

1. Navigate to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "NeuroLink Assistant")
3. Navigate to the "Bot" section in the left sidebar
4. Click "Add Bot" and confirm

### Configuring Bot Permissions

Under the Bot section, configure these essential settings:

```text
Privileged Gateway Intents:
- MESSAGE CONTENT INTENT: Enabled (required for reading messages)
- SERVER MEMBERS INTENT: Enabled (if tracking member events)
- PRESENCE INTENT: Optional (for user status features)
```

### Generating the Invite URL

Navigate to OAuth2 > URL Generator and select:

- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Send Messages`, `Read Message History`, `Use Slash Commands`, `Embed Links`, `Attach Files`

Copy the generated URL and use it to invite your bot to your test server.

## Project Setup

Let's initialize our project and install the necessary dependencies.

```bash
mkdir neurolink-discord-bot
cd neurolink-discord-bot
npm init -y
```

Install the required packages:

```bash
npm install discord.js @juspay/neurolink dotenv
npm install -D typescript @types/node ts-node nodemon
```

Initialize TypeScript:

```bash
npx tsc --init
```

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Project Structure

Organize your project with a clean structure:

```text
neurolink-discord-bot/
├── src/
│   ├── index.ts           # Main entry point
│   ├── config.ts          # Configuration
│   ├── commands/          # Slash commands
│   │   ├── index.ts
│   │   ├── ask.ts
│   │   ├── chat.ts
│   │   └── summarize.ts
│   ├── events/            # Discord event handlers
│   │   ├── ready.ts
│   │   └── interactionCreate.ts
│   ├── services/          # NeuroLink integration
│   │   ├── neurolink.ts
│   │   └── conversation.ts
│   └── utils/             # Helper functions
│       ├── embed.ts
│       └── logger.ts
├── .env
├── package.json
└── tsconfig.json
```

## Environment Configuration

Create a `.env` file in your project root:

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_application_client_id
NEUROLINK_API_KEY=your_neurolink_api_key
```

Create `src/config.ts`:

```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID!,
  },
  neurolink: {
    apiKey: process.env.NEUROLINK_API_KEY!,
  },
};

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'NEUROLINK_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

## NeuroLink Service Integration

Create the NeuroLink service layer in `src/services/neurolink.ts`:

```typescript
import { NeuroLink } from '@juspay/neurolink';
import { config } from '../config';

const neurolink = new NeuroLink();

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function generateResponse(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const {
    systemPrompt = 'You are a helpful Discord bot assistant. Be concise, friendly, and informative.',
    maxTokens = 1000,
    temperature = 0.7,
  } = options;

  try {
    const result = await neurolink.generate({
      input: { text: prompt },
      systemPrompt,
      provider: 'openai',
      model: 'gpt-4o-mini',
      maxTokens,
      temperature,
    });

    return result?.content ?? 'I could not generate a response.';
  } catch (error) {
    console.error('NeuroLink API error:', error);
    throw new Error('Failed to generate AI response');
  }
}

export async function generateChatResponse(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  // Build conversation text from message history
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n');

  try {
    const result = await neurolink.generate({
      input: { text: conversationText },
      systemPrompt: systemPrompt || 'You are a helpful assistant.',
      provider: 'openai',
      model: 'gpt-4o-mini',
      maxTokens: 1000,
      temperature: 0.7,
    });

    return result?.content ?? 'I could not generate a response.';
  } catch (error) {
    console.error('NeuroLink API error:', error);
    throw new Error('Failed to generate AI response');
  }
}

export async function summarizeText(text: string): Promise<string> {
  return generateResponse(text, {
    systemPrompt: 'Summarize the following text concisely while preserving key information.',
    maxTokens: 500,
    temperature: 0.3,
  });
}
```

## Conversation Management

For multi-turn conversations, we need to track message history. Create `src/services/conversation.ts`:

```typescript
import { ChatMessage } from './neurolink';

interface Conversation {
  messages: ChatMessage[];
  lastActivity: number;
  channelId: string;
  userId: string;
}

class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private readonly maxMessages = 20;
  private readonly timeoutMs = 30 * 60 * 1000; // 30 minutes

  private getKey(userId: string, channelId: string): string {
    return `${userId}-${channelId}`;
  }

  getConversation(userId: string, channelId: string): ChatMessage[] {
    const key = this.getKey(userId, channelId);
    const conversation = this.conversations.get(key);

    if (!conversation) {
      return [];
    }

    // Check if conversation has expired
    if (Date.now() - conversation.lastActivity > this.timeoutMs) {
      this.conversations.delete(key);
      return [];
    }

    return conversation.messages;
  }

  addMessage(userId: string, channelId: string, message: ChatMessage): void {
    const key = this.getKey(userId, channelId);
    let conversation = this.conversations.get(key);

    if (!conversation) {
      conversation = {
        messages: [],
        lastActivity: Date.now(),
        channelId,
        userId,
      };
      this.conversations.set(key, conversation);
    }

    conversation.messages.push(message);
    conversation.lastActivity = Date.now();

    // Trim old messages if exceeding limit
    if (conversation.messages.length > this.maxMessages) {
      conversation.messages = conversation.messages.slice(-this.maxMessages);
    }
  }

  clearConversation(userId: string, channelId: string): void {
    const key = this.getKey(userId, channelId);
    this.conversations.delete(key);
  }

  // Cleanup expired conversations periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity > this.timeoutMs) {
        this.conversations.delete(key);
      }
    }
  }
}

export const conversationManager = new ConversationManager();

// Run cleanup every 10 minutes
setInterval(() => conversationManager.cleanup(), 10 * 60 * 1000);
```

## Creating Slash Commands

### Command Registration

Create `src/commands/index.ts` to handle command registration:

```typescript
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../config';

export const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the AI a question')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Your question for the AI')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Have a conversation with the AI')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Your message to the AI')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize recent channel messages')
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of messages to summarize (default: 20)')
        .setMinValue(5)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear your conversation history with the AI'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and how to use them'),
];

export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(config.discord.token);

  try {
    console.log('Registering slash commands...');

    await rest.put(Routes.applicationCommands(config.discord.clientId), {
      body: commands.map((cmd) => cmd.toJSON()),
    });

    console.log('Slash commands registered successfully!');
  } catch (error) {
    console.error('Error registering commands:', error);
    throw error;
  }
}
```

### Ask Command

Create `src/commands/ask.ts`:

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { generateResponse } from '../services/neurolink';

export async function handleAskCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const question = interaction.options.getString('question', true);

  await interaction.deferReply();

  try {
    const response = await generateResponse(question);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('AI Response')
      .setDescription(response)
      .setFooter({
        text: `Asked by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in ask command:', error);
    await interaction.editReply({
      content: 'Sorry, I encountered an error while processing your question. Please try again.',
    });
  }
}
```

### Chat Command with Conversation History

Create `src/commands/chat.ts`:

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { generateChatResponse, ChatMessage } from '../services/neurolink';
import { conversationManager } from '../services/conversation';

const CHAT_SYSTEM_PROMPT = `You are a friendly and helpful Discord bot assistant named NeuroBot.
You can engage in natural conversations, answer questions, help with coding, and provide information.
Keep responses concise but informative. Use markdown formatting when appropriate.
Remember context from previous messages in the conversation.`;

export async function handleChatCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const message = interaction.options.getString('message', true);
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  await interaction.deferReply();

  try {
    // Get existing conversation history
    const history = conversationManager.getConversation(userId, channelId);

    // Add user's new message
    const userMessage: ChatMessage = { role: 'user', content: message };
    conversationManager.addMessage(userId, channelId, userMessage);

    // Generate response with full history
    const response = await generateChatResponse(
      [...history, userMessage],
      CHAT_SYSTEM_PROMPT
    );

    // Store assistant's response in history
    conversationManager.addMessage(userId, channelId, {
      role: 'assistant',
      content: response,
    });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(response)
      .setFooter({
        text: `Conversation with ${interaction.user.username} | Use /clear to reset`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in chat command:', error);
    await interaction.editReply({
      content: 'Sorry, I encountered an error. Please try again.',
    });
  }
}
```

### Summarize Command

Create `src/commands/summarize.ts`:

```typescript
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
  ChannelType,
} from 'discord.js';
import { summarizeText } from '../services/neurolink';

export async function handleSummarizeCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const count = interaction.options.getInteger('count') || 20;

  if (interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'This command can only be used in text channels.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const channel = interaction.channel as TextChannel;
    const messages = await channel.messages.fetch({ limit: count });

    // Filter out bot messages and format for summarization
    const humanMessages = messages
      .filter((msg) => !msg.author.bot && msg.content.length > 0)
      .reverse()
      .map((msg) => `${msg.author.username}: ${msg.content}`)
      .join('\n');

    if (!humanMessages) {
      await interaction.editReply({
        content: 'No messages found to summarize.',
      });
      return;
    }

    const summary = await summarizeText(humanMessages);

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`Summary of Last ${count} Messages`)
      .setDescription(summary)
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in summarize command:', error);
    await interaction.editReply({
      content: 'Sorry, I could not summarize the messages. Please try again.',
    });
  }
}
```

## Event Handlers

### Ready Event

Create `src/events/ready.ts`:

```typescript
import { Client, ActivityType } from 'discord.js';

export function handleReady(client: Client<true>): void {
  console.log(`Bot is online as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} server(s)`);

  // Set bot status
  client.user.setPresence({
    activities: [
      {
        name: '/help for commands',
        type: ActivityType.Listening,
      },
    ],
    status: 'online',
  });
}
```

### Interaction Handler

Create `src/events/interactionCreate.ts`:

```typescript
import { Interaction, EmbedBuilder } from 'discord.js';
import { handleAskCommand } from '../commands/ask';
import { handleChatCommand } from '../commands/chat';
import { handleSummarizeCommand } from '../commands/summarize';
import { conversationManager } from '../services/conversation';

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'ask':
        await handleAskCommand(interaction);
        break;

      case 'chat':
        await handleChatCommand(interaction);
        break;

      case 'summarize':
        await handleSummarizeCommand(interaction);
        break;

      case 'clear':
        conversationManager.clearConversation(
          interaction.user.id,
          interaction.channelId
        );
        await interaction.reply({
          content: 'Your conversation history has been cleared!',
          ephemeral: true,
        });
        break;

      case 'help':
        await handleHelpCommand(interaction);
        break;

      default:
        await interaction.reply({
          content: 'Unknown command.',
          ephemeral: true,
        });
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);

    const errorMessage = 'An error occurred while processing your command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleHelpCommand(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('NeuroLink Bot Commands')
    .setDescription('Here are all available commands:')
    .addFields(
      {
        name: '/ask <question>',
        value: 'Ask a one-off question to the AI',
      },
      {
        name: '/chat <message>',
        value: 'Have a conversation with the AI (remembers context)',
      },
      {
        name: '/summarize [count]',
        value: 'Summarize recent messages in the channel',
      },
      {
        name: '/clear',
        value: 'Clear your conversation history',
      },
      {
        name: '/help',
        value: 'Show this help message',
      }
    )
    .setFooter({ text: 'Powered by NeuroLink AI' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
```

## Main Entry Point

Create `src/index.ts`:

```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { registerCommands } from './commands';
import { handleReady } from './events/ready';
import { handleInteraction } from './events/interactionCreate';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// Event handlers
client.once('ready', (c) => handleReady(c));
client.on('interactionCreate', handleInteraction);

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Start the bot
async function main(): Promise<void> {
  try {
    await registerCommands();
    await client.login(config.discord.token);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
```

## Adding Advanced Features

### Rate Limiting

Protect your API usage with rate limiting. Create `src/utils/rateLimiter.ts`:

```typescript
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isRateLimited(userId: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(userId);

    if (!entry || now > entry.resetTime) {
      this.limits.set(userId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return false;
    }

    if (entry.count >= this.maxRequests) {
      return true;
    }

    entry.count++;
    return false;
  }

  getRemainingTime(userId: string): number {
    const entry = this.limits.get(userId);
    if (!entry) return 0;
    return Math.max(0, entry.resetTime - Date.now());
  }
}

export const rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
```

### Streaming Responses

For long responses, implement streaming updates:

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { NeuroLink } from '@juspay/neurolink';

export async function handleStreamingResponse(
  interaction: ChatInputCommandInteraction,
  prompt: string
): Promise<void> {
  await interaction.deferReply();

  const neurolink = new NeuroLink();

  let fullResponse = '';
  let lastUpdate = Date.now();
  const updateInterval = 1500; // Update every 1.5 seconds

  const result = await neurolink.stream({
    input: { text: prompt },
    systemPrompt: 'You are a helpful Discord bot assistant.',
    provider: 'openai',
    model: 'gpt-4o',
  });

  for await (const chunk of result.stream) {
    if ('content' in chunk) {
      fullResponse += chunk.content;
    }

    // Update message periodically to avoid rate limits
    if (Date.now() - lastUpdate > updateInterval) {
      const embed = new EmbedBuilder()
        .setDescription(fullResponse + ' ...')
        .setColor(0x5865f2);

      await interaction.editReply({ embeds: [embed] });
      lastUpdate = Date.now();
    }
  }

  // Final update
  const finalEmbed = new EmbedBuilder()
    .setDescription(fullResponse)
    .setColor(0x57f287)
    .setFooter({ text: 'Response complete' });

  await interaction.editReply({ embeds: [finalEmbed] });
}
```

### Message-Based Triggers

Add automatic responses to @mentions:

```typescript
// Add to src/index.ts
client.on('messageCreate', async (message) => {
  // Ignore bots and messages without mentions
  if (message.author.bot) return;
  if (!message.mentions.has(client.user!)) return;

  // Remove the mention from the message
  const content = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!content) {
    await message.reply('How can I help you? Ask me anything!');
    return;
  }

  try {
    await message.channel.sendTyping();

    const response = await generateResponse(content, {
      systemPrompt: 'You are a helpful Discord bot. Keep responses brief and friendly.',
      maxTokens: 500,
    });

    await message.reply(response);
  } catch (error) {
    console.error('Error responding to mention:', error);
    await message.reply('Sorry, I encountered an error. Please try again.');
  }
});
```

## Deployment

### Package Scripts

Update `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon --exec ts-node src/index.ts",
    "register": "ts-node src/commands/index.ts"
  }
}
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  bot:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### Cloud Deployment Options

**Railway:**

```bash
railway login
railway init
railway up
```

**Fly.io:**

```bash
fly launch
fly secrets set DISCORD_TOKEN=xxx NEUROLINK_API_KEY=xxx
fly deploy
```

**DigitalOcean App Platform:**

1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Deploy with automatic scaling

## Best Practices

### Error Handling

Always wrap API calls in try-catch blocks and provide user-friendly error messages:

```typescript
try {
  const response = await generateResponse(prompt);
  await interaction.editReply({ content: response });
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    await interaction.editReply({
      content: 'I\'m receiving too many requests. Please wait a moment.',
    });
  } else {
    await interaction.editReply({
      content: 'Something went wrong. Please try again later.',
    });
  }
  console.error('API Error:', error);
}
```

### Security Considerations

1. **Never expose API keys** - Use environment variables
2. **Validate user input** - Sanitize before sending to APIs
3. **Implement rate limiting** - Prevent abuse
4. **Use ephemeral messages** - For sensitive responses
5. **Log responsibly** - Don't log user messages in production

### Performance Optimization

1. **Cache frequently used data** - Reduce API calls
2. **Use connection pooling** - For database connections
3. **Implement request queuing** - Handle traffic spikes
4. **Monitor response times** - Set up alerting
5. **Request cancellation** - Use AbortController for timeout handling

> **Note:** Timeout-based cancellation is available via the `timeout` parameter in NeuroLink.

## Testing Your Bot

Create a simple test script:

```typescript
// src/test.ts
import { generateResponse } from './services/neurolink';

async function test() {
  console.log('Testing NeuroLink integration...');

  const response = await generateResponse('What is Discord?');
  console.log('Response:', response);

  console.log('Test completed successfully!');
}

test().catch(console.error);
```

Run with: `npx ts-node src/test.ts`

## What You Built

You built an AI Discord bot with slash commands, multi-turn conversations, thread summarization, and mention responses using Discord.js and NeuroLink's generation API. The bot handles natural language queries, maintains conversation context per thread, and provides AI-powered moderation and analysis.

Continue with these related tutorials:

- [Building a Slack Bot with AI](/posts/building-slack-bot-with-ai/) for similar patterns on a different platform
- [MCP Server Tutorial](/posts/mcp-server-tutorial/) for exposing your bot's capabilities as reusable AI tools
- Speech-to-Text with NeuroLink for adding voice capabilities to voice channels

## Resources

- [Discord.js Documentation](https://discord.js.org/)
- [NeuroLink API Documentation](https://docs.neurolink.ink/)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Example Repository](https://github.com/neurolink/discord-bot-example)

---

*Have questions about building Discord bots with NeuroLink? Join our [Discord community](https://discord.gg/neurolink) or reach out on [Twitter](https://twitter.com/neurolink).*

---

**Related posts:**

- [Building AI Slack Bots with NeuroLink](/posts/slack-bot-tutorial/)
- [Building a Slack Bot with AI: Complete Guide](/posts/building-slack-bot-with-ai/)
- [Function Calling: AI Tool Use Patterns with NeuroLink](/posts/function-calling-patterns/)
