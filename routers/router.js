const router = require("express").Router()
const Bhav = require("../controllers/bhavcopy.controller")

router.get("/",(req,res)=>{
    res.send("request received")
})

router.get("/get-symbols",Bhav.getAllSymbols)
router.get("/get-data/:symbol",Bhav.getData)
router.get("/bites",Bhav.Bites)
router.get("/highlights",Bhav.GetHighlights)
router.post("/create_alert",Bhav.CreatePriceAlert)
router.post("/get-calender-data",Bhav.GetCalenderData)
router.post("/send-otp", Bhav.SendVerificationMail)
router.post("/verify-otp", Bhav.VerifyOtp)
module.exports = router