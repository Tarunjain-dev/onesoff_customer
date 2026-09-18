import express from "express";
import cors from "cors";
import helmet from "helmet";
import { corsOptions } from "./config/cors";
import authRoutes from "./routes/auth";
import vendorProfileRoutes from "./routes/vendor-profile";
import productRoutes from "./routes/products";
import categoryRoutes from "./routes/categories";
import kycRoutes from "./routes/kyc";
import uploadRoutes from "./routes/upload";
import orderRoutes from "./routes/orders";
import returnRoutes from "./routes/returns";
import vendorRoutes from "./routes/vendors";
import couponRoutes from "./routes/coupons";
import trialRoutes from "./routes/trials";
import adminRoutes from "./routes/admin.routes";
import adminAsVendorSupportRoutes from "./routes/admin-as-vendor-support";
import adminStaffRoutes from "./routes/admin-staff";
import reviewRoutes from "./routes/reviews";
import searchRoutes from "./routes/search";
import customerRoutes from "./routes/customers";
import cartRoutes from "./routes/cart";
import notificationRoutes from "./routes/notifications";
import paymentRoutes from "./routes/payments";
import settingsRoutes from "./routes/settings";
import agreementRoutes from "./routes/agreements";
import publicAgreementRoutes from "./routes/public-agreements";
import { bigintSerializerMiddleware } from "./middlewares/bigintSerializer";
import { errorHandler } from "./middlewares/errorHandler";
import logger from "./utils/logger";


const app = express();

app.use(cors());
app.use(helmet());
app.use('/payments/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bigintSerializerMiddleware);

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Server is Working " });
});

app.use("/api",customerRoutes)
app.use("/auth", authRoutes);
app.use("/vendor-profile", vendorProfileRoutes);
app.use("/products", productRoutes);
app.use("/categories", categoryRoutes);
app.use("/kyc", kycRoutes);
app.use("/upload", uploadRoutes);
app.use("/orders", orderRoutes);
app.use("/returns", returnRoutes);
app.use("/vendors", vendorRoutes);
app.use("/coupons", couponRoutes);
app.use("/trials", trialRoutes);
app.use("/admin", adminRoutes);
app.use("/admin-as-vendor/support", adminAsVendorSupportRoutes);
app.use("/admin-staff", adminStaffRoutes);
app.use("/reviews", reviewRoutes);
app.use("/search", searchRoutes);
app.use("/customers", customerRoutes);
app.use("/cart", cartRoutes);
app.use("/notifications", notificationRoutes);
app.use("/payments", paymentRoutes);
app.use("/settings", settingsRoutes);
app.use("/agreements", agreementRoutes);
app.use("/public/agreements", publicAgreementRoutes);

// Global error handler
app.use(errorHandler);

export default app;
