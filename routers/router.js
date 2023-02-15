const router = require("express").Router()
const Bhav = require("../controllers/bhavcopy.controller")

router.get("/",(req,res)=>{
    res.send("request received")
})

router.get("/get-symbols",Bhav.getAllSymbols)
router.get("/get-data/:symbol",Bhav.getData)
router.get("/bites",Bhav.Bites)
router.get("/highlights",Bhav.GetHighlights)
module.exports = router