---
layout: post
title: Building AI Slack Bots with NeuroLink
date: '2025-11-15 10:00:00 +0530'
categories:
  - Tutorial
  - Integration
tags:
  - slack
  - bot
  - chatbot
  - workspace
  - automation
description: >-
  Build intelligent Slack bots with NeuroLink. Commands, conversations, and
  workspace automation.
author: neurolink
toc: true
mermaid: false
pin: false
image:
  path: /assets/img/posts/slack-bot-tutorial/hero.png
  alt: Building AI Slack Bots with NeuroLink
---

You will build an AI-powered Slack bot using the Slack Bolt framework and NeuroLink's generation API. By the end of this tutorial, you will have a production-ready bot that responds to natural language queries, analyzes sentiment, summarizes threads, and routes requests to the right team members.

> **Tip:** This tutorial builds a custom Slack bot from scratch. NeuroLink does not provide a built-in Slack integration -- you will build the webhook handlers and event listeners yourself using Bolt, with NeuroLink handling the AI generation.
{: .prompt-tip }

Now you will set up the Slack application, install dependencies, and configure the Bolt framework.

## External Dependencies

This tutorial requires several npm packages for building Slack bots:

```bash
npm install @juspay/neurolink @slack/bolt
npm install dotenv
npm install -D typescript @types/node ts-node nodemon
```

**Required Packages:**

- `@juspay/neurolink` - NeuroLink SDK for AI generation
- `@slack/bolt` - Slack's official framework for building apps
- `dotenv` - Environment variable management
- `typescript` and `@types/node` - TypeScript support
- `ts-node` and `nodemon` - Development tools

## Prerequisites

Before we begin, ensure you have:

- **Node.js 20.18.1+** installed
- **A Slack workspace** where you have admin permissions
- **NeuroLink account** with API access
- **Required packages** (see External Dependencies section above)
- Basic familiarity with JavaScript and async/await patterns
- A code editor of your choice

## Part 1: Setting Up Your Slack Application

### Creating the Slack App

First, navigate to the Slack API portal at api.slack.com/apps and click "Create New App." Select "From scratch" and provide a name for your bot. Choose the workspace where you'll develop and test.

After creation, you'll land on the Basic Information page. Keep this tab open as we'll need several values from here.

### Configuring OAuth Scopes

Navigate to "OAuth & Permissions" in the sidebar. Scroll to "Scopes" and add the following Bot Token Scopes:

```text
app_mentions:read    - Allows your bot to read messages that mention it
chat:write           - Enables sending messages
channels:history     - Read message history in public channels
channels:read        - View basic channel information
groups:history       - Read message history in private channels
groups:read          - View basic private channel information
im:history           - Read direct message history
im:read              - View basic direct message information
im:write             - Send direct messages
users:read           - View user information
commands             - Add slash commands
```

These scopes give your bot the permissions it needs to receive messages, respond appropriately, and interact with users.

### Setting Up Event Subscriptions

Navigate to "Event Subscriptions" and toggle it on. You'll need to provide a Request URL later once your server is running. For now, subscribe to the following bot events:

```text
app_mention          - When someone mentions your bot
message.channels     - Messages in public channels
message.groups       - Messages in private channels
message.im           - Direct messages to your bot
```

### Enabling Socket Mode

For development, Socket Mode allows your bot to receive events without exposing a public URL. Go to "Socket Mode" in the sidebar and enable it. Create an app-level token with the `connections:write` scope and save this token securely.

### Installing the App

Return to "OAuth & Permissions" and click "Install to Workspace." Authorize the requested permissions. After installation, copy the Bot User OAuth Token that appears. You'll need both this token and the app-level token for your application.

## Part 2: Project Setup and Dependencies

### Initializing the Project

Create a new directory for your project and initialize it:

```bash
mkdir neurolink-slack-bot
cd neurolink-slack-bot
npm init -y
```

### Installing Dependencies

Install the required packages:

```bash
npm install @slack/bolt @juspay/neurolink dotenv winston
npm install --save-dev nodemon typescript @types/node
```

The packages serve these purposes:

- **@slack/bolt**: Slack's official framework for building apps
- **@juspay/neurolink**: NeuroLink's SDK for AI capabilities
- **dotenv**: Environment variable management
- **winston**: Logging framework for production

