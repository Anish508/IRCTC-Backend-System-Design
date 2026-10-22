import { Router } from "express";
import {
    createSchedule,
    cancelSchedule,
    getAllSchedules
} from "../controllers/schedule.controller.js";
import { requireAuth, requireAdmin } from "../middlewares/getContext.middleware.js";

const router = Router();

// Protect all schedule routes - requires authenticated administrator
router.use(requireAuth, requireAdmin);

router.post("/", createSchedule);
router.get("/", getAllSchedules);
router.patch("/:scheduleId/cancel", cancelSchedule);
router.put("/:scheduleId/cancel", cancelSchedule);

export default router;
