/* global Module */

/*
  MMM-CalendarExt3AddEvent
  Author: Your Name
  License: MIT
*/

Module.register("MMM-CalendarExt3AddEvent", {
  defaults: {
    calendars: [
      {
        name: "Primary",
        calendarId: "primary",
      },
      {
        name: "Work",
        calendarId: "your-work-calendar-id@group.calendar.google.com",
      },
    ],
    // For style and behavior
    modalClass: "CE3AddEventModal",
    timeFormat: "HH:mm", 
    dateFormat: "YYYY-MM-DD",
    popupZIndex: 9999
  },

  start: function () {
    this.loaded = false;
    this.modalVisible = false;
  
    //Wait for MMM-ClanedarExt3 to show up in the DOM
    setTimeout(() => {
      this.setupCalendarObserver();
    }, 2000);
},

  setupCalendarObserver: function() {
    // Find the main container used by MMM-CalendarExt3
    // This may differ depending on how you’ve configured CalendarExt3
    const calendarContainer = document.querySelector(".MMM-CalendarExt3"); 
    // or maybe "#CalendarExt3" or some other known root element

    if (!calendarContainer) {
      console.warn("MMM-CalendarExt3AddEvent: Could not find MMM-CalendarExt3 container to observe.");
      return;
    }

    // Create a MutationObserver that re-injects plus buttons whenever the calendar DOM changes
    const observer = new MutationObserver((mutationsList) => {
      // Wait briefly to let MMM-CalendarExt3 finalize
      setTimeout(() => {
        this.injectPlusButtons();
      }, 2000);
    });

    // Observe childList changes (DOM additions/removals) in the subtree
    observer.observe(calendarContainer, {
      childList: true,
      subtree: true
    });

    console.log("MMM-CalendarExt3AddEvent: CalendarExt3 observer set up. Will re-inject plus buttons on changes.");
  },

  getStyles: function () {
    return [
      // e.g. "modules/MMM-CalendarExt3/MMM-CalendarExt3.css",
      this.file("style.css"),
    ];
  },

  getScripts: function () {
    return [];
  },

  // Render container + popup; plus buttons are dynamically injected
  getDom: function () {
    const wrapper = document.createElement("div");

    // Modal container
    const modalContainer = document.createElement("div");
    modalContainer.id = "CE3AddEventModalContainer";
    modalContainer.className = this.config.modalClass;
    modalContainer.style.display = this.modalVisible ? "block" : "none";
    modalContainer.style.zIndex = this.config.popupZIndex;
    modalContainer.innerHTML = this.getPopupHTML();
    wrapper.appendChild(modalContainer);

    // Wait a moment to inject plus buttons after DOM is in place
    setTimeout(() => {
      this.injectPlusButtons();
    }, 10000);

    return wrapper;
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === "CALENDAR_EXT3_RENDERED") {
      this.injectPlusButtons();
    }
    if (notification === "DOM_OBJECTS_CREATED") {
    // Attach close and submit event listeners for the modal
      const closeBtn = document.getElementById("ce3AddEventCloseBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.hideModal());
      }

      const submitBtn = document.getElementById("ce3AddEventSubmitBtn");
      if (submitBtn) {
        submitBtn.addEventListener("click", () => {
          const data = this.getCurrentFormData();
          console.log("Submitting new event:", data);
          this.sendSocketNotification("CE3_ADD_EVENT", data);
          this.hideModal();
        });
      }
	    }
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "CE3_ADD_EVENT_RESULT") {
      console.log("Event created successfully:", payload);
      // Possibly you can do something like refresh the calendar
    } else if (notification === "CE3_OAUTH_ERROR") {
      console.error("OAuth error:", payload);
    }
  },

  injectPlusButtons: function () {
    // Adjust based on actual MMM-CalendarExt3 day cell class
    console.log("AddEvent: Injecting plus buttons now...");
    const dayCells = document.querySelectorAll(".cell[data-date]");
    console.log("AddEvent: Found dayCells count:", dayCells.length);
    dayCells.forEach((dayCell) => {
      if (dayCell.querySelector(".CE3AddEventPlus")) return; // already added

      const plusBtn = document.createElement("div");
      plusBtn.className = "CE3AddEventPlus";
      plusBtn.innerHTML = "+";
      plusBtn.title = "Add Event";
      plusBtn.style.cursor = "pointer";
      plusBtn.onclick = (event) => {
        event.stopPropagation();
  	const rawTimestamp = dayCell.getAttribute("data-date"); //e.g. Unix timestamp "173363400000"
	const timestamp = parseInt(rawTimestamp, 10);
	const jsDate = new Date(timestamp); //convert to Javascript Date
        const isoDate = jsDate.toISOString().slice(0,10); //format as YYYY-MM-DD
        this.showModal(isoDate);
      };
      dayCell.appendChild(plusBtn);
    });
  },

  showModal: function (selectedDate) {
    this.modalVisible = true;
    const container = document.getElementById("CE3AddEventModalContainer");
    if (container) {
      container.style.display = "block";
      const dateInput = container.querySelector("#ce3-add-event-date");
      if (dateInput) dateInput.value = selectedDate || "";
    }
   const titleInput =  container.querySelector("#ce3-add-event-title");
   if (titleInput) { titleInput.focus(); }
   const locationInput = container.querySelector("#ce3-add-event-location");
   if (locationInput) { locationInput.focus(); } 
  },

  hideModal: function () {
    this.modalVisible = false;
    const container = document.getElementById("CE3AddEventModalContainer");
    if (container) container.style.display = "none";
    const activeElement = document.activeElement;
    if (activeElement && activeElement.tagName === "INPUT") {
      activeElement.blur();
    }
  },

  getPopupHTML: function () {
    const formHTML = `
      <div class="CE3AddEventHeader">
        <span>Add New Event</span>
        <span class="CE3AddEventClose" id="ce3AddEventCloseBtn">&#10005;</span>
      </div>
      <div class="CE3AddEventBody">
        <div class="CE3AddEventRow">
          <label for="ce3-add-event-calendar">Calendar:</label>
          <select id="ce3-add-event-calendar">
            ${this.config.calendars
              .map(
                (cal) => 
                  `<option value="${cal.calendarId}">${cal.name}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="CE3AddEventRow">
          <label for="ce3-add-event-title">Title:</label>
          <input type="text" id="ce3-add-event-title" placeholder="Event title" />
        </div>
        <div class="CE3AddEventRow">
          <label for="ce3-add-event-location">Location:</label>
          <input type="text" id="ce3-add-event-location" placeholder="Event location" />
        </div>
        <div class="CE3AddEventRow">
          <label for="ce3-add-event-date">Date:</label>
          <input type="date" id="ce3-add-event-date" />
        </div>
        <div class="CE3AddEventRow">
          <label for="ce3-add-event-start">Start:</label>
          <input type="time" id="ce3-add-event-start" />
          <label for="ce3-add-event-end" style="margin-left: 10px;">End:</label>
          <input type="time" id="ce3-add-event-end" />
        </div>
        <div class="CE3AddEventRow">
          <label for="ce3-add-event-allDay">All day:</label>
          <input type="checkbox" id="ce3-add-event-allDay" />
        </div>
      </div>
      <div class="CE3AddEventFooter">
        <button id="ce3AddEventSubmitBtn">Save</button>
      </div>
    `;
    return formHTML;
  },

  getCurrentFormData: function () {
    const container = document.getElementById("CE3AddEventModalContainer");
    if (!container) return {};

    return {
      calendarId: container.querySelector("#ce3-add-event-calendar").value,
      title: container.querySelector("#ce3-add-event-title").value,
      location: container.querySelector("#ce3-add-event-location").value,
      date: container.querySelector("#ce3-add-event-date").value,
      startTime: container.querySelector("#ce3-add-event-start").value,
      endTime: container.querySelector("#ce3-add-event-end").value,
      allDay: container.querySelector("#ce3-add-event-allDay").checked,
    };
  },
});
