const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 3000


//middleware

// const corOptions = {
//     origin: ['http://localhost:3000'],
//     credentials: true,
//     optionSuccessStatus: 200,
// }
// app.use(cors(corOptions))

app.use(cors())
app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.it2xzvi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        const jobsCollection = client.db('soloSpehere').collection('jobs')
        const bidsCollection = client.db('soloSpehere').collection('bids')

        //get all the jobs data from db
        app.get("/jobs", async (req, res) => {
            const result = await jobsCollection.find().toArray();
            res.send(result)
        })


        //get a single data from db using db job id
        app.get('/job/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await jobsCollection.findOne(query) 
            // const result = await jobsCollection.findOne({_id: new ObjectId(id)}) 
            res.send(result);
        })



        //save a bid data in DB or post a bid data in DB
        app.post("/bid", async(req, res) => {
            const bidData = req.body;
            // console.log(bidData)
            // return
            const result = await bidsCollection.insertOne(bidData)
            res.send(result);
        })


        // save a job data in DB or post a job data in DB
        app.post("/job", async(req, res) => {
            const jobData = req.body;
            // console.log(jobData)
            // return
            const result = await jobsCollection.insertOne(jobData)
            res.send(result);
        })

        //get all jobs posted by a specific user
        app.get('/jobs/:email', async(req, res) => {
            const email = req.params.email
            const query = {'buyer.email': email}
            const result = await jobsCollection.find(query).toArray()
            res.send(result)
        })

        //delete a job data from db
        app.delete('/job/:id', async(req, res) => {
            const id = req.params.id
            const query = {_id : new ObjectId (id)}
            const result = await jobsCollection.deleteOne(query)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error

    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send("Server is running...")
})


app.listen(port, () => {
    console.log(`server is running ${port}`)
})