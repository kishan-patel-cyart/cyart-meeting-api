const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Format referral source for display (e.g., "healthtech" -> "HealthTech")
const formatReferral = (referral) => {
    if (!referral) return null;
    // Convert hyphenated names to title case (cyvul-track -> CyVul Track)
    return referral
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .replace('Cyvul', 'CyVul')
        .replace('Cyshield', 'CyShield');
};

// Send meeting booking email
const sendMeetingEmail = async (meetingData) => {
    const { name, email, phone, company, agenda, attendees, date, time, duration, referral } = meetingData;

    const formattedReferral = formatReferral(referral);
    const subjectLine = formattedReferral
        ? `Demo For ${formattedReferral} - ${name}`
        : `New Meeting Booking from ${name}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'inquiry@cyart.io', // Your email where bookings will be sent
        subject: subjectLine,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #000 0%, #1a1a1a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .referral-badge { display: inline-block; background: #ff6b35; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-block { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #ff6b35; }
                    .label { font-weight: bold; color: #ff6b35; margin-bottom: 5px; }
                    .value { color: #333; margin-bottom: 15px; }
                    .meeting-details { background: #fff5f0; padding: 15px; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🗓️ ${formattedReferral ? `Demo Request - ${formattedReferral}` : 'New Meeting Booking'}</h1>
                        ${formattedReferral ? `<div class="referral-badge">Source: ${formattedReferral}</div>` : ''}
                    </div>
                    <div class="content">
                        <div class="meeting-details">
                            <h2 style="margin-top: 0; color: #ff6b35;">📅 Meeting Schedule</h2>
                            <p><strong>Date:</strong> ${date}</p>
                            <p><strong>Time:</strong> ${time}</p>
                            <p><strong>Duration:</strong> ${duration}</p>
                        </div>

                        <div class="info-block">
                            <div class="label">Contact Person</div>
                            <div class="value">${name}</div>

                            <div class="label">Email</div>
                            <div class="value"><a href="mailto:${email}">${email}</a></div>

                            ${phone ? `
                            <div class="label">Phone</div>
                            <div class="value">${phone}</div>
                            ` : ''}

                            ${company ? `
                            <div class="label">Company</div>
                            <div class="value">${company}</div>
                            ` : ''}
                            
                            ${formattedReferral ? `
                            <div class="label">Demo Request Source</div>
                            <div class="value">${formattedReferral}</div>
                            ` : ''}
                        </div>

                        ${attendees ? `
                        <div class="info-block">
                            <div class="label">Meeting Attendees</div>
                            <div class="value">${attendees}</div>
                        </div>
                        ` : ''}

                        <div class="info-block">
                            <div class="label">Meeting Agenda</div>
                            <div class="value">${agenda}</div>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated email from CyArt Meeting Booking System</p>
                        <p>Please respond to ${email} to confirm the meeting</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        // Plain text version as fallback
        text: `
New Meeting Booking

Meeting Details:
Date: ${date}
Time: ${time}
Duration: ${duration}

Contact Information:
Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${company ? `Company: ${company}` : ''}

${attendees ? `Attendees: ${attendees}` : ''}

Agenda:
${agenda}

---
Please respond to ${email} to confirm the meeting.
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = { sendMeetingEmail };
