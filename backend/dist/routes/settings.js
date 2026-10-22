"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GeneralSettingsController_1 = require("../controllers/GeneralSettingsController");
const router = (0, express_1.Router)();
router.get('/general', GeneralSettingsController_1.GeneralSettingsController.getPublicSettings);
exports.default = router;
