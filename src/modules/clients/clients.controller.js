import Client from "./clients.model.js";

// GET /api/clients?type=vendor|client&search=...
export const getClients = async (req, res) => {
  try {
    const { type, search } = req.query;

    const filter = { isActive: true };

    if (type) {
      if (!["client", "vendor"].includes(type)) {
        return res
          .status(400)
          .json({ message: "Invalid type. Use 'client' or 'vendor'" });
      }
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const clients = await Client.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ count: clients.length, data: clients });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/clients/:id
export const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client || !client.isActive) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.status(200).json({ data: client });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// POST /api/clients
export const createClient = async (req, res) => {
  try {
    const { name, type, phone, email, address, notes } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: "Name and type are required" });
    }

    const client = await Client.create({
      name,
      type,
      phone,
      email,
      address,
      notes,
    });

    res
      .status(201)
      .json({ message: "Client created successfully", data: client });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/clients/:id
export const updateClient = async (req, res) => {
  try {
    const { name, type, phone, email, address, notes } = req.body;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { name, type, phone, email, address, notes },
      { new: true, runValidators: true },
    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res
      .status(200)
      .json({ message: "Client updated successfully", data: client });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// DELETE /api/clients/:id (soft delete)
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.status(200).json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
