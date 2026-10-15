# Lesson 4: Put the Greeting Server on the Internet

Lesson 1 built an MCP server with one tool, `greeting`. That server talks over **stdio**: it only runs on the same computer as the IDE that started it. This lesson keeps that tool and adds a second way to reach it, **Streamable HTTP**, so the server can run on a host and answer clients over the internet.

Nathan deploys it. His dad can call the greeting tool from Gemini CLI, or from the Gemini web app at gemini.google.com.

The greeting behavior is unchanged:

- Tool name: `greeting`
- Input: a string called `name`
- Output: `Hello, <name>! How can I help you today?`

## What you are adding

| Piece | Where | What it does |
| --- | --- | --- |
| Shared server | `lesson1/server/src/createServer.ts` | Registers the greeting tool once |
| Local transport | `lesson1/server/src/index.ts` | stdio, same as Lesson 1 (`npm start`) |
| Remote transport | `lesson1/server/src/http.ts` | Streamable HTTP on `/mcp` (`npm run start:http`) |
| Bearer token | `MCP_AUTH_TOKEN` | Required on `/mcp` as a header, or as the last path segment `/mcp/<token>` |
| Health check | `GET /health` | Tells the host the process is up. No token required |
| Host config | `render.yaml` at the repo root | Render blueprint for a free web service |

