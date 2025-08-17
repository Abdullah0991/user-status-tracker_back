// src/routes/dashboard.ts
import express, { Request, Response } from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, DashboardStats } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/stats',
    passport.authenticate('jwt', { session: false }),
    async (req: Request, res: Response<DashboardStats | { message: string }>) => {
        const user = (req as AuthenticatedRequest).user;
        try {
            const totalUsers = await prisma.user.count();

            // Count only regular users (those with status)
            const totalRegularUsers = await prisma.user.count({
                where: {
                    role: 'USER'
                }
            });

            const statusCounts = await prisma.user.groupBy({
                by: ['status'],
                where: {
                    role: 'USER',
                    status: {
                        not: null
                    }
                },
                _count: {
                    status: true
                }
            });

            // Prepare status distribution for charts
            const statusDistributionBar = statusCounts.map(item => {
                const statusLabels = {
                    'AVAILABLE_NO_TASK': 'Available - No Task',
                    'AVAILABLE_ROUTINE_TASK': 'Available - Routine Task',
                    'AVAILABLE_URGENT_TASK': 'Available - Urgent Task',
                    'UNAVAILABLE': 'Unavailable'
                };

                const statusColors = {
                    'AVAILABLE_NO_TASK': '#10b981',      // Green
                    'AVAILABLE_ROUTINE_TASK': '#3b82f6', // Blue
                    'AVAILABLE_URGENT_TASK': '#ef4444',  // Red
                    'UNAVAILABLE': '#6b7280'             // Gray
                };

                return {
                    status: statusLabels[item.status as keyof typeof statusLabels] || item.status || 'Unknown',
                    count: item._count.status,
                    percentage: totalRegularUsers > 0
                        ? Number(((item._count.status / totalRegularUsers) * 100).toFixed(1))
                        : 0,
                    color: statusColors[item.status as keyof typeof statusColors] || '#6b7280'
                };
            });

            // Calculate availability vs unavailability for pie chart
            const availableCount = statusCounts
                .filter(item => item.status && item.status !== 'UNAVAILABLE')
                .reduce((sum, item) => sum + item._count.status, 0);

            const unavailableCount = statusCounts
                .find(item => item.status === 'UNAVAILABLE')?._count.status || 0;

            const availabilityDistribution = [
                {
                    name: 'Available',
                    value: availableCount,
                    percentage: totalRegularUsers > 0
                        ? Number(((availableCount / totalRegularUsers) * 100).toFixed(1))
                        : 0,
                    color: '#10b981'
                },
                {
                    name: 'Unavailable',
                    value: unavailableCount,
                    percentage: totalRegularUsers > 0
                        ? Number(((unavailableCount / totalRegularUsers) * 100).toFixed(1))
                        : 0,
                    color: '#ef4444'
                }
            ].filter(item => item.value > 0); // Only include non-zero values

            // Legacy stats format for backward compatibility
            const stats = statusCounts.reduce((acc, item) => {
                if (item.status) {
                    acc[item.status] = {
                        count: item._count.status,
                        percentage: totalRegularUsers > 0
                            ? ((item._count.status / totalRegularUsers) * 100).toFixed(1)
                            : '0'
                    };
                }
                return acc;
            }, {} as DashboardStats['stats']);

            res.json({
                totalUsers,
                totalRegularUsers,
                stats,
                statusDistributionBar,
                availabilityDistribution
            });
        } catch (error) {
            console.error('Dashboard stats error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

export default router;