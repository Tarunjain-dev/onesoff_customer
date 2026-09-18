import { Response } from 'express';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/ApiResponse';
import { CartService } from '../services/CartService';

export const CartController = {
  async getCart(req: AuthRequest, res: Response) {
    try {
      const userId = String(req.user?.userId || '').trim();
      if (!userId) {
        throw new Error('Unauthorized');
      }
      const cart = await CartService.getCart(userId);
      return ApiResponse.success(res, cart);
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async addToCart(req: AuthRequest, res: Response) {
    try {
      const userId = String(req.user?.userId || '').trim();
      if (!userId) {
        throw new Error('Unauthorized');
      }
      const { productId, variantId, quantity, rentalPeriod, issueDate, returnDate, size, color, imageUrl, alterationRequired } = req.body;
      const cart = await CartService.addToCart(userId, productId, variantId, quantity, {
        rentalPeriod,
        issueDate,
        returnDate,
        size,
        color,
        imageUrl,
        alterationRequired
      });
      return ApiResponse.success(res, cart, 'Added to cart');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async removeFromCart(req: AuthRequest, res: Response) {
    try {
      const userId = String(req.user?.userId || '').trim();
      if (!userId) {
        throw new Error('Unauthorized');
      }
      const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
      if (!itemId) {
        throw new Error('itemId is required');
      }
      await CartService.removeFromCart(userId, parseInt(itemId, 10));
      return ApiResponse.success(res, null, 'Removed from cart');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  },

  async clearCart(req: AuthRequest, res: Response) {
    try {
      const userId = String(req.user?.userId || '').trim();
      if (!userId) {
        throw new Error('Unauthorized');
      }
      await CartService.clearCart(userId);
      return ApiResponse.success(res, null, 'Cart cleared');
    } catch (error: any) {
      return ApiResponse.error(res, error.message);
    }
  }
};
