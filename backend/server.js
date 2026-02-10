import express from "express"
import path from "path"
import 'dotenv/config'
const app = express()
import mongoose from "mongoose"
const root = path.resolve(import.meta.dirname, "..")


const connectDB = async function() {
   try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("DB connected successfully")
} catch (error) {
    console.log(error)
} 
}

connectDB()

app.use(express.static(path.join(root, "frontend")))
const PORT = process.env.PORT || 5500

app.listen(PORT, () => {
    console.log(`App listening at http://localhost:${PORT}`)
})

app.get("/", (req, res) => {
    res.sendFile(path.join(root, "frontend", "index.html"))
})

app.get("/yope", (req, res) => {
    res.send()
})
