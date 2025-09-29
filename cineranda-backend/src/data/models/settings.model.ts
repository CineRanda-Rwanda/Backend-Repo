import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  welcomeBonusAmount: number;
  // Keep existing fields (if any)
  [key: string]: any;
}

const SettingsSchema = new Schema(
  {
    welcomeBonusAmount: { 
      type: Number, 
      default: 100 
    },
    // Existing fields remain unchanged
  },
  { 
    timestamps: true 
  }
);

// Helper method to get settings (creates default if none exist)
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ welcomeBonusAmount: 100 });
  }
  return settings;
};

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);