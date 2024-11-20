import fs from "fs/promises";
import { KMMatcher } from "./KM_new.js"
import { embedding } from "./gemini.js"
import { logger } from "./logger.js";
import {
    is_question,
    extractCoreWords1,
    extractCoreWords2,
    preprocessText
} from "./tools.js"

const TEXT_ARRAY_LENGTH = 128;

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

    async solve_test(query) {
        const texts = query.texts;
        const dimensions = query.dimensions;
        const true_a_indices = query.true_a_indices;
        const true_q_indices = query.true_q_indices
        const text_name = query.text_name;

        logger.info(`Text Length: ${texts.length}`);

        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);

        isQuestion = await this.checkQuestions(texts);

        //for core words weight
        for(let i = 0; i < texts.length; i++) {
            // texts[i] = preprocessText(texts[i]);
            if(isQuestion[i]){
                
                // let coreWords =  extractCoreWords1(texts[i]);
                // let addCoreWords = ", " + coreWords.join(", ");
                // texts[i] += addCoreWords.repeat(1);
               
            }
        }

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
        }


        const m_KM = new KMMatcher(weights);

        logger.info(`Running KM Algorithm..., QuestionCnt:${questionCnt}`);

        startTime = Date.now();

        const best = m_KM.solve();

        logger.info(`KM Algorithm took ${Date.now() - startTime}ms`);


        let fail_value = 0;
        let true_value = 0;

        let will_write = "";
        weights.map((weight, i) => {
            let tmp = weight.map((item, j) => {
                return {
                    score: item,
                    from: i,
                    to: j
                }
            });

            let is_true = false;
            true_q_indices.forEach((q_idx, index) => {
                if (q_idx == i) {
                    if (true_a_indices[index] == m_KM.xy[i]) {
                        is_true = true;
                    } else {
                        will_write += "###########################################\n";
                        will_write += "------------question-----------------------\n";
                        will_write += texts[i] + "\n";
                        will_write += "------------correct----------------------\n";
                        will_write += texts[true_a_indices[index]] + "\n"
                        will_write += "------------expect----------------------\n";
                        will_write += texts[m_KM.xy[i]] + "\n"
                        will_write += "----------------------------------\n";
                        console.log({ from: i, to: m_KM.xy[i], correct: true_a_indices[index] });
                    }
                    will_write += `Question: ${i}, true_answer: ${true_a_indices[index]}, expect: ${m_KM.xy[i]}\n`

                }
            });
            true_a_indices.forEach((a_idx, index) => {
                if (a_idx == i) {
                    if (true_q_indices[index] == m_KM.xy[i]) {
                        is_true = true;
                    } else {
                        will_write += "###########################################\n";
                        will_write += "------------question-----------------------\n";
                        will_write += texts[i] + "\n";
                        will_write += "------------correct----------------------\n";
                        will_write += texts[true_q_indices[index]] + "\n"
                        will_write += "------------expect----------------------\n";
                        will_write += texts[m_KM.xy[i]] + "\n"
                        will_write += "----------------------------------\n";
                    }
                    will_write += `Answer: ${i}, true_quetion: ${true_q_indices[index]}, expect: ${m_KM.xy[i]}\n`
                }
            });
            
            tmp.sort((a, b) => b.score - a.score);
            tmp.map(item => {
                will_write += `${item.from.toString().padStart(3, 0)}: ${item.to.toString().padStart(3, 0)}: ${item.score.toFixed(4)}\t`


                // if( (item.from == 75 && item.to == 70) || (item.from == 97 && item.to == 22) ){
                //     console.log(`${item.from.toString().padStart(3, 0)}: ${item.to.toString().padStart(3, 0)}: ${item.score.toFixed(4)}\t`);
                //     fail_value += item.score;
                // }
                // if((item.from == 75 && item.to == 22) || (item.from == 97 && item.to == 70) ) {
                //     console.log(`${item.from.toString().padStart(3, 0)}: ${item.to.toString().padStart(3, 0)}: ${item.score.toFixed(4)}\t`);
                //     true_value += item.score;
                // }


            });
            will_write += '\n\n'
            if (!is_true) will_write += "\n###########################################"
        })

        // console.log(`true_value: ${true_value.toFixed(4)} \nfail_value: ${fail_value.toFixed(4)} \ndelta: ${(true_value - fail_value).toFixed(4)}`);

        will_write += "--------------------------------------\n";
        await writefile(will_write, text_name)
        //write info

        return m_KM.xy

    }
};


export {
    Matcher
}