import * as invoiceService from "../services/invoice.service.js";

// POST /invoices 
export const createInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.body, req.user._id);

    return res.status(201).json({
      success : true,
      message : "Invoice created successfully",
      data    : invoice,
    });
  } catch (err) {
    next(err);
  }
};

// GET /invoices 
export const getInvoices = async (req, res, next) => {
  try {
    const result = await invoiceService.getInvoices(req.query);

    return res.status(200).json({
      success : true,
      data    : result,
    });
  } catch (err) {
    next(err);
  }
};

// GET /invoices/:id 
export const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);

    return res.status(200).json({
      success : true,
      data    : invoice,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.cancelInvoice(
      req.params.id,
      req.user._id,
      req.body.reason
    );

    return res.status(200).json({
      success: true,
      message: "Invoice cancelled successfully",
      data: invoice,
    });
  } catch (err) {
    next(err);
  }
};