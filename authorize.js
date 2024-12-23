#!/usr/bin/env node

/**
 * authorize.js
 *
 * A local-server approach to generate OAuth2 tokens for MMM-CalendarExt3AddEvent.
 * 1) Reads your credentials.json for client_id, client_secret, redirect_uris.
 * 2) Spawns a small HTTP server on localhost.
 * 3) Opens your default browser to Google's OAuth2 consent screen.
 * 4) Google redirects the user back to localhost with a "code".
 * 5) We exchange that code for tokens, save to token.json, and exit.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");
const { google } = require("googleapis");
const openModule = require("open");
const open = openModule.default || openModule;

const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

// The scopes your module needs (read/write to Calendar).
// Adjust if you need additional permissions.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

// The port & path we’ll listen on locally. Must match your OAuth redirect URI.
const PORT = 3000;
const REDIRECT_PATH = "/oauth2callback";

// Helper: Load credentials from file
function loadCredentials() {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error loading client secret file:", err);
    process.exit(1);
  }
}

// Main authorize function
async function authorize() {
  const credentials = loadCredentials();
  // Depending on how you set up OAuth in the Google Cloud console, 
  // it might be `credentials.web` or `credentials.installed`.
  const { client_secret, client_id, redirect_uris } =
    credentials.web || credentials.installed;

  // We’ll override the redirect URI to point to our local server.
  // (Ensure you have added "http://localhost:3000/oauth2callback" in GCP console!)
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    `http://localhost:${PORT}${REDIRECT_PATH}`
  );

  // Generate the auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline", // Important to get a refresh token
    scope: SCOPES,
  });

  console.log("Starting local server on port", PORT);

  // Start a simple HTTP server to catch the redirect
  const server = http.createServer(async (req, res) => {
    // Parse the URL
    const parsedUrl = new url.URL(req.url, `http://localhost:${PORT}`);
    if (parsedUrl.pathname === REDIRECT_PATH) {
      // Get the code from the querystring
      const code = parsedUrl.searchParams.get("code");
      if (!code) {
        res.end("No code found in querystring. Authorization failed.");
        return;
      }

      try {
        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        // Save tokens to disk
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log("Tokens acquired and saved to", TOKEN_PATH);

        // Respond to the browser, then shut down
        res.end("Authorization successful! You can close this tab/window now.");
      } catch (error) {
        console.error("Error exchanging code for token:", error);
        res.end("Error exchanging code for token. See console.");
      } finally {
        server.close(() => {
          console.log("Server closed, exiting process.");
          process.exit(0);
        });
      }
    } else {
      // If user hits another route, show a simple message
      res.end("No callback code found on this route.");
    }
  });

  // Start listening
  server.listen(PORT, () => {
    console.log(`Listening for OAuth2 callback on http://localhost:${PORT}${REDIRECT_PATH}`);
    console.log("Opening your browser for authorization...");
    // Open default browser
    open(authUrl).catch((error) => {
      console.error("Failed to open browser automatically:", error);
      console.log("Please open the following URL manually:\n", authUrl);
    });
  });
}

// Run the script
authorize();
