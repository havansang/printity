import { useEffect,useRef } from "react"
import { Canvas,Image,IText } from "fabric"

export default function FabricCanvas({printArea}){

  const canvasRef = useRef(null)

  const fabricRef = useRef(null)

  useEffect(()=>{

    if(!printArea) return

    const canvas = new Canvas(canvasRef.current)

    canvas.setDimensions({
      width:printArea.width,
      height:printArea.height
    })

    fabricRef.current = canvas

    canvas.on("object:moving",(e)=>{

      const o = e.target

      if(o.left < 0) o.left = 0
      if(o.top < 0) o.top = 0

      if(o.left + o.width*o.scaleX > canvas.width)
        o.left = canvas.width - o.width*o.scaleX

      if(o.top + o.height*o.scaleY > canvas.height)
        o.top = canvas.height - o.height*o.scaleY

    })

  },[printArea])


  async function addText(){

    const text = new IText("Text",{
      left:100,
      top:100,
      fontSize:40
    })

    fabricRef.current.add(text)

  }

  async function upload(e){

    const file = e.target.files[0]

    const reader = new FileReader()

    reader.onload = async f=>{

      const img = await Image.fromURL(f.target.result)

      img.scaleToWidth(200)

      img.left=100
      img.top=100

      fabricRef.current.add(img)

    }

    reader.readAsDataURL(file)

  }

  function exportPNG(){

    const data = fabricRef.current.toDataURL({
      multiplier:4
    })

    const a = document.createElement("a")

    a.href = data
    a.download = "design.png"

    a.click()

  }

  return(

    <>
      <div style={{marginBottom:10}}>
        <input type="file" onChange={upload}/>
        <button onClick={addText}>Text</button>
        <button onClick={exportPNG}>Export</button>
      </div>

      <div
        className="canvas-container"
        style={{
          left:printArea.x,
          top:printArea.y
        }}
      >

        <canvas ref={canvasRef}></canvas>

      </div>

    </>

  )

}