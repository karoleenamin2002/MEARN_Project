import Branch from "../models/Branch.js";
import Product from "../models/Product.js";
import Transfer from "../models/Transfer.js";
import InventoryTransaction from "../models/InventoryTransaction.js";

// POST /api/transfers
export const createTransfer = async (req, res, next) => {
  try {
    const { fromBranchId, toBranchId, productId, quantity, notes } = req.body;

    // Validate required fields
    if (!fromBranchId || !toBranchId || !productId || !quantity) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "fromBranchId, toBranchId, productId, and quantity are required",
        });
    }

    if (fromBranchId === toBranchId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Source and destination branches must be different",
        });
    }

    // Get both branches and product in parallel
    const [fromBranch, toBranch, product] = await Promise.all([
      Branch.findById(fromBranchId),
      Branch.findById(toBranchId),
      Product.findById(productId),
    ]);

    if (!fromBranch)
      return res
        .status(404)
        .json({ success: false, message: "Source branch not found" });
    if (!toBranch)
      return res
        .status(404)
        .json({ success: false, message: "Destination branch not found" });
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    // Check product exists in source branch and has enough quantity
    const fromProduct = fromBranch.products.find(
      (p) => p.product.toString() === productId,
    );
    if (!fromProduct) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Product does not exist in source branch",
        });
    }
    if (fromProduct.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient quantity. Available: ${fromProduct.quantity}, Requested: ${quantity}`,
      });
    }

    // Deduct from source branch
    const fromQuantityBefore = fromProduct.quantity;
    fromProduct.quantity -= quantity;

    // Add to destination branch (create if not exists)
    const toProduct = toBranch.products.find(
      (p) => p.product.toString() === productId,
    );
    const toQuantityBefore = toProduct ? toProduct.quantity : 0;

    if (toProduct) {
      toProduct.quantity += quantity;
    } else {
      toBranch.products.push({ product: productId, quantity });
    }

    // Save both branches
    await Promise.all([fromBranch.save(), toBranch.save()]);

    // Save transfer record
    const transfer = await Transfer.create({
      fromBranch: fromBranchId,
      toBranch: toBranchId,
      product: productId,
      quantity,
      notes,
      createdBy: req.user?._id,
    });

    // Log inventory transactions for both branches
    await InventoryTransaction.insertMany([
      {
        productId,
        productName: product.name,
        branchId: fromBranchId,
        branchName: fromBranch.name,
        transactionType: "adjustment",
        quantity: -quantity,
        quantityBefore: fromQuantityBefore,
        quantityAfter: fromProduct.quantity,
        notes: `Transfer to ${toBranch.name}`,
      },
      {
        productId,
        productName: product.name,
        branchId: toBranchId,
        branchName: toBranch.name,
        transactionType: "adjustment",
        quantity: quantity,
        quantityBefore: toQuantityBefore,
        quantityAfter: toQuantityBefore + quantity,
        notes: `Transfer from ${fromBranch.name}`,
      },
    ]);

    res.status(201).json({
      success: true,
      message: "Transfer completed successfully",
      data: transfer,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/transfers
export const getTransfers = async (req, res, next) => {
  try {
    const transfers = await Transfer.find()
      .populate("fromBranch", "name")
      .populate("toBranch", "name")
      .populate("product", "name barcode")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: transfers.length, data: transfers });
  } catch (error) {
    next(error);
  }
};

// GET /api/transfers/:id
export const getTransferById = async (req, res, next) => {
  try {
    const transfer = await Transfer.findById(req.params.id)
      .populate("fromBranch", "name address")
      .populate("toBranch", "name address")
      .populate("product", "name barcode")
      .populate("createdBy", "name");

    if (!transfer) {
      return res
        .status(404)
        .json({ success: false, message: "Transfer not found" });
    }

    res.json({ success: true, data: transfer });
  } catch (error) {
    next(error);
  }
};
