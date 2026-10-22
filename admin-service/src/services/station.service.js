import prisma from "../config/prisma.js";
import { ConflictError, NotFoundError } from "../utils/error.js";
import logger from "../config/logger.js";
import adminProducer from "../kafka/producer/admin.producer.js";

export const createStation = async (data) => {
    const existing = await prisma.station.findUnique({
        where: { code: data.code }
    });

    if (existing) {
        throw new ConflictError("Station code already exists");
    }

    const station = await prisma.station.create({
        data
    });

    logger.info("Station Created", { id: station.id, code: station.code });

    // Publish event - fire and forget (non-critical)
    await adminProducer.publishStationCreated(station).catch((err) => {
        logger.error("Failed to publish station created event", { error: err.message });
    });
    return station;
};

export const getAllStations = async (page, limit, search) => {
    const skip = (page - 1) * limit;

    const where = search ? {
        OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } }
        ]
    } : {};

    const [stations, total] = await Promise.all([
        prisma.station.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                name: "asc"
            }
        }),
        prisma.station.count({ where })
    ]);

    return { stations, total };
};

export const getStationById = async (stationId) => {
    const station = await prisma.station.findUnique({
        where: { id: stationId }
    });

    if (!station) {
        throw new NotFoundError("Station not found");
    }

    return station;
};

export default { createStation, getAllStations, getStationById };
