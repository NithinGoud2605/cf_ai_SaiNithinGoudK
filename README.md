# Cloudflare AI Chat Application

A chat application with AI memory using Cloudflare Workers AI and Durable Objects.

## Features

- AI chat with persistent memory
- Natural responses using Llama models
- Session-based memory storage
- Clean web interface

## Setup

```bash
npm install
wrangler deploy
wrangler pages deploy public --project-name cf-ai-agent-chat
```

## Usage

Send POST to `/api/chat`:
```json
{
  "message": "Hello",
  "sessionId": "session123"
}
```

## Deployment

- Worker: https://cf_ai_cloudflare_agent_chat.sainithingoudk.workers.dev
- Frontend: https://fe507db2.cf-ai-agent-chat.pages.dev

## Development

```bash
wrangler dev
```