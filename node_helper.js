"use strict";

/**
 * node_helper.js for MMM-CalendarExt3AddEvent
 * - Uses OAuth2 tokens from token.json
 * - Creates events in the user's Google Calendar
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

module.exports = NodeHelper.create({
  start: function () {
    console.log("Starting node_helper for MMM-CalendarExt3AddEvent");
    this.oauth2Client = null;
  },

  // Called when a socket notification arrives from MMM-CalendarExt3AddEvent.js
  socketNotificationReceived: function (notification, payload) {
    if (notification === "CE3_ADD_EVENT") {
      this.handleAddEvent(payload);
    }
  },

  /**
   * Attempt to load and authorize credentials if not already done.
   */
  async ensureClientLoaded() {
    if (this.oauth2Client) {
      // Already loaded
      return;
    }

    try {
      // 1) Load credentials.json
      const credentials = JSON.parse(
        fs.readFileSync(CREDENTIALS_PATH, "utf8")
      );
      const { client_secret, client_id, redirect_uris } =
        credentials.installed || credentials.web;

      // 2) Instantiate the OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // 3) Load token.json
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
      this.oauth2Client.setCredentials(token);

      // Optionally, can refresh if needed
      // this.oauth2Client.on('tokens', (tokens) => {
      //   if (tokens.refresh_token) {
      //     fs.writeFileSync(TOKEN_PATH, JSON.stringify(this.oauth2Client.credentials));
      //   }
      // });

      console.log("MMM-CaldendarExt3AddEvent: OAuth2 client successfully loaded with stored token.");
    } catch (err) {
      console.error("MMM-CaldendarExt3AddEvent: Error loading OAuth client or token:", err);
    }
  },

  /**
   * Handle the creation of a new event.
   */
  async handleAddEvent(payload) {
    // Ensure we have an authenticated OAuth2 client
    await this.ensureClientLoaded();
    if (!this.oauth2Client) {
      console.error("MMM-CaldendarExt3AddEvent: OAuth2 client not available. Cannot create event.");
      return;
    }

    try {
      const calendar = google.calendar({ version: "v3", auth: this.oauth2Client });
      const event = this.buildCalendarEvent(payload);

      const res = await calendar.events.insert({
        calendarId: payload.calendarId || "primary",
        requestBody: event,
      });

      console.log("MMM-CaldendarExt3AddEvent: Event created:", res.data);
      this.sendSocketNotification("CE3_ADD_EVENT_RESULT", res.data);
    } catch (err) {
      console.error("MMM-CaldendarExt3AddEvent: Error creating event:", err);
      this.sendSocketNotification("CE3_OAUTH_ERROR", err.toString());
    }
  },

  /**
   * Helper to build a Google Calendar event from the form data
   */
  buildCalendarEvent(payload) {
    const event = {
      summary: payload.title || "Untitled Event",
      location: payload.location || "",
      start: {},
      end: {},
    };

    if (payload.allDay) {
      // All-day event: use date fields
      event.start.date = payload.date;
      // For a single-day all-day event, you'd do:
      // event.end.date = the next day
      // e.g., if you want it to remain on the same day only, do the same date
      // but typically all-day events end the next day
      event.end.date = payload.date; 
    } else {
      // Timed event
      const startDateTime = `${payload.date}T${payload.startTime || "00:00"}:00`;
      const endDateTime = `${payload.date}T${payload.endTime || "23:59"}:00`;

      event.start.dateTime = startDateTime;
      event.end.dateTime = endDateTime;
      const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      event.start.timeZone = userTZ;
      event.end.timeZone = userTZ;
    }
    return event;
  },
});
