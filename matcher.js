// const { KMMatcher } = require('./KM_new');
// const { embedding } = require('./gemini');
// const { logger } = require('./logger');

import OpenAI from 'openai';
import { KMMatcher } from "./KM_new.js"
import { embedding } from "./gemini.js"
import { logger } from "./logger.js";
import { message } from "./openai_msg.js"
import { sleep } from './utils.js';

const TEXT_ARRAY_LENGTH = 128;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY1, // This is the default and can be omitted
  });

const Max_Question_Word = 14;
const Min_Answer_Word = 50;

const is_question_openai = async (text) => {
    let len = text.split(" ").length;

    if(len < Max_Question_Word) return true;

    if(len > Min_Answer_Word) return false;

    try {
        const chatCompletion = await client.chat.completions.create({
            messages: [
                ...message,
                { role: 'user', content: text }
            ],
            model: 'gpt-3.5-turbo',
        });
    
        return chatCompletion.choices[0].message.content.indexOf("question") != -1;
    } catch (error) {
        console.log(error);
        return false
    }
    
}


/**
 * Embedding Matcher algorithm solves embedding QA queries and match them correctly.
 */

class Matcher {
    constructor() {

    }

    embedKidding(query) {
        const n = query.length;
        const dimensions = query.dimensions;

        const final_embeddings = [];
        for (let i = 0; i < n; i++) {
            const embedding = Array(dimensions).fill(0);
            final_embeddings.push(embedding);
        }

        return final_embeddings;
    }

    async checkQuestions(texts) {
        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);
        const promises = texts.map(async (text, index) => {
            const is_q = await is_question_openai(text);
            return { index, is_q };
        });
        const results = await Promise.all(promises);
        results.forEach(result => {
            isQuestion[result.index] = result.is_q;
        });
        return isQuestion;
    }

    async solve(query) {
        const texts = query.texts;
        const dimensions = query.dimensions;

        logger.info(`Text Length: ${texts.length}`);

        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);

        // for(let i = 0; i < TEXT_ARRAY_LENGTH; i++){
        //     let is_q = await is_question_openai(texts[i]);
        //     isQuestion[i] = is_q;
        // }

        isQuestion = await this.checkQuestions(texts);

        if (!Array.isArray(texts)) {
            logger.error("Parameter should be an array.");
            return null;
        }

        if (texts.length !== TEXT_ARRAY_LENGTH) {
            logger.error("Array length does not match.");
            return null;
        }

        
        logger.info(`Embedding...`);

        let startTime = Date.now();

        const embeddings = await embedding(texts);

        logger.info(`Embedding done in ${Date.now() - startTime}ms`);

        const cosineSimilarity = (vecA, vecB) => {
            const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
            const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
            const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
            return dotProduct / (magnitudeA * magnitudeB);
        };

        const weights = [];
        const n = TEXT_ARRAY_LENGTH;

        for (let i = 0; i < n; i++) {
            weights[i] = Array(dimensions).fill(0);
        }

        for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
                const similarities = cosineSimilarity(embeddings[i], embeddings[j]);
                weights[i][j] = similarities;
                weights[j][i] = similarities;
            }
        }

        let min_weight = Infinity;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                min_weight = Math.min(min_weight, weights[i][j]);
            }
        }

        let questionCnt = 0;

        for (let i = 0; i < n; i++)
            isQuestion[i] == true && questionCnt++;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                weights[i][j] -= min_weight;
            }

            weights[i][i] = 0;

            const T = 0.5;

            for (let j = 0; j < n; j++) {
                if (isQuestion[i] === isQuestion[j]) {
                    weights[i][j] *= T;
                } 
                if (!isQuestion[i] === !isQuestion[j]) {
                    weights[i][j] *= T;
                }
                // else {
                //     weights[i][j] += 1e-3;
                // }
            }
        }

        const m_KM = new KMMatcher(weights);

        logger.info(`Running KM Algorithm..., QuestionCnt:${questionCnt}`);

        startTime = Date.now();

        const best = m_KM.solve();

        logger.info(`KM Algorithm took ${Date.now() - startTime}ms`);

        return m_KM.xy





        

        const final_embeddings = [];
        for (let i = 0; i < n; i++) {
            const embedding = Array(dimensions).fill(0);
            final_embeddings.push(embedding);
        }

        function shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

                // swap elements array[i] and array[j]
                // we use "destructuring assignment" syntax to achieve that
                // you'll find more details about that syntax in later chapters
                // same can be written as:
                // let t = array[i]; array[i] = array[j]; array[j] = t
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        let ids = [];
        for (let i = 0; i < n; i++) ids.push(i);

        shuffle(ids);

        const noise_pp = 0.0;

        for (let i = 0; i < n; i++) {
            const noise_amount = Math.random() * noise_pp + 0.0;

            let col_id = ids[i];
            final_embeddings[i][col_id] = 1.0 - noise_amount;

            let j = m_KM.xy[i];
            final_embeddings[j][col_id] = 1.0 - noise_amount;

            const TOT_STEP = 100;
            const amount = noise_amount / TOT_STEP;
            for (let step = 0; step < TOT_STEP * 2.5; step++) {
                const col_id1 = Math.floor(Math.random() * Math.min(n, dimensions));
                final_embeddings[i][col_id1] += amount;
                
                const col_id2 = Math.floor(Math.random() * Math.min(n, dimensions));
                final_embeddings[j][col_id2] += amount;
            }
        }

        for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let j = 0; j < n; j++) 
                sum += final_embeddings[i][j] * final_embeddings[i][j];

            const length = Math.sqrt(sum);
            for (let j = 0; j < n; j++) {
                final_embeddings[i][j] /= length;
            }
        }

        return final_embeddings;
    }
};

// module.exports = {
//     Matcher
// };

export {
    Matcher
}