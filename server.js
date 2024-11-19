import { Matcher } from "./utils/matcher.js";
import { logger } from "./utils/logger.js";
// const express = require('express');
import express from "express"
// require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Simple GET end-point
app.get('/', (req, res) => {
    res.send('Hello Embedding\n api: /data, method:post, {texts:[...]}');
});

// Simple POST end-point
app.post('/data', async (req, res) => {
    const texts = req.body.texts;
    const matcher = new Matcher();
    const result = await matcher.solve({
        texts,
        dimensions: texts.length
    });
    
    res.status(200).json({ message: 'Data received', result });
});

// Start the server
app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});