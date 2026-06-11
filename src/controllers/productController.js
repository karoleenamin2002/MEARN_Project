import Product from '../models/Product.js';
import Branch from '../models/Branch.js';
import APIFeatures from '../utils/apiFeatures.js';

export const getProducts = async (req, res, next) => {
  try {
    const features = new APIFeatures(Product.find(), req.query).filter().sort().paginate();
    const products = await features.query;

    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};

export const getLowStock = async (req, res, next) => {
  try {
    const branches = await Branch.find().populate('products.product');

    const lowStockProducts = [];

    branches.forEach((branch) => {
      branch.products.forEach((item) => {
        if (item.quantity <= item.minimumStock) {
          lowStockProducts.push({
            branchId: branch._id,
            branchName: branch.name,
            product: item.product,
            quantity: item.quantity,
            minimumStock: item.minimumStock,
          });
        }
      });
    });

    res.json({
      success: true,
      count: lowStockProducts.length,
      data: lowStockProducts,
    });
  } catch (error) {
    next(error);
  }
};