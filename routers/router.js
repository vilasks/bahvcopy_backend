const router = require("express").Router()
const Bhav = require("../controllers/bhavcopy.controller")
const AUTH = require("../controllers/auth.controller")
const {signup, login} = require("../controllers/user.controller")
router.get("/",AUTH.verify,(req,res)=>{
    res.send("request received")
})

router.post("/signup",signup)
router.post("/login", login)

router.get("/get-symbols",Bhav.getAllSymbols)
router.get("/get-data/:symbol",Bhav.getData)
router.get("/bites",Bhav.Bites)
router.get("/highlights",Bhav.GetHighlights)
router.post("/create_alert",Bhav.CreatePriceAlert)
router.post("/get-calender-data",Bhav.GetCalenderData)
router.post("/send-otp", Bhav.SendVerificationMail)
router.post("/verify-otp", Bhav.VerifyOtp)
module.exports = router