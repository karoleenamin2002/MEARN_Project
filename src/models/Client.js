import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Client name is required'], trim: true },
    phone: { type: String, trim: true },
    type: { type: String, enum: ['vendor', 'client'], required: [true, 'Client type is required'] },
  },
  { timestamps: true }
);

export default mongoose.model('Client', clientSchema);
