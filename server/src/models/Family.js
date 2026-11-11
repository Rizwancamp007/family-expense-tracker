import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
  },
  { _id: false }
);

const familySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    inviteCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    members: { type: [memberSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Family = mongoose.model("Family", familySchema);
