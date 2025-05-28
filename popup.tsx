import { useEffect, useState } from "react"

function IndexPopup() {
  const [data, setData] = useState("")
  useEffect(() => {
    const worker = new Worker(new URL("./workers/worker.ts", import.meta.url))
    worker.onmessage = (e: MessageEvent<string>) => {
      console.log("Received:", e.data)
    }
    worker.postMessage("Start")
    return () => worker.terminate()
  }, [])

  return (
    <div
      style={{
        padding: 16
      }}>
      <h2>
        Welcome to your{" "}
        <a href="https://www.plasmo.com" target="_blank">
          Plasmo
        </a>{" "}
        Extension!
      </h2>
      <input onChange={(e) => setData(e.target.value)} value={data} />
      <a href="https://docs.plasmo.com" target="_blank">
        View Docs
      </a>
    </div>
  )
}

export default IndexPopup