### Environment Configuration

Create a `.env` file in your project root:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
OPENAI_API_KEY=your-openai-api-key
LOG_LEVEL=info
```

Replace the placeholder values with your actual credentials. Never commit this file to version control.

> **Note**: This tutorial uses Socket Mode, which doesn't require `SLACK_SIGNING_SECRET` for request verification. Socket Mode establishes a WebSocket connection for real-time events, eliminating the need for signature verification. If you were using HTTP mode with webhooks instead, you would need to add `SLACK_SIGNING_SECRET=your-signing-secret` and implement signature verification in your request handlers.

### Project Structure

Organize your project with this structure:

```text
neurolink-slack-bot/
├── src/
│   ├── index.js
│   ├── neurolink.js
│   ├── handlers/
│   │   ├── commands.js
│   │   ├── messages.js
│   │   └── events.js
│   └── utils/
│       ├── logger.js
│       └── formatters.js
├── .env
├── .gitignore
└── package.json
```

## Part 3: Core Application Setup

### Creating the Logger

Start with a robust logging utility in `src/utils/logger.js`:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;
```

### Initializing NeuroLink

Create the NeuroLink integration in `src/neurolink.js`:

```javascript
const { NeuroLink } = require('@juspay/neurolink');
const logger = require('./utils/logger');

const neurolink = new NeuroLink();

async function generateResponse(prompt, context = {}) {
  try {
    const result = await neurolink.generate({
      input: { text: prompt },
      systemPrompt: `You are an intelligent assistant integrated into a Slack workspace.
          Be helpful, concise, and professional. Format responses appropriately for Slack
          using markdown when helpful. Keep responses focused and actionable.`,
      provider: 'openai',
      model: 'gpt-4o'  // Specify model directly - NeuroLink doesn't use env vars for model selection
    });

    return result.content;
  } catch (error) {
    logger.error('NeuroLink API error:', error);
    throw new Error('Failed to generate AI response');
  }
}

async function analyzeMessage(message, analysisType) {
  const prompts = {
    sentiment: `Analyze the sentiment of this message and respond with one word: positive, negative, or neutral.\n\nMessage: "${message}"`,
    summary: `Summarize this message in one concise sentence:\n\n"${message}"`,
    actionItems: `Extract any action items from this message. List them as bullet points. If none exist, respond with "No action items found."\n\n"${message}"`
  };

  return generateResponse(prompts[analysisType] || prompts.summary);
}

module.exports = { generateResponse, analyzeMessage };
```

### Main Application Entry Point

Create the main application in `src/index.js`:

```javascript
require('dotenv').config();
const { App } = require('@slack/bolt');
const logger = require('./utils/logger');
const { setupCommands } = require('./handlers/commands');
const { setupMessageHandlers } = require('./handlers/messages');
const { setupEventHandlers } = require('./handlers/events');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

// Register all handlers
setupCommands(app);
setupMessageHandlers(app);
setupEventHandlers(app);

// Global error handler
app.error(async (error) => {
  logger.error('Slack app error:', error);
});

// Start the application
(async () => {
  await app.start();
  logger.info('NeuroLink Slack Bot is running!');
})();
```

## Part 4: Implementing Slash Commands

Slash commands provide a clean interface for users to interact with your bot. Create `src/handlers/commands.js`:

