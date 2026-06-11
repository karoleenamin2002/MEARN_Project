import { checkAvailableAICredits } from "../services/subscription.service.js";
import AppError from "../utils/appError.js";

const checkAIUsage = (requiredCredits = 1) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError("Authentication required before AI credit check.", 401));
      }

      // Will throw AppError if no active subscription or insufficient credits
      const subscription = await checkAvailableAICredits(
        req.user._id,
        requiredCredits
      );

    
      req.activeSubscription = subscription;

 
      req.aiCreditCost = requiredCredits;

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default checkAIUsage;
