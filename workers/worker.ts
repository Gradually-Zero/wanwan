self.onmessage = (event: MessageEvent<string>) => {
  console.log("Worker received:", event.data)
  const response: string = `Processed: ${event.data}`
  self.postMessage(response)
}