```javascript
const { generateResponse, analyzeMessage } = require('../neurolink');
const logger = require('../utils/logger');

function setupCommands(app) {
  // Ask the AI a question
  app.command('/ask', async ({ command, ack, respond }) => {
    await ack();

    try {
      const question = command.text;

      if (!question) {
        await respond('Please provide a question. Usage: `/ask your question here`');
        return;
      }

      await respond({
        response_type: 'ephemeral',
        text: 'Thinking...'
      });

      const answer = await generateResponse(question);

      await respond({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Question:* ${question}`
            }
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Answer:*\n${answer}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Asked by <@${command.user_id}> | Powered by NeuroLink`
              }
            ]
          }
        ]
      });
    } catch (error) {
      logger.error('Error in /ask command:', error);
      await respond('Sorry, I encountered an error processing your question. Please try again.');
    }
  });

  // Summarize a message or text
  app.command('/summarize', async ({ command, ack, respond }) => {
    await ack();

    try {
      const text = command.text;

      if (!text) {
        await respond('Please provide text to summarize. Usage: `/summarize your text here`');
        return;
      }

      const summary = await analyzeMessage(text, 'summary');

      await respond({
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Summary:*\n${summary}`
            }
          }
        ]
      });
    } catch (error) {
      logger.error('Error in /summarize command:', error);
      await respond('Sorry, I could not generate a summary. Please try again.');
    }
  });

  // Extract action items
  app.command('/actions', async ({ command, ack, respond }) => {
    await ack();

    try {
      const text = command.text;

      if (!text) {
        await respond('Please provide text to extract actions from. Usage: `/actions meeting notes or message`');
        return;
      }

      const actions = await analyzeMessage(text, 'actionItems');

      await respond({
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Action Items:*\n${actions}`
            }
          }
        ]
      });
    } catch (error) {
      logger.error('Error in /actions command:', error);
      await respond('Sorry, I could not extract action items. Please try again.');
    }
  });

  // Help command
  app.command('/aihelp', async ({ ack, respond }) => {
    await ack();

    await respond({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'NeuroLink Bot Commands'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Available Commands:*'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '`/ask [question]` - Ask the AI any question\n`/summarize [text]` - Get a summary of text\n`/actions [text]` - Extract action items\n`/aihelp` - Show this help message'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Tips:*\n• Mention @NeuroLinkBot in any channel for conversational AI\n• DM the bot for private conversations\n• React with :brain: to get AI insights on any message'
          }
        }
      ]
    });
  });
}

module.exports = { setupCommands };
```

Don't forget to register these commands in your Slack app settings under "Slash Commands."

## Part 5: Handling Conversations

Conversational interactions make your bot feel more natural. Create `src/handlers/messages.js`:

```javascript
const { generateResponse } = require('../neurolink');
const logger = require('../utils/logger');

// Store conversation history per user
const conversationHistory = new Map();

function getConversationContext(userId) {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  return conversationHistory.get(userId);
}

function addToConversation(userId, role, content) {
  const history = getConversationContext(userId);
  history.push({ role, content });

  // Keep only last 10 messages for context
  if (history.length > 10) {
    history.shift();
  }
}

function setupMessageHandlers(app) {
  // Handle direct messages
  app.message(async ({ message, say, client }) => {
    // Ignore bot messages
    if (message.bot_id || message.subtype) return;

    // Only respond to DMs
    const conversationInfo = await client.conversations.info({
      channel: message.channel
    });

    if (!conversationInfo.channel.is_im) return;

    try {
      const userId = message.user;
      const userMessage = message.text;

      // Add user message to history
      addToConversation(userId, 'user', userMessage);

      // Get conversation context
      const context = getConversationContext(userId);

      // Build prompt with context
      const contextPrompt = context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const response = await generateResponse(
        `Previous conversation:\n${contextPrompt}\n\nRespond to the latest message naturally and helpfully.`
      );

      // Add bot response to history
      addToConversation(userId, 'assistant', response);

      await say(response);
    } catch (error) {
      logger.error('Error handling DM:', error);
      await say('Sorry, I encountered an error. Please try again.');
    }
  });

  // Handle app mentions
  app.event('app_mention', async ({ event, say, client }) => {
    try {
      // Remove the bot mention from the message
      const botUserId = (await client.auth.test()).user_id;
      const cleanMessage = event.text.replace(`<@${botUserId}>`, '').trim();

      if (!cleanMessage) {
        await say({
          thread_ts: event.ts,
          text: "Hi! How can I help you? Ask me anything or use `/aihelp` to see available commands."
        });
        return;
      }

      // Get thread context if replying in a thread
      let contextMessages = [];
      if (event.thread_ts) {
        const replies = await client.conversations.replies({
          channel: event.channel,
          ts: event.thread_ts,
          limit: 10
        });

        contextMessages = replies.messages
          .filter(msg => !msg.bot_id)
          .map(msg => msg.text)
          .join('\n');
      }

      const prompt = contextMessages
        ? `Thread context:\n${contextMessages}\n\nQuestion: ${cleanMessage}`
        : cleanMessage;

      const response = await generateResponse(prompt);

      await say({
        thread_ts: event.thread_ts || event.ts,
        text: response
      });
    } catch (error) {
      logger.error('Error handling mention:', error);
      await say({
        thread_ts: event.ts,
        text: 'Sorry, I encountered an error processing your request.'
      });
    }
  });
}

module.exports = { setupMessageHandlers };
```

## Part 6: Advanced Event Handling

Create `src/handlers/events.js` for handling reactions and other events:

```javascript
const { analyzeMessage, generateResponse } = require('../neurolink');
const logger = require('../utils/logger');

function setupEventHandlers(app) {
  // React to :brain: emoji to provide AI insights
  app.event('reaction_added', async ({ event, client }) => {
    if (event.reaction !== 'brain') return;

    try {
      // Get the message that was reacted to
      const result = await client.conversations.history({
        channel: event.item.channel,
        latest: event.item.ts,
        inclusive: true,
        limit: 1
      });

      if (!result.messages || result.messages.length === 0) return;

      const originalMessage = result.messages[0].text;

      // Generate insights
      const insights = await generateResponse(
        `Provide brief, helpful insights about this message. Include any relevant suggestions or observations:\n\n"${originalMessage}"`
      );

      // Reply in thread
      await client.chat.postMessage({
        channel: event.item.channel,
        thread_ts: event.item.ts,
        text: `*AI Insights:*\n${insights}`
      });
    } catch (error) {
      logger.error('Error handling reaction:', error);
    }
  });

  // Handle channel join to introduce the bot
  app.event('member_joined_channel', async ({ event, client }) => {
    // Only respond if the bot itself joined
    const botInfo = await client.auth.test();
    if (event.user !== botInfo.user_id) return;

    try {
      await client.chat.postMessage({
        channel: event.channel,
        text: `Hello! I'm NeuroLink Bot, your AI assistant. Here's what I can do:\n\n• Ask me questions by mentioning me: @NeuroLinkBot\n• Use \`/ask\` for quick questions\n• Use \`/summarize\` to condense text\n• Use \`/actions\` to extract action items\n• React with :brain: to any message for AI insights\n\nType \`/aihelp\` for more information!`
      });
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  });

  // Handle message shortcuts (from message actions menu)
  app.shortcut('analyze_message', async ({ shortcut, ack, client }) => {
    await ack();

    try {
      const messageText = shortcut.message.text;

      // Open a modal with analysis options
      await client.views.open({
        trigger_id: shortcut.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'analysis_modal',
          private_metadata: JSON.stringify({
            channel: shortcut.channel.id,
            message_ts: shortcut.message.ts,
            message_text: messageText
          }),
          title: {
            type: 'plain_text',
            text: 'Analyze Message'
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Message:*\n>${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}`
              }
            },
            {
              type: 'input',
              block_id: 'analysis_type',
              element: {
                type: 'static_select',
                action_id: 'type_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select analysis type'
                },
                options: [
                  {
                    text: { type: 'plain_text', text: 'Sentiment Analysis' },
                    value: 'sentiment'
                  },
                  {
                    text: { type: 'plain_text', text: 'Summary' },
                    value: 'summary'
                  },
                  {
                    text: { type: 'plain_text', text: 'Extract Action Items' },
                    value: 'actionItems'
                  }
                ]
              },
              label: {
                type: 'plain_text',
                text: 'Analysis Type'
              }
            }
          ],
          submit: {
            type: 'plain_text',
            text: 'Analyze'
          }
        }
      });
    } catch (error) {
      logger.error('Error opening analysis modal:', error);
    }
  });

  // Handle modal submission
  app.view('analysis_modal', async ({ ack, view, client, body }) => {
    await ack();

    try {
      const metadata = JSON.parse(view.private_metadata);
      const analysisType = view.state.values.analysis_type.type_select.selected_option.value;

      const analysis = await analyzeMessage(metadata.message_text, analysisType);

      // Send the analysis as a DM to the user
      await client.chat.postMessage({
        channel: body.user.id,
        text: `*${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis:*\n${analysis}`
      });
    } catch (error) {
      logger.error('Error processing analysis:', error);
    }
  });
}

module.exports = { setupEventHandlers };
```

## Part 7: Message Formatting Utilities

Create `src/utils/formatters.js` for consistent message formatting:

```javascript
function formatCodeBlock(code, language = '') {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

function formatBulletList(items) {
  return items.map(item => `• ${item}`).join('\n');
}

function formatNumberedList(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function formatQuote(text) {
  return text.split('\n').map(line => `> ${line}`).join('\n');
}

function formatUserMention(userId) {
  return `<@${userId}>`;
}

function formatChannelLink(channelId) {
  return `<#${channelId}>`;
}

function formatTimestamp(timestamp, format = 'date_short_pretty') {
  return `<!date^${Math.floor(timestamp)}^{${format}}|${new Date(timestamp * 1000).toLocaleDateString()}>`;
}

function truncateText(text, maxLength = 2000) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

module.exports = {
  formatCodeBlock,
  formatBulletList,
  formatNumberedList,
  formatQuote,
  formatUserMention,
  formatChannelLink,
  formatTimestamp,
  truncateText
};
```

## Part 8: Deployment and Production Considerations

### Preparing for Production

Update your `package.json` with production scripts:

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "lint": "eslint src/",
    "test": "jest"
  }
}
```

### Docker Deployment

Create a `Dockerfile` for containerized deployment:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

USER node

CMD ["npm", "start"]
```

And a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  slack-bot:
    build: .
    env_file:
      - .env
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

### Health Checks and Monitoring

Add a health check endpoint by modifying your main application:

```javascript
const http = require('http');

// Add after app initialization
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(3000, () => {
  logger.info('Health check server running on port 3000');
});
```

### Rate Limiting

Implement rate limiting to prevent abuse:

```javascript
const rateLimits = new Map();

function checkRateLimit(userId, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const userLimits = rateLimits.get(userId) || { count: 0, resetTime: now + windowMs };

  if (now > userLimits.resetTime) {
    userLimits.count = 0;
    userLimits.resetTime = now + windowMs;
  }

  userLimits.count++;
  rateLimits.set(userId, userLimits);

  return userLimits.count <= limit;
}
```

### Security Best Practices

1. **Validate all inputs**: Never trust user input. Sanitize and validate before processing.
2. **Use environment variables**: Keep secrets out of code.
3. **Implement request signing verification**: Verify requests come from Slack.
4. **Limit data retention**: Don't store conversation history indefinitely.
5. **Audit logging**: Log all bot actions for security review.

## Part 9: Testing Your Bot

### Local Testing

Run your bot in development mode:

```bash
npm run dev
```

Test the following scenarios:

1. Send a direct message to your bot
2. Mention the bot in a channel
3. Use each slash command
4. React to a message with :brain:
5. Test the message shortcut (if configured)

### Automated Testing

Create basic tests in `tests/handlers.test.js`:

```javascript
const { generateResponse, analyzeMessage } = require('../src/neurolink');

describe('NeuroLink Integration', () => {
  test('generates response for simple question', async () => {
    const response = await generateResponse('What is 2+2?');
    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(0);
  });

  test('analyzes sentiment correctly', async () => {
    const sentiment = await analyzeMessage('I love this product!', 'sentiment');
    expect(sentiment.toLowerCase()).toContain('positive');
  });
});
```

## What You Built

You built an AI-powered Slack bot with slash commands, conversation handling, mention responses, and AI-powered reactions using NeuroLink's generation API. The bot processes natural language queries and returns intelligent responses directly in Slack channels and direct messages.

Remember to monitor your bot's performance, gather user feedback, and iterate on the experience. The best bots evolve based on how teams actually use them.

For more advanced NeuroLink features, explore the documentation at docs.neurolink.ink. You'll find capabilities like function calling, structured outputs, and fine-tuning that can make your Slack bot even more powerful.

Happy building!

---

*Ready to transform your Slack workspace with AI? Sign up for NeuroLink at neurolink.ink and start building intelligent integrations today.*

---

**Related posts:**

- [Building AI Agents with NeuroLink: From Chatbot to Autonomous System](/posts/building-ai-agents/)
- [Function Calling: AI Tool Use Patterns with NeuroLink](/posts/function-calling-patterns/)
- [Real-Time AI: Streaming Response Patterns with NeuroLink](/posts/streaming-best-practices/)
