import { useEffect, useRef } from "react"
import { Canvas, Image, IText } from "fabric"
import Positioner from "./Positioner"

export default function Editor() {

  const sceneRef = useRef(null)
  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const fabricRef = useRef(null)

  useEffect(() => {
    loadSVG()
  }, [])


  async function loadSVG() {

    const res = await fetch("/front.svg")
    const text = await res.text()

    const parser = new DOMParser()
    const doc = parser.parseFromString(text, "image/svg+xml")
    const svg = doc.querySelector("svg")

    svgRef.current.replaceWith(svg)
    svgRef.current = svg

    requestAnimationFrame(setupEditor)
  }


  function setupEditor() {

    const svg = svgRef.current
    const placeholder = svg.querySelector("#placeholder_front")

    if (!placeholder) {
      console.error("Print area not found")
      return
    }

    const svgWidth = svg.viewBox.baseVal.width
    const svgDisplayWidth = svg.getBoundingClientRect().width

    const scale = svgDisplayWidth / svgWidth

    const width = parseFloat(placeholder.getAttribute("width")) * scale
    const height = parseFloat(placeholder.getAttribute("height")) * scale

    const parent = placeholder.parentElement
    const transform = parent.getAttribute("transform")

    let x = 0
    let y = 0

    const match = transform.match(/translate\(([^ ]+)\s*([^)]+)\)/)

    if (match) {
      x = parseFloat(match[1]) * scale
      y = parseFloat(match[2]) * scale
    }

    initCanvas(width, height, x, y)
  }


  function initCanvas(width, height, x, y) {

    const canvas = new Canvas(canvasRef.current)

    canvas.setDimensions({
      width,
      height
    })

    const container = canvas.wrapperEl

    container.style.position = "absolute"
    container.style.left = x + "px"
    container.style.top = y + "px"

    fabricRef.current = canvas

    console.log("Fabric ready")
  }


  function addText() {

    const canvas = fabricRef.current
    if (!canvas) return

    const text = new IText("Hello", {
      left: 50,
      top: 50,
      fontSize: 40
    })

    canvas.add(text)
  }


  function uploadImage(e) {

    const canvas = fabricRef.current
    if (!canvas) return

    const file = e.target.files[0]
    const reader = new FileReader()

    reader.onload = async (f) => {

      const img = await Image.fromURL(
        f.target.result,
        { crossOrigin: "anonymous" }
      )

      img.scaleToWidth(150)

      img.left = 50
      img.top = 50

      canvas.add(img)
    }

    reader.readAsDataURL(file)
  }


  function download(data) {

    const a = document.createElement("a")
    a.href = data
    a.download = "mockup.png"
    a.click()
  }


  async function exportMockup() {

    const svg = svgRef.current
    const placeholder = svg.querySelector("#placeholder_front")

    placeholder.style.display = "none"

    const svgData = new XMLSerializer().serializeToString(svg)

    const svgBlob = new Blob(
      [svgData],
      { type: "image/svg+xml;charset=utf-8" }
    )

    const url = URL.createObjectURL(svgBlob)

    const img = new window.Image()

    img.onload = async () => {

      const exportCanvas = document.createElement("canvas")

      exportCanvas.width = svg.viewBox.baseVal.width
      exportCanvas.height = svg.viewBox.baseVal.height

      const ctx = exportCanvas.getContext("2d")

      ctx.drawImage(img, 0, 0)

      await drawDesign(ctx)

      const data = exportCanvas.toDataURL("image/png")

      download(data)

      URL.revokeObjectURL(url)
    }

    img.src = url
  }


  function drawDesign(ctx) {

    return new Promise(resolve => {

      const fabricCanvas = fabricRef.current

      const designImg = new window.Image()

      designImg.onload = () => {

        const svg = svgRef.current
        const placeholder = svg.querySelector("#placeholder_front")

        const parent = placeholder.parentElement
        const transform = parent.getAttribute("transform")

        const match = transform.match(/translate\(([^ ]+)\s*([^)]+)\)/)

        const x = parseFloat(match[1])
        const y = parseFloat(match[2])

        const w = parseFloat(placeholder.getAttribute("width"))
        const h = parseFloat(placeholder.getAttribute("height"))

        ctx.drawImage(
          designImg,
          x,
          y,
          w,
          h
        )

        resolve()
      }

      designImg.src = fabricCanvas.toDataURL({
        multiplier: 4
      })

    })
  }


  return (

    <div className="editor">

      <div className="toolbar">

        <input type="file" onChange={uploadImage} />

        <button onClick={addText}>
          Add Text
        </button>

        <button onClick={exportMockup}>
          Export PNG
        </button>

      </div>

      <Positioner>

        <div ref={sceneRef} className="scene">

          <svg ref={svgRef}></svg>

          <canvas ref={canvasRef}></canvas>

        </div>

      </Positioner>

    </div>
  )
}