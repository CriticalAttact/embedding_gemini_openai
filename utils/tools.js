import OpenAI from 'openai';
import nlp from "compromise";
import natural from "natural";
import synonyms from 'synonyms';
import { message } from "./openai_msg.js";

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

function splitTextIntoSentences(text) {
    let adjustedText = text.replace(/-\s+/g, ". ");
    adjustedText = adjustedText.replace(/\b(vs)\.\s+/g, "$1 ");
    adjustedText = adjustedText.replace(/\b(sp|Op|No|Drs|Mr|Dr|Mrs)\.\s+/g, "$1_TEMP ");
    let doc = nlp(adjustedText);
    let sentences = doc.sentences().out('array');
    return sentences.map(sentence => sentence.trim()); // Trim whitespace from each sentence
}

function extractCoreWords1(sentence) {
    const doc = nlp(sentence);
    const ad_times = 1;
    const noun_times = 1;
    const verb_times = 1;
    const ed_times = 1;
    let nouns = [];
    let verbs = [];
    let adjectives = [];
    let wordsWithEd = [];
    nouns = Array(noun_times).fill(doc.nouns().out('array')).flat();
    verbs = Array(verb_times).fill(doc.verbs().out('array')).flat();
    wordsWithEd = Array(ed_times).fill(doc.match('#Verb+ed').out('array')).flat();
    adjectives = Array(ad_times).fill(doc.match('#Adjective').out('array')).flat();

    const coreWords = [...nouns, ...verbs, ...adjectives, ...wordsWithEd];
    
    return coreWords;
}

function extractCoreWords2(sentence) {
    const stopWords = ['the', 'a', 'an', 'does', 'at', 'in', 'on', 'for', 'to', 'and', 'with', 'of', 'is', 'by', 'this', 'that', 'it', 'be', 'not'];
    const questionWords = ["what", "how", "why", "who", "where", "when", "which", "is", "are", "do", "does", "did", "will", "would", "can", "could", "may", "might", "shall", "should", "must", "was", "were"];
    const doc = nlp(sentence);
    const words = doc.terms().out('array');
    const filteredWords = words.filter(word => ![...stopWords, ...questionWords].includes(word.toLowerCase()));
    return filteredWords;
}

const is_question = async (text) => {
    try {
        const firstWord = text.trim().split(' ')[0];

        const questionWords = ["what", "how", "why", "who", "where", "when", "which", "is", "are", "do", "does", "did", "will", "would", "can", "could", "may", "might", "shall", "should", "must", "was", "were"];

        const sentences = splitTextIntoSentences(text);

        if (sentences.length < 2 && questionWords.includes(firstWord.toLowerCase())) {
            return true
        }

        if (sentences.length > 2) {
            return false
        }


        const isQuestion = await is_question_openai(text);
        return isQuestion

    } catch (error) {
        console.log(error);
        console.log(text)
    }

}


const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY1, // This is the default and can be omitted
});

const is_question_openai = async (text) => {
    try {
        const chatCompletion = await client.chat.completions.create({
            messages: [
                ...message,
                { role: 'user', content: text },
                // {role: 'user', content:`${text}\n\n\n\n\n\nIs this a question? Provide me only "Yes" or "No"`}
            ],
            model: 'gpt-3.5-turbo',
            // model: 'gpt-4o',
        });

        return chatCompletion.choices[0].message.content.indexOf("question") != -1;
    } catch (error) {
        console.log(error);
        return false
    }

}

function cleanText(text) {
    return text
        .toLowerCase() // Convert to lowercase
        .replace(/[^a-z0-9\s]/g, '') // Remove punctuation and special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim(); // Remove leading/trailing spaces
}

function lemmatizeText(text) {
    const tokens = tokenizer.tokenize(text);
    return tokens.map(word => stemmer.stem(word)).join(' ');
}

function expandText(text) {
    const words = text.split(' ');
    const expandedWords = words.map(word => {
        // Get synonyms for the word
        const wordSynonyms = synonyms(word.toLowerCase(), 'n') || []; // 'n' for noun as an example
        if (wordSynonyms.length > 0) {
            // Randomly select a synonym if available
            // const randomSynonym = wordSynonyms[Math.floor(Math.random() * wordSynonyms.length)];
            const randomSynonym = wordSynonyms[0];
            return randomSynonym;
        }
        return word; // Keep the word as-is if no synonyms are found
    });

    return expandedWords.join(' ');
}

function preprocessText(text) {
    let cleaned = cleanText(text);
    let lemmatized = lemmatizeText(cleaned);
    // let expanded = expandText(lemmatized);
    return lemmatized;
}

export {
    is_question,
    extractCoreWords1,
    extractCoreWords2,
    preprocessText
}