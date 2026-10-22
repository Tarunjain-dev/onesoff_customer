"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CategoryController_1 = require("../../controllers/CategoryController");
const router = (0, express_1.Router)();
router.get('/', CategoryController_1.CategoryController.listCategories);
exports.default = router;
