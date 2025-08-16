// src/server.ts
import express from 'express';
import cors from 'cors';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import dashboardRoutes from './routes/dashboard';
import configurePassport from './config/passport';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Configure Passport
configurePassport(passport);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

export { prisma };