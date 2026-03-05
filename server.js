const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { createMeetingEvent } = require('./calendarService');
const { createContactEvent } = require('./contactCalendarService');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Railway/Render reverse proxy)
const PORT = process.env.PORT || 3001;

// File to persist booked slots
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');

// Load existing bookings or initialize empty object
let bookedSlots = {};
try {
    if (fs.existsSync(BOOKINGS_FILE)) {
        bookedSlots = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
    }
} catch (error) {
    console.log('No existing bookings file, starting fresh');
    bookedSlots = {};
}

// Save bookings to file
const saveBookings = () => {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookedSlots, null, 2));
};

// Rate limiting: 10 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Allowed origins for CORS
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://cyart.io',
    'https://www.cyart.io',
    'https://cyart.in',
    'https://www.cyart.in'
];

// Add custom FRONTEND_URL if set
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());
app.use('/api/', limiter);

// Root endpoint
app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'CyArt Meeting API is running. Access /api/health for detailed status.' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'CyArt Meeting API is running' });
});

// Get booked slots for a specific date
app.get('/api/booked-slots', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.json({ bookedSlots: [] });
    }

    const slots = bookedSlots[date] || [];
    res.json({ bookedSlots: slots });
});

// Meeting booking endpoint
app.post('/api/schedule-meeting', async (req, res) => {
    try {
        const { name, email, phone, company, agenda, attendees, date, time, duration, referral } = req.body;

        // Validation
        if (!name || !email || !agenda || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, email, agenda, date, and time are required'
            });
        }

        // Check if slot is already booked
        if (bookedSlots[date] && bookedSlots[date].includes(time)) {
            return res.status(409).json({
                success: false,
                error: 'This time slot is already booked. Please select another time.'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Prepare meeting data
        const meetingData = {
            name,
            email,
            phone: phone || '',
            company: company || '',
            agenda,
            attendees: attendees || '',
            date,
            time,
            duration: duration || '30m',
            referral: referral || ''
        };

        // Create Google Calendar event
        const calendarResult = await createMeetingEvent(meetingData);

        // Save the booked slot
        if (!bookedSlots[date]) {
            bookedSlots[date] = [];
        }
        bookedSlots[date].push(time);
        saveBookings();

        // Log the booking
        console.log('Meeting booked:', {
            name,
            email,
            date,
            time,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({
            success: true,
            message: 'Meeting booked successfully! A calendar event has been created.',
            meetLink: calendarResult.meetLink
        });

    } catch (error) {
        console.error('Error processing meeting booking:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to book meeting. Please try again or contact support.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, company, message } = req.body;

        // Validation
        if (!name || !email || !company || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, email, company, and message are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Create calendar event
        const result = await createContactEvent({ name, email, company, message });

        console.log('Contact form submitted:', { name, email, company, timestamp: new Date().toISOString() });

        res.status(200).json({
            success: true,
            message: 'Message received! We will get back to you shortly.'
        });

    } catch (error) {
        console.error('Error processing contact form:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit message. Please try again or email us directly.'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server - bind to 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║   CyArt Meeting Booking API Server    ║
╠════════════════════════════════════════╣
║  Status: Running                       ║
║  Port: ${PORT}                           ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
║  Email: ${process.env.EMAIL_USER || 'Not configured'}     ║
╚════════════════════════════════════════╝
    `);
});

module.exports = app;
