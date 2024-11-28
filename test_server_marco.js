import fs from "fs/promises";  // Use only fs/promises
import { Matcher } from "./utils/matcher_test_marco.js";
import { logger } from "./utils/logger.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Asynchronous reading of a JSON file
const readfile = async (file_index) => {
    let json_data = {};
    try {
        // Read the file with the correct encoding
        const data = await fs.readFile(`./data/database${file_index}.txt`, 'utf8');
        
        // Parse the JSON data
        json_data = JSON.parse(data);
    } catch (error) {
        console.error('Error:', error);
    }
    return json_data;
}

const engine = async (file_index) => {
    const startTime = new Date().getTime();
    const data = await readfile(file_index);
    const texts = data['texts'];
    const true_q_indices = data["q_indices"];
    const true_a_indices = data["a_indices"];
    const matcher = new Matcher();
    const result = await matcher.solve_test({
        texts,
        dimensions: 128,
        true_q_indices,
        true_a_indices,
        text_name: `example${file_index.toString().padStart(2,0)}`,
    });
    let fail_cnt = 0;
    true_q_indices.forEach((q_idx, index) => {
        if(result[q_idx] != true_a_indices[index]){
            fail_cnt++;
        }
    });

    const endTime = new Date().getTime(); 
    logger.error(`file_${file_index}: time: ${(endTime - startTime)/1000}s  ,  failed_count: ${fail_cnt}`)
    // await sleep(60 * 1000 - (endTime - startTime));
    return fail_cnt;
}

const main = async () => {
    
    // let truefile_cnt = 0;
    // for(let i = 0; i < 100; i++) {
    //     let fail_cnt = await engine(i);
    //     if(fail_cnt == 0) truefile_cnt++;
        
    // }


    // for(let m = 1; m >0; m -= 0.1) {
    //     for(let g = 1; g >0; g -= 0.1) {
    //         for(let e = 1; e >0; e -= 0.1) {
    //             let truefile_cnt = 0;
    //             let failed_array = [0,4,14,20,24,31,35,36,41,46,47,50,52,62,64,65,68,72,80,82,85,86,87,93,94,95];
    //             for(let i = 0; i < failed_array.length; i++) { //    failed_array.length
    //                 let fail_cnt = await engine(failed_array[i], m, g, e);
    //                 if(fail_cnt == 0) truefile_cnt++;
    //                 logger.error(`Success! ${truefile_cnt}, m: ${m}, g: ${g}, e: ${e}`);
    //             }
    //         }
    //     }   
    // }

    // let truefile_cnt = 0;
    // let failed_array = [47];//[11,27,28,35,38,42,43,46,47]
    // for(let i = 0; i < failed_array.length; i++) {
    //     let fail_cnt = await engine(failed_array[i]);
    //     if(fail_cnt == 0) truefile_cnt++;
    // }
    // logger.error(`Success! ${truefile_cnt}`);

    let truefile_cnt = 0;
    for(let i = 37; i < 100; i++) { 
        let fail_cnt = await engine(i);
        if(fail_cnt == 0) truefile_cnt++;
    }
    logger.error(`Success! ${truefile_cnt}`);


}

// Invoke main function
main().catch(err => console.error(err));