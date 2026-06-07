import * as paymentService from "../services/payment.service.js";

// POST /api/payments
export const createPayment = async (req, res, next) => {
  try {
    const { invoice, paymentTransaction } = await paymentService.createPayment(
      req.body,
      req.user._id
    );

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: { invoice, paymentTransaction },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/payments
export const getPayments = async (req, res, next) => {
  try {
    const result = await paymentService.getPayments(req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/clients/:id/balance
export const getClientBalance = async (req, res, next) => {
  try {
    const result = await paymentService.getClientBalance(
      req.params.id,
      req.query
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
