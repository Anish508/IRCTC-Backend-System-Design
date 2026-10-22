import { Router } from "express";
import {
    createStation,
    getAllStations,
    getStationById,
    getStationByIdInternal
} from "../controllers/station.controller.js";
import { requireAuth, requireAdmin } from "../middlewares/getContext.middleware.js";

const router = Router();

// Internal service route for inter-service communication
router.get("/internal/:stationId", getStationByIdInternal);

// Protect all administrative station management routes
router.use(requireAuth, requireAdmin);

router.post("/", createStation);
router.get("/", getAllStations);
router.get("/:stationId", getStationById);

export default router;
