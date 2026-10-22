import asyncHandler from "../utils/asyncHandler.js";
import { BadRequestError } from "../utils/error.js";
import * as scheduleService from "../services/schedule.service.js";

export const createSchedule = asyncHandler(async (req, res) => {
    const { trainId, departureDate } = req.body;

    if (!trainId || !departureDate) {
        throw new BadRequestError("trainId and departureDate are required");
    }

    const schedule = await scheduleService.createSchedule({ trainId, departureDate });
    return res.status(201).json({
        success: true,
        message: "Train Schedule created successfully",
        data: schedule
    });
});

export const cancelSchedule = asyncHandler(async (req, res) => {
    const { scheduleId } = req.params;
    if (!scheduleId) {
        throw new BadRequestError("ScheduleId is missing");
    }

    const schedule = await scheduleService.cancelSchedule(scheduleId);
    return res.status(200).json({
        success: true,
        message: "Schedule cancelled",
        data: schedule
    });
});

export const getAllSchedules = asyncHandler(async (req, res) => {
    const schedules = await scheduleService.getAllSchedules(req.query);
    res.status(200).json({ success: true, data: schedules });
});

export default {
    createSchedule,
    cancelSchedule,
    getAllSchedules
};
