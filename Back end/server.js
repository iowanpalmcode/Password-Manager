import express from "express"
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`app listening on port ${PORT}`)
})