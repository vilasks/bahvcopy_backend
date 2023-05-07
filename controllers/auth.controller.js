const jwt = require("jsonwebtoken")
const client = require("../db/connection")
const db = client.db("bhav")
const {ResCode} = require("../models/response.codes")
const crypto = require("crypto")



exports.verify = async(req,res,next) => {
    try{
        let cookie = req.headers['cookie']
        let some = jwt.verify(cookie, process.env.JWT_SECRET)
        next()
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "unable to verify token"})
    }
}