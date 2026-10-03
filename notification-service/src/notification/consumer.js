import { consumer } from "../kafka/kafka.js";
import { TOPICS } from "../kafka/topics.js";
import { sendOtpEmail, sendWelcomeEmail } from "./emailService.js";
import logger from "../config/logger.js";

/**
 * Handles incoming OTP email events
 * Validates payload and checks expiration before sending
 */
async function handleOtpEmailEvent(event) {
    const { eventId, data } = event;

    // 1. Basic validation (Non-retryable: dropping invalid messages)
    if (!data?.email || !data?.otp) {
        logger.warn(`[Consumer] Dropping invalid OTP event: missing email or otp. EventId: ${eventId}`);
        return;
    }

    // 2. Expiration check: Drop stale OTPs if delayed past validity
    if (data.expiresAt && new Date() > new Date(data.expiresAt)) {
        logger.warn(
            `[Consumer] Dropping expired OTP email for: ${data.email}. Expired at: ${data.expiresAt}`
        );
        return;
    }

    // 3. Delegate to Email Service (Retryable if SendGrid/network fails)
    logger.info(`[Consumer] Processing OTP email for: ${data.email} (Event: ${eventId})`);
    await sendOtpEmail({
        email: data.email,
        firstName: data.firstName,
        otp: data.otp
    });
}

/**
 * Handles incoming Welcome email events
 */
async function handleWelcomeEmailEvent(event) {
    const { eventId, data } = event;

    // 1. Basic validation
    if (!data?.email) {
        logger.warn(`[Consumer] Dropping invalid Welcome event: missing email. EventId: ${eventId}`);
        return;
    }

    // 2. Delegate to Email Service
    logger.info(`[Consumer] Processing Welcome email for: ${data.email} (Event: ${eventId})`);
    await sendWelcomeEmail({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName
    });
}

/**
 * Starts the Kafka consumer and processes incoming messages
 */
export async function startConsumer() {
    await consumer.connect();
    logger.info("[Kafka Consumer] Connected to broker");

    // Subscribe to both topics
    await consumer.subscribe({ topic: TOPICS.EMAIL_OTP, fromBeginning: true });
    await consumer.subscribe({ topic: TOPICS.EMAIL_WELCOME, fromBeginning: true });
    logger.info(`[Kafka Consumer] Subscribed to topics: ${TOPICS.EMAIL_OTP}, ${TOPICS.EMAIL_WELCOME}`);

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const rawValue = message.value?.toString();
            if (!rawValue) return;

            // Step 1: Parse JSON
            let event;
            try {
                event = JSON.parse(rawValue);
            } catch (err) {
                // Invalid JSON is a "poison pill" -> log and do NOT re-throw to avoid infinite retry loops
                logger.error(`[Consumer] Malformed JSON received on ${topic}: ${rawValue}`);
                return;
            }

            // Step 2: Route by topic
            switch (topic) {
                case TOPICS.EMAIL_OTP:
                    await handleOtpEmailEvent(event);
                    break;

                case TOPICS.EMAIL_WELCOME:
                    await handleWelcomeEmailEvent(event);
                    break;

                default:
                    logger.warn(`[Consumer] Unhandled topic: ${topic}`);
            }
        }
    });
}

/**
 * Disconnects the Kafka consumer during graceful shutdown
 */
export async function stopConsumer() {
    await consumer.disconnect();
    logger.info("[Kafka Consumer] Disconnected");
}

export default {
    startConsumer,
    stopConsumer
};
