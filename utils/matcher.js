import fs from "fs/promises";
import { KMMatcher } from "./KM_new.js"
import { embedding } from "./gemini.js"
import { logger } from "./logger.js";
import {
    is_question,
    keywordMatchScore
} from "./tools.js"

const TEXT_ARRAY_LENGTH = 128;
const KEYWORD_MAX_SCORE = 0.016;    // percent

const writefile = async (data, text_name) => {
    try {
        await fs.writeFile(`./example/${text_name}.txt`, data);
        console.log('File written successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}




class Matcher {
    constructor() {

    }

    async checkQuestions(texts) {
        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);
        const promises = texts.map(async (text, index) => {
            const is_q = await is_question(text);
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
        const dimensions = query.dimensions || 128;

        logger.info(`Text Length: ${texts.length}`);

        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);

        isQuestion = await this.checkQuestions(texts);
        /**
         * additional option (keyword weight)
         */
        let keywordScores = Array(TEXT_ARRAY_LENGTH).fill([]);
        for(let i = 0; i < TEXT_ARRAY_LENGTH; i++){
            keywordScores[i] = Array(TEXT_ARRAY_LENGTH).fill(0);
        }
        for(let i = 0; i < texts.length; i++) {
            for(let j = 0; j < texts.length; j++){
                
                if(isQuestion[i] == true && isQuestion[j]== false) {
                    let keywordScore = keywordMatchScore(texts[i], texts[j]);
                    keywordScores[i][j] = keywordScore;
                    keywordScores[j][i] = keywordScore;
                }

            }
        }
        /**
         * additional option (keyword weight)
         */

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
            }

            /**
             * additional option (key word)
             */
            let max_weight = 0;
            let max_key_weight = 0;
            for(let j =0; j < n; j++) {
                max_weight = Math.max(weights[i][j], max_weight);
                max_key_weight = Math.max(weights[i][j], max_key_weight);
            }
            if(max_key_weight == 0) max_key_weight = 1;

            for(let j = 0; j < n; j++) {
                weights[i][j] += max_weight * KEYWORD_MAX_SCORE * (keywordScores[i][j] / max_key_weight);
            }
        }

        const m_KM = new KMMatcher(weights);

        logger.info(`Running KM Algorithm..., QuestionCnt:${questionCnt}`);

        startTime = Date.now();

        const best = m_KM.solve();

        logger.info(`KM Algorithm took ${Date.now() - startTime}ms`);

        return m_KM.xy

    }

    
};


export {
    Matcher
}