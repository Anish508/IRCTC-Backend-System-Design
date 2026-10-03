import { Kafka } from "kafkajs";
import config from "../config/index.js";

/**
 * Singleton Kafka Client instance
 */
const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID || "notification-service",
    brokers: [config.KAFKA_BROKER || "localhost:9093"]
});

/**
 * Singleton Consumer instance.
 *
 * NOTE on Consumer Group ("notification-service"):
 * Multiple instances of notification-service using the same group will divide
 * Kafka partitions between them instead of processing every message multiple times.
 */
export const consumer = kafka.consumer({
    groupId: config.KAFKA_GROUP_ID || "notification-service"
});

export default kafka;
