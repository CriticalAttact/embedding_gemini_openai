import { Client } from "@elastic/elasticsearch";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const client = new Client({
    node: 'http://localhost:9200',
})

const addText = async (data, index = "my_index") => {
    try {
        await client.index({
            index: index,
            document: {
                content: data.text,
            },
            id: data.id
        });
    } catch (error) {
        console.error('Error indexing document:', error);
    }
}

const deleteTexts = async (index = "my_index") => {
    try {
        await client.indices.delete({
            index: index,
        });
    } catch (error) {
        console.log(error);
    }
}


const addAllTexts = async (datas, index = "my_index") => {
    try{
        const promises = datas.map(async(data)=>{
            await addText(data,index);
        });
        await Promise.all(promises);
    }catch(error) {
        console.log(error);
    }
    await sleep(1000);
}

const searchText = async(question, index = "my_index") => {
    try {
        const response = await client.search({
            index: index,
            query: {
                match: { content: question },
            },
            size: 1000,
        });
        return response.hits.hits;
    } catch (error) {
    console.error('Error updating document:', error);
    }
}


export {
    searchText,
    addAllTexts,
    deleteTexts,
}