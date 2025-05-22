import express from "express";
import cors from 'cors'
import cookieParser from 'cookie-parser'
const app = express()

app.use(cors())
app.use(cookieParser())
app.use(express.json()); // Parses application/json
app.use(express.urlencoded({ extended: true }))
app.use('/auth')

app.listen(3002)