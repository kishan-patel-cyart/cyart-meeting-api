const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

// Initialize Google Auth - supports both env var (production) and JSON file (local dev)
let auth;

if (process.env.GOOGLE_CREDENTIALS) {
    // Production: Read credentials from environment variable (JSON string)
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });
} else {
    // Local dev: Read credentials from JSON file
    auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });
}

const calendar = google.calendar({ version: 'v3', auth });

// Format referral source for display
const formatReferral = (referral) => {
    if (!referral) return null;
    return referral
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .replace('Cyvul', 'CyVul')
        .replace('Cyshield', 'CyShield');
};

// Create Google Calendar event
const createMeetingEvent = async (meetingData) => {
    const { name, email, phone, company, agenda, attendees, date, time, duration, referral } = meetingData;

    try {
        const currentYear = new Date().getFullYear();
        // date string format from frontend: "Mon, Mar 9"
        const dateParts = date.split(', ')[1].split(' '); // ["Mar", "9"]
        const monthStr = dateParts[0];
        const dayInt = parseInt(dateParts[1]);

        const monthMap = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const monthInt = monthMap[monthStr];

        // time string format: "3:00 PM"
        const timeParts = time.split(' ');
        const timeValue = timeParts[0].split(':');
        let hours = parseInt(timeValue[0]);
        const minutes = parseInt(timeValue[1]);
        const ampm = timeParts[1];

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        // Build ISO date string in IST (Asia/Kolkata = UTC+5:30)
        const pad = (n) => String(n).padStart(2, '0');
        const isoStart = `${currentYear}-${pad(monthInt + 1)}-${pad(dayInt)}T${pad(hours)}:${pad(minutes)}:00`;

        const durationMinutes = parseInt(duration.replace('m', '')) || 30;
        const endDate = new Date(currentYear, monthInt, dayInt, hours, minutes + durationMinutes);
        const isoEnd = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

        const formattedReferral = formatReferral(referral);
        const eventTitle = formattedReferral
            ? `Demo For ${formattedReferral} - ${name}${company ? ` (${company})` : ''}`
            : `Meeting with ${name}${company ? ` (${company})` : ''}`;

        const description = [
            `📋 Contact Info:`,
            `Name: ${name}`,
            `Email: ${email}`,
            phone ? `Phone: ${phone}` : null,
            company ? `Company: ${company}` : null,
            formattedReferral ? `Source: ${formattedReferral}` : null,
            ``,
            attendees ? `👥 Attendees: ${attendees}` : null,
            ``,
            `📝 Agenda:`,
            agenda
        ].filter(Boolean).join('\n');

        const event = {
            summary: eventTitle,
            description: description,
            start: {
                dateTime: isoStart,
                timeZone: 'Asia/Kolkata',
            },
            end: {
                dateTime: isoEnd,
                timeZone: 'Asia/Kolkata',
            },
            conferenceData: {
                createRequest: {
                    requestId: `cyart-meeting-${Date.now()}`,
                    conferenceSolutionKey: {
                        type: 'hangoutsMeet'
                    }
                }
            }
        };

        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
            conferenceDataVersion: 1,
        });

        console.log('Event created successfully:', response.data.htmlLink);

        return {
            success: true,
            eventId: response.data.id,
            meetLink: response.data.hangoutLink
        };

    } catch (error) {
        console.error('Error creating Google Calendar event:', error);
        throw error;
    }
};

module.exports = { createMeetingEvent };
