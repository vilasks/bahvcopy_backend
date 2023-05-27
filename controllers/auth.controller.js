const jwt = require("jsonwebtoken")
const client = require("../db/connection")
const db = client.db("bhav")
const {ResCode} = require("../models/response.codes")
const crypto = require("crypto")



exports.verify = async(req,res,next) => {
    try{
        let cookie = req.headers['authorization'].split(" ")[1]
        let some = jwt.verify(cookie, process.env.JWT_SECRET)
        next()
    }catch(err){
        console.log(err)
        res.setHeader("authorization", `Bearer `)
        return res.status(401).send({status: ResCode.failure, msg: "unauthorized"})
    }
}