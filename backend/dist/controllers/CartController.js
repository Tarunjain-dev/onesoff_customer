"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const CartService_1 = require("../services/CartService");
exports.CartController = {
    async getCart(req, res) {
        try {
            const userId = String(req.user?.userId || '').trim();
            if (!userId) {
                throw new Error('Unauthorized');
            }
            const cart = await CartService_1.CartService.getCart(userId);
            return ApiResponse_1.ApiResponse.success(res, cart);
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async addToCart(req, res) {
        try {
            const userId = String(req.user?.userId || '').trim();
            if (!userId) {
                throw new Error('Unauthorized');
            }
            const { productId, variantId, quantity, rentalPeriod, issueDate, returnDate, size, color, imageUrl, alterationRequired } = req.body;
            const cart = await CartService_1.CartService.addToCart(userId, productId, variantId, quantity, {
                rentalPeriod,
                issueDate,
                returnDate,
                size,
                color,
                imageUrl,
                alterationRequired
            });
            return ApiResponse_1.ApiResponse.success(res, cart, 'Added to cart');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async removeFromCart(req, res) {
        try {
            const userId = String(req.user?.userId || '').trim();
            if (!userId) {
                throw new Error('Unauthorized');
            }
            const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
            if (!itemId) {
                throw new Error('itemId is required');
            }
            await CartService_1.CartService.removeFromCart(userId, parseInt(itemId, 10));
            return ApiResponse_1.ApiResponse.success(res, null, 'Removed from cart');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    },
    async clearCart(req, res) {
        try {
            const userId = String(req.user?.userId || '').trim();
            if (!userId) {
                throw new Error('Unauthorized');
            }
            await CartService_1.CartService.clearCart(userId);
            return ApiResponse_1.ApiResponse.success(res, null, 'Cart cleared');
        }
        catch (error) {
            return ApiResponse_1.ApiResponse.error(res, error.message);
        }
    }
};
