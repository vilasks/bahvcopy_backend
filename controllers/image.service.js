require("dotenv").config()
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require("fs")
const canvasRenderService = new ChartJSNodeCanvas({ width: parseInt(process.env.CANVAS_WIDTH), height: parseInt(process.env.CANVAS_HEIGHT)});
const configuration = {
    type: "line",
    data: {
      labels: [1,2,3,5,4],
      datasets: [
        {
          label: "PRICE",
          data: [10,10,25,63,6],
          backgroundColor: "rgba(255,255,0,0.1)",
          borderColor: "rgba(255,255,0,1)",
          borderWidth: 2,
          pointRadius: 2,
          fill: true
        }
      ]
    },
    options: {
      legend: {
        position: "bottom",
        labels: {
          fontColor: "rgb(255, 255, 255,1)",
          fontSize: 16
        }
      },
      scales: {
        xAxes: {
          grid: {
            display: false
          },
          ticks: {
            fontColor: "rgba(255, 255, 255, 1)"
          }
        },
        yAxes: {
          grid: {
            lineWidth: 2,
            color: "rgba(255, 255, 255, 0.8)"
          },
          ticks: {
            fontColor: "rgba(255, 255, 255, 1"
          }
        }
      }
    }
};

function setConfiguaration(config){
    configuration.data.labels = config.xAxis
    configuration.data.datasets[0].data = config.yAxis
    
    if(config.bg){
        configuration.data.datasets[0].backgroundColor = config.bg
        configuration.data.datasets[0].borderColor = config.bg
    }

    if(config.heading){
        configuration.data.datasets[0].label = config.heading
    }

    if(config.pointerRadius){
        configuration.data.datasets[0].pointRadius = config.pointerRadius 
    }

}

async function createImage(id,config){
    setConfiguaration(config)
    const image = await canvasRenderService.renderToBuffer( configuration );
    let filepath = `./priceAlertImages/${id}.png`
    await fs.writeFileSync(filepath,image)
    return `${id}.png`
}

module.exports = {
    createImage
}