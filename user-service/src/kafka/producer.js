import crypto from "crypto";
import { producer, connectProducer } from "./kafka.js";
import { TOPICS } from "./topics.js";
import logger from "../config/logger.js";

/**
 * Publishes an OTP_EMAIL event to Kafka
 * @param {object} params
 * @param {string} params.email - Recipient email
 * @param {string} [params.firstName] - Passenger first name
 * @param {string} params.otp - 6-digit numeric OTP
 * @param {number} [params.ttl=300] - Validity in seconds (defaults to 5 minutes)
 */
export async function sendOtpEmailEvent({ email, firstName = "Passenger", otp, ttl = 300 }) {
    await connectProducer();

    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    const event = {
        eventType: "OTP_EMAIL",
        eventId: crypto.randomUUID(),
        data: {
            email,
            firstName,
            otp,
            expiresAt
        }
    };

    await producer.send({
        topic: TOPICS.EMAIL_OTP,
        messages: [
            {
                key: email, // Partition by email to preserve per-user message order
                value: JSON.stringify(event)
            }
        ]
    });

    logger.info(`[Kafka Producer] Published OTP_EMAIL event for: ${email} (Event: ${event.eventId})`);
    return event;
}

/**
 * Publishes a WELCOME_EMAIL event to Kafka upon successful account verification
 * @param {object} params
 * @param {string} params.email - Recipient email
 * @param {string} [params.firstName] - User first name
 * @param {string} [params.lastName] - User last name
 */
export async function sendWelcomeEmailEvent({ email, firstName = "Passenger", lastName = "" }) {
    await connectProducer();

    const event = {
        eventType: "WELCOME_EMAIL",
        eventId: crypto.randomUUID(),
        data: {
            email,
            firstName,
            lastName
        }
    };

    await producer.send({
        topic: TOPICS.EMAIL_WELCOME,
        messages: [
            {
                key: email,
                value: JSON.stringify(event)
            }
        ]
    });

    logger.info(`[Kafka Producer] Published WELCOME_EMAIL event for: ${email} (Event: ${event.eventId})`);
    return event;
}

export default {
    sendOtpEmailEvent,
    sendWelcomeEmailEvent
};
