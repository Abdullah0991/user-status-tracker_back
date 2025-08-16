// src/routes/auth.ts
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, Status } from '@prisma/client';
import { AuthResponse, LoginRequest, RegisterRequest } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Register
router.post('/register', async (req: Request<{}, AuthResponse, RegisterRequest>, res: Response<AuthResponse | {
    message: string
}>) => {
    try {
        const { email, password, name, role = 'USER' } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Set initial status only for regular users, not for admins
        const userData: any = {
            email,
            password: hashedPassword,
            name,
            role
        };

        if (role === 'USER') {
            userData.status = Status.AVAILABLE_NO_TASK;
        }
        // For ADMIN users, status remains null

        const user = await prisma.user.create({
            data: userData
        });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', async (req: Request<{}, AuthResponse, LoginRequest>, res: Response<AuthResponse | {
    message: string
}>) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;