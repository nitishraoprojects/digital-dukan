/**
 * Nikavi Studio — site configuration
 * ------------------------------------------------------------
 * Replace every value marked TODO with your real details.
 * Nothing else in the codebase needs to change.
 */
window.DD_CONFIG = {
  // TODO: WhatsApp number in international format, digits only (91 + 10-digit mobile).
  whatsappNumber: "917011088270",
  whatsappMessage: "Hi! I'm interested in getting a website for my business.",

  // TODO: Your public phone number as you'd like it displayed (optional, shown in footer).
  phoneDisplay: "+91 70110 88270",

  // TODO: Your business email address.
  email: "digitaldukaan91@gmail.com",

  // TODO: Google Calendar appointment schedule link or Calendly link (15-minute discovery call).
  // e.g. "https://calendar.app.google/XXXXXXXX" or "https://calendly.com/your-handle/15min"
  bookingUrl: "",

  // Lead form submission.
  // Works out-of-the-box with Web3Forms (free): get an access key at https://web3forms.com
  // and paste it below. Leads will arrive in your inbox.
  // Alternatively, set `endpoint` to a Formspree URL (https://formspree.io/f/xxxx) or your own API
  // that accepts JSON POST, and leave accessKey empty.
  form: {
    endpoint: "https://api.web3forms.com/submit",
    accessKey: "", // TODO: Web3Forms access key
    subject: "New website enquiry — Nikavi Studio",
    timeoutMs: 15000
  },

  // TODO: Social profile URLs. Leave empty to hide a link.
  socials: {
    instagram: "", // TODO: e.g. "https://www.instagram.com/nikavistudio"
    linkedin: "",
    facebook: ""
  }
};
