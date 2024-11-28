import { Matcher } from "./utils/matcher_server.js";
import { logger } from "./utils/logger.js";
// const express = require('express');
import express from "express"
// require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' })); // Adjust '10mb' as needed
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Simple GET end-point
app.get('/', (req, res) => {
    res.send('Hello Embedding\n api: ipaddress:8989/embedding, method:post, {query:{texts:[...128texts]}}');
});

// Simple POST end-point
app.post('/embedding', async (req, res) => {
    const texts = req.body.query.texts;
    const matcher = new Matcher();
    try {
        const results = await matcher.solve({
            texts,
            dimensions: texts.length
        });
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json([]);
    }
    
});

// Start the server
app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});