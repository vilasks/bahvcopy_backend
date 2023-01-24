const https = require("https")
const fs = require("fs")
const decompress = require("decompress")
const csv = require("csv-parser")
const client = require("../db/connection")
const db = client.db("bhav")
const {ResCode} = require("../models/response.codes")

exports.getTodaysData = async(date) => {
    try{
        const file = fs.createWriteStream("./bhav.zip")
        let parts = date.split("-")
        let full_data = date.split("-").join("")
        console.log(parts)
        console.log(full_data)
        let url = `https://www1.nseindia.com/content/historical/EQUITIES/${parts[2]}/${parts[1]}/cm${full_data}bhav.csv.zip`
        let checker = await new Promise((resolve,rejects)=>{
            https.get(url,{
                headers:{
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Safari/605.1.15",
                    "Referer": "http://www.google.com/",
                    "cookie": "NSE-TEST-1=1960845322.20480.0000; path=/"
                }
            },(response)=>{
                console.log(response.statusCode)
                if(response.statusCode!=200){
                    return rejects(null)
                }
                response.pipe(file)
                response.on("data",()=>console.log("Data"))
                response.on("end",()=>resolve("Some"))
                response.on("error",(err)=>{
                    console.log("error occured")
                    console.log(err)
                    rejects(null)
                })
            })
        })
        let bhav_path = "./bhav/"
        if(!checker){
            return
        }
        await decompress("./bhav.zip","bhav").then((files)=>{
            console.log(files)
            bhav_path = bhav_path + files[0].path
            console.log("Extraction Complete")
            return
        })
        fs.createReadStream(bhav_path)
            .pipe(csv())
            .on("data",async(data)=> {
                if(data.SERIES=="EQ"){
                    data = await this.parseBhavCopy(data)
                    await this.insertIntoDb(data)
                }
            })
            .on("end",()=>{
                console.log("read end")
                setTimeout(()=>{
                    fs.rm(bhav_path,(err)=>{
                        if(err){
                            console.log("err while removing")
                        }
                        console.log("removed successfully")
                    })
                },10000)
            })
    }catch(err){
        console.log(err)
        // return res.status(500).send({status:ResCode.failure,message:"Something went wrong"})
    }
}

exports.insertIntoDb = async(data) =>{
    let insert = await db.collection(data.SYMBOL).insertOne(data)
    if(!insert.acknowledged){
        console.log(`Insert failed ${data.SYMBOL}`)
    }
}

exports.parseBhavCopy = async(data) => {

    try{
        Object.keys(data).forEach((ele)=>{
            if(ele=="OPEN" || ele=="CLOSE" || ele=="HIGH" || ele=="LOW"){
                data[ele] = parseFloat(data[ele])
            }

            if(ele=="LAST" || ele=="PREVCLOSE" || ele=="TOTTRDVAL" ){
                data[ele] = parseFloat(data[ele])
            }

            if(ele=="TIMESTAMP"){
                data[ele] = new Date(data[ele])
            }

            if(ele==""){
                delete data[ele]
            }

            if(ele=="TOTTRDQTY" || ele=="TOTALTRADES"){
                data[ele] = parseInt(data[ele])
            }

        })
        return data
    }catch(err){
        console.log(err)
        // return res.status(500).send({status:ResCode.failure,message:"Something went wrong"})
    }

}

exports.getAllSymbols = async(req,res) => {
    try{

        let collection = db.collection("Symbols")
        let data = []
        let collections = await collection.find({},{projection:{SYMBOL: 1, NAME_OF_COMPANY: 1}}).forEach((e)=>{
            data.push(e)
        })
        
        return res.status(200).send({status:ResCode.success,data:data})

    }catch(err){
        console.log(err)
        return res.status(500).send({status:ResCode.failure,message:"Something went wrong"})
    }
}

exports.getData = async(req,res) => {
    try{
        if(req.params.symbol==undefined || req.params.symbol==""){
            return res.status(400).send({status:ResCode.failure,msg:"Symbol is required"})
        }

        let data = (await db.collections()).map((e)=>{
            return e.namespace.split(".")[1]
        }).filter((e)=>{
            return e==req.params.symbol
        })

        if(data.length<=0){
            return res.status(400).send({status:ResCode.failure,msg:"symbol does not exsist"})
        }

        let intervel = parseInt(req.query.i) || 30
        console.log(new Date(Date.now()-(86400000*intervel)))
        let resp = await db.collection(req.params.symbol).aggregate([
            {$match:{"TIMESTAMP":{$gte: new Date(Date.now()-(86400000*intervel))}}},
            {$sort:{TIMESTAMP:1}}
        ]).toArray()

        // console.log(resp)
        
        return res.status(200).send({status:ResCode.success,msg:"success",data:resp})

    }catch(err){
        console.log(err)
        return res.status(500).send({status:ResCode.failure,msg:"Something went wrong at server"})
    }
}