# Kicklient

A Node.js library for making it easier to use the Kick API.

## Installation

Run `npm install kicklient` or `pnpm add kicklient` or `yarn add kicklient`

## Usage

### Authentication (with Express)

First install the dependencies:

```bash
npm install kicklient express express-session dotenv
```

Set the environment variables:

```
KICK_CLIENT_ID={YOUR_KICK_APP_CLIENT_ID}
KICK_CLIENT_SECRET={YOUR_KICK_APP_CLIENT_SECRET}
KICK_REDIRECT_URI={YOUR_KICK_APP_REDIRECT_URI}
SESSION_SECRET={RANDOM_SESSION_SECRET}
```

The authentication flow should be handled like this:

```typescript
import express from "express";
import session from "express-session";
import { exchangeCodeForToken, getAuthorizationUrl } from "kicklient";

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);

app.get("/auth", (req, res) => {
  const { url, state, codeVerifier } = getAuthorizationUrl({
    clientId: process.env.CLIENT_ID,
    redirectUri: process.env.REDIRECT_URI,
    scopes: [
      /* requested scopes */
    ],
  });

  req.session.state = state;
  req.session.codeVerifier = codeVerifier;

  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  if (
    !req.session.state ||
    !req.session.codeVerifier ||
    typeof req.query.code !== "string" ||
    req.session.state !== req.query.state
  ) {
    return res.sendStatus(400);
  }

  const tokens = await exchangeCodeForToken({
    code: req.query.code,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
    codeVerifier: req.session.codeVerifier,
  });

  // Save tokens to the database

  res.sendStatus(200);
});

app.listen(3000, () => console.log("Server is listening on port 3000"));
```

### Getting app token

```typescript
import { getAppAccessToken } from "kicklient";

const token = await getAppAccessToken({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});
```

### Basic usage

```typescript
import { UserClient, AppClient } from "kicklient";

const userClient = new UserClient({
  accessToken,
  refreshToken,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  async onTokenRefresh(tokens) {
    await saveTokensToDB(tokens);
  },
});

const appClient = new AppClient({
  accessToken,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  async onTokenRefresh(tokens) {
    await saveTokensToDB(tokens);
  },
});

console.log(await appClient.uses.getUsersByIds({ ids: [123, 321] }));

console.log(await userClient.channelRewards.getChannelRewards());
```

### Getting paginated data

```typescript
const categories = client.categories.getCategories({});

for await (const page of categories) {
  console.log(page.map((category) => category.name));
  // IMPORTANT: exit the loop once you get what you want to avoid unnecessary
  // API calls
  if (containsSearchedData(page)) break;
}
```

### Events (with Express)

```typescript
import express from "express";
import { createWebhookHandler } from "kicklient";

await userClient.events.createEventsSubscriptions({
  events: [
    /* requested events */
  ],
});

// OR

await appClient.events.createEventsSubscriptions({
  broadcasterUserId,
  events: [
    /* requested events */
  ],
});

const app = express();

const handler = createWebhookHandler({
  async "chat.message.sent"(message) {
    console.log("Received message:", message.content);
  },
});

// or client.createWebhookHandler(...) to access object API methods

app.post("/webhook-events", express.text({ type: "*/*" }), async (req, res) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.append(key, value);
  }

  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const request = new Request(fullUrl, {
    method: req.method,
    headers,
    body: req.body,
  });

  const response = await handler(request);
  res.sendStatus(response.status);
});

app.listen(3000, () => console.log("Server is listening on port 3000"));
```
