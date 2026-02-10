import express from "express"
import path from "path"
import 'dotenv/config'
const root = path.resolve(import.meta.dirname, "..")


const app = express()
app.use(express.static(path.join(root, "frontend")))
const PORT = process.env.PORT || 5500

app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`)
})

app.get("/", (req, res) => {
    res.sendFile(path.join(root, "frontend", "index.html"))
})
