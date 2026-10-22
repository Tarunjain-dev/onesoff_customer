"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SearchController_1 = require("../../controllers/SearchController");
const router = (0, express_1.Router)();
router.get('/', SearchController_1.SearchController.getSuggestions);
exports.default = router;
