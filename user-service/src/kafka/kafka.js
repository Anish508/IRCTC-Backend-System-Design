import { Kafka, Partitioners } from "kafkajs";
import config from "../config/index.js";
import logger from "../config/logger.js";

/**
 * Singleton Kafka Client instance
 * Initialized once and reused across the entire user-service process
 */
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID || "user-service",
    brokers: [config.KAFKA_BROKER || "localhost:9093"]
});

/**
 * Singleton Producer instance
 */
export const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner
});

let isConnected = false;

/**
 * Connects the Kafka producer if not already connected
 */
export async function connectProducer() {
    if (!isConnected) {
        await producer.connect();
        isConnected = true;
        logger.info("[Kafka] Producer connected successfully");
    }
}

/**
 * Disconnects the Kafka producer during graceful shutdown
 */
export async function disconnectProducer() {
    if (isConnected) {
        await producer.disconnect();
        isConnected = false;
        logger.info("[Kafka] Producer disconnected");
    }
}

export default kafka;
