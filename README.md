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
import { KickOAuth } from "kicklient";
import session from "express-session";

const auth = new KickOAuth(
  process.env.KICK_CLIENT_ID!,
  process.env.KICK_CLIENT_SECRET!,
  process.env.KICK_REDIRECT_URI!
);

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
  })
);

app.get("/auth", (req, res) => {
  const { url, state, codeVerifier } = auth.getAuthorizationUrl([
    /* requested scopes */
  ]);

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

  const tokens = await auth.exchangeCodeForToken(
    req.query.code,
    req.session.codeVerifier
  );

  // Save tokens to the database

  res.sendStatus(200);
});
```

### Getting app token

```typescript
const token = await auth.getAppAccessToken();
```

### Basic usage

```typescript
import { UserClient, KickOAuth, AppClient } from "kicklient";

const userClient = await UserClient.create(
  auth,
  userAccessToken,
  userRefreshToken,
  (tokens) => saveTokensToDB(tokens)
);

const appClient = await AppClient.create(auth, appToken);

console.log(await appClient.categories.getCategories("category_name"));

// Requires [channel:rewards:write] scope
console.log(await userClient.channelRewards.getChannelRewards());
```

### Events

```typescript
import { KickAPIEvents, KickOAuth, UserClient } from "kicklient";

const eventHandler = new KickAPIEvents();

await eventHandler.on("chat.message.sent", userId, client, async (message) => {
  console.log(message.content);
  if (message.content === "forbidden_word") {
    try {
      await message.sender.ban("Forbidden word");
    } catch (error) {
      console.error("An error occured:", error);
    }
  }
});
```
