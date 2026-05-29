import Notification from '../models/Notification.js';

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find()
      .populate('relatedProductId', 'name')
      .sort('-createdAt')
      .limit(50);
    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, $addToSet: { readBy: req.user._id } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { readBy: { $nin: [req.user._id] } },
      { isRead: true, $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// @desc    Create notification
// @route   POST /api/notifications
// @access  Private/Admin
export const createNotification = async (req, res, next) => {
  try {
    const notification = await Notification.create(req.body);
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};
