const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express()
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const port = process.env.PORT || 3000

//middleware
const corOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://solosphere.web.app',
    ],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corOptions))
// app.use(cors())
app.use(express.json())
app.use(cookieParser())


// verify jwt middleware
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
        jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log(err)
                return res.status(401).send({ message: 'unauthorized access' })
            }
            console.log(decoded)
            // akhnane req.user ar moddhe decoded token dile onno api ar moddhe theke user ar token aceess kara jabe
            req.user = decoded
            next();
        })
    }
}



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

        // jwt generate 
        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d'
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : "strict",
            })
                .send({ success: true })

        })


        // clear token on logout
        app.get('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                maxAge: 0

            })
                .send({ success: true })
        })


        //get all the jobs data from db
        app.get("/jobs", async (req, res) => {
            const result = await jobsCollection.find().toArray();
            res.send(result)
        })


        //get a single data from db using db job id
        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query)
            // const result = await jobsCollection.findOne({_id: new ObjectId(id)}) 
            res.send(result);
        })


        //save a bid data in DB or post a bid data in DB (database)
        app.post("/bid", async (req, res) => {
            const bidData = req.body;
            // check if it is a duplicate request
            const query = {
                email: bidData.email,
                jobId: bidData.jobId
            }
            const alreadyApplied = await bidsCollection.findOne(query)
            console.log(alreadyApplied)

            if (alreadyApplied) {
                return res.status(400).send('You already applied!')
            }
            const result = await bidsCollection.insertOne(bidData)
            res.send(result);
        })


        // save a job data in DB or post a job data in DB
        app.post("/job", async (req, res) => {
            const jobData = req.body;
            // console.log(jobData)
            // return
            const result = await jobsCollection.insertOne(jobData)
            res.send(result);
        })


        //get all jobs posted by a specific user
        app.get('/jobs/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user?.email
            console.log(tokenEmail)
            const email = req.params.email
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { 'buyer.email': email }
            const result = await jobsCollection.find(query).toArray()
            res.send(result)
        })

        //delete a job data from db
        app.delete('/job/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.deleteOne(query)
            res.send(result)
        })


        // update a job in db
        app.put('/job/:id', async (req, res) => {
            const id = req.params.id
            const jobData = req.body
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...jobData,
                }
            }
            const result = await jobsCollection.updateOne(query, updateDoc, options

            )
            res.send(result)
        })


        //gets all bids for a user by email from db
        app.get('/my-bids/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            // const query = { email }
            const result = await bidsCollection.find(query).toArray()
            res.send(result)
        })


        //gets all bid requests from db for job owner
        app.get('/bid-requests/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            // in db buyer is a object so objects value need to access with quotation 
            const query = { 'buyer.email': email }
            const result = await bidsCollection.find(query).toArray()
            res.send(result)
        })

        // update bid status

        app.patch('/bid/:id', async (req, res) => {
            const id = req.params.id
            const status = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: status,
            }
            const result = await bidsCollection.updateOne(query, updateDoc)
            res.send(result)

        })

        //get all the jobs data from db for pagination
        app.get("/all-jobs", async (req, res) => {
            const size = parseInt(req.query.size)
            const page = parseInt(req.query.page) - 1
            const filter = req.query.filter
            const sort = req.query.sort
            const search = req.query.search
            console.log(page, size)


            let query = {
                job_title: { $regex: search, $options: 'i' }
            }
            if (filter) query.category = filter;

            let options = {}
            if (sort) options = {
                sort: { deadline: sort === 'asc' ? 1 : -1 }
            }


            const result = await jobsCollection.find(query, options).skip(page * size).limit(size).toArray();
            res.send(result)
        })



        //get all the jobs data count from db
        app.get("/jobs-count", async (req, res) => {
            const filter = req.query.filter
            const search = req.query.search
            let query = {
                job_title: { $regex: search, $options: 'i' }
            }
            if (filter) query.category = filter;
            const count = await jobsCollection.countDocuments(query)
            res.send({ count })
        })





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        console.log("I LOVE you")
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