import Branch from '../models/Branch.js';

export const createBranch = async (req, res, next) => {
  try {
    const branch = await Branch.create(req.body);

    res.status(201).json({ success: true, data: branch });
  } catch (error) {
    next(error);
  }
};

export const getBranches = async (req, res, next) => {
  try {
    const branches = await Branch.find().populate('products.product');

    res.json({ success: true, count: branches.length, data: branches });
  } catch (error) {
    next(error);
  }
};

export const getBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id).populate('products.product');

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    res.json({ success: true, data: branch });
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    res.json({ success: true, data: branch });
  } catch (error) {
    next(error);
  }
};

export const deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    res.json({ success: true, message: 'Branch deleted' });
  } catch (error) {
    next(error);
  }
};