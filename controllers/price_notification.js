const {queue} = require("async")
const client = require("../db/connection")
const { ObjectID } = require("bson")
const db = client.db("bhav")
const NewsLetterQueue = queue(NewsLetter,5)
const PriceAlertQueue = queue(PriceAlert,5)

async function NewsLetter(id,callback){
    try{
        let user = await db.collection("Users").findOne({_id: new ObjectID(id)})
        let template = "some"
    }catch(err){
        console.log(err)
    }
}

async function PriceAlert(id,callback){
    try{
        let alert = await db.collection("PriceAlert").findOne({_id: new ObjectID(id)})
        let template = "some"
    }catch(err){
        console.log(err)
    }
}


async function NewsLetterCRON(){
    try{
        let users = await db.collection("Users").find({NEWSLETTER: true}).toArray()
        users.forEach((user)=>NewsLetterQueue.push(user))
    }catch(err){
        console.log(err)
    }
}