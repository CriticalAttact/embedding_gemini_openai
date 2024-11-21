import { Client } from "@elastic/elasticsearch";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const client = new Client({
    node: 'http://localhost:9200',
})

const addText = async (data) => {
    try {
        await client.index({
            index: 'my_index',
            document: {
                content: data.text,
            },
            id: data.id
        });
    } catch (error) {
        console.error('Error indexing document:', error);
    }
}

const deleteTexts = async () => {
    try {
        await client.indices.delete({
            index: "my_index",
        });
    } catch (error) {
        console.log(error);
    }
}


const addAllTexts = async (datas) => {
    await deleteTexts();
    const promises = datas.map(async(data)=>{
        await addText(data);
    });
    await Promise.all(promises);
    await sleep(1000);
}

const searchText = async(question) => {
    try {
        const response = await client.search({
            index: 'my_index',
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
}