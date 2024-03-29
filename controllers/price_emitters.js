
const {EventEmitter} = require("node:events")
const client = require("../db/connection")
const db = client.db("bhav")
const {PriceAlertQueue} = require("./price_notification")
let instance = null;
class PriceEmitters{
    emitters = {}
    constructor(){
        if(instance){
            throw new Error("You cannot create another instance")
        }
        this.#initEmitter()
        instance = this
    }

    async #initEmitter(cb){
        let symbols = await this.#getAllSymbols();
        await Promise.all(symbols.map((ele)=>{
            this.emitters[ele.SYMBOL] = new EventEmitter()
        }))
        this.#intializeListeners()
    }

    startListen(symbol,price,cb){
        if(!this.emitters[symbol]){
            throw new Error("symbol does not exsist")
        }
        this.emitters[symbol].once(price,cb)
    }

    startEmitting(symbol,price,last_price){
        let higher = null
        let lower = null
        if(symbol=="TCS"){
            console.log(symbol)
            console.log(this.emitters[symbol])
        }
        if(!this.emitters[symbol]){
            return
            // throw new Error("symbol does not exsist")
        }

        price = this.convertToNum(price)
        last_price = this.convertToNum(last_price)

        if(price > last_price){
            higher = price
            lower = last_price

        }else if(price < last_price){
            higher = last_price
            lower = price
        }else if(price == last_price){
            higher = price
            lower = price
        }

        while(higher>=lower){
            if(symbol=="TCS"){
                console.log(lower.toFixed(process.env.PRICE_PRECISION))
            }
            this.emitters[symbol].emit(lower.toFixed(process.env.PRICE_PRECISION))
            lower+=0.1
        }
    }

    async #getAllSymbols(){
        let collection = db.collection("Symbols")
        let data = []
        await collection.find({},{projection:{SYMBOL: 1, NAME_OF_COMPANY: 1}}).forEach((e)=>{
            data.push(e)
        })
        return data
    }

    convertToNum(num){
        return Number(Number(num).toFixed(process.env.PRICE_PRECISION))
    }

    async #intializeListeners(){
        let collection = await db.collection("PriceAlerts").find({COMPLETED:false}).toArray()
        collection.forEach((ele)=>{
            this.startListen(ele.SYMBOL,ele.PRICE.toFixed(process.env.PRICE_PRECISION),()=>{
                PriceAlertQueue.push(ele._id.toString())
            })
        })
    }

}

let priceNotifier = new PriceEmitters();


// setTimeout(()=>{
//     priceNotifier.startListen("TCS","30.00",()=>{
//         console.log("trigger 30")
//     })

//     priceNotifier.startListen("TCS","30.50",()=>{
//         console.log("trigger 30.5")
//     })

//     priceNotifier.startListen("TCS","31.50",()=>{
//         console.log("trigger 31.5")
//     })

//     priceNotifier.startListen("TCS","32.50",()=>{
//         console.log("trigger 32.5")
//     })

//     priceNotifier.startListen("TCS","32.00",()=>{
//         console.log("trigger 32")
//     })

// },3000)


// setTimeout(()=>{
//     priceNotifier.startEmitting("TCS",32,20)
// },4000)

module.exports = {priceNotifier} 