Streamable HTTP is the remote transport Gemini CLI uses when a server entry has `httpUrl`. An older style, SSE (`url` in Gemini's settings), is a different endpoint shape. This server speaks Streamable HTTP, so SSE is not set up here.

Each HTTP request creates a fresh server instance (stateless mode) and answers with one JSON body. That matches a tool that returns a single sentence, and it still works after a free host wakes up from sleep.

## Try it on your computer

From the repository root:

```bash
cd lesson1/server
npm install
npm run test:http
```

`test:http` compiles the server, starts it on a free port, and checks:

- The process exits if `MCP_AUTH_TOKEN` is missing
- `GET /health` returns `{"status":"ok"}` with no token
- `POST /mcp` returns 401 when the token is missing or wrong
- An MCP client can list `greeting` and call it over HTTP with a bearer header
- The same client can list and call `greeting` at `/mcp/<token>` with no header
- A wrong or partial path token returns 401, and the body does not echo the token
- The original stdio server still lists and calls the same tool

Leave a server running yourself when you want to poke at it:

```bash
cd lesson1/server
npm install
npm run build
export MCP_AUTH_TOKEN="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
npm run start:http
```

Then open `http://127.0.0.1:3000/health`. A call without the token should be rejected:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST http://127.0.0.1:3000/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

That prints `401`. The same call with the token in the path (no `Authorization` header) is the URL the Gemini web app uses. With the server still running in that terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "http://127.0.0.1:3000/mcp/$MCP_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

A correct token prints `200`.

On startup you will see a warning that the server is binding to `0.0.0.0` without DNS rebinding protection. That is expected. Render's public hostname does not exist until the service is created, so the lesson locks `/mcp` with the token (header or path).

`npm start` is still the local stdio server for Cursor, Windsurf, and VS Code. Point those tools at `node build/index.js` inside `lesson1/server`, the same way Lesson 1 describes.

### Optional: MCP Inspector

With `npm run start:http` still running, you can open the official inspector UI:

```bash
npx @modelcontextprotocol/inspector
```

Connect it to `http://127.0.0.1:3000/mcp` using the Streamable HTTP transport, and add the header `Authorization: Bearer <the token you exported>`. The web-app shape works here too: connect to `http://127.0.0.1:3000/mcp/<token>` and leave the header empty. List tools, then call `greeting` with a name. The script above is the check this lesson relies on; the inspector is a way to click through the same calls.

## Deploy on Render

[Render](https://render.com) runs a normal Node process and gives it an `https://` address. The free web service plan is enough for this lesson. It sleeps after about 15 minutes without traffic, and the next request wakes it. That wake-up can take around a minute, which is why the Gemini timeout below is 3 minutes.

You do these steps by hand. The repo cannot create the account or store the token.

1. Generate a token and store it somewhere private (a password manager or a note only you and your dad can see):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Push this project to GitHub if it is not there already. Render deploys from the branch you connect, usually `main`, so merge this lesson first or select the branch that contains `render.yaml`.

3. Create a Render account. Signing in with GitHub is the shortest path.

4. In the Render Dashboard, choose **New** → **Blueprint**.

5. Select this repository. Render reads `render.yaml` and creates a web service named `mcp-greeting`:
   - Root directory: `lesson1/server`
   - Build: `if [ -f package-lock.json ]; then npm ci; else npm install; fi && npm run build`
   - Start: `npm run start:http`
   - Health check: `/health`
   - Node: `22.14.0`

   `lesson1/server/package-lock.json` is committed, so this build runs `npm ci`. If that lockfile is not in the checkout, the same command runs `npm install`.

6. When Render asks for `MCP_AUTH_TOKEN`, paste the token from step 1. Leave the value out of git, the README, and screenshots.

7. If the account has no free instance type, pick the cheapest web service. The start command and health check stay the same. The service will stay awake, so the cold-start note below matters less.

8. Wait until the deploy is **Live**. Open the service URL Render shows you. You should see a short text page. Open `https://YOUR-SERVICE.onrender.com/health` and confirm `{"status":"ok"}`.

9. Send your dad the service URL and the token in a private message. He needs a different URL for each Gemini app:
   - Gemini CLI: `https://YOUR-SERVICE.onrender.com/mcp`, plus the token in a header
   - Gemini web app: `https://YOUR-SERVICE.onrender.com/mcp/YOUR_TOKEN` (the token is the last part of the path)

The homepage and `/health` are open on purpose so you can see that the process is up. `/mcp` answers when the request carries `Authorization: Bearer <token>`. `/mcp/<token>` answers when that path segment is the same token.

### Deploying without the blueprint

Create a **Web Service**, connect the repo, and set:

- Root Directory: `lesson1/server`
- Build Command: `if [ -f package-lock.json ]; then npm ci; else npm install; fi && npm run build`
- Start Command: `npm run start:http`
- Health Check Path: `/health`
- Environment: `NODE_VERSION` = `22.14.0`, and `MCP_AUTH_TOKEN` = your token

The root directory is `lesson1/server`, which is where `package-lock.json` is committed. The build command runs `npm ci` when that file is present and `npm install` when it is not.

## Gemini CLI for Nathan's dad

This is the client to set up. Gemini CLI speaks Streamable HTTP when the server entry uses `httpUrl`, and it can send the bearer token in `headers`.

Install the CLI (Node.js required), then sign in the way the installer describes:

```bash
npm install -g @google/gemini-cli
```

### Settings snippet

Edit `~/.gemini/settings.json` (on Windows: `%USERPROFILE%\.gemini\settings.json`). Create the file if it is not there. If it already has other settings, add `nathan-greeting` inside the existing `mcpServers` object.

```json
{
  "mcpServers": {
    "nathan-greeting": {
      "httpUrl": "https://YOUR-SERVICE.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      },
      "timeout": 180000
    }
  }
}
```

Replace `YOUR-SERVICE` and `YOUR_TOKEN` with the URL and token Nathan sent. The URL has to end in `/mcp`. `timeout` is milliseconds. 180000 (3 minutes) gives a sleeping free instance time to wake up. Gemini's own default is longer than that; the field is here so a short example timeout does not get copied in by accident.

The same entry can be added from a terminal. `--scope user` writes `~/.gemini/settings.json`, so it works from any folder. The default scope would write a project file in the current directory instead.

```bash
gemini mcp add --transport http --scope user --timeout 180000 nathan-greeting \
  "https://YOUR-SERVICE.onrender.com/mcp" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### Check that the tool works

1. List servers. The first run after the site has been asleep can take a minute.

   ```bash
   gemini mcp list
   ```

   `nathan-greeting` should show the `https://.../mcp` URL and a connected status. If it shows disconnected, run the command again once the host has finished waking up.

2. Start Gemini CLI:

   ```bash
   gemini
   ```

3. Ask it to use the tool, for example: "Use the greeting tool to greet Nathan."

4. Approve the tool call when Gemini asks. The tool result should be:

   ```text
   Hello, Nathan! How can I help you today?
   ```

Try a second name ("greet Dad") and confirm the name in the sentence changes. That shows the server is running the Lesson 1 tool, not a fixed string.

## Gemini web app for Nathan's dad

The Gemini web app at [gemini.google.com](https://gemini.google.com) connects under **Settings → Connected Apps → Custom apps**. The dialog asks for the MCP server URL, and under advanced features it can take an optional OAuth client id and client secret. It has no field for an `Authorization` header, so the bearer setup from the CLI section cannot be pasted there.

Google's own help says those OAuth fields are for a server that expects a full sign-in (Dynamic Client Registration, or a client id and secret you registered ahead of time). This greeting server does not run an OAuth provider. Dad leaves the OAuth fields blank and puts the token in the URL instead. Gemini then calls that exact URL for every tool request.

The URL to paste:

```text
https://YOUR-SERVICE.onrender.com/mcp/YOUR_TOKEN
```

`YOUR_TOKEN` is the same `MCP_AUTH_TOKEN` Nathan set on Render. Paste it with the token as the last segment. An extra slash on the end still reaches the server. A query string such as `?token=` is ignored: the web app would have to keep that query on every request, and proxies log query strings readily, so this lesson uses the path.

That is weaker than the header used by Gemini CLI. The token is part of the address, so it can show up in Render's request logs, in the browser history of whoever pastes it, and on Gemini's connected-app screen. Anyone who has the full URL can call the greeting tool. For a lesson that only says hello, that is the practical lock. Keep the URL in the same private message as the token, and avoid screenshots of the connected-app page.

### Connect

Google currently offers custom apps to people who are 18 or over, in the US, signed in with a personal Google Account (a work or school account will not show this), with Keep Activity on, and using English. You add the app on the web. After that it is available in the Gemini mobile app as well. If **Connected Apps** is missing, open **Personal Intelligence** first, then **Connected Apps**.

1. On a computer, open [gemini.google.com](https://gemini.google.com).
2. At the bottom, open **Settings → Connected Apps**.
3. Under **Custom apps**, choose **Add a custom app** (or the "Add a custom app link to get started" field).
4. When the dialog says **Connect to an MCP server**, paste `https://YOUR-SERVICE.onrender.com/mcp/YOUR_TOKEN`.
5. Leave **OAuth Client ID** and **Client secret** empty. Skip **Advanced features** if it is collapsed.
6. Click **Next**. Accept the notice that Google has not reviewed this server, then connect.
7. The first request can take about a minute while the free Render service wakes up.

### Check that the tool works

In Gemini, start a prompt that names the app. Google's tip is to type `@` and pick the custom app, then ask: "Use the greeting tool to greet Nathan."

The tool result should be:

```text
Hello, Nathan! How can I help you today?
```

Ask it to greet Dad as well. The name in the sentence should change.

Custom apps are aimed at Gemini Spark and at quick actions from chat. If the connection succeeds and a normal chat still ignores the tool, switch to **Spark** and ask again with `@`.

## Other Gemini clients

The same Streamable HTTP endpoint works in Gemini clients that accept `httpUrl` and `headers`:

- **Gemini in Android Studio.** Settings → Tools → AI → MCP Servers. The IDE stores an `mcp.json` file with the same `httpUrl` and `headers` fields as the snippet above. Use `httpUrl` for this server. `url` is the field for an SSE endpoint. See [Add an MCP server](https://developer.android.com/studio/gemini/add-mcp-server).
- **Gemini Code Assist** (VS Code and JetBrains) reads MCP servers from `~/.gemini/settings.json`, the same file as Gemini CLI. Add the snippet above there too.

Any other MCP client that speaks Streamable HTTP can use `https://YOUR-SERVICE.onrender.com/mcp` and the `Authorization` header. Cursor and VS Code can do that, but this lesson's steps are for Gemini CLI.

## What Nathan does by hand

- Create the Render account and connect the GitHub repo
- Choose the free (or cheapest) web service if the blueprint asks
- Generate `MCP_AUTH_TOKEN`, paste it into Render, and keep it out of the repo
- Copy the live `https://....onrender.com` URL
- Send his dad the token in private, the CLI URL ending in `/mcp`, and the web app URL ending in `/mcp/<token>`
- Dad installs Gemini CLI and adds the header snippet, or pastes the secret URL into Connected Apps and leaves the OAuth fields blank

## Troubleshooting

- **Deploy fails immediately** with a log line about `MCP_AUTH_TOKEN`: the variable is empty or shorter than 16 characters. Set it in the Render dashboard and redeploy.
- **Build log says `npm ci` can only install with an existing package-lock.json**: set the root directory to `lesson1/server` and use the build command from `render.yaml`. That directory's `package-lock.json` is committed, so the command runs `npm ci`. If the lockfile is missing from the checkout, the same command runs `npm install`.
- **`/health` works and `/mcp` returns 401**: the server is up. Gemini CLI needs `Authorization: Bearer <token>`. The web app needs the token in the path, `https://YOUR-SERVICE.onrender.com/mcp/<token>`, with the OAuth fields left blank.
- **The web app asks you to sign in or enter a client id**: the URL it is using returned 401, so Gemini is looking for OAuth. Paste the path URL again, with the hex token as the last segment and no trailing slash. Leave the client id and secret empty.
- **Connected Apps is missing**: the Google account is outside the current custom-app rollout (personal account, 18+, US, English, Keep Activity on). Gemini CLI still works with the header setup.
- **`gemini mcp list` sits there, then fails**: the free instance was asleep. Run the command again. Confirm `timeout` is `180000` and the URL ends in `/mcp`.
- **Tool list is empty**: Gemini connected to a different server, or the URL is the site root instead of `/mcp`.
- **Local IDE stopped seeing the tool**: local configs should still launch `npm start` / `node build/index.js`. `npm run start:http` is the remote process.
