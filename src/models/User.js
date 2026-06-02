import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Define User Schema with validation
const userSchema = new mongoose.Schema(
  {
    // User personal information
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    // User email - unique identifier
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    // Hashed password - excluded from queries by default
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      minlength: [6, "Password must be at least 6 characters"],
    },

    // User role with predefined options
    role: {
      type: String,
      enum: {
        values: ["admin", "employee"],
        message: "Role must be either admin or employee",
      },
      default: "employee",
    },
  },
  { timestamps: true }, // Automatically add createdAt and updatedAt
);

// ============ MIDDLEWARE HOOKS ============

// Hash password before saving document
userSchema.pre("save", async function (next) {
  // Only hash if password field has been modified
  if (!this.isModified("passwordHash")) return next();

  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// ============ INSTANCE METHODS ============

// Compare provided password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// ============ EXPORT ============

export default mongoose.model("User", userSchema);
