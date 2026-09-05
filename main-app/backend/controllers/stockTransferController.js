// stockTransferController.js
// NOTE: Stock transfers feature was removed in migration v22 (stores/store_inventory tables dropped).
// All endpoints return 501 until the feature is redesigned without multi-store dependencies.

exports.getAll = async (req, res) => {
  res.status(501).json({ message: 'Stock transfers feature is being redesigned. Coming soon.' });
};

exports.getById = async (req, res) => {
  res.status(501).json({ message: 'Stock transfers feature is being redesigned. Coming soon.' });
};

exports.create = async (req, res) => {
  res.status(501).json({ message: 'Stock transfers feature is being redesigned. Coming soon.' });
};

exports.approve = async (req, res) => {
  res.status(501).json({ message: 'Stock transfers feature is being redesigned. Coming soon.' });
};

exports.cancel = async (req, res) => {
  res.status(501).json({ message: 'Stock transfers feature is being redesigned. Coming soon.' });
};

exports.getStats = async (req, res) => {
  res.status(501).json({ message: 'Stock transfers feature is being redesigned. Coming soon.' });
};
