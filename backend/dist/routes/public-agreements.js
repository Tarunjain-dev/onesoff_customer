"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AgreementController_1 = require("../controllers/AgreementController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/', AgreementController_1.AgreementController.getPublicAgreements);
router.post('/:agreementId/accept', auth_1.authenticate, AgreementController_1.AgreementController.acceptAgreement);
exports.default = router;
