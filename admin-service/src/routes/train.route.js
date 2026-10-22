import { Router } from "express";
import {
    createTrain,
    createRoute,
    getAllTrains,
    getTrainById
} from "../controllers/train.controller.js";
import { requireAuth, requireAdmin } from "../middlewares/getContext.middleware.js";

const router = Router();

// Protect all train routes - requires authenticated administrator
router.use(requireAuth, requireAdmin);

router.post("/", createTrain);
router.get("/", getAllTrains);
router.post("/routes", createRoute);
router.get("/:trainId", getTrainById);

export default router;
