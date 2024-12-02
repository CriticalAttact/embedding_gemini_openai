import fs from "fs/promises";
import { KMMatcher } from "./KM_new.js"
import { embedding } from "./gemini.js"
import { logger } from "./logger.js";
import {
    is_question,
    keywordMatchScore,
    getScoreWithQuestion,
} from "./tools.js"

import { marco_embedding } from "./ms_marco_test.js";

import {
    addAllTexts,
    searchText,
    deleteTexts
} from "./elastic.js"

const TEXT_ARRAY_LENGTH = 128;
const GEMINI_MAX_SCORE = 1;
const MARCO_MAX_SCORE = 1;
const STELLA_MAX_SCORE = 1;

const writefile = async (data, text_name) => {
    try {
        await fs.writeFile(`./example/${text_name}.txt`, data);
        console.log('File written successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}

const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
};

const getWeigths = (embeddings, isQuestion, MAX_SCORE, dimensions = 128) => {
    const n = TEXT_ARRAY_LENGTH;
    const weights = [];
    for (let i = 0; i < n; i++) {
        weights[i] = Array(dimensions).fill(0);
    }

    for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
            const similarities = cosineSimilarity(embeddings[i], embeddings[j]);
            weights[i][j] = similarities * MAX_SCORE;
            weights[j][i] = similarities * MAX_SCORE;
        }
    }

    let min_weight = Infinity;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            min_weight = Math.min(min_weight, weights[i][j]);
        }
    }


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

    return weights;
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

        const true_pairs = new Map();
        true_q_indices.map((q_i, idx) => {
            true_pairs.set(q_i, true_a_indices[idx]);
        })

        logger.info(`Text Length: ${texts.length}`);

        if (!Array.isArray(texts)) {
            logger.error("Parameter should be an array.");
            return null;
        }
        
        if (texts.length !== TEXT_ARRAY_LENGTH) {
            logger.error("Array length does not match.");
            return null;
        }
        const n = TEXT_ARRAY_LENGTH;

        let isQuestion = Array(TEXT_ARRAY_LENGTH).fill(false);
        isQuestion = await this.checkQuestions(texts);
        
        let questionCnt = 0;

        for (let i = 0; i < n; i++)
            isQuestion[i] == true && questionCnt++;
        logger.info(`Question count: ${questionCnt}`);

        logger.info(`Embedding...`);
        let startTime = Date.now();
        let embeddings;
        while(true) {
            try {
                embeddings = await embedding(texts.map(text => (text)));
                break;
            } catch (error) {
                console.log(error);
            }``
        }

        logger.info(`GEMINI_Embedding done in ${Date.now() - startTime}ms`);


        let weights = [];
        weights = getWeigths(embeddings, isQuestion, GEMINI_MAX_SCORE, TEXT_ARRAY_LENGTH);

        
        const m_KM = new KMMatcher(weights);

        logger.info(`Running KM Algorithm...`);

        startTime = Date.now();

        const best = m_KM.solve();

        logger.info(`KM Algorithm took ${Date.now() - startTime}ms`);


        /////////////////check out dangerous file
        const limited_dangerous = 0.07;
        let sorted_weights = [];

        weights.map((weight, i) => {
            let tmp = weight.map((item, j) => {
                return {
                    score: item,
                    from: i,
                    to: j
                }
            });

            tmp.sort((a, b) => b.score - a.score);
            sorted_weights.push(tmp);
        });

        let dangerous_questions = [];

        for(let i = 0 ; i < n; i++) {
            if(!isQuestion[i]) continue;
            for(let j = 0; j < n; j++) {
                if(sorted_weights[i][j].to == m_KM.xy[i]) {
                    let front_cnt = 0;
                    if(j == 0) {
                        front_cnt ++;
                        if(sorted_weights[i][j].score - sorted_weights[i][j + 1].score < limited_dangerous) {
                            let next_answer_index = sorted_weights[i][j + 1].to;
                            let next_question_index = m_KM.xy[next_answer_index];
                            for(let k = 0; k < n; k++){
                                if(sorted_weights[next_question_index][k].to == next_answer_index) {
                                    if(k == 0) {
                                        front_cnt ++;
                                        if(front_cnt == 2) break;
                                        if(sorted_weights[i][j].to != sorted_weights[next_question_index][k + 1].to) break;

                                        if(sorted_weights[next_question_index][k].score - sorted_weights[next_question_index][k + 1].score < limited_dangerous){
                                            dangerous_questions.push(i);
                                        }
                                        break;
                                    } else {
                                        if(sorted_weights[i][j].to != sorted_weights[next_question_index][k - 1].to) break;

                                        if(sorted_weights[next_question_index][k - 1].score - sorted_weights[next_question_index][k].score < limited_dangerous){
                                            dangerous_questions.push(i);
                                        }
                                        break;
                                    }                                 
                                }
                            }
                        }
                    } else {
                        if(sorted_weights[i][j - 1].score - sorted_weights[i][j].score < limited_dangerous) {
                            let next_answer_index = sorted_weights[i][j - 1].to;
                            let next_question_index = m_KM.xy[next_answer_index];

                            for(let k = 0; k < n; k++){
                                if(sorted_weights[next_question_index][k].to == next_answer_index) {
                                    if(k == 0) {
                                        if(sorted_weights[i][j].to != sorted_weights[next_question_index][k + 1].to) break;

                                        if(sorted_weights[next_question_index][k].score - sorted_weights[next_question_index][k + 1].score < limited_dangerous){
                                            dangerous_questions.push(i);
                                        }
                                        break;
                                    } else {
                                        if(sorted_weights[i][j].to != sorted_weights[next_question_index][k - 1].to) break;

                                        if(sorted_weights[next_question_index][k - 1].score - sorted_weights[next_question_index][k].score < limited_dangerous){
                                            dangerous_questions.push(i);
                                        }
                                        break;
                                    }                                 
                                }
                            }
                        }
                    }
                }
            }
        }

        logger.info(dangerous_questions);

        let stella_weights, marco1_weights, marco2_weights, marco3_weights;

        try {
            logger.info(`Embedding...`);
            startTime = Date.now();
            let hf_embeddings = await marco_embedding(texts);
            logger.info(`HF_Embedding done in ${Date.now() - startTime}ms`);

            let embeddings_stella = hf_embeddings.embeddings_stella;
            let embeddings_marco1 = hf_embeddings.embeddings_marco1;
            let embeddings_marco2 = hf_embeddings.embeddings_marco2;
            let embeddings_marco3 = hf_embeddings.embeddings_marco3;

            stella_weights = getWeigths(embeddings_stella, isQuestion, STELLA_MAX_SCORE, TEXT_ARRAY_LENGTH);
            marco1_weights = getWeigths(embeddings_marco1, isQuestion, MARCO_MAX_SCORE, TEXT_ARRAY_LENGTH);
            marco2_weights = getWeigths(embeddings_marco2, isQuestion, MARCO_MAX_SCORE, TEXT_ARRAY_LENGTH);
            marco3_weights = getWeigths(embeddings_marco3, isQuestion, MARCO_MAX_SCORE, TEXT_ARRAY_LENGTH);


        } catch (error) {
            console.log(error);
        }
