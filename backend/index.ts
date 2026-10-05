import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto'; // Built into Node.js, we use it for generating random file names


dotenv.config(); // Loads your .env file

const app = express();


// Initialize the database driver and pass it to Prisma
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


app.use(cors({
    origin: ['http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true
}));


app.use(express.json());
app.use(cookieParser());

const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});


// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // 1. Validation (check if any fields are missing)
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // 2. Check if user already exists
        const userExists = await prisma.user.findFirst({
            where: {
                email: email
            }
        })

        if (userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // 3. Hash the password (using bcrypt.hash)
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);

        // 4. Save to database using Prisma
        await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hash
            }
        });

        // 5. Return success
        return res.status(201).json({ message: 'User created successfully' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Find user by email (Return 400 if not found)
        const user = await prisma.user.findFirst({
            where: {
                email: email
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // 2. Compare passwords using bcrypt.compare
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // 3. Generate JWT Token
        const token = jwt.sign({ userId: user.id }, "MY_SUPER_SECRET_KEY", { expiresIn: '7d' });

        // 4. Send token in an HttpOnly cookie and return 200 OK

        res.cookie('token', token, {
            httpOnly: true, // Prevents XSS attacks!
            secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        return res.status(200).json({ message: "Logged in successfully", user: { id: user.id, name: user.name } });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// The Middleware Function
// The Middleware Function
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1. Get the token from the cookies
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ error: "Unauthorized: No token provided" });
        }

        // 2. Verify the token using the EXACT SAME secret key you used in login
        const decoded = jwt.verify(token, "MY_SUPER_SECRET_KEY") as { userId: number };

        // 3. Attach the userId to res.locals so the controller can use it!
        res.locals.userId = decoded.userId;

        // 4. Pass control to the next function (the controller)
        next();
    } catch (error) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};

// CREATE FOLDER (Updated to use requireAuth!)
app.post('/api/folders', requireAuth, async (req, res) => {
    // Delete the mock `const userId = 1;`
    // Grab it securely from the middleware!
    const userId = res.locals.userId;

    const { name, parentId } = req.body;

    try {
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        // 1. If parentId exists, verify it belongs to this user (Prevent IDOR!)
        if (parentId) {
            const parent = await prisma.folder.findFirst({
                where: {
                    id: parentId,
                    userId: userId
                }
            })
            if (!parent) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }
        }

        // 2. Create the folder in the DB
        const folder = await prisma.folder.create({
            data: {
                userId: userId,
                name: name,
                parentId: parentId
            }
        })

        // 3. Return 201 Created with the folder
        res.status(201).json({ folder });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/folders
app.get('/api/folders', requireAuth, async (req, res) => {
    const userId = res.locals.userId;
    const parentId = req.query.parentId ? Number(req.query.parentId) : null;
    const section = req.query.section || 'mydrive'; // mydrive, starred, trash

    try {
        let folderWhere: any = { userId };
        let fileWhere: any = { userId };

        if (section === 'mydrive') {
            folderWhere.parentId = parentId;
            folderWhere.isDeleted = false;
            fileWhere.folderId = parentId;
            fileWhere.isDeleted = false;
        } else if (section === 'starred') {
            folderWhere.isStarred = true;
            folderWhere.isDeleted = false;
            fileWhere.isStarred = true;
            fileWhere.isDeleted = false;
        } else if (section === 'trash') {
            folderWhere.isDeleted = true;
            fileWhere.isDeleted = true;
        }

        const folders = await prisma.folder.findMany({ where: folderWhere });
        const files = await prisma.file.findMany({ where: fileWhere });

        return res.status(200).json({ folders, files });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});


// POST /api/upload/ticket
app.post('/api/upload/ticket', requireAuth, async (req, res) => {
    // 1. Get the userId from the middleware
    const userId = res.locals.userId;
    const { filename, contentType } = req.body; // e.g. "vacation.png", "image/png"

    try {
        // 2. Generate a highly unique S3 Key (path) so files don't overwrite each other!
        // Example: "user_1/1699999999-vacation.png"
        const uniqueString = crypto.randomBytes(8).toString('hex');
        const s3Key = `user_${userId}/${uniqueString}-${filename}`;

        // 3. Create the AWS Command
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: s3Key,
            ContentType: contentType // Crucial: Tells AWS what kind of file is coming
        });

        // 4. Generate the Presigned URL (Valid for 5 minutes)
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

        // 5. Send BOTH the url and the s3Key back to the frontend
        return res.status(200).json({ url: presignedUrl, key: s3Key });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to generate upload ticket' });
    }
});

// POST /api/files
app.post('/api/files', requireAuth, async (req, res) => {
    const userId = res.locals.userId;
    const { name, s3Key, size, mimeType, folderId } = req.body;

    try {
        // Prevent IDOR: If they are putting it in a folder, make sure they own the folder!
        if (folderId) {
            const parent = await prisma.folder.findFirst({
                where: { id: folderId, userId: userId }
            });
            if (!parent) return res.status(404).json({ error: 'Folder not found' });
        }

        // Generate the public URL (if your bucket allows public access)
        const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

        // Save it to the database!
        const file = await prisma.file.create({
            data: {
                userId: userId,
                name: name,
                s3Key: s3Key,
                size: size,
                mimeType: mimeType,
                url: publicUrl,
                folderId: folderId
            }
        });

        return res.status(201).json({ file });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});





// DELETE /api/folders/:id
app.delete('/api/folders/:id', requireAuth, async (req, res) => {
    const userId = res.locals.userId;
    const folderId = Number(req.params.id);

    try {
        const deleted = await prisma.folder.deleteMany({
            where: { id: folderId, userId: userId }
        });

        if (deleted.count === 0) return res.status(404).json({ error: 'Folder not found or unauthorized' });
        return res.status(200).json({ message: 'Folder deleted' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/folders/:id (Rename, Star, Trash)
app.patch('/api/folders/:id', requireAuth, async (req, res) => {
    const userId = res.locals.userId;
    const folderId = Number(req.params.id);
    const { name, isStarred, isDeleted } = req.body;

    try {
        const updated = await prisma.folder.updateMany({
            where: { id: folderId, userId: userId },
            data: { 
                ...(name !== undefined && { name }),
                ...(isStarred !== undefined && { isStarred }),
                ...(isDeleted !== undefined && { isDeleted })
            }
        });

        if (updated.count === 0) return res.status(404).json({ error: 'Folder not found or unauthorized' });
        return res.status(200).json({ message: 'Folder updated' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/files/:id
app.delete('/api/files/:id', requireAuth, async (req, res) => {
    const userId = res.locals.userId;
    const fileId = Number(req.params.id);

    try {
        const file = await prisma.file.findFirst({
            where: { id: fileId, userId: userId }
        });

        if (!file) return res.status(404).json({ error: 'File not found' });

        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.s3Key,
        });
        await s3.send(command).catch(console.error);

        await prisma.file.delete({
            where: { id: file.id }
        });

        return res.status(200).json({ message: 'File deleted' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/files/:id (Rename, Star, Trash)
app.patch('/api/files/:id', requireAuth, async (req, res) => {
    const userId = res.locals.userId;
    const fileId = Number(req.params.id);
    const { name, isStarred, isDeleted } = req.body;

    try {
        const updated = await prisma.file.updateMany({
            where: { id: fileId, userId: userId },
            data: { 
                ...(name !== undefined && { name }),
                ...(isStarred !== undefined && { isStarred }),
                ...(isDeleted !== undefined && { isDeleted })
            }
        });

        if (updated.count === 0) return res.status(404).json({ error: 'File not found or unauthorized' });
        return res.status(200).json({ message: 'File updated' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: res.locals.userId },
            select: { id: true, name: true, email: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.status(200).json({ user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/files/:id/link
app.get('/api/files/:id/link', requireAuth, async (req, res) => {
    try {
        const file = await prisma.file.findFirst({
            where: { id: Number(req.params.id), userId: res.locals.userId }
        });
        if (!file) return res.status(404).json({ error: 'File not found' });

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.s3Key,
            ResponseContentDisposition: `inline; filename="${file.name}"`, // inline allows viewing, attachment prompts download
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 300 });
        return res.status(200).json({ url });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/seed', async (req, res) => {
    try {
        const user = await prisma.user.create({
            data: { id: 1, name: "Test User", email: "test@test.com", password: "hash" }
        });
        res.json(user);
    } catch (e) {
        res.send("User already exists!");
    }
});


app.listen(8080, () => {
    console.log('Backend running on http://localhost:8080');
});
