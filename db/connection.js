require("dotenv").config()
const {MongoClient} = require("mongodb")

const client = new MongoClient(process.env.DB_URL)

async function main(){
    await client.connect()
    let ping = await client.db("bhav").command({ping:1});
    if(ping.ok){
        console.log("db connected successfully")
    }
}

main()

module.exports = client

