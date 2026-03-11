import { useRef,useState,useEffect } from "react"

export default function Positioner({children}){

  const ref = useRef(null)

  const [zoom,setZoom] = useState(1)
  const [pos,setPos] = useState({x:0,y:0})

  const spacePressed = useRef(false)

  useEffect(()=>{

    function down(e){
      if(e.code==="Space") spacePressed.current=true
    }

    function up(e){
      if(e.code==="Space") spacePressed.current=false
    }

    window.addEventListener("keydown",down)
    window.addEventListener("keyup",up)

    return ()=>{
      window.removeEventListener("keydown",down)
      window.removeEventListener("keyup",up)
    }

  },[])


  function wheel(e){

    let z = zoom * (e.deltaY>0?0.9:1.1)
  
    setZoom(z)
  
  }

  let dragging=false
  let start={x:0,y:0}

  function mouseDown(e){

    if(!spacePressed.current) return

    dragging=true

    start={
      x:e.clientX-pos.x,
      y:e.clientY-pos.y
    }

  }

  function mouseMove(e){

    if(!dragging) return

    setPos({
      x:e.clientX-start.x,
      y:e.clientY-start.y
    })

  }

  function mouseUp(){
    dragging=false
  }


  return(

    <div
      ref={ref}
      className="viewport"
      onWheel={wheel}
      onMouseDown={mouseDown}
      onMouseMove={mouseMove}
      onMouseUp={mouseUp}
      onMouseLeave={mouseUp}
    >

      <div
        className="positioner"
        style={{
          transform:`translate(${pos.x}px,${pos.y}px) scale(${zoom})`
        }}
      >

        {children}

      </div>

    </div>

  )

}