/////////////////////////////////////////////////////
        const stella_KM = new KMMatcher(stella_weights);
        logger.info(`Running KM Algorithm...`);

        startTime = Date.now();

        const stella_best = stella_KM.solve();

        logger.info(`Stella KM Algorithm took ${Date.now() - startTime}ms`);
////////////////////////////////////////////////
        const marco1_KM = new KMMatcher(marco1_weights);
        logger.info(`Running KM Algorithm...`);

        startTime = Date.now();

        const marco1_best = marco1_KM.solve();

        logger.info(`Marco1 KM Algorithm took ${Date.now() - startTime}ms`);
//////////////////////////////////////////////////////
        const marco2_KM = new KMMatcher(marco2_weights);
        logger.info(`Running KM Algorithm...`);

        startTime = Date.now();

        const marco2_best = marco2_KM.solve();

        logger.info(`Marco2 KM Algorithm took ${Date.now() - startTime}ms`);
////////////////////////////////////////////////////////
        const marco3_KM = new KMMatcher(marco3_weights);
        logger.info(`Running KM Algorithm...`);

        startTime = Date.now();

        const marco3_best = marco3_KM.solve();

        logger.info(`Marco3 KM Algorithm took ${Date.now() - startTime}ms`);
        


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

        const ela_KM = new KMMatcher(elasticScores);
        logger.info(`Running KM Algorithm...`);

        startTime = Date.now();

        const ela_best = ela_KM.solve();

        logger.info(`Ela KM Algorithm took ${Date.now() - startTime}ms`);
        let print = {}
        dangerous_questions.map(dq => {
            if(!print[dq]) print[dq] = [];
            print[dq].push(m_KM.xy[dq]);
            print[dq].push(stella_KM.xy[dq]);
            print[dq].push(ela_KM.xy[dq]);
            print[dq].push(marco1_KM.xy[dq]);
            print[dq].push(marco2_KM.xy[dq]);
            print[dq].push(marco3_KM.xy[dq]);
            print[dq].push(true_pairs.get(dq));
            let flag_array = Array(TEXT_ARRAY_LENGTH).fill(0);
            flag_array[m_KM.xy[dq]] += 1.3;
            flag_array[stella_KM.xy[dq]] += 0.8;
            flag_array[ela_KM.xy[dq]] += 1;
            flag_array[marco1_KM.xy[dq]] += 0.3;
            flag_array[marco2_KM.xy[dq]] += 0.3;
            flag_array[marco3_KM.xy[dq]] += 0.3;

            let max_cnt = 0;
            let correct = -1;

            for(let i = 0; i < TEXT_ARRAY_LENGTH; i++) {
                if(flag_array[i] > max_cnt){
                    max_cnt = flag_array[i];
                    correct = i;
                }
            }

            m_KM.xy[dq] = correct;

        })

        logger.info(print)

        // out put with file
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
                        logger.error({ from: i, to: m_KM.xy[i], correct: true_a_indices[index], delta: weights[i][true_a_indices[index]] - weights[i][m_KM.xy[i]] });
                    }
                    will_write += "###########################################\n";
                    will_write += "------------question-----------------------\n";
                    will_write += texts[i] + "\n";
                    will_write += "------------correct----------------------\n";
                    will_write += texts[true_a_indices[index]] + "\n"
                    will_write += "------------expect----------------------\n";
                    will_write += texts[m_KM.xy[i]] + "\n"
                    will_write += "----------------------------------\n";
                    will_write += `Question: ${i}, true_answer: ${true_a_indices[index]}, expect: ${m_KM.xy[i]}\n`

                }
            });
            true_a_indices.forEach((a_idx, index) => {
                if (a_idx == i) {
                    if (true_q_indices[index] == m_KM.xy[i]) {
                        is_true = true;
                    }
                    will_write += "###########################################\n";
                    will_write += "------------answer-----------------------\n";
                    will_write += texts[i] + "\n";
                    will_write += "------------correct----------------------\n";
                    will_write += texts[true_q_indices[index]] + "\n"
                    will_write += "------------expect----------------------\n";
                    will_write += texts[m_KM.xy[i]] + "\n"
                    will_write += "----------------------------------\n";
                    will_write += `Answer: ${i}, true_quetion: ${true_q_indices[index]}, expect: ${m_KM.xy[i]}\n`
                }
            });
            
            tmp.sort((a, b) => b.score - a.score);
            tmp.map(item => {
                will_write += `${item.from.toString().padStart(3, 0)}: ${item.to.toString().padStart(3, 0)}: ${item.score.toFixed(4)}\t`




            });
            will_write += '\n\n'
            if (!is_true) will_write += "\n###########################################\n"
        })

        
        will_write += "--------------------------------------\n";
        await writefile(will_write, text_name)
        
        return m_KM.xy

    }
};


export {
    Matcher
}