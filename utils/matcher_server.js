import { KMMatcher } from "./KM_new.js"
import { embedding } from "./gemini.js"
import { logger } from "./logger.js";
import {
    is_question,
} from "./tools.js"

import { marco_embedding } from "./ms_marco_server.js";

import {
    addAllTexts,
    searchText,
    deleteTexts
} from "./elastic.js"

const TEXT_ARRAY_LENGTH = 128;
const MARCO_MAX_SCORE = 1;
const GEMINI_MAX_SCORE = 1;
const ELASTIC_MAX_SCORE = 0.24;

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
        const dimensions = query.dimensions;

        logger.info(`Text Length: ${texts.length}`);

        if (!Array.isArray(texts)) {
            logger.error("Parameter should be an array.");
            return null;
        }

        if (texts.length !== TEXT_ARRAY_LENGTH) {
            logger.error("Array length does not match.");
            return null;
        }

        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);
        isQuestion = await this.checkQuestions(texts);
        
        
        //embedding with gemini
        logger.info(`Embedding...`);

        let startTime = Date.now();

        let embeddings;

        try {
            const marco_result = await marco_embedding(texts);
            if(marco_result) {
                embeddings = marco_result;
            } else {
                embeddings = await embedding(texts.map(text => (text)));
            }
        } catch (error) {
            embeddings = await embedding(texts.map(text => (text)));
        }

        logger.info(`MARCO_Embedding done in ${Date.now() - startTime}ms`);

        /**
         * additional option (elastic)
         */

        let elasticScores = Array(TEXT_ARRAY_LENGTH).fill([]);
        for(let i = 0; i < TEXT_ARRAY_LENGTH; i++){
            elasticScores[i] = Array(TEXT_ARRAY_LENGTH).fill(0);
        }
        let random_index = "my_index" + (new Date().getTime()).toString();
        let answersDatas = [];
        for(let i = 0; i < TEXT_ARRAY_LENGTH; i++){
           
            answersDatas.push({
                text:texts[i],
                id: i
            })
            
        }

        await addAllTexts(answersDatas, random_index);

        for(let i = 0; i < TEXT_ARRAY_LENGTH; i ++) {
            elasticScores[i][i] = -100;
            if(isQuestion[i]){
                const results  = await searchText(texts[i], random_index);
                results.map(result => {
                    if(i != result['_id']){
                        elasticScores[i][result['_id']] = result["_score"];
                        elasticScores[result['_id']][i] = result["_score"];
                        if(isQuestion[result['_id']]) {
                            elasticScores[i][result['_id']] *= 0.5;
                            elasticScores[result['_id']][i] *= 0.5;
                        }
                    }
                })
            }
        }

        await deleteTexts(random_index);

        
////////////////////////////////////////////////////////////////////////////////

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
                weights[i][j] = similarities * MARCO_MAX_SCORE;
                weights[j][i] = similarities * MARCO_MAX_SCORE;
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
            let max_weight = 0;

            for (let j = 0; j < n; j++) {
                if (isQuestion[i] === isQuestion[j]) {
                    weights[i][j] *= T;
                }
                if (!isQuestion[i] === !isQuestion[j]) {
                    weights[i][j] *= T;
                }
            }


            /**
             * additional option (elastic)
             */
            max_weight = 0;
            let max_elastic_weight = 0;
            for(let j =0; j < n; j++) {
                max_weight = Math.max(weights[i][j], max_weight);
                max_elastic_weight = Math.max(elasticScores[i][j], max_elastic_weight);
            }
            if(max_elastic_weight == 0) max_elastic_weight = 1;

            for(let j = 0; j < n; j++) {
                weights[i][j] += max_weight * ELASTIC_MAX_SCORE * (elasticScores[i][j] / max_elastic_weight);
            }

        }

       try {
             ///////////gemini
            logger.info(`Embedding...`);
            startTime = Date.now();
            let gemini_embeddings = await embedding(texts.map(text => (text)));
            logger.info(`GEMINI_Embedding done in ${Date.now() - startTime}ms`);

            const gemini_weights = [];

            for (let i = 0; i < n; i++) {
                gemini_weights[i] = Array(dimensions).fill(0);
            }

            for (let i = 0; i < gemini_embeddings.length; i++) {
                for (let j = i + 1; j < gemini_embeddings.length; j++) {
                    const similarities = cosineSimilarity(gemini_embeddings[i], gemini_embeddings[j]);
                    gemini_weights[i][j] = similarities * GEMINI_MAX_SCORE;
                    gemini_weights[j][i] = similarities * GEMINI_MAX_SCORE;
                }
            }

            min_weight = Infinity;
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    min_weight = Math.min(min_weight, gemini_weights[i][j]);
                }
            }


            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    gemini_weights[i][j] -= min_weight;
                }

                gemini_weights[i][i] = 0;

                const T = 0.5;
                let max_weight = 0;

                for (let j = 0; j < n; j++) {
                    if (isQuestion[i] === isQuestion[j]) {
                        gemini_weights[i][j] *= T;
                    }
                    if (!isQuestion[i] === !isQuestion[j]) {
                        gemini_weights[i][j] *= T;
                    }
                }

            }

            //////////////////////////////////weight + gemini
            for(let i = 0; i < n; i++) {
                for(let j = 0; j < n; j++) {
                    weights[i][j] += gemini_weights[i][j];
                }
            }

       } catch (error) {
            console.log(error);
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