import mongoose from "mongoose";
import InventoryCount from "../models/InventoryCount.js";
import Branch from "../models/Branch.js";
import InventoryTransaction from "../models/InventoryTransaction.js";

export const initiateCount = async (req, res, next) => {
  try {
    console.log(req.user);
    const { branchId, notes } = req.body;
    const activeCount = await InventoryCount.findOne({
      branch: branchId,
      status: "initiated",
    });
    if (activeCount) {
      const error = new Error(
        `There is already an active inventory count running for branch ID ${branchId}. Complete or cancel it first.`,
      );
      error.statusCode = 400;
      throw error;
    }
    const branch = await Branch.findById(branchId);
    if (!branch) {
      const error = new Error("Branch not found.");
      error.statusCode = 404;
      throw error;
    }

    const items = branch.products.map((p) => ({
      product: p.product,
      expectedQuantity: p.quantity,
      countedQuantity: null,
      variance: null,
    }));

    const count = await InventoryCount.create({
      branch: branchId,
      status: "initiated",
      countedBy: req.user._id,
      items,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Inventory count initiated successfully",
      data: count,
    });
  } catch (error) {
    next(error);
  }
};

export const getCounts = async (req, res, next) => {
  try {
    const counts = await InventoryCount.find()
      .populate("branch", "name address")
      .populate("countedBy", "name email")
      .populate("items.product", "name barcode category sellPrice buyPrice");

    res.json({
      success: true,
      count: counts.length,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
};

export const getCount = async (req, res, next) => {
  try {
    const count = await InventoryCount.findById(req.params.id)
      .populate("branch", "name address")
      .populate("countedBy", "name email")
      .populate("items.product", "name barcode category sellPrice buyPrice");

    if (!count) {
      const error = new Error("Inventory count not found");
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      data: count,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCount = async (req, res, next) => {
  try {
    const { items, notes } = req.body;
    const count = await InventoryCount.findById(req.params.id);

    if (!count) {
      const error = new Error("Inventory count not found");
      error.statusCode = 404;
      throw error;
    }

    if (count.status !== "initiated") {
      const error = new Error("Inventory count is already completed");
      error.statusCode = 400;
      throw error;
    }

    for (const item of items) {
      const actualItem = count.items.find(
        (i) => i.product.toString() == item.product.toString(),
      );
      if (actualItem) {
        actualItem.countedQuantity = Number(item.countedQuantity);
      }
      //   console.log(actualItem);
      //   console.log(count.items)
    }
    // console.log(items);
    if (notes) {
      count.notes = notes;
    }

    await count.save();

    res.json({
      message: "Inventory count progress saved successfully",
      data: count,
    });
  } catch (error) {
    next(error);
  }
};
export const completeCount = async (req, res, next) => {
  try {
    const { items, notes } = req.body;
    const count = await InventoryCount.findById(req.params.id);

    if (!count) {
      const error = new Error("Inventory count not found");
      error.statusCode = 404;
      throw error;
    }

    if (count.status !== "initiated") {
      const error = new Error(`Inventory count is already ${count.status}`);
      error.statusCode = 400;
      throw error;
    }
    for (const item of items) {
      const actualItem = count.items.find(
        (i) => i.product.toString() === item.product.toString(),
      );

      if (actualItem) {
        actualItem.countedQuantity = Number(item.countedQuantity);
      }
    }

    for (const item of count.items) {
      if (item.countedQuantity == null) {
        item.countedQuantity = item.expectedQuantity;
      }
    }

    count.status = "completed";
    count.completedAt = new Date();

    if (notes) {
      count.notes = notes;
    }

    await count.save();

    res.json({
      message: "Inventory count completed",
      data: count,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelCount = async (req, res, next) => {
  try {
    const count = await InventoryCount.findById(req.params.id);

    if (!count) {
      const error = new Error("Inventory count not found");
      error.statusCode = 404;
      throw error;
    }

    if (count.status !== "initiated") {
      const error = new Error(`Inventory count is already ${count.status}`);
      error.statusCode = 400;
      throw error;
    }

    count.status = "cancelled";
    await count.save();

    res.json({
      success: true,
      message: "Inventory count cancelled successfully",
      data: count,
    });
  } catch (error) {
    next(error);
  }
};
