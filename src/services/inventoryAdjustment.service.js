import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import Product from "../models/Product.js";
import InventoryTransaction from "../models/InventoryTransaction.js";

const createError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

export const adjustInventory = async (body, createdById) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      productId,
      branchId,
      actualQuantity,
      reason,
      notes = null,
    } = body;

    const actualQty = Number(actualQuantity);

    const branch = await Branch.findById(branchId).session(session);
    if (!branch) {
      throw createError("Branch not found", 404);
    }

    const productEntry = branch.products.find(
      (p) => p.product.toString() === productId.toString(),
    );

    if (!productEntry) {
      throw createError("Product not found in this branch", 404);
    }

    const product = await Product.findById(productId)
      .select("name")
      .session(session);

    if (!product) {
      throw createError("Product not found", 404);
    }

    const quantityBefore = Number(productEntry.quantity || 0);
    const difference = actualQty - quantityBefore;

    if (difference === 0) {
      throw createError(
        "Actual quantity matches current system quantity. No adjustment required.",
        422,
      );
    }

    const transactionType = difference > 0 ? "adjustment_in" : "adjustment_out";
    const adjustmentQuantity = Math.abs(difference);

    productEntry.quantity = actualQty;

    await branch.save({ session });

    const [transaction] = await InventoryTransaction.create(
      [
        {
          productId,
          productName: product.name,
          branchId: branch._id,
          branchName: branch.name,
          transactionType,
          quantity: adjustmentQuantity,
          quantityBefore,
          quantityAfter: actualQty,
          reason,
          notes,
          createdBy: createdById,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    return transaction;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};
