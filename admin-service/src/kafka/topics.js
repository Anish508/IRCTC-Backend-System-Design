/**
 * Centralized Kafka Topic definitions for Admin Service
 */
export const KAFKA_TOPICS = {
    STATION_CREATED: "station.created",
    TRAIN_CREATED: "train.created",
    ROUTE_CREATED: "route.created",
    SCHEDULE_CREATED: "schedule.created",
    SCHEDULE_CANCELLED: "schedule.cancelled"
};

export const TOPICS = KAFKA_TOPICS;
export default KAFKA_TOPICS;
