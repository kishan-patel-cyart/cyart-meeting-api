const { google } = require('googleapis');
require('dotenv').config();

// Initialize Google Auth for the "Talk to Us" contact form
let auth;

if (process.env.GOOGLE_CRED_CONTACT) {
    const credentials = JSON.parse(process.env.GOOGLE_CRED_CONTACT);
    auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });
} else {
    // Local dev fallback
    const path = require('path');
    auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'google-credentials-contact.json'),
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });
}

const calendar = google.calendar({ version: 'v3', auth });

// Create a calendar event for a contact form submission
const createContactEvent = async (contactData) => {
    const { name, email, company, message } = contactData;

    try {
        // Create event starting now, lasting 15 minutes (as a reminder to follow up)
        const now = new Date();
        const end = new Date(now.getTime() + 15 * 60000);

        const eventTitle = `📩 Contact: ${name} - ${company}`;

        const description = [
            `📋 Contact Form Submission`,
            ``,
            `Name: ${name}`,
            `Email: ${email}`,
            `Company: ${company}`,
            ``,
            `📝 Message:`,
            message,
            ``,
            `---`,
            `Reply to: ${email}`
        ].join('\n');

        const event = {
            summary: eventTitle,
            description: description,
            start: {
                dateTime: now.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            end: {
                dateTime: end.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            colorId: '11', // Red color to stand out as a follow-up item
        };

        const calendarId = process.env.GOOGLE_CALENDAR_ID_CONTACT || process.env.GOOGLE_CALENDAR_ID || 'primary';

        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });

        console.log('Contact event created:', response.data.htmlLink);

        return {
            success: true,
            eventId: response.data.id,
            eventLink: response.data.htmlLink
        };

    } catch (error) {
        console.error('Error creating contact calendar event:', error);
        throw error;
    }
};

module.exports = { createContactEvent };
