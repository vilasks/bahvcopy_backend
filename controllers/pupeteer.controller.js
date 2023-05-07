const puppeteer =  require('puppeteer');

async function main (url) {
  try{
    const browser = await puppeteer.launch({headless:true});
  
    const page = await browser.newPage();

    await page.goto(url).catch((err)=>{
      console.log(err)
    });

    setTimeout(async()=>{
      await browser.close();
    },10000)
  }catch(err){
    console.log(err)
  }
};

module.exports = {
  main
}