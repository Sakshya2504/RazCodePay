import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log('MongoDB connection established.');
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
