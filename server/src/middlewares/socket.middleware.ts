/**
 * Socket.IO Authentication Middleware
 * Validates JWT tokens for WebSocket connections
 */

import { Socket } from "socket.io";
import { verifyToken } from "../utils/lib";
import { User } from "../models/User";
import { logger } from "../services/logger";

export interface AuthenticatedSocket extends Socket {
    userId: string;
    userRole: string;
    userEmail: string;
}

/**
 * Socket.IO authentication middleware
 * Validates JWT token and attaches user data to socket
 */
export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
    try {
        // Get token from handshake auth or query
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token || typeof token !== 'string') {
            logger.securityEvent("Socket connection without token", {
                socketId: socket.id,
                ip: socket.handshake.address
            });
            return next(new Error("Authentication token required"));
        }

        // Verify token
        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (tokenError) {
            logger.securityEvent("Invalid socket token", {
                socketId: socket.id,
                ip: socket.handshake.address,
                error: tokenError
            });
            return next(new Error("Invalid or expired token"));
        }

        // Get user from database
        const user = await User.findById(decoded.userId);
        if (!user) {
            logger.securityEvent("Socket connection for non-existent user", {
                socketId: socket.id,
                userId: decoded.userId
            });
            return next(new Error("User not found"));
        }

        if (!user.isActive) {
            logger.securityEvent("Inactive user attempted socket connection", {
                socketId: socket.id,
                userId: String(user._id),
                email: user.email
            });
            return next(new Error("Account is not active"));
        }

        // Attach user data to socket
        const authSocket = socket as AuthenticatedSocket;
        authSocket.userId = String(user._id);
        authSocket.userRole = user.role;
        authSocket.userEmail = user.email;

        logger.info("Socket authenticated", {
            socketId: socket.id,
            userId: authSocket.userId,
            email: authSocket.userEmail
        });

        next();
    } catch (error: any) {
        logger.error("Socket authentication error", error, {
            socketId: socket.id,
            ip: socket.handshake.address
        });
        next(new Error("Authentication failed"));
    }
